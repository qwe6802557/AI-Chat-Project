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

/**
 * Our Free Model (dsh-our-free-model) 独立服务适配器
 * 对接本地或局域网搭建的 OFM Standalone 网关服务（OpenAI 兼容接口）
 */
@Injectable()
export class OFMAdapter implements IProviderAdapter {
  readonly providerName = 'OurFreeModel';
  private readonly logger = new Logger(OFMAdapter.name);
  private client: OpenAI | null = null;
  private enabled = false;

  get isConfigured(): boolean {
    return this.enabled;
  }

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('OFM_API_KEY') ||
      this.configService.get<string>('OFM_KEY');
    const baseURL =
      this.configService.get<string>('OFM_BASE_URL') ||
      'http://127.0.0.1:18900/v1';

    if (!apiKey) {
      this.logger.warn(
        'OurFreeModel 适配器未启用：OFM_API_KEY（兼容 OFM_KEY）环境变量未配置',
      );
      return;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.enabled = true;

    this.logger.log(`${this.providerName} 适配器已加载，目标网关: ${baseURL}`);
  }

  private getClient(): OpenAI {
    if (!this.enabled || !this.client) {
      throw new Error('OurFreeModel 适配器未配置，无法发起请求');
    }
    return this.client;
  }

  private resolveTargetModel(model: string): string {
    const mapping: Record<string, string> = {
      'deepseek-v4.1-flash': 'deepseek-ai/deepseek-v4.1-flash',
      'deepseek-ai/deepseek-v4.1-flash': 'deepseek-ai/deepseek-v4.1-flash',
      'deepseek-v4.1-flash-free': 'opencode/deepseek-v4.1-flash-free',
      'glm-5.3': 'z-ai/glm-5.3',
      'z-ai/glm-5.3': 'z-ai/glm-5.3',
      'gpt-oss-20b': 'openai/gpt-oss-20b',
      'openai/gpt-oss-20b': 'openai/gpt-oss-20b',
      'kimi-k3': 'moonshotai/kimi-k2.6',
      'moonshotai/kimi-k3': 'moonshotai/kimi-k2.6',
      'kilo-free': 'kilo-auto/free',
      'kilo-auto/free': 'kilo-auto/free',
    };
    return mapping[model.toLowerCase()] || model;
  }

  /**
   * 创建非流式聊天补全
   */
  async createChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: CompletionOptions,
  ): Promise<CompletionResponse> {
    try {
      const targetModel = this.resolveTargetModel(model);
      this.logger.log(
        `调用 ${this.providerName} API - 请求模型: ${model}, 目标模型: ${targetModel}`,
      );

      const completion = await this.getClient().chat.completions.create(
        {
          model: targetModel,
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 4096,
          stream: false,
          ...(options?.tools?.length ? { tools: options.tools } : {}),
          ...(options?.toolChoice ? { tool_choice: options.toolChoice } : {}),
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
      const targetModel = this.resolveTargetModel(model);
      this.logger.log(
        `调用 ${this.providerName} 流式 API - 请求模型: ${model}, 目标模型: ${targetModel}`,
      );

      const stream = await this.getClient().chat.completions.create(
        {
          model: targetModel,
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 4096,
          stream: true,
          stream_options: {
            include_usage: true,
          },
          ...(options?.tools?.length ? { tools: options.tools } : {}),
          ...(options?.toolChoice ? { tool_choice: options.toolChoice } : {}),
        },
        options?.abortSignal ? { signal: options.abortSignal } : undefined,
      );

      return this.transformStream(stream);
    } catch (error) {
      const targetModel = this.resolveTargetModel(model);
      if (
        error instanceof OpenAI.APIError &&
        error.status === 400 &&
        /stream_options|include_usage/i.test(error.message)
      ) {
        this.logger.warn(
          `${this.providerName} 不支持 stream_options.include_usage，降级为无 usage 流式请求`,
        );

        const fallbackStream = await this.getClient().chat.completions.create(
          {
            model: targetModel,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 4096,
            stream: true,
            ...(options?.tools?.length ? { tools: options.tools } : {}),
            ...(options?.toolChoice ? { tool_choice: options.toolChoice } : {}),
          },
          options?.abortSignal ? { signal: options.abortSignal } : undefined,
        );

        return this.transformStream(fallbackStream);
      }

      this.handleError(error);
    }
  }

  /**
   * 执行轻量健康探活
   */
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
      content:
        typeof firstChoice?.message?.content === 'string'
          ? firstChoice.message.content
          : '',
      model: completion.model || '',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: usage.total_tokens || promptTokens + completionTokens,
      },
      toolCalls: firstChoice?.message?.tool_calls,
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
          tool_calls: delta?.tool_calls,
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
