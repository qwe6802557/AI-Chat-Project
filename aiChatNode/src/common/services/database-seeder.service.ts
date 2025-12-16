import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserService } from '../../modules/user/user.service';
import { AiProviderService } from '../../modules/ai-provider/ai-provider.service';
import { AiModelService } from '../../modules/ai-provider/ai-model.service';

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
      // 检查是否已存在供应商
      const existingProviders = await this.aiProviderService.findAll();
      if (existingProviders.length > 0) {
        this.logger.log('AI 供应商数据已存在，跳过初始化');
        return;
      }

      this.logger.log('开始初始化 AI 供应商和模型...');

      // 创建 Claude 供应商
      const claudeProvider = await this.aiProviderService.create({
        name: 'Claude',
        description: 'Anthropic Claude AI - 第三方代理服务',
        website: 'https://anthropic.com',
        isActive: true,
      });

      this.logger.log(`Claude 供应商创建成功: ${claudeProvider.id}`);

      // 创建 Claude 模型
      await this.aiModelService.create({
        providerId: claudeProvider.id,
        modelName: 'Claude Opus 4.5',
        modelId: 'claude-opus-4-5-20251101',
        inputPrice: 0.003, // $0.003 per 1K tokens
        outputPrice: 0.015, // $0.015 per 1K tokens
        contextLength: 200000, // 200K tokens
        maxOutput: 8192, // 8K tokens
        availability: 99.9,
        tps: 100,
        description: 'Anthropic的最新模型',
        isActive: true,
      });

      this.logger.log('AI 供应商和模型初始化完成');
    } catch (error) {
      this.logger.error('AI 供应商初始化失败:', error);
      // 不抛出错误
    }
  }
}
