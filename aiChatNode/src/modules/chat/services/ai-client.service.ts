import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ClaudeAdapter } from '../adapters/claude.adapter';
import { AiModelService } from '../../ai-provider/ai-model.service';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import {
  ChatMessage,
  CompletionOptions,
  CompletionResponse,
  CompletionChunk,
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
    private readonly aiModelService: AiModelService,
    private readonly aiProviderService: AiProviderService,
  ) {}

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

    // 调用适配器
    const completion = await this.claudeAdapter.createChatCompletion(
      messages,
      modelId,
      options,
    );

    // 更新供应商访问量统计
    await this.aiProviderService.incrementAccessCount(model.provider.id);

    // 返回结果
    return completion;
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

    // 更新供应商访问量统计
    await this.aiProviderService.incrementAccessCount(model.provider.id);

    // 调用适配器
    return this.claudeAdapter.createStreamChatCompletion(
      messages,
      modelId,
      options,
    );
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels() {
    return this.aiModelService.findActiveModels(true);
  }
}
