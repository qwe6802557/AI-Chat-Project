import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type {
  AgentTraceSource,
  AgentTraceStatus,
} from '../entities/agent-trace.entity';
import type {
  AgentSpanStatus,
  AgentSpanType,
} from '../entities/agent-span.entity';
import { TraceStorageService } from './trace-storage.service';

export interface TraceUsageAccumulator {
  promptTokens: number;
  completionTokens: number;
  estimatedCredits: number;
}

export interface ActiveTraceContext {
  traceId: string;
  userId: string;
  currentSpanId: string | null;
  usage: TraceUsageAccumulator;
  statusOverride?: AgentTraceStatus | null;
  errorSummaryOverride?: string | null;
  creditsOverride?: number | null;
}

export interface StartRootTraceOptions {
  traceId?: string;
  userId: string;
  source: AgentTraceSource;
  workflowId?: string | null;
  sessionId?: string | null;
  channelInstanceId?: string | null;
  roleId?: string | null;
  title?: string | null;
}

export interface StartSpanOptions {
  spanType: AgentSpanType;
  name: string;
  nodeId?: string | null;
  modelId?: string | null;
  input?: unknown;
  metadata?: Record<string, any> | null;
}

export interface SpanRecorder {
  spanId: string;
  setOutput: (output: unknown) => void;
  setModelId: (modelId: string | null | undefined) => void;
  setStatus: (status: AgentSpanStatus) => void;
  setUsage: (usage: {
    promptTokens?: number;
    completionTokens?: number;
    estimatedCredits?: number;
  }) => void;
  mergeMetadata: (extra: Record<string, any>) => void;
}

/**
 * 基于 AsyncLocalStorage 的分布式 Trace ID 与 Span 上下文透传服务
 */
@Injectable()
export class TraceContextService {
  private readonly als = new AsyncLocalStorage<ActiveTraceContext>();

  constructor(private readonly traceStorage: TraceStorageService) {}

  /**
   * 生成紧凑唯一 Trace ID
   */
  createTraceId(): string {
    return `tr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }

  /**
   * 生成唯一 Span ID
   */
  createSpanId(): string {
    return `sp_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }

  /**
   * 读取当前异步链路的 Trace ID
   */
  getCurrentTraceId(): string | null {
    return this.als.getStore()?.traceId ?? null;
  }

  /**
   * 读取当前异步链路的 Span ID
   */
  getCurrentSpanId(): string | null {
    return this.als.getStore()?.currentSpanId ?? null;
  }

  /**
   * 读取当前 Trace 已累计的 Token 与估算积分汇总
   */
  getCurrentUsageSummary(): TraceUsageAccumulator {
    const store = this.als.getStore();
    if (!store) {
      return { promptTokens: 0, completionTokens: 0, estimatedCredits: 0 };
    }
    return { ...store.usage };
  }

  /**
   * 向当前 Trace 累加模型消耗（自动防止重复统计需由上层只在最细粒度调一次）
   */
  addUsageToTrace(usage?: {
    promptTokens?: number;
    completionTokens?: number;
    estimatedCredits?: number;
  }): void {
    const store = this.als.getStore();
    if (!store || !usage) return;
    store.usage.promptTokens += Math.max(0, Number(usage.promptTokens || 0));
    store.usage.completionTokens += Math.max(
      0,
      Number(usage.completionTokens || 0),
    );
    store.usage.estimatedCredits += Math.max(
      0,
      Number(usage.estimatedCredits || 0),
    );
  }

  /**
   * 当上层工作流以返回值状态（而非抛出异常）收敛失败或中断时，显式覆盖根 Trace 终态
   */
  markCurrentTraceOutcome(
    status: AgentTraceStatus,
    errorSummary?: string | null,
  ): void {
    const store = this.als.getStore();
    if (!store) return;
    store.statusOverride = status;
    if (errorSummary !== undefined) {
      store.errorSummaryOverride = errorSummary;
    }
  }

  /**
   * 同步工作流最低计费积分下限至 Trace 消耗统计（防止零定价模型实扣 1 积分时观测面板显示 0）
   */
  ensureMinimumTraceCredits(minCredits: number): void {
    const store = this.als.getStore();
    if (!store || !Number.isFinite(minCredits) || minCredits <= 0) return;
    store.creditsOverride = Math.max(store.creditsOverride ?? 0, minCredits);
  }

