import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ImageGeneration } from './entities/image-generation.entity';
import { CreateImageGenerationDto } from './dto/create-image-generation.dto';
import { CreditsService } from '../credits/credits.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { UserService } from '../user/user.service';
import { CreditBusinessType } from '../credits/types/credits.types';

export interface UpstreamImageItem {
  url?: string;
  b64_json?: string;
}

export interface UpstreamImageResponse {
  created?: number;
  data?: UpstreamImageItem[];
}

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    @InjectRepository(ImageGeneration)
    private readonly imageRepo: Repository<ImageGeneration>,
    private readonly configService: ConfigService,
    private readonly creditsService: CreditsService,
    private readonly aiModelService: AiModelService,
    private readonly userService: UserService,
  ) {}

  /**
   * 获取本地图片转存目录
   */
  private getUploadDir(): string {
    const root = process.env.UPLOAD_DIR?.trim() || 'uploads';
    return path.resolve(process.cwd(), root, 'images');
  }

  /**
   * 生成图片主流程：积分校验、扣费、上游调用、本地转存
   */
  async generateImages(
    userId: string,
    dto: CreateImageGenerationDto,
  ): Promise<ImageGeneration> {
    const defaultModel =
      this.configService.get<string>('DEFAULT_IMAGE_MODEL') ||
      'grok-imagine-image-2.0';
    const modelId = dto.model || defaultModel;

    const model = await this.aiModelService.findByModelIdOrNull(modelId);
    const unitCredits = model ? model.creditCost : 100;
    const numGenerations = dto.n ?? 1;
    const totalCost = unitCredits * numGenerations;

    const user = await this.userService.findById(userId);
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && totalCost > 0) {
      const snapshot = await this.creditsService.getSnapshotForUser(userId);
      if (snapshot.remaining < totalCost) {
        throw new BadRequestException(
          `积分不足，本次生成需要 ${totalCost} 积分，剩余 ${snapshot.remaining} 积分`,
        );
      }
    }

    const task = this.imageRepo.create({
      userId,
      prompt: dto.prompt,
      modelId,
      aspectRatio: dto.aspect_ratio || '1:1',
      resolution: dto.resolution || '1k',
      quality: dto.quality || 'medium',
      numGenerations,
      imageUrls: [],
      costCredits: totalCost,
      status: 'pending',
    });
    const savedTask = await this.imageRepo.save(task);

    if (totalCost > 0) {
      await this.creditsService.deductDirectCredits({
        userId,
        amount: totalCost,
        businessType: CreditBusinessType.IMAGE_GENERATION,
        businessId: savedTask.id,
        modelId,
        remark: `生图：${dto.prompt.slice(0, 30)}`,
      });
    }

    try {
      const baseUrl =
        this.configService.get<string>('IMAGE_API_BASE_URL') ||
        this.configService.get<string>('GROK2API_BASE_URL') ||
        'http://1.15.171.111:8000/v1';
      const apiKey =
        this.configService.get<string>('IMAGE_API_KEY') ||
        this.configService.get<string>('GROK2API_KEY') ||
        this.configService.get<string>('GROK2API_API_KEY');

      const upstreamUrl = `${baseUrl.replace(/\/+$/, '')}/images/generations`;

      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelId,
          prompt: dto.prompt,
          n: numGenerations,
          aspect_ratio: dto.aspect_ratio || '1:1',
          resolution: dto.resolution || '1k',
          quality: dto.quality || 'medium',
          response_format: 'url',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`上游生图响应异常 (${response.status}): ${errorText}`);
      }

      const resData = (await response.json()) as UpstreamImageResponse;
      const items = resData.data || [];

      if (items.length === 0) {
        throw new Error('上游接口未返回任何图片数据');
      }

      const localUrls: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const savedUrl = await this.downloadAndSaveImage(
          savedTask.id,
          i,
          item,
          baseUrl,
        );
        localUrls.push(savedUrl);
      }

      savedTask.status = 'success';
      savedTask.imageUrls = localUrls;
      return await this.imageRepo.save(savedTask);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`生图任务失败: ${msg}`, error instanceof Error ? error.stack : undefined);

      savedTask.status = 'failed';
      savedTask.errorMessage = msg;
      await this.imageRepo.save(savedTask);

      if (totalCost > 0) {
        await this.creditsService.refundDirectCredits({
          userId,
          amount: totalCost,
          businessType: CreditBusinessType.IMAGE_GENERATION,
          businessId: savedTask.id,
          modelId,
          remark: `生图失败退款：${msg.slice(0, 50)}`,
        });
      }

      throw new BadRequestException(`生图失败: ${msg}`);
    }
  }

  /**
   * 将远端生图数据转存到本地磁盘，并返回访问相对路径
   */
  private async downloadAndSaveImage(
    taskId: string,
    index: number,
    item: UpstreamImageItem,
    baseUrl?: string,
  ): Promise<string> {
    const uploadDir = this.getUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${taskId}_${index}.png`;
    const targetPath = path.join(uploadDir, filename);

    if (item.b64_json) {
      const buffer = Buffer.from(item.b64_json, 'base64');
      await fs.writeFile(targetPath, buffer);
    } else if (item.url) {
      let downloadUrl = item.url;
      if (baseUrl) {
        try {
          const upstreamOrigin = new URL(baseUrl).origin;
          const parsed = new URL(downloadUrl, upstreamOrigin);
          if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
            downloadUrl = `${upstreamOrigin}${parsed.pathname}${parsed.search}`;
          }
        } catch {
          // ignore parsing error
        }
      }

      const res = await fetch(downloadUrl);
      if (!res.ok) {
        throw new Error(`无法下载远端图片: ${downloadUrl}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      await fs.writeFile(targetPath, Buffer.from(arrayBuffer));
    } else {
      throw new Error('图片数据缺失 url 与 b64_json');
    }

    return `/images/media/${filename}`;
  }

  /**
   * 分页拉取当前用户的生成历史记录
   */
  async getHistory(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{
    items: ImageGeneration[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const take = Math.min(Math.max(1, pageSize), 50);
    const skip = (Math.max(1, page) - 1) * take;

    const [items, total] = await this.imageRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return {
      items,
      total,
      page,
      pageSize: take,
      hasMore: skip + items.length < total,
    };
  }

  /**
   * 安全获取本地转存图片文件物理路径
   */
  async getMediaFilePath(filename: string): Promise<string> {
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(filename)) {
      throw new BadRequestException('非法的图片文件名');
    }

    const filePath = path.join(this.getUploadDir(), filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw new NotFoundException('请求的图片不存在');
    }
  }
}
