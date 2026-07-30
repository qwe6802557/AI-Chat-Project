import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IProviderAdapter,
  ProviderHealthCheckResult,
} from './provider-adapter.interface';
import {
  ChatMessage,
  CompletionOptions,
  CompletionResponse,
  CompletionChunk,
} from '../types/completion.types';
@Injectable()
export class Grok2APIAdapter implements IProviderAdapter {
  readonly providerName = 'Grok2API';
  private readonly logger = new Logger(Grok2APIAdapter.name);
  private client: OpenAI | null = null;
  private enabled = false;

  get isConfigured(): boolean {
    return this.enabled;
  }

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('GROK2API_API_KEY') ||
      this.configService.get<string>('GROK2API_KEY');
    const baseURL = this.configService.get<string>('GROK2API_BASE_URL');

    if (!apiKey || !baseURL) {
      this.logger.warn(
        'Grok2API 适配器未启用：GROK2API_API_KEY（兼容 GROK2API_KEY）或 GROK2API_BASE_URL 缺失',
      );
      return;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.enabled = true;

    this.logger.log(`${this.providerName} 适配器已加载`);
    this.logger.log(`目标URL: ${baseURL}`);
  }

  private getClient(): OpenAI {
    if (!this.enabled || !this.client) {
      throw new Error('Grok2API 适配器未配置，无法发起请求');
    }
    return this.client;
  }

  async createChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: CompletionOptions,
  ): Promise<CompletionResponse> {
    try {
      this.logger.log(`调用 ${this.providerName} API - 模型: ${model}`);

      const completion = await this.getClient().chat.completions.create(
        {
          model,
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

  async createStreamChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: CompletionOptions,
  ): Promise<AsyncIterable<CompletionChunk>> {
    try {
      this.logger.log(`调用 ${this.providerName} 流式 API - 模型: ${model}`);

      const stream = await this.getClient().chat.completions.create(
        {
          model,
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 4096,
          stream: true,
          stream_options: {
            include_usage: true,
          },
        },
        options?.abortSignal ? { signal: options.abortSignal } : undefined,
      );

      return this.transformStream(stream);
    } catch (error) {
      if (
        error instanceof OpenAI.APIError &&
        error.status === 400 &&
        /stream_options|include_usage/i.test(error.message)
      ) {
        this.logger.warn(
          `${this.providerName} 不支持 stream_options.include_usage，将降级为无 usage 统计的流式请求`,
        );

        const fallbackStream = await this.getClient().chat.completions.create(
          {
            model,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 4096,
            stream: true,
          },
          options?.abortSignal ? { signal: options.abortSignal } : undefined,
        );

        return this.transformStream(fallbackStream);
      }

      this.handleError(error);
    }
  }

  async healthCheck(options?: {
    timeoutMs?: number;
  }): Promise<ProviderHealthCheckResult> {
    const startTime = Date.now();
    const abortController = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 5000;
    const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const modelsPage = await this.getClient().models.list({
        signal: abortController.signal,
      });

      return {
        status: 'up',
        responseTimeMs: Date.now() - startTime,
        modelCount: modelsPage.data.length,
        sampleModelId: modelsPage.data[0]?.id,
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError && error.status === 404) {
        throw new Error(
          `${this.providerName} 健康检查接口不可用：当前 BASE_URL 不支持 /models`,
        );
      }
      const msg = error instanceof Error ? error.message : String(error);
      throw error instanceof Error ? error : new Error(msg);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private transformResponse(completion: any): CompletionResponse {
    const firstChoice = completion.choices?.[0];
    const usage = completion.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;

    return {
      content: typeof firstChoice?.message?.content === 'string' ? firstChoice.message.content : '',
      model: completion.model || '',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: usage.total_tokens || promptTokens + completionTokens,
      },
    };
  }

  private async *transformStream(
    stream: AsyncIterable<any>,
  ): AsyncIterable<CompletionChunk> {
    for await (const chunk of stream) {
      const firstChoice = chunk.choices?.[0];
      const delta = firstChoice?.delta;
      const usage = chunk.usage || {};

      yield {
        delta: {
          content: typeof delta?.content === 'string' ? delta.content : '',
          role: typeof delta?.role === 'string' ? delta.role : undefined,
        },
        finish_reason: firstChoice?.finish_reason,
        usage: chunk.usage
          ? {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0,
            }
          : null,
      };
    }
  }

  private handleError(error: unknown): never {
    const msg = error instanceof Error ? error.message : String(error);
    this.logger.error(`${this.providerName} API Error: ${msg}`);
    throw error instanceof Error ? error : new Error(msg);
  }
}
