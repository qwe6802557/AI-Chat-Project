import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { VideoGeneration } from './entities/video-generation.entity';
import { CreateVideoGenerationDto } from './dto/create-video-generation.dto';
import { CreditsService } from '../credits/credits.service';
import { UserService } from '../user/user.service';
import { CreditBusinessType } from '../credits/types/credits.types';

export interface SiliconFlowSubmitResponse {
  requestId?: string;
  code?: number;
  message?: string;
}

export interface SiliconFlowStatusResponse {
  code?: number;
  message?: string;
  status?: 'Succeed' | 'InQueue' | 'InProgress' | 'Failed' | string;
  reason?: string;
  results?: {
    videos?: Array<{
      url?: string;
    }>;
  };
}

@Injectable()
export class VideoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoService.name);
  private readonly activePollers = new Map<string, NodeJS.Timeout>();
  private isDestroyed = false;

  constructor(
    @InjectRepository(VideoGeneration)
    private readonly videoRepo: Repository<VideoGeneration>,
    private readonly configService: ConfigService,
    private readonly creditsService: CreditsService,
    private readonly userService: UserService,
  ) {}

  /**
   * 服务启动时恢复所有未完结任务的状态轮询
   */
  async onModuleInit() {
    try {
      const pendingTasks = await this.videoRepo.find({
        where: [
          { status: 'pending' },
          { status: 'processing' },
        ],
        take: 50,
      });

      for (const task of pendingTasks) {
        if (task.upstreamTaskId) {
          this.trackTaskProgress(task.id, task.upstreamTaskId, task.userId).catch(
            (err) => this.logger.error(`恢复视频任务 ${task.id} 轮询失败: ${err.message}`),
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`初始化视频轮询失败: ${err.message}`);
    }
  }

  /**
   * 模块卸载/测试清理时停止所有活跃轮询
   */
  onModuleDestroy() {
    this.isDestroyed = true;
    for (const timer of this.activePollers.values()) {
      clearTimeout(timer);
    }
    this.activePollers.clear();
  }

  /**
   * 本地视频持久化存储目录
   */
  private getUploadDir(): string {
    const root = process.env.UPLOAD_DIR?.trim() || 'uploads';
    return path.resolve(process.cwd(), root, 'videos');
  }

  /**
   * 获取 SiliconFlow API 凭证与端点
   */
  private getApiConfig() {
    const apiKey =
      this.configService.get<string>('SILICONFLOW_API_KEY') ||
      process.env.SILICONFLOW_API_KEY ||
      '';
    const baseUrl =
      this.configService.get<string>('SILICONFLOW_BASE_URL') ||
      process.env.SILICONFLOW_BASE_URL ||
      'https://api.siliconflow.cn/v1';

    return { apiKey: apiKey.trim(), baseUrl: baseUrl.replace(/\/+$/, '') };
  }

  /**
   * 创建并提交视频生成任务
   */
  async generateVideo(
    userId: string,
    dto: CreateVideoGenerationDto,
  ): Promise<VideoGeneration> {
    const { apiKey, baseUrl } = this.getApiConfig();
    if (!apiKey) {
      throw new BadRequestException('未配置 SILICONFLOW_API_KEY 视频服务凭证');
    }

    const hasImage = Boolean(dto.image && dto.image.trim().length > 0);
    // 默认模型：图生视频采用 I2V，文生视频采用 T2V
    const defaultModel = hasImage
      ? 'Wan-AI/Wan2.2-I2V-A14B'
      : 'Wan-AI/Wan2.2-T2V-A14B';
    const modelId = dto.model || defaultModel;

    const unitCredits = 200; // 单次固定消耗 200 积分
    const user = await this.userService.findById(userId);
    const isAdmin = user?.role === 'admin';

    // 检查积分
    if (!isAdmin) {
      const snapshot = await this.creditsService.getSnapshotForUser(userId);
      if (snapshot.remaining < unitCredits) {
        throw new BadRequestException(
          `积分不足，生成视频需要 ${unitCredits} 积分，当前剩余 ${snapshot.remaining} 积分`,
        );
      }
    }

    // 宽高比映射为上游支持的分辨率
    const aspectRatio = dto.aspect_ratio || '16:9';
    let imageSize = '1280x720';
    if (aspectRatio === '9:16') {
      imageSize = '720x1280';
    } else if (aspectRatio === '1:1') {
      imageSize = '960x960';
    }

    // 创建本地任务记录
    const task = this.videoRepo.create({
      userId,
      prompt: dto.prompt,
      modelId,
      imageUrl: hasImage ? dto.image : null,
      aspectRatio,
      duration: 5,
      costCredits: unitCredits,
      status: 'pending',
    });
    const savedTask = await this.videoRepo.save(task);

    // 预扣除积分
    if (unitCredits > 0) {
      await this.creditsService.deductDirectCredits({
        userId,
        amount: unitCredits,
        businessType: CreditBusinessType.VIDEO_GENERATION,
        businessId: savedTask.id,
        modelId,
        remark: `视频生成：${dto.prompt.slice(0, 30)}`,
      });
    }

    try {
      const submitUrl = `${baseUrl}/video/submit`;
      const requestPayload: Record<string, any> = {
        model: modelId,
        prompt: dto.prompt,
        image_size: imageSize,
      };
      if (hasImage) {
        requestPayload.image = dto.image;
      }

      const response = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`上游提交异常 (${response.status}): ${errorText}`);
      }

      const resData = (await response.json()) as SiliconFlowSubmitResponse;
      const requestId = resData.requestId;

      if (!requestId) {
        throw new Error(resData.message || '上游接口未返回有效的任务 requestId');
      }

      // 更新任务状态为处理中并记录 upstreamTaskId
      savedTask.status = 'processing';
      savedTask.upstreamTaskId = requestId;
      const updatedTask = await this.videoRepo.save(savedTask);

      // 启动异步跟踪
      this.trackTaskProgress(updatedTask.id, requestId, userId).catch((err) =>
        this.logger.error(`视频任务 ${updatedTask.id} 进度跟踪异常: ${err.message}`),
      );

      return updatedTask;
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`视频任务提交失败: ${msg}`, error?.stack);

      savedTask.status = 'failed';
      savedTask.errorMessage = msg;
      await this.videoRepo.save(savedTask);

      // 失败秒级全额返还积分
      if (unitCredits > 0) {
        await this.creditsService.refundDirectCredits({
          userId,
          amount: unitCredits,
          businessType: CreditBusinessType.VIDEO_GENERATION,
          businessId: savedTask.id,
          modelId,
          remark: `视频任务失败退款：${msg.slice(0, 50)}`,
        });
      }

      throw new BadRequestException(`提交视频生成任务失败: ${msg}`);
    }
  }

  /**
   * 异步轮询任务状态并在完成时持久化下载 MP4
   */
  async trackTaskProgress(
    taskId: string,
    upstreamRequestId: string,
    userId: string,
  ): Promise<void> {
    if (this.isDestroyed || this.activePollers.has(taskId)) {
      return;
    }

    const { apiKey, baseUrl } = this.getApiConfig();
    const statusUrl = `${baseUrl}/video/status`;
    const maxPollAttempts = 120; // 5秒一次，最多轮询10分钟
    let attempts = 0;

    const clearThisPoller = () => {
      const timer = this.activePollers.get(taskId);
      if (timer) clearTimeout(timer);
      this.activePollers.delete(taskId);
    };

    const scheduleNext = (delayMs: number) => {
      if (this.isDestroyed) {
        clearThisPoller();
        return;
      }
      const timer = setTimeout(poll, delayMs);
      this.activePollers.set(taskId, timer);
    };

    const poll = async () => {
      if (this.isDestroyed) {
        clearThisPoller();
        return;
      }

      try {
        attempts++;
        const response = await fetch(statusUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ requestId: upstreamRequestId }),
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.warn(`任务 ${taskId} 轮询响应 ${response.status}: ${errText}`);
          if (attempts < maxPollAttempts) {
            scheduleNext(5000);
            return;
          }
          throw new Error(`上游轮询接口异常: ${errText}`);
        }

        const resData = (await response.json()) as SiliconFlowStatusResponse;
        const status = resData.status;

        if (status === 'Succeed') {
          const videoUrl = resData.results?.videos?.[0]?.url;
          if (!videoUrl) {
            throw new Error('视频已生成完毕但未找到下载 URL');
          }

          // 将视频流持久化保存到本地
          const localVideoPath = await this.downloadAndSaveVideo(taskId, videoUrl);

          await this.videoRepo.update(taskId, {
            status: 'success',
            videoUrl: localVideoPath,
            errorMessage: null,
          });

          clearThisPoller();
          this.logger.log(`视频任务 ${taskId} 成功生成并持久化落盘: ${localVideoPath}`);
          return;
        }

        if (status === 'Failed') {
          const reason = resData.reason || resData.message || '生成失败';
          await this.videoRepo.update(taskId, {
            status: 'failed',
            errorMessage: reason,
          });

          // 失败自动全额退款
          await this.creditsService.refundDirectCredits({
            userId,
            amount: 200,
            businessType: CreditBusinessType.VIDEO_GENERATION,
            businessId: taskId,
            remark: `视频生成失败退款：${reason.slice(0, 50)}`,
          });

          clearThisPoller();
          this.logger.warn(`视频任务 ${taskId} 失败并已退款: ${reason}`);
          return;
        }

        // 仍在排队或生成中，继续轮询
        if (attempts < maxPollAttempts) {
          scheduleNext(5000);
        } else {
          // 超时处理
          await this.videoRepo.update(taskId, {
            status: 'failed',
            errorMessage: '视频生成任务排队超时，已自动退还积分',
          });

          await this.creditsService.refundDirectCredits({
            userId,
            amount: 200,
            businessType: CreditBusinessType.VIDEO_GENERATION,
            businessId: taskId,
            remark: '视频生成超时退款',
          });

          clearThisPoller();
        }
      } catch (err: any) {
        this.logger.error(`轮询视频任务 ${taskId} 发生异常: ${err.message}`);
        if (attempts < maxPollAttempts) {
          scheduleNext(5000);
        } else {
          clearThisPoller();
        }
      }
    };

    // 延迟 3 秒开始第一次轮询
    scheduleNext(3000);
  }

  /**
   * 流式下载远程视频并保存到本地磁盘
   */
  private async downloadAndSaveVideo(
    taskId: string,
    remoteUrl: string,
  ): Promise<string> {
    const uploadDir = this.getUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `video-${taskId}.mp4`;
    const targetPath = path.join(uploadDir, filename);

    const res = await fetch(remoteUrl);
    if (!res.ok || !res.body) {
      throw new Error(`下载远程视频文件失败 (${res.status})`);
    }

    const fileStream = createWriteStream(targetPath);
    // Node.js stream pipeline
    // @ts-ignore
    await pipeline(res.body, fileStream);

    return `/videos/media/${filename}`;
  }

  /**
   * 分页拉取历史记录
   */
  async getHistory(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: VideoGeneration[]; total: number; page: number; pageSize: number }> {
    const [list, total] = await this.videoRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { list, total, page, pageSize };
  }

  /**
   * 查询指定任务状态
   */
  async getTaskStatus(userId: string, taskId: string): Promise<VideoGeneration> {
    const task = await this.videoRepo.findOne({ where: { id: taskId, userId } });
    if (!task) {
      throw new NotFoundException('视频任务不存在');
    }
    return task;
  }

  /**
   * 获取本地媒体文件的绝对路径（供控制器发送流）
   */
  async getMediaFilePath(filename: string): Promise<string> {
    const safeName = path.basename(filename);
    const filePath = path.join(this.getUploadDir(), safeName);

    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw new NotFoundException(`请求的视频资源不存在: ${safeName}`);
    }
  }

  /**
   * 删除视频任务及本地文件
   */
  async deleteVideoTask(userId: string, taskId: string): Promise<{ success: boolean }> {
    const task = await this.videoRepo.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('未找到该视频任务');
    }

    const user = await this.userService.findById(userId);
    if (task.userId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException('无权删除此视频任务');
    }

    if (task.videoUrl) {
      const filename = path.basename(task.videoUrl);
      const filePath = path.join(this.getUploadDir(), filename);
      try {
        await fs.unlink(filePath);
      } catch (err: any) {
        this.logger.warn(`删除本地视频文件失败: ${err.message}`);
      }
    }

    await this.videoRepo.delete(taskId);
    return { success: true };
  }
}
