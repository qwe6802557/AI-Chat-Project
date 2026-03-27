import {
  ChatMessage,
  CompletionOptions,
  CompletionResponse,
  CompletionChunk,
} from '../types/completion.types';

export interface ProviderHealthCheckResult {
  status: 'up';
  responseTimeMs: number;
  modelCount: number;
  sampleModelId?: string;
}

/**
 * AI 供应商适配器接口
 * 所有 AI 供应商适配器都必须实现此接口
 */
export interface IProviderAdapter {
  /**
   * 供应商名称
   */
  readonly providerName: string;
  readonly isConfigured: boolean;

  /**
   * 创建聊天补全（非流式）
   * @param messages 消息数组
   * @param model 模型ID
   * @param options 可选配置
   */
  createChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: CompletionOptions,
  ): Promise<CompletionResponse>;

  /**
   * 创建流式聊天补全
   * @param messages 消息数组
   * @param model 模型ID
   * @param options 可选配置
   */
  createStreamChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: CompletionOptions,
  ): Promise<AsyncIterable<CompletionChunk>>;

  /**
   * 执行轻量探活
   * - 优先使用模型列表接口，避免产生 token 消耗
   */
  healthCheck(options?: {
    timeoutMs?: number;
  }): Promise<ProviderHealthCheckResult>;
}
