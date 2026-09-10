import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { VoiceTask } from './entities/voice-task.entity';
import { CreateTtsDto, QueryVoiceHistoryDto } from './dto/voice.dto';
import { CreditsService } from '../credits/credits.service';
import { CreditBusinessType } from '../credits/types/credits.types';

export interface VoiceItem {
  voice_id: string;
  name: string;
  language: string;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  public static readonly TTS_UNIT_COST = 20;
  public static readonly STT_UNIT_COST = 20;

  // 内置备用音色字典（在上游临时异常或未配置网络时保底）
  private cachedVoices: VoiceItem[] = [
    { voice_id: 'eve', name: 'Eve', language: 'multilingual' },
    { voice_id: 'ara', name: 'Ara', language: 'multilingual' },
    { voice_id: 'altair', name: 'Altair', language: 'multilingual' },
    { voice_id: 'atlas', name: 'Atlas', language: 'multilingual' },
    { voice_id: 'aurora', name: 'Aurora', language: 'multilingual' },
    { voice_id: 'carina', name: 'Carina', language: 'multilingual' },
    { voice_id: 'celeste', name: 'Celeste', language: 'multilingual' },
    { voice_id: 'cosmo', name: 'Cosmo', language: 'multilingual' },
    { voice_id: 'helios', name: 'Helios', language: 'multilingual' },
    { voice_id: 'leo', name: 'Leo', language: 'multilingual' },
    { voice_id: 'luna', name: 'Luna', language: 'multilingual' },
    { voice_id: 'orion', name: 'Orion', language: 'multilingual' },
    { voice_id: 'rex', name: 'Rex', language: 'multilingual' },
    { voice_id: 'sirius', name: 'Sirius', language: 'multilingual' },
    { voice_id: 'zenith', name: 'Zenith', language: 'multilingual' },
  ];

  constructor(
    @InjectRepository(VoiceTask)
    private readonly voiceTaskRepo: Repository<VoiceTask>,
    private readonly creditsService: CreditsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 获取音频本地转存目录
   */
  public getUploadDir(): string {
    return path.resolve(process.cwd(), 'uploads', 'voice');
  }

  private getUpstreamConfig() {
    const baseUrl =
      this.configService.get<string>('GROK2API_BASE_URL') ||
      this.configService.get<string>('VOICE_API_BASE_URL') ||
      'http://1.15.171.111:8000/v1';
    const apiKey =
      this.configService.get<string>('GROK2API_KEY') ||
      this.configService.get<string>('GROK2API_API_KEY') ||
      this.configService.get<string>('VOICE_API_KEY');
    return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
  }

  /**
   * 获取可用音色列表
   */
  async getVoices(model?: string): Promise<{ voices: VoiceItem[] }> {
    try {
      const { baseUrl, apiKey } = this.getUpstreamConfig();
      const url = `${baseUrl}/tts/voices${model ? `?model=${encodeURIComponent(model)}` : ''}`;
      const res = await fetch(url, {
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });

      if (res.ok) {
        const data = (await res.json()) as { voices?: VoiceItem[] };
        if (Array.isArray(data.voices) && data.voices.length > 0) {
          this.cachedVoices = data.voices;
          return { voices: this.cachedVoices };
        }
      }
    } catch (err) {
      this.logger.warn(`获取上游音色列表失败，回退缓存字典: ${err}`);
    }
    return { voices: this.cachedVoices };
  }

  /**
   * 提交 TTS 文本转语音任务
   */
  async createTts(userId: string, dto: CreateTtsDto): Promise<VoiceTask> {
    const model = dto.model || 'grok-voice-think-fast-1.0';
    const costCredits = VoiceService.TTS_UNIT_COST;

    // 1. 初始化并持久化任务记录 (状态: pending)
    const task = this.voiceTaskRepo.create({
      userId,
      type: 'tts',
      model,
      voiceId: dto.voiceId,
      language: dto.language || 'zh',
      speed: dto.speed || 1.0,
      text: dto.text,
      costCredits,
      status: 'pending',
    });
    const savedTask = await this.voiceTaskRepo.save(task);

    // 2. 扣减 20 积分
    await this.creditsService.deductDirectCredits({
      userId,
      amount: costCredits,
      businessType: CreditBusinessType.VOICE_TTS,
      businessId: savedTask.id,
      modelId: model,
      remark: `语音合成：${dto.text.slice(0, 30)}`,
    });

    try {
      // 3. 调用上游 TTS 接口
      const { baseUrl, apiKey } = this.getUpstreamConfig();
      const upstreamUrl = `${baseUrl}/tts`;

      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          text: dto.text,
          voice_id: dto.voiceId,
          language: dto.language || 'zh',
          speed: dto.speed || 1.0,
          output_format: { codec: 'mp3' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`上游语音合成异常 (${response.status}): ${errText}`);
      }

      // 4. 读取音频二进制流并本地落盘
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.byteLength === 0) {
        throw new Error('上游返回音频数据为空');
      }

      const uploadDir = this.getUploadDir();
      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `tts_${savedTask.id}.mp3`;
      const targetPath = path.join(uploadDir, filename);
      await fs.writeFile(targetPath, buffer);

      // 5. 更新任务状态为成功
      savedTask.status = 'success';
      savedTask.audioUrl = `/voice/media/${filename}`;
      return await this.voiceTaskRepo.save(savedTask);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`TTS 语音合成失败: ${msg}`);

