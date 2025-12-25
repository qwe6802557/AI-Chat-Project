import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { IProviderAdapter } from './provider-adapter.interface';
import {
  ChatMessage,
  CompletionOptions,
  CompletionResponse,
  CompletionChunk,
} from '../types/completion.types';

/**
 * Claude AI 适配器
 * 使用 OpenAI SDK 调用第三方 Claude API
 */
@Injectable()
export class ClaudeAdapter implements IProviderAdapter {
  readonly providerName = 'Claude';
  private readonly logger = new Logger(ClaudeAdapter.name);
  private client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('CLAUDE_API_KEY');
    const baseURL = this.configService.get<string>('CLAUDE_BASE_URL');

    if (!apiKey) {
      throw new Error('CLAUDE_API_KEY 未配置');
    }

    if (!baseURL) {
      throw new Error('CLAUDE_BASE_URL 未配置');
    }

    // 使用 OpenAI SDK
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });

    this.logger.log(`${this.providerName} 适配器已加载`);
    this.logger.log(`目标URL: ${baseURL}`);
  }

  /**
   * 创建聊天补全（非流式）
   */
  async createChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: CompletionOptions,
  ): Promise<CompletionResponse> {
    try {
      this.logger.log(`调用 ${this.providerName} API - 模型: ${model}`);

      const completion = await this.client.chat.completions.create(
        {
          model,
          // 类型断言
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 4096,
          stream: false,
        },
        options?.abortSignal ? { signal: options.abortSignal } : undefined,
      );

      return this.transformResponse(completion);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 创建流式聊天补全
   */
  async createStreamChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: CompletionOptions,
  ): Promise<AsyncIterable<CompletionChunk>> {
    try {
      this.logger.log(`调用 ${this.providerName} 流式 API - 模型: ${model}`);

      const stream = await this.client.chat.completions.create(
        {
          model,
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 4096,
          stream: true,
        },
        options?.abortSignal ? { signal: options.abortSignal } : undefined,
      );

      return this.transformStream(stream);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 转换响应格式为统一格式
   */
  private transformResponse(completion: any): CompletionResponse {
    return {
      content: completion.choices[0]?.message?.content || '',
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * 转换流式响应为统一格式
   */
  private async *transformStream(
    stream: AsyncIterable<any>,
  ): AsyncIterable<CompletionChunk> {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const finishReason = chunk.choices[0]?.finish_reason;

      yield {
        delta: {
          content: delta?.content || '',
          role: delta?.role,
        },
        finish_reason: finishReason,
      };
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: any): never {
    if (error instanceof OpenAI.APIError) {
      this.logger.error(
        `${this.providerName} API Error: ${error.status} - ${error.message}`,
      );
      throw new Error(`${this.providerName} API Error: ${error.message}`);
    }

    this.logger.error(
      `${this.providerName} Unexpected error: ${error.message}`,
    );
    throw error;
  }
}
