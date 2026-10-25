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
 * 科大讯飞星辰 MaaS 大模型服务适配器 (OpenAI 兼容接口)
 * 支持 Spark-X2.6 (原生思考/推理链)、Spark-X2.5、Spark-X2.6-4B 等系列模型
 */
@Injectable()
export class XfyunMaaSAdapter implements IProviderAdapter {
  readonly providerName = 'iFLYTEK';
  private readonly logger = new Logger(XfyunMaaSAdapter.name);
  private client: OpenAI | null = null;
  private enabled = false;

  get isConfigured(): boolean {
    return this.enabled;
  }

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('XFYUN_MAAS_API_KEY') ||
      'ak-c881c0df2473e9409d7f8e7f7c14ef7f';
    const baseURL =
      this.configService.get<string>('XFYUN_MAAS_BASE_URL') ||
      'https://maas-api.cn-huabei-1.xf-yun.com/v2';

    if (!apiKey) {
      this.logger.warn(
        '科大讯飞星辰 MaaS 适配器未启用：XFYUN_MAAS_API_KEY 环境变量未配置',
      );
      return;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.enabled = true;

    this.logger.log(`${this.providerName} 星辰 MaaS 适配器加载成功，网关: ${baseURL}`);
  }

  private getClient(): OpenAI {
    if (!this.enabled || !this.client) {
      throw new Error('科大讯飞星辰 MaaS 适配器未配置，无法发起请求');
    }
    return this.client;
  }

  private resolveTargetModel(model: string): string {
    const clean = model.trim().toLowerCase();
    if (clean.includes('x2.6-4b') || clean === 'spark-x2.6-4b') {
      return 'spark-x2.6-4b';
    }
    if (clean.includes('x2.5-4b') || clean === 'spark-x2.5-4b') {
      return 'spark-x2.5-4b';
    }
    if (clean.includes('x2.5-1.7b') || clean === 'spark-x2.5-1.7b') {
      return 'spark-x2.5-1.7b';
    }
    if (clean.includes('x2.5') || clean === 'spark-x2.5') {
      return 'spark-x2.5';
    }
    if (clean.includes('x2.6') || clean === 'spark-x2.6') {
      return 'spark-x2.6';
    }
    return model;
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
        `[XfyunMaaS] 调用非流式 API - 请求模型: ${model}, 目标模型: ${targetModel}`,
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
   * 创建流式聊天补全 (支持原生 reasoning_content 思考链推送)
   */
  async createStreamChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: CompletionOptions,
  ): Promise<AsyncIterable<CompletionChunk>> {
    try {
      const targetModel = this.resolveTargetModel(model);
      this.logger.log(
        `[XfyunMaaS] 调用流式 API - 请求模型: ${model}, 目标模型: ${targetModel}`,
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
          `[XfyunMaaS] 不支持 stream_options.include_usage，自动降级为常规流式请求`,
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
   * 执行轻量健康探活与测速
   */
  async healthCheck(options?: {
    timeoutMs?: number;
  }): Promise<ProviderHealthCheckResult> {
    const startTime = Date.now();
    const abortController = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 6000;
    const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await this.getClient().chat.completions.create(
        {
          model: 'spark-x2.6',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        },
        { signal: abortController.signal },
      );

      return {
        status: 'up',
        responseTimeMs: Date.now() - startTime,
        modelCount: 3,
        sampleModelId: response.model || 'spark-x2.6',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw error instanceof Error ? error : new Error(msg);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private transformResponse(completion: any): CompletionResponse {
    const firstChoice = completion.choices?.[0];
    const message = firstChoice?.message || {};
    const usage = completion.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;

    const rawReasoning =
      typeof message.reasoning_content === 'string'
        ? message.reasoning_content
        : '';

    return {
      content: typeof message.content === 'string' ? message.content : '',
      model: completion.model || 'spark-x2.6',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: usage.total_tokens || promptTokens + completionTokens,
      },
      reasoning: rawReasoning
        ? {
            mode: 'raw',
            source: 'provider_block',
            content: rawReasoning,
          }
        : null,
      toolCalls: message.tool_calls,
    };
  }

  private async *transformStream(
    stream: AsyncIterable<any>,
  ): AsyncIterable<CompletionChunk> {
    let hasEmittedReasoningStart = false;

    for await (const chunk of stream) {
      const firstChoice = chunk.choices?.[0];
      const delta = firstChoice?.delta;
      const usage = chunk.usage || {};

      // 提取深度思考内容 (reasoning_content)
      const reasoningDelta =
        typeof delta?.reasoning_content === 'string'
          ? delta.reasoning_content
          : '';

      if (reasoningDelta) {
        if (!hasEmittedReasoningStart) {
          hasEmittedReasoningStart = true;
          yield {
            type: 'reasoning_start',
            reasoning: {
              mode: 'raw',
              source: 'provider_block',
              content: '',
            },
          };
        }

        yield {
          type: 'reasoning_delta',
          delta: { content: reasoningDelta },
          reasoning: {
            mode: 'raw',
            source: 'provider_block',
            content: reasoningDelta,
          },
        };
      }

      // 提取最终回答内容 (content)
      const contentDelta =
        typeof delta?.content === 'string' ? delta.content : '';

      if (contentDelta) {
        if (hasEmittedReasoningStart) {
          hasEmittedReasoningStart = false;
          yield {
            type: 'reasoning_done',
            reasoning: {
              mode: 'raw',
              source: 'provider_block',
              content: '',
            },
          };
        }

        yield {
          type: 'answer_delta',
          delta: {
            content: contentDelta,
            role: typeof delta?.role === 'string' ? delta.role : undefined,
            tool_calls: delta?.tool_calls,
          },
          finish_reason: firstChoice?.finish_reason,
        };
      }

      // 用量事件处理
      if (chunk.usage) {
        yield {
          type: 'done',
          delta: {},
          usage: {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          },
          finish_reason: firstChoice?.finish_reason,
        };
      }
    }
  }

  private handleError(error: unknown): never {
    const msg = error instanceof Error ? error.message : String(error);
    this.logger.error(`[XfyunMaaS] API 调用失败: ${msg}`);
    throw error instanceof Error ? error : new Error(msg);
  }
}
