import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserService } from '../../modules/user/user.service';
import { AiProviderService } from '../../modules/ai-provider/ai-provider.service';
import { AiModelService } from '../../modules/ai-provider/ai-model.service';
import type { AiProvider } from '../../modules/ai-provider/entities/ai-provider.entity';
import {
  DEFAULT_MODEL_BILLING_MODE,
  DEFAULT_MODEL_CREDIT_COST,
  DEFAULT_CHAT_BILLING_MODE,
  DEFAULT_CHAT_MODEL_CREDIT_COST,
  CreditBusinessType,
} from '../../modules/credits/types/credits.types';
import { CreditsService } from '../../modules/credits/credits.service';

interface SeedSummary {
  createdProviders: number;
  skippedProviders: number;
  createdModels: number;
  skippedModels: number;
}
/**
 * 数据库初始化服务
 * 应用启动时自动执行数据初始化
 */
@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);
  private readonly shouldFailFast = process.env.NODE_ENV === 'production';

  constructor(
    private readonly userService: UserService,
    private readonly aiProviderService: AiProviderService,
    private readonly aiModelService: AiModelService,
    private readonly creditsService: CreditsService,
  ) {}

  /**
   * 模块初始化时执行
   */
  async onModuleInit() {
    this.logger.log('开始执行数据库初始化...');

    try {
      await this.userService.initSuperAdmin();
      this.logger.log('超级管理员初始化完成');

      // 为超级管理员配置足额测试积分（无限积分）
      const admin = await this.userService.findByUsername('admin');
      if (admin) {
        const snapshot = await this.creditsService.getSnapshotForUser(admin.id);
        if (snapshot.remaining < 10000000) {
          await this.creditsService.grantCredits({
            userId: admin.id,
            amount: 999999999,
            businessType: CreditBusinessType.SYSTEM,
            remark: '管理员默认测试无限积分',
          });
          this.logger.log('已为超级管理员注入默认测试积分: 999999999');
        }
      }

      const summary = await this.seedAiProviders();
      this.logger.log(
        `AI 种子校验完成: 新建供应商 ${summary.createdProviders} 个，跳过已存在供应商 ${summary.skippedProviders} 个，新建模型 ${summary.createdModels} 个，跳过已存在模型 ${summary.skippedModels} 个`,
      );

      this.logger.log('数据库初始化完成！');
    } catch (error) {
      this.logger.error('数据库初始化失败:', error);
      if (this.shouldFailFast) {
        throw error;
      }
      this.logger.warn(
        '当前处于非生产环境，应用将继续启动，但数据库初始化未完全成功',
      );
    }
  }

  /**
   * 初始化 AI 供应商和模型种子数据
   * 当前阶段：仅注册 Grok2API 供应商及 grok-chat-fast / grok-imagine-image-lite 等可用模型
   * 在问与 Claude 相关 seed 已暂时注释，数据库历史记录需通过 isActive=false 脚本同步禁用
   */
  private async seedAiProviders(): Promise<SeedSummary> {
    this.logger.log('开始校验 AI 供应商和模型...');

    const summary: SeedSummary = {
      createdProviders: 0,
      skippedProviders: 0,
      createdModels: 0,
      skippedModels: 0,
    };

    // ===== Claude 供应商及其模型（暂时注释，后续如需恢复请取消注释）=====
    // const claudeProviderResult = await this.ensureProvider({
    //   name: 'Claude',
    //   description: 'Anthropic Claude AI - 第三方代理服务',
    //   website: 'https://anthropic.com',
    // });
    // summary[
    //   claudeProviderResult.created ? 'createdProviders' : 'skippedProviders'
    // ] += 1;
    //
    // const claudeModelResult = await this.ensureModel({
    //   providerId: claudeProviderResult.provider.id,
    //   modelName: 'Claude Opus 4.5',
    //   modelId: 'claude-opus-4-5-20251101',
    //   inputPrice: 0.003,
    //   outputPrice: 0.015,
    //   contextLength: 200000,
    //   maxOutput: 8192,
    //   availability: 99.9,
    //   tps: 100,
    //   description: 'Anthropic 的兼容接入模型',
    //   billingMode: DEFAULT_MODEL_BILLING_MODE,
    //   creditCost: DEFAULT_MODEL_CREDIT_COST,
    // });
    // summary[
    //   claudeModelResult === 'created' ? 'createdModels' : 'skippedModels'
    // ] += 1;

    // ===== Zaiwen 供应商及其模型种子（暂时注释，ZAIWEN_CHAT_MODEL_SEEDS 已置空数组）=====
    // const zaiwenProviderResult = await this.ensureProvider({
    //   name: 'Zaiwen',
    //   description: '在问 OpenAI 兼容接口供应商',
    //   website: 'https://www.zaiwenai.com',
    // });
    // summary[
    //   zaiwenProviderResult.created ? 'createdProviders' : 'skippedProviders'
    // ] += 1;
    //
    // for (const model of ZAIWEN_CHAT_MODEL_SEEDS) {
    //   const result = await this.ensureModel({
    //     providerId: zaiwenProviderResult.provider.id,
    //     modelName: model.modelId,
    //     modelId: model.modelId,
    //     inputPrice: model.inputMultiplier,
    //     outputPrice: model.outputMultiplier,
    //     contextLength: 0,
    //     maxOutput: 0,
    //     availability: 99.9,
    //     tps: 0,
    //     description: `在问官方支持模型，输入倍率 ${model.inputMultiplier}，输出倍率 ${model.outputMultiplier}`,
    //     billingMode: DEFAULT_MODEL_BILLING_MODE,
    //     creditCost: resolveZaiwenModelCreditCost(model.modelId),
    //   });
    //   summary[result === 'created' ? 'createdModels' : 'skippedModels'] += 1;
    // }

    // ===== Grok2API 供应商及模型种子 =====
    const grok2apiProviderResult = await this.ensureProvider({
      name: 'Grok2API',
      description: '本机 Grok2API OpenAI 兼容服务',
      website: 'http://127.0.0.1:18000',
    });
    summary[
      grok2apiProviderResult.created ? 'createdProviders' : 'skippedProviders'
    ] += 1;

    const GROK2API_CHAT_MODELS = [
      {
        modelId: 'grok-chat-fast',
        modelName: 'Grok Chat Fast',
        description: '本机 Grok2API 快速聊天模型',
        sortOrder: 1,
        isActive: true,
      },
    ];

    const GROK2API_IMAGE_MODELS = [
      {
        modelId: 'grok-imagine-image-lite',
        modelName: 'Grok Imagine Image Lite',
        description: 'Grok Web 图片生成轻量模型，支持 n、宽高比、1k/2k',
        sortOrder: 1,
        isActive: true,
        category: 'image' as const,
        creditCost: 100,
      },
    ];

    // 显式下架已停用/不可用的历史模型
    const DEPRECATED_MODEL_IDS = [
      'grok-4.3',
      'grok-build-0.1',
      'grok-4.5',
      'grok-4.6',
      'grok-4.7',
      'grok-composer-2.5-fast',
      'grok-imagine-image-2.0',
      'moonshotai/Kimi-K3',
    ];
    for (const deprecatedId of DEPRECATED_MODEL_IDS) {
      try {
        const existing = await this.aiModelService.findByModelIdOrNull(deprecatedId);
        if (existing && existing.isActive) {
          await this.aiModelService.update(existing.id, { isActive: false });
          this.logger.log(`已下架不可用模型: ${deprecatedId}`);
        }
      } catch (err) {
        this.logger.warn(`下架模型 ${deprecatedId} 失败: ${err}`);
      }
    }

    for (const model of GROK2API_CHAT_MODELS) {
      const result = await this.ensureModel({
        providerId: grok2apiProviderResult.provider.id,
        modelName: model.modelName,
        modelId: model.modelId,
        inputPrice: 0,
        outputPrice: 0,
        contextLength: 0,
        maxOutput: 0,
        availability: 99.9,
        tps: 0,
        description: model.description,
        billingMode: DEFAULT_CHAT_BILLING_MODE,
        creditCost: DEFAULT_CHAT_MODEL_CREDIT_COST,
        sortOrder: model.sortOrder,
        isActive: model.isActive,
        category: 'chat',
      });
      summary[result === 'created' ? 'createdModels' : 'skippedModels'] += 1;
    }

    for (const model of GROK2API_IMAGE_MODELS) {
      const result = await this.ensureModel({
        providerId: grok2apiProviderResult.provider.id,
        modelName: model.modelName,
        modelId: model.modelId,
        inputPrice: 0,
        outputPrice: 0,
        contextLength: 0,
        maxOutput: 0,
        availability: 100,
        tps: 0,
        description: model.description,
        billingMode: DEFAULT_MODEL_BILLING_MODE,
        creditCost: model.creditCost,
        sortOrder: model.sortOrder,
        isActive: model.isActive,
        category: model.category,
      });
      summary[result === 'created' ? 'createdModels' : 'skippedModels'] += 1;
    }

    // ===== Zhipu (智谱 AI) 供应商及模型种子 =====
    const zhipuProviderResult = await this.ensureProvider({
      name: 'Zhipu',
      description: '智谱 AI 大模型开放平台 (BigModel)',
      website: 'https://open.bigmodel.cn',
    });
    summary[
      zhipuProviderResult.created ? 'createdProviders' : 'skippedProviders'
    ] += 1;

    const ZHIPU_CHAT_MODELS = [
      {
        modelId: 'glm-4-flash',
        modelName: 'GLM-4-Flash',
        description: '智谱 AI 官方永久免费通用大模型，毫秒级快速响应与日常通用问答',
        sortOrder: 8,
        isActive: true,
      },
    ];

    for (const model of ZHIPU_CHAT_MODELS) {
      const result = await this.ensureModel({
        providerId: zhipuProviderResult.provider.id,
        modelName: model.modelName,
        modelId: model.modelId,
        inputPrice: 0,
        outputPrice: 0,
        contextLength: 128000,
        maxOutput: 4096,
        availability: 99.9,
        tps: 60,
        description: model.description,
        billingMode: DEFAULT_CHAT_BILLING_MODE,
        creditCost: DEFAULT_CHAT_MODEL_CREDIT_COST,
        sortOrder: model.sortOrder,
        isActive: model.isActive,
        category: 'chat',
      });
      summary[result === 'created' ? 'createdModels' : 'skippedModels'] += 1;
    }

    // ===== SiliconFlow (硅基流动) 供应商及模型种子 =====
    const siliconFlowProviderResult = await this.ensureProvider({
      name: 'SiliconFlow',
      description: '硅基流动 SiliconCloud 开源模型服务',
      website: 'https://cloud.siliconflow.cn',
    });
    summary[
      siliconFlowProviderResult.created ? 'createdProviders' : 'skippedProviders'
    ] += 1;

    const SILICONFLOW_CHAT_MODELS = [
      {
        modelId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
        modelName: 'DeepSeek-R1-Distill (7B)',
        description: '硅基流动 DeepSeek-R1 蒸馏模型，具备强大深度思考与思维链推导能力',
        sortOrder: 9,
        isActive: true,
      },
      {
        modelId: 'Qwen/Qwen2.5-Coder-7B-Instruct',
        modelName: 'Qwen2.5-Coder (7B)',
        description: '硅基流动通义千问代码特化模型，专注算法编写、架构设计与工程调试',
        sortOrder: 10,
        isActive: true,
      },
    ];

    for (const model of SILICONFLOW_CHAT_MODELS) {
      const result = await this.ensureModel({
        providerId: siliconFlowProviderResult.provider.id,
        modelName: model.modelName,
        modelId: model.modelId,
        inputPrice: 0,
        outputPrice: 0,
        contextLength: 128000,
        maxOutput: 4096,
        availability: 99.9,
        tps: 50,
        description: model.description,
        billingMode: DEFAULT_CHAT_BILLING_MODE,
        creditCost: DEFAULT_CHAT_MODEL_CREDIT_COST,
        sortOrder: model.sortOrder,
        isActive: model.isActive,
        category: 'chat',
      });
      summary[result === 'created' ? 'createdModels' : 'skippedModels'] += 1;
    }

    // ===== OurFreeModel (dsh-our-free-model) 本地免密网关通道 =====
    const ofmProviderResult = await this.ensureProvider({
      name: 'OurFreeModel',
      description: 'Our Free Model (dsh-our-free-model) 本地免密聚合网关通道',
      website: 'https://github.com/Ebony-Vinyl/dsh-our-free-model',
    });
    summary[
      ofmProviderResult.created ? 'createdProviders' : 'skippedProviders'
    ] += 1;

    const OUR_FREE_MODELS = [
      {
        modelId: 'deepseek-ai/DeepSeek-V4.1-Flash',
        modelName: 'DeepSeek-V4.1-Flash (EAC 协付)',
        description: 'Our Free Model EAC 通道：DeepSeek 前沿快速对话模型，已解锁 GitHub 协付通道',
        sortOrder: 11,
        isActive: true,
      },
      {
        modelId: 'z-ai/glm-5.3',
        modelName: 'GLM-5.3 (EAC 协付)',
        description: 'Our Free Model EAC 通道：智谱前沿旗舰大模型，全能逻辑推理与代码理解',
        sortOrder: 12,
        isActive: true,
      },
      {
        modelId: 'openai/gpt-oss-20b',
        modelName: 'GPT-OSS-20B (EAC 协付)',
        description: 'Our Free Model EAC 通道：高吞吐低延迟开源前沿模型，日常通用与极速问答',
        sortOrder: 13,
        isActive: true,
      },
      {
        modelId: 'kilo-auto/free',
        modelName: 'Kilo-Auto (OFM Free)',
        description: 'Our Free Model 免密通道：Kilo AI 自动优选免费前沿大模型',
        sortOrder: 14,
        isActive: true,
      },
    ];

    for (const model of OUR_FREE_MODELS) {
      const result = await this.ensureModel({
        providerId: ofmProviderResult.provider.id,
        modelName: model.modelName,
        modelId: model.modelId,
        inputPrice: 0,
        outputPrice: 0,
        contextLength: 128000,
        maxOutput: 4096,
        availability: 99.9,
        tps: 60,
        description: model.description,
        billingMode: DEFAULT_CHAT_BILLING_MODE,
        creditCost: DEFAULT_CHAT_MODEL_CREDIT_COST,
        sortOrder: model.sortOrder,
        isActive: model.isActive,
        category: 'chat',
      });
      summary[result === 'created' ? 'createdModels' : 'skippedModels'] += 1;
    }

    // 同步数据库中所有已存在的聊天模型为固定 10 积分按次计费
    try {
      const allModels = await this.aiModelService.findAll();
      for (const m of allModels) {
        if (m.category === 'chat' || (!m.category && m.modelId !== 'grok-imagine-image-lite' && m.modelId !== 'grok-imagine-image-2.0')) {
          if (m.creditCost !== DEFAULT_CHAT_MODEL_CREDIT_COST || m.billingMode !== DEFAULT_CHAT_BILLING_MODE) {
            await this.aiModelService.update(m.id, {
              creditCost: DEFAULT_CHAT_MODEL_CREDIT_COST,
              billingMode: DEFAULT_CHAT_BILLING_MODE,
            });
            this.logger.log(
              `已同步聊天模型 ${m.modelId} 为固定 ${DEFAULT_CHAT_MODEL_CREDIT_COST} 积分 ${DEFAULT_CHAT_BILLING_MODE}`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.warn(`同步已有聊天模型积分配置失败: ${err}`);
    }

    return summary;
  }

  /**
   * 确保供应商存在
   */
  private async ensureProvider(payload: {
    name: string;
    description: string;
    website: string;
  }): Promise<{ provider: AiProvider; created: boolean }> {
    const existingProvider = await this.aiProviderService.findByName(
      payload.name,
    );
    if (existingProvider) {
      this.logger.log(`供应商已存在，跳过覆盖: ${payload.name}`);
      return {
        provider: existingProvider,
        created: false,
      };
    }

    const provider = await this.aiProviderService.create({
      name: payload.name,
      description: payload.description,
      website: payload.website,
      isActive: true,
    });

    this.logger.log(`供应商创建成功: ${payload.name} (${provider.id})`);
    return { provider, created: true };
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
    billingMode?: string;
    creditCost?: number;
    sortOrder?: number;
    isActive?: boolean;
    category?: 'chat' | 'image';
  }): Promise<'created' | 'skipped'> {
    const existingModel = await this.aiModelService.findByModelIdOrNull(
      payload.modelId,
    );

    if (existingModel) {
      const needsSortUpdate =
        payload.sortOrder !== undefined &&
        existingModel.sortOrder !== payload.sortOrder;
      const needsActiveUpdate =
        payload.isActive !== undefined &&
        existingModel.isActive !== payload.isActive;
      const needsCategoryUpdate =
        payload.category !== undefined &&
        existingModel.category !== payload.category;
      const needsBillingModeUpdate =
        payload.billingMode !== undefined &&
        existingModel.billingMode !== payload.billingMode;
      const needsCreditCostUpdate =
        payload.creditCost !== undefined &&
        existingModel.creditCost !== payload.creditCost;
      const needsNameUpdate =
        payload.modelName !== undefined &&
        existingModel.modelName !== payload.modelName;
      const needsDescUpdate =
        payload.description !== undefined &&
        existingModel.description !== payload.description;

      if (
        needsSortUpdate ||
        needsActiveUpdate ||
        needsCategoryUpdate ||
        needsBillingModeUpdate ||
        needsCreditCostUpdate ||
        needsNameUpdate ||
        needsDescUpdate
      ) {
        await this.aiModelService.update(existingModel.id, {
          modelName: payload.modelName ?? existingModel.modelName,
          description: payload.description ?? existingModel.description,
          sortOrder: payload.sortOrder ?? existingModel.sortOrder,
          isActive: payload.isActive ?? existingModel.isActive,
          category: payload.category ?? existingModel.category,
          billingMode: payload.billingMode ?? existingModel.billingMode,
          creditCost: payload.creditCost ?? existingModel.creditCost,
        });
        this.logger.log(`模型已更新配置(名称/描述/排序/状态/分类/计费): ${payload.modelId}`);
      } else {
        this.logger.log(`模型已存在，跳过覆盖: ${payload.modelId}`);
      }
      return 'skipped';
    }

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
      isActive: payload.isActive ?? true,
      billingMode: payload.billingMode || DEFAULT_MODEL_BILLING_MODE,
      creditCost: payload.creditCost ?? DEFAULT_MODEL_CREDIT_COST,
      sortOrder: payload.sortOrder ?? 0,
      category: payload.category ?? 'chat',
    });

    this.logger.log(`模型创建成功: ${payload.modelId}`);
    return 'created';
  }
}