  /**
   * 开启根 Trace 上下文作用域并在结束时自动归档耗时、状态与消耗
   */
  async runWithTrace<T>(
    options: StartRootTraceOptions,
    fn: (traceId: string) => Promise<T>,
  ): Promise<T> {
    const traceId = options.traceId?.trim() || this.createTraceId();
    const startMs = Date.now();
    const store: ActiveTraceContext = {
      traceId,
      userId: options.userId,
      currentSpanId: null,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        estimatedCredits: 0,
      },
    };

    await this.traceStorage.createTrace({
      traceId,
      userId: options.userId,
      source: options.source,
      workflowId: options.workflowId ?? null,
      sessionId: options.sessionId ?? null,
      channelInstanceId: options.channelInstanceId ?? null,
      roleId: options.roleId ?? null,
      title: options.title ?? null,
    });

    let finalStatus: AgentTraceStatus = 'completed';
    let errorSummary: string | null = null;

    return this.als.run(store, async () => {
      try {
        return await fn(traceId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const errName = err instanceof Error ? err.name : '';
        finalStatus =
          errName === 'AbortError' || /abort|cancel|中断/i.test(message)
            ? 'aborted'
            : 'failed';
        errorSummary = message;
        throw err;
      } finally {
        const resolvedStatus = store.statusOverride ?? finalStatus;
        const resolvedError = store.errorSummaryOverride ?? errorSummary;
        const resolvedCredits = Math.max(
          store.usage.estimatedCredits,
          store.creditsOverride ?? 0,
        );
        await this.traceStorage.finalizeTrace({
          traceId,
          status: resolvedStatus,
          durationMs: Date.now() - startMs,
          totalPromptTokens: store.usage.promptTokens,
          totalCompletionTokens: store.usage.completionTokens,
          totalCredits: resolvedCredits,
          errorSummary: resolvedError,
        });
      }
    });
  }

  /**
   * 在当前 Trace 下创建子 Span；若当前无活跃 Trace 则直接透传执行
   */
  async withSpan<T>(
    options: StartSpanOptions,
    fn: (recorder?: SpanRecorder) => Promise<T>,
  ): Promise<T> {
    const parentStore = this.als.getStore();
    if (!parentStore) {
      return fn(undefined);
    }

    const spanId = this.createSpanId();
    const startedAt = Date.now();
    let capturedOutput: unknown;
    let resolvedModelId = options.modelId ?? null;
    let status: AgentSpanStatus = 'completed';
    let promptTokens = 0;
    let completionTokens = 0;
    let estimatedCredits = 0;
    const metadata: Record<string, any> = options.metadata
      ? { ...options.metadata }
      : {};

    const recorder: SpanRecorder = {
      spanId,
      setOutput: (output) => {
        capturedOutput = output;
      },
      setModelId: (modelId) => {
        if (modelId) resolvedModelId = modelId;
      },
      setStatus: (nextStatus) => {
        status = nextStatus;
      },
      setUsage: (usage) => {
        promptTokens = Math.max(0, Number(usage.promptTokens || 0));
        completionTokens = Math.max(0, Number(usage.completionTokens || 0));
        estimatedCredits = Math.max(0, Number(usage.estimatedCredits || 0));
      },
      mergeMetadata: (extra) => {
        Object.assign(metadata, extra);
      },
    };

    const childStore: ActiveTraceContext = {
      ...parentStore,
      currentSpanId: spanId,
    };

    return this.als.run(childStore, async () => {
      try {
        const result = await fn(recorder);
        if (capturedOutput === undefined) {
          capturedOutput = result;
        }
        return result;
      } catch (err: any) {
        status = 'failed';
        capturedOutput = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        if (
          options.spanType === 'llm' &&
          (promptTokens > 0 || completionTokens > 0 || estimatedCredits > 0)
        ) {
          this.als.run(parentStore, () => {
            this.addUsageToTrace({
              promptTokens,
              completionTokens,
              estimatedCredits,
            });
          });
        }
        await this.traceStorage.appendSpan({
          traceId: parentStore.traceId,
          spanId,
          parentSpanId: parentStore.currentSpanId,
          nodeId: options.nodeId ?? null,
          spanType: options.spanType,
          name: options.name,
          modelId: resolvedModelId,
          status,
          startedAt,
          durationMs: Date.now() - startedAt,
          promptTokens,
          completionTokens,
          estimatedCredits,
          input: options.input,
          output: capturedOutput,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        });
      }
    });
  }

