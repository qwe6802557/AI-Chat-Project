import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeAdapter } from '../adapters/claude.adapter';
import { ZaiwenAdapter } from '../adapters/zaiwen.adapter';
import { IProviderAdapter } from '../adapters/provider-adapter.interface';
import { AiModelService } from '../../ai-provider/ai-model.service';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { RedisService } from '../../../common/redis/redis.service';
import {
  ChatMessage,
  CompletionOptions,
  CompletionResponse,
  CompletionChunk,
  CompletionUsageStats,
} from '../types/completion.types';
import {
  extractAssistantContent,
  type ExtractedAssistantReasoning,
} from '../utils/assistant-content.util';
import {
  resolveModelReasoningProfile,
  resolveReasoningPanelTitle,
  type ModelReasoningProfile,
} from '../utils/reasoning-profile.util';

export interface ProviderHealthStatus {
  providerId: string;
  name: string;
  isActive: boolean;
  isConfigured: boolean;
  status: 'up' | 'down';
  cached: boolean;
  checkedAt: string;
  message?: string;
  responseTimeMs?: number;
  modelCount?: number;
  sampleModelId?: string;
}

/**
 * AI 客户端统一服务：
 * 从数据库查询模型和供应商信息
 * 调用对应的适配器
 * 更新访问量统计
 */
@Injectable()
export class AIClientService {
  private readonly logger = new Logger(AIClientService.name);
  private readonly THINK_TAG_PATTERN = /<think\b|<\/think>/i;

