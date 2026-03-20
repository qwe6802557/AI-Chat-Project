import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserService } from '../../modules/user/user.service';
import { AiProviderService } from '../../modules/ai-provider/ai-provider.service';
import { AiModelService } from '../../modules/ai-provider/ai-model.service';
import type { AiProvider } from '../../modules/ai-provider/entities/ai-provider.entity';
import {
  DEFAULT_ZAIWEN_CHAT_MODEL,
  ZAIWEN_CHAT_MODEL_SEEDS,
} from '../../modules/ai-provider/constants/zaiwen-models';

/**
 * 数据库初始化服务
 * 应用启动时自动执行数据初始化
 */
@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(
    private readonly userService: UserService,
    private readonly aiProviderService: AiProviderService,
    private readonly aiModelService: AiModelService,
  ) {}

  /**
   * 模块初始化时执行
   */
  async onModuleInit() {
    this.logger.log('开始执行数据库初始化...');

    try {
      // 初始化超级管理员
      await this.userService.initSuperAdmin();

      // 初始化AI供应商和模型
      await this.seedAiProviders();

      this.logger.log('数据库初始化完成！');
    } catch (error) {
      this.logger.error('数据库初始化失败:', error);
    }
  }

  /**
   * 初始化 AI 供应商和模型种子数据
   */
  private async seedAiProviders() {
    try {
      this.logger.log('开始校验 AI 供应商和模型...');

      const claudeProvider = await this.ensureProvider({
        name: 'Claude',
        description: 'Anthropic Claude AI - 第三方代理服务',
        website: 'https://anthropic.com',
      });

      await this.ensureModel({
        providerId: claudeProvider.id,
        modelName: 'Claude Opus 4.5',
        modelId: 'claude-opus-4-5-20251101',
        inputPrice: 0.003,
        outputPrice: 0.015,
        contextLength: 200000,
        maxOutput: 8192,
        availability: 99.9,
        tps: 100,
        description: 'Anthropic 的兼容接入模型',
      });

      const zaiwenProvider = await this.ensureProvider({
        name: 'Zaiwen',
        description: '在问 OpenAI 兼容接口供应商',
        website: 'https://www.zaiwenai.com',
      });

      for (const model of ZAIWEN_CHAT_MODEL_SEEDS) {
        await this.ensureModel({
          providerId: zaiwenProvider.id,
          modelName: model.modelId,
          modelId: model.modelId,
          inputPrice: model.inputMultiplier,
          outputPrice: model.outputMultiplier,
          contextLength: 0,
          maxOutput: 0,
          availability: 99.9,
          tps: 0,
          description: `在问官方支持模型，输入倍率 ${model.inputMultiplier}，输出倍率 ${model.outputMultiplier}`,
        });
      }

      this.logger.log('AI 供应商和模型校验完成');
    } catch (error) {
      this.logger.error('AI 供应商初始化失败:', error);
      // 不抛出错误
    }
  }

  /**
   * 确保供应商存在
   */
  private async ensureProvider(payload: {
    name: string;
    description: string;
    website: string;
  }): Promise<AiProvider> {
    const existingProvider = await this.aiProviderService.findByName(payload.name);
    if (existingProvider) {
      await this.aiProviderService.update(existingProvider.id, {
        description: payload.description,
        website: payload.website,
        isActive: true,
      });
      this.logger.log(`供应商已存在，已校准配置: ${payload.name}`);
      return await this.aiProviderService.findOne(existingProvider.id);
    }

    const provider = await this.aiProviderService.create({
      name: payload.name,
      description: payload.description,
      website: payload.website,
      isActive: true,
    });

    this.logger.log(`供应商创建成功: ${payload.name} (${provider.id})`);
    return provider;
  }

  /**
   * 确保模型存在
   */
  private async ensureModel(payload: {
    providerId: string;
    modelName: string;
    modelId: string;
    inputPrice: number;
    outputPrice: number;
    contextLength: number;
    maxOutput: number;
    availability: number;
    tps: number;
    description: string;
  }): Promise<void> {
    try {
      const existingModel = await this.aiModelService.findByModelId(payload.modelId);
      await this.aiModelService.update(existingModel.id, {
        providerId: payload.providerId,
        modelName: payload.modelName,
        inputPrice: payload.inputPrice,
        outputPrice: payload.outputPrice,
        contextLength: payload.contextLength,
        maxOutput: payload.maxOutput,
        availability: payload.availability,
        tps: payload.tps,
        description: payload.description,
        isActive: true,
      });
      this.logger.log(`模型已存在，已校准配置: ${payload.modelId}`);
      return;
    } catch {
      await this.aiModelService.create({
        providerId: payload.providerId,
        modelName: payload.modelName,
        modelId: payload.modelId,
        inputPrice: payload.inputPrice,
        outputPrice: payload.outputPrice,
        contextLength: payload.contextLength,
        maxOutput: payload.maxOutput,
        availability: payload.availability,
        tps: payload.tps,
        description: payload.description,
        isActive: true,
      });

      this.logger.log(`模型创建成功: ${payload.modelId}`);
    }
  }
}