  /**
   * 直接记录瞬时或已完成节点 Span（例如条件跳过的节点）
   */
  async recordInstantSpan(params: {
    spanType: AgentSpanType;
    name: string;
    nodeId?: string | null;
    modelId?: string | null;
    status: AgentSpanStatus;
    startedAt?: number;
    durationMs?: number;
    input?: unknown;
    output?: unknown;
    metadata?: Record<string, any> | null;
  }): Promise<void> {
    const parentStore = this.als.getStore();
    if (!parentStore) return;

    await this.traceStorage.appendSpan({
      traceId: parentStore.traceId,
      spanId: this.createSpanId(),
      parentSpanId: parentStore.currentSpanId,
      nodeId: params.nodeId ?? null,
      spanType: params.spanType,
      name: params.name,
      modelId: params.modelId ?? null,
      status: params.status,
      startedAt: params.startedAt ?? Date.now(),
      durationMs: params.durationMs ?? 0,
      input: params.input,
      output: params.output,
      metadata: params.metadata ?? null,
    });
  }

  /**
   * 包装流式 AsyncIterable，捕获全流周期延迟、Token 用量与错误态
   */
  wrapAsyncIterableSpan<
    T extends {
      type?: string;
      error?: unknown;
      failover?: { activeModelId?: string } & Record<string, unknown>;
      delta?: { content?: string };
      usage?: {
        promptTokens?: number;
        completionTokens?: number;
        estimatedTotalCost?: number;
      };
    },
  >(
    options: StartSpanOptions,
    sourceIterable: AsyncIterable<T>,
  ): AsyncIterable<T> {
    const parentStore = this.als.getStore();
    if (!parentStore) {
      return sourceIterable;
    }

    const spanId = this.createSpanId();
    const startedAt = Date.now();
    const traceStorage = this.traceStorage;
    const recordUsage = (usage: {
      promptTokens?: number;
      completionTokens?: number;
      estimatedCredits?: number;
    }) => this.addUsageToTrace(usage);
    const als = this.als;

    return {
      async *[Symbol.asyncIterator]() {
        let status: AgentSpanStatus = 'completed';
        let modelId = options.modelId ?? null;
        let promptTokens = 0;
        let completionTokens = 0;
        let estimatedCredits = 0;
        let textSnippet = '';
        let errorMessage: string | null = null;
        const metadata: Record<string, unknown> = options.metadata
          ? { ...options.metadata }
          : {};

        try {
          for await (const chunk of sourceIterable) {
            if (chunk?.failover?.activeModelId) {
              modelId = chunk.failover.activeModelId;
              metadata.failover = chunk.failover;
            }
            if (chunk?.delta?.content && textSnippet.length < 600) {
              textSnippet += String(chunk.delta.content);
            }
            if (chunk?.usage) {
              promptTokens = Math.max(
                promptTokens,
                Number(chunk.usage.promptTokens || 0),
              );
              completionTokens = Math.max(
                completionTokens,
                Number(chunk.usage.completionTokens || 0),
              );
              estimatedCredits = Math.max(
                estimatedCredits,
                Number(chunk.usage.estimatedTotalCost || 0),
              );
            }
            if (chunk?.type === 'error' && chunk?.error) {
              status = 'failed';
              errorMessage =
                typeof chunk.error === 'string'
                  ? chunk.error
                  : JSON.stringify(chunk.error);
            }
            yield chunk;
          }
        } catch (err: unknown) {
          status = 'failed';
          errorMessage = err instanceof Error ? err.message : String(err);
          throw err;
        } finally {
          als.run(parentStore, () => {
            recordUsage({
              promptTokens,
              completionTokens,
              estimatedCredits,
            });
          });
          await traceStorage.appendSpan({
            traceId: parentStore.traceId,
            spanId,
            parentSpanId: parentStore.currentSpanId,
            nodeId: options.nodeId ?? null,
            spanType: options.spanType,
            name: options.name,
            modelId,
            status,
            startedAt,
            durationMs: Date.now() - startedAt,
            promptTokens,
            completionTokens,
            estimatedCredits,
            input: options.input,
            output: errorMessage || textSnippet,
            metadata: Object.keys(metadata).length > 0 ? metadata : null,
          });
        }
      },
    };
  }
}
