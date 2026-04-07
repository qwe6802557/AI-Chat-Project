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

interface ProviderUsageLike {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface ProviderChoiceLike {
  message?: {
    content?: unknown;
  };
  delta?: {
    content?: unknown;
    role?: unknown;
  };
  finish_reason?: string | null;
}

interface ProviderCompletionLike {
  choices?: ProviderChoiceLike[];
  model?: string;
  usage?: ProviderUsageLike | null;
}

const asProviderCompletionLike = (value: unknown): ProviderCompletionLike => {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  return value as ProviderCompletionLike;
};

const readString = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

const normalizeProviderError = (
  providerName: string,
  error: unknown,
  context: 'request' | 'health-check',
): Error => {
  if (error instanceof OpenAI.APIError) {
    if (context === 'health-check' && error.status === 404) {
      return new Error(
        `${providerName} 健康检查接口不可用：当前 BASE_URL 不支持 /models，请检查兼容路径配置`,
      );
    }

    return new Error(`${providerName} API Error: ${error.message}`);
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  return error instanceof Error ? error : new Error(errorMessage);
};

/**
 * Claude AI 适配器
 * 使用 OpenAI SDK 调用第三方 Claude API
 */
@Injectable()
export class ClaudeAdapter implements IProviderAdapter {
  readonly providerName = 'Claude';
  private readonly logger = new Logger(ClaudeAdapter.name);
  private client: OpenAI | null = null;
  private enabled = false;

  get isConfigured(): boolean {
    return this.enabled;
  }

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('CLAUDE_API_KEY');
    const baseURL = this.configService.get<string>('CLAUDE_BASE_URL');

    if (!apiKey || !baseURL) {
      this.logger.warn(
        'Claude 适配器未启用：CLAUDE_API_KEY 或 CLAUDE_BASE_URL 缺失',
      );
      return;
    }

    // 使用 OpenAI SDK
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.enabled = true;

    this.logger.log(`${this.providerName} 适配器已加载`);
    this.logger.log(`目标URL: ${baseURL}`);
  }

  /**
   * 获取可用客户端
   */
  private getClient(): OpenAI {
    if (!this.enabled || !this.client) {
      throw new Error('Claude 适配器未配置，无法发起请求');
    }
    return this.client;
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

      const completion = await this.getClient().chat.completions.create(
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
      throw normalizeProviderError(this.providerName, error, 'health-check');
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * 转换响应格式为统一格式
   */
  private transformResponse(completion: unknown): CompletionResponse {
    const normalizedCompletion = asProviderCompletionLike(completion);
    const firstChoice = normalizedCompletion.choices?.[0];
    const promptTokens = normalizedCompletion.usage?.prompt_tokens || 0;
    const completionTokens = normalizedCompletion.usage?.completion_tokens || 0;
    const totalTokens =
      normalizedCompletion.usage?.total_tokens ||
      promptTokens + completionTokens;

    return {
      content: readString(firstChoice?.message?.content),
      model: normalizedCompletion.model || '',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
    };
  }

  /**
   * 转换流式响应为统一格式
   */
  private async *transformStream(
    stream: AsyncIterable<unknown>,
  ): AsyncIterable<CompletionChunk> {
    for await (const chunk of stream) {
      const normalizedChunk = asProviderCompletionLike(chunk);
      const firstChoice = normalizedChunk.choices?.[0];
      const delta = firstChoice?.delta;
      const finishReason = firstChoice?.finish_reason;
      const promptTokens = normalizedChunk.usage?.prompt_tokens || 0;
      const completionTokens = normalizedChunk.usage?.completion_tokens || 0;
      const totalTokens =
        normalizedChunk.usage?.total_tokens ||
        promptTokens + completionTokens;

      yield {
        delta: {
          content: readString(delta?.content),
          role: typeof delta?.role === 'string' ? delta.role : undefined,
        },
        finish_reason: finishReason,
        usage: normalizedChunk.usage
          ? {
              promptTokens,
              completionTokens,
              totalTokens,
            }
          : null,
      };
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown): never {
    const normalizedError = normalizeProviderError(
      this.providerName,
      error,
      'request',
    );

    if (error instanceof OpenAI.APIError) {
      this.logger.error(
        `${this.providerName} API Error: ${error.status} - ${error.message}`,
      );
      throw normalizedError;
    }

    this.logger.error(
      `${this.providerName} Unexpected error: ${normalizedError.message}`,
    );
    throw normalizedError;
  }
}