      // 标记失败
      savedTask.status = 'failed';
      savedTask.errorMessage = msg;
      await this.voiceTaskRepo.save(savedTask);

      // 全额退款
      await this.creditsService.refundDirectCredits({
        userId,
        amount: costCredits,
        businessType: CreditBusinessType.VOICE_TTS,
        businessId: savedTask.id,
        modelId: model,
        remark: `语音合成失败退款：${msg.slice(0, 50)}`,
      });

      throw new BadRequestException(`语音合成失败: ${msg}`);
    }
  }

  /**
   * 提交 STT 语音识别转文字任务
   */
  async createStt(
    userId: string,
    file: Express.Multer.File,
    language?: string,
    model?: string,
  ): Promise<VoiceTask> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('请上传有效的音频文件');
    }

    const sttModel = model || 'grok-stt';
    const lang = language || 'zh';
    const costCredits = VoiceService.STT_UNIT_COST;

    // 1. 初始化并持久化任务记录 (状态: pending)
    const task = this.voiceTaskRepo.create({
      userId,
      type: 'stt',
      model: sttModel,
      language: lang,
      speed: 1.0,
      text: '', // 待识别填入
      costCredits,
      status: 'pending',
    });
    const savedTask = await this.voiceTaskRepo.save(task);

    // 2. 扣除 20 积分
    await this.creditsService.deductDirectCredits({
      userId,
      amount: costCredits,
      businessType: CreditBusinessType.VOICE_STT,
      businessId: savedTask.id,
      modelId: sttModel,
      remark: '语音识别转文字',
    });

    try {
      // 3. 转存用户上传的原音频文件，便于前端复听
      const extMatch = file.originalname?.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
      const uploadDir = this.getUploadDir();
      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `stt_${savedTask.id}.${ext}`;
      const targetPath = path.join(uploadDir, filename);
      await fs.writeFile(targetPath, file.buffer);
      savedTask.audioUrl = `/voice/media/${filename}`;

      // 4. 调用上游 STT 接口
      const { baseUrl, apiKey } = this.getUpstreamConfig();
      const upstreamUrl = `${baseUrl}/stt`;

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'audio/mpeg' }),
        file.originalname || `audio.${ext}`,
      );
      formData.append('model', sttModel);
      formData.append('language', lang);

      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`上游语音识别异常 (${response.status}): ${errText}`);
      }

      const result = (await response.json()) as {
        text?: string;
        duration?: number;
      };

      const recognizedText = result.text?.trim() || '';
      savedTask.status = 'success';
      savedTask.text = recognizedText;
      savedTask.duration = result.duration || null;
      return await this.voiceTaskRepo.save(savedTask);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`STT 语音识别失败: ${msg}`);

      savedTask.status = 'failed';
      savedTask.errorMessage = msg;
      await this.voiceTaskRepo.save(savedTask);

      // 全额退款
      await this.creditsService.refundDirectCredits({
        userId,
        amount: costCredits,
        businessType: CreditBusinessType.VOICE_STT,
        businessId: savedTask.id,
        modelId: sttModel,
        remark: `语音识别失败退款：${msg.slice(0, 50)}`,
      });

      throw new BadRequestException(`语音识别失败: ${msg}`);
    }
  }

  /**
   * 分页查询当前用户的语音历史任务
   */
  async getHistory(
    userId: string,
    query: QueryVoiceHistoryDto,
  ): Promise<{
    items: VoiceTask[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(Math.max(1, query.pageSize || 20), 50);
    const skip = (page - 1) * pageSize;

    const qb = this.voiceTaskRepo.createQueryBuilder('task');
    qb.where('task.userId = :userId', { userId });

    if (query.type && query.type !== 'all') {
      qb.andWhere('task.type = :type', { type: query.type });
    }

    qb.orderBy('task.createdAt', 'DESC');
    qb.skip(skip);
    qb.take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  /**
   * 安全获取本地音频文件物理路径
   */
  async getMediaFilePath(filename: string): Promise<string> {
    if (!/^[a-zA-Z0-9_.-]+\.(mp3|wav|m4a|webm|ogg|aac)$/i.test(filename)) {
      throw new BadRequestException('非法的音频文件名');
    }

    const filePath = path.join(this.getUploadDir(), filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw new NotFoundException('请求的音频文件不存在');
    }
  }
}
