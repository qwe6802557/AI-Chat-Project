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
 * 支持 Spark-X2.6 (原生思考/推理链)、Spark-X2.6-4B 等系列模型
 */
@Injectable()
export class XfyunMaaSAdapter implements IProviderAdapter {
  readonly providerName = 'iFLYTEK';
  private readonly logger = new Logger(XfyunMaaSAdapter.name);
  private client: OpenAI | null = null;
  private enabled = false;
  private readonly healthCheckModel: string;

  get isConfigured(): boolean {
    return this.enabled;
  }

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('XFYUN_MAAS_API_KEY')?.trim();
    const baseURL =
      this.configService.get<string>('XFYUN_MAAS_BASE_URL')?.trim() ||
      'https://maas-api.cn-huabei-1.xf-yun.com/v2';
    this.healthCheckModel =
      this.configService.get<string>('XFYUN_MAAS_HEALTHCHECK_MODEL')?.trim() ||
      'spark-x2.6-4b';

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
          model: this.healthCheckModel,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        },
        { signal: abortController.signal },
      );

      return {
        status: 'up',
        responseTimeMs: Date.now() - startTime,
        modelCount: 2,
        sampleModelId: response.model || this.healthCheckModel,
      };
    } catch (error) {
      this.handleError(error);
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
    const rawMsg = error instanceof Error ? error.message : String(error);
    const status =
      (error as { status?: number; statusCode?: number; response?: { status?: number } })?.status ??
      (error as { statusCode?: number })?.statusCode ??
      (error as { response?: { status?: number } })?.response?.status;

    this.logger.error(`[XfyunMaaS] API 调用失败: ${rawMsg}`);

    // 保留 HTTP status 供上游熔断与降级器判定，同时将英文报错转为中文提示
    if (
      status === 403 ||
      /no valid authorization|lacks an active order|insufficient quota|order is invalid|11200/i.test(
        rawMsg,
      )
    ) {
      throw Object.assign(
        new Error(
          '科大讯飞星辰 MaaS 授权失败（403）：当前 API Key 缺少有效模型订单、免费额度已过期或未授权该模型，请检查控制台服务开通与授权状态',
        ),
        { status: status || 403 },
      );
    }

    if (status === 401) {
      throw Object.assign(
        new Error(
          '科大讯飞星辰 MaaS 鉴权失败（401）：请检查 XFYUN_MAAS_API_KEY 配置是否有效',
        ),
        { status: 401 },
      );
    }

    if (status === 429) {
      throw Object.assign(
        new Error('科大讯飞星辰 MaaS 请求触发限流（429），请稍后重试'),
        { status: 429 },
      );
    }

    throw error instanceof Error ? error : new Error(rawMsg);
  }
}