  constructor(
    private readonly claudeAdapter: ClaudeAdapter,
    private readonly zaiwenAdapter: ZaiwenAdapter,
    private readonly aiModelService: AiModelService,
    private readonly aiProviderService: AiProviderService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private readonly DEFAULT_PROVIDER_HEALTH_CACHE_TTL_SECONDS = 60;

  private buildProviderHealthCacheKey(providerId: string): string {
    return `health:provider:${providerId}`;
  }

  private async getCachedProviderHealth(
    providerId: string,
  ): Promise<ProviderHealthStatus | null> {
    try {
      const cachedValue = await this.redisService.get(
        this.buildProviderHealthCacheKey(providerId),
      );
      if (!cachedValue) {
        return null;
      }

      const parsedValue = JSON.parse(cachedValue) as ProviderHealthStatus;
      if (
        !parsedValue ||
        typeof parsedValue !== 'object' ||
        typeof parsedValue.providerId !== 'string' ||
        typeof parsedValue.name !== 'string' ||
        typeof parsedValue.status !== 'string' ||
        typeof parsedValue.checkedAt !== 'string'
      ) {
        return null;
      }

      return {
        ...parsedValue,
        cached: true,
      };
    } catch (error) {
      this.logger.warn(
        `读取 provider 健康检查缓存失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async setCachedProviderHealth(
    providerId: string,
    value: ProviderHealthStatus,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redisService.set(
        this.buildProviderHealthCacheKey(providerId),
        JSON.stringify(value),
        { EX: ttlSeconds },
      );
    } catch (error) {
      this.logger.warn(
        `写入 provider 健康检查缓存失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildUsageWithEstimatedCost(
    usage: CompletionUsageStats,
    pricing: {
      inputPrice: number;
      outputPrice: number;
    },
  ): CompletionUsageStats {
    const promptTokens = Number(usage.promptTokens || 0);
    const completionTokens = Number(usage.completionTokens || 0);
    const totalTokens =
      Number(usage.totalTokens || 0) || promptTokens + completionTokens;
    const estimatedInputCost =
      (promptTokens / 1000) * Number(pricing.inputPrice || 0);
    const estimatedOutputCost =
      (completionTokens / 1000) * Number(pricing.outputPrice || 0);

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedInputCost,
      estimatedOutputCost,
      estimatedTotalCost: estimatedInputCost + estimatedOutputCost,
    };
  }

  private isReasoningDebugEnabled(): boolean {
    return this.configService.get<string>('REASONING_DEBUG_ENABLED') === 'true';
  }

  private getReasoningDebugSnippetLength(): number {
    const configuredValue = Number(
      this.configService.get<string>('REASONING_DEBUG_SNIPPET_LENGTH') || '200',
    );

    if (!Number.isFinite(configuredValue) || configuredValue <= 0) {
      return 200;
    }

    return Math.min(Math.floor(configuredValue), 2000);
  }

  private buildReasoningDebugSnippet(content: string): string {
    const normalizedContent = content.replace(/\s+/g, ' ').trim();
    return normalizedContent.slice(0, this.getReasoningDebugSnippetLength());
  }

  private logReasoningDebug(
    event: 'non-stream' | 'stream',
    profile: ModelReasoningProfile,
    content: string,
  ): void {
    if (!this.isReasoningDebugEnabled()) {
      return;
    }

    if (!this.THINK_TAG_PATTERN.test(content)) {
      return;
    }

    this.logger.log(
      `[reasoning-debug][${event}] model=${profile.modelId} capability=${profile.capability} integration=${profile.integration} containsThink=true snippet=${this.buildReasoningDebugSnippet(content)}`,
    );
  }

  private normalizeCompletionResponse(
    completion: CompletionResponse,
    profile: ModelReasoningProfile,
  ): CompletionResponse {
    this.logReasoningDebug('non-stream', profile, completion.content);
    const extracted = extractAssistantContent(completion.content);
    const normalizedReasoning = this.normalizeReasoningForProfile(
      extracted.reasoning,
      profile,
    );

    return {
      ...completion,
      content: extracted.answer,
      reasoning: normalizedReasoning,
    };
  }

  private normalizeReasoningForProfile(
    reasoning: ExtractedAssistantReasoning | null,
    profile: ModelReasoningProfile,
  ): CompletionResponse['reasoning'] {
    if (!reasoning || !reasoning.content) {
      return null;
    }

    if (profile.capability === 'none') {
      return null;
    }

    if (profile.capability === 'summary') {
      if (reasoning.mode !== 'summary') {
        return null;
      }
    }

    return {
      ...reasoning,
      title: resolveReasoningPanelTitle(reasoning.mode, profile.strategy),
    };
  }

  private async *normalizeStreamWithReasoning(
    stream: AsyncIterable<CompletionChunk>,
    profile: ModelReasoningProfile,
  ): AsyncIterable<CompletionChunk> {
    let rawContent = '';
    let emittedAnswer = '';
    let emittedReasoning = '';
    let reasoningStarted = false;
    let reasoningCompleted = false;
    let latestReasoningMeta: ExtractedAssistantReasoning | null = null;
    let hasLoggedThink = false;

    for await (const chunk of stream) {
      if (chunk.type && chunk.type !== 'answer_delta') {
        yield chunk;
        continue;
      }

      const rawDelta = chunk.delta?.content || '';

      if (!rawDelta) {
        yield chunk;
        continue;
      }

      rawContent += rawDelta;
      if (!hasLoggedThink && this.THINK_TAG_PATTERN.test(rawContent)) {
        hasLoggedThink = true;
        this.logReasoningDebug('stream', profile, rawContent);
      }
      const extracted = extractAssistantContent(rawContent);
      latestReasoningMeta = this.normalizeReasoningForProfile(
        extracted.reasoning,
        profile,
      ) as ExtractedAssistantReasoning | null;
      const reasoningContent = extracted.reasoning?.content || '';
      const answerContent = extracted.answer;

      if (latestReasoningMeta && reasoningContent && !reasoningStarted) {
        reasoningStarted = true;
        yield {
          type: 'reasoning_start',
          reasoning: {
            mode: latestReasoningMeta.mode,
            source: latestReasoningMeta.source,
            title: latestReasoningMeta.title,
          },
        };
      }

      const visibleReasoningContent = latestReasoningMeta?.content || '';
      const reasoningDelta = visibleReasoningContent.slice(emittedReasoning.length);
      if (reasoningDelta) {
        emittedReasoning = visibleReasoningContent;
        yield {
          type: 'reasoning_delta',
          delta: {
            content: reasoningDelta,
          },
          reasoning: {
            mode: latestReasoningMeta?.mode,
            source: latestReasoningMeta?.source,
            title: latestReasoningMeta?.title,
          },
        };
      }

      if (reasoningStarted && !reasoningCompleted && !extracted.reasoningOpen) {
        reasoningCompleted = true;
        yield {
          type: 'reasoning_done',
          reasoning: latestReasoningMeta,
        };
      }

      const answerDelta = answerContent.slice(emittedAnswer.length);
      if (answerDelta) {
        emittedAnswer = answerContent;
        yield {
          ...chunk,
          type: 'answer_delta',
          delta: {
            ...chunk.delta,
            content: answerDelta,
          },
        };
      }
    }
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
    const reasoningProfile = resolveModelReasoningProfile({
      providerName: model.provider.name,
      modelId,
    });

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
      ...this.normalizeCompletionResponse(completion, reasoningProfile),
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
    const reasoningProfile = resolveModelReasoningProfile({
      providerName: model.provider.name,
      modelId,
    });

    // 更新供应商访问量统计
    await this.aiProviderService.incrementAccessCount(model.provider.id);

    // 调用适配器
    const stream = await adapter.createStreamChatCompletion(
      messages,
      modelId,
      options,
    );

    return this.decorateStreamWithEstimatedCost(
      this.normalizeStreamWithReasoning(stream, reasoningProfile),
      {
        inputPrice: Number(model.inputPrice || 0),
        outputPrice: Number(model.outputPrice || 0),
      },
    );
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

  async checkProvidersHealth(options?: {
    activeOnly?: boolean;
    timeoutMs?: number;
    cacheTtlSeconds?: number;
    bypassCache?: boolean;
  }): Promise<ProviderHealthStatus[]> {
    const providers = await this.aiProviderService.findAll(false);
    const targetProviders =
      options?.activeOnly === false
        ? providers
        : providers.filter((provider) => provider.isActive);
    const cacheTtlSeconds =
      options?.cacheTtlSeconds ??
      this.DEFAULT_PROVIDER_HEALTH_CACHE_TTL_SECONDS;

    return Promise.all(
      targetProviders.map(async (provider) => {
        let adapter: IProviderAdapter;

        try {
          adapter = this.resolveAdapter(provider.name);
        } catch (error) {
          const result: ProviderHealthStatus = {
            providerId: provider.id,
            name: provider.name,
            isActive: provider.isActive,
            isConfigured: false,
            status: 'down',
            cached: false,
            checkedAt: new Date().toISOString(),
            message: error instanceof Error ? error.message : String(error),
          };
          await this.setCachedProviderHealth(
            provider.id,
            result,
            cacheTtlSeconds,
          );
          return result;
        }

        if (!options?.bypassCache) {
          const cachedResult = await this.getCachedProviderHealth(provider.id);
          if (cachedResult) {
            return cachedResult;
          }
        }

        try {
          const result = await adapter.healthCheck({
            timeoutMs: options?.timeoutMs,
          });

          const healthStatus: ProviderHealthStatus = {
            providerId: provider.id,
            name: provider.name,
            isActive: provider.isActive,
            isConfigured: adapter.isConfigured,
            cached: false,
            checkedAt: new Date().toISOString(),
            ...result,
          };
          await this.setCachedProviderHealth(
            provider.id,
            healthStatus,
            cacheTtlSeconds,
          );
          return healthStatus;
        } catch (error) {
          const result: ProviderHealthStatus = {
            providerId: provider.id,
            name: provider.name,
            isActive: provider.isActive,
            isConfigured: adapter.isConfigured,
            status: 'down',
            cached: false,
            checkedAt: new Date().toISOString(),
            message: error instanceof Error ? error.message : String(error),
          };
          await this.setCachedProviderHealth(
            provider.id,
            result,
            cacheTtlSeconds,
          );
          return result;
        }
      }),
    );
  }
}
