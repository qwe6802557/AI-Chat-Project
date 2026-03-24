import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ClaudeAdapter } from '../adapters/claude.adapter';
import { ZaiwenAdapter } from '../adapters/zaiwen.adapter';
import { IProviderAdapter } from '../adapters/provider-adapter.interface';
import { AiModelService } from '../../ai-provider/ai-model.service';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import {
  ChatMessage,
  CompletionOptions,
  CompletionResponse,
  CompletionChunk,
  CompletionUsageStats,
} from '../types/completion.types';

/**
 * AI 客户端统一服务：
 * 从数据库查询模型和供应商信息
 * 调用对应的适配器
 * 更新访问量统计
 */
@Injectable()
export class AIClientService {
  private readonly logger = new Logger(AIClientService.name);

  constructor(
    private readonly claudeAdapter: ClaudeAdapter,
    private readonly zaiwenAdapter: ZaiwenAdapter,
    private readonly aiModelService: AiModelService,
    private readonly aiProviderService: AiProviderService,
  ) {}

  private buildUsageWithEstimatedCost(
    usage: CompletionUsageStats,
    pricing: {
      inputPrice: number;
      outputPrice: number;
    },
  ): CompletionUsageStats {
    const estimatedInputCost =
      (usage.promptTokens / 1000) * Number(pricing.inputPrice || 0);
    const estimatedOutputCost =
      (usage.completionTokens / 1000) * Number(pricing.outputPrice || 0);

    return {
      ...usage,
      estimatedInputCost,
      estimatedOutputCost,
      estimatedTotalCost: estimatedInputCost + estimatedOutputCost,
    };
  }

  /**
   * 根据供应商选择适配器
   */
  private resolveAdapter(providerName: string): IProviderAdapter {
    const normalizedProviderName = providerName.trim().toLowerCase();

    if (
      normalizedProviderName.includes('zaiwen') ||
      providerName.includes('在问')
    ) {
      return this.zaiwenAdapter;
    }

    if (
      normalizedProviderName.includes('claude') ||
      normalizedProviderName.includes('anthropic')
    ) {
      return this.claudeAdapter;
    }

    throw new BadRequestException(`暂不支持供应商 ${providerName}`);
  }

  /**
   * 创建聊天补全（非流式）
   * @param modelId 模型ID（如 claude-opus-4-5-20251101）
   * @param messages 消息数组
   * @param options 可选配置
   */
  async createChatCompletion(
    modelId: string,
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<CompletionResponse> {
    // 从数据库查询模型信息
    const model = await this.aiModelService.findByModelId(modelId, true);

    // 检查模型和供应商是否启用
    if (!model.isActive) {
      throw new BadRequestException(`模型 ${modelId} 未启用`);
    }

    if (!model.provider.isActive) {
      throw new BadRequestException(`供应商 ${model.provider.name} 未启用`);
    }

    this.logger.log(
      `使用供应商: ${model.provider.name}, 模型: ${model.modelName} (${modelId})`,
    );

    const adapter = this.resolveAdapter(model.provider.name);

    // 调用适配器
    const completion = await adapter.createChatCompletion(
      messages,
      modelId,
      options,
    );

    // 更新供应商访问量统计
    await this.aiProviderService.incrementAccessCount(model.provider.id);

    // 返回结果
    return {
      ...completion,
      usage: this.buildUsageWithEstimatedCost(completion.usage, {
        inputPrice: Number(model.inputPrice || 0),
        outputPrice: Number(model.outputPrice || 0),
      }),
    };
  }

  /**
   * 创建流式聊天补全
   * @param modelId 模型ID
   * @param messages 消息数组
   * @param options 可选配置
   */
  async createStreamChatCompletion(
    modelId: string,
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<AsyncIterable<CompletionChunk>> {
    // 查询模型信息
    const model = await this.aiModelService.findByModelId(modelId, true);

    // 模型和供应商是否启用
    if (!model.isActive) {
      throw new BadRequestException(`模型 ${modelId} 未启用`);
    }

    if (!model.provider.isActive) {
      throw new BadRequestException(`供应商 ${model.provider.name} 未启用`);
    }

    this.logger.log(
      `使用供应商: ${model.provider.name}, 模型: ${model.modelName} (${modelId}) - 流式模式`,
    );

    const adapter = this.resolveAdapter(model.provider.name);

    // 更新供应商访问量统计
    await this.aiProviderService.incrementAccessCount(model.provider.id);

    // 调用适配器
    const stream = await adapter.createStreamChatCompletion(
      messages,
      modelId,
      options,
    );

    return this.decorateStreamWithEstimatedCost(stream, {
      inputPrice: Number(model.inputPrice || 0),
      outputPrice: Number(model.outputPrice || 0),
    });
  }

  private async *decorateStreamWithEstimatedCost(
    stream: AsyncIterable<CompletionChunk>,
    pricing: {
      inputPrice: number;
      outputPrice: number;
    },
  ): AsyncIterable<CompletionChunk> {
    for await (const chunk of stream) {
      if (!chunk.usage) {
        yield chunk;
        continue;
      }

      yield {
        ...chunk,
        usage: this.buildUsageWithEstimatedCost(chunk.usage, pricing),
      };
    }
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels() {
    return this.aiModelService.findActiveModels(true);
  }
}
