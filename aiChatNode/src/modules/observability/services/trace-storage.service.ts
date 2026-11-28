import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  AgentTrace,
  type AgentTraceSource,
  type AgentTraceStatus,
} from '../entities/agent-trace.entity';
import {
  AgentSpan,
  type AgentSpanStatus,
  type AgentSpanType,
} from '../entities/agent-span.entity';
import { summarizeTracePayload } from '../utils/trace-sanitizer.util';

export interface CreateTraceInput {
  traceId: string;
  userId: string;
  source: AgentTraceSource;
  workflowId?: string | null;
  sessionId?: string | null;
  channelInstanceId?: string | null;
  roleId?: string | null;
  title?: string | null;
}

export interface FinalizeTraceInput {
  traceId: string;
  status: AgentTraceStatus;
  durationMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCredits: number;
  errorSummary?: string | null;
}

export interface AppendSpanInput {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  nodeId?: string | null;
  spanType: AgentSpanType;
  name: string;
  modelId?: string | null;
  status: AgentSpanStatus;
  startedAt: number;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCredits?: number;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, any> | null;
}

export interface ListTracesQuery {
  source?: AgentTraceSource;
  status?: AgentTraceStatus;
  workflowId?: string;
  channelInstanceId?: string;
  traceId?: string;
  days?: number;
  page?: number;
  pageSize?: number;
}

/**
 * 分布式追踪数据持久化与 30 天滚动清理服务
 */
@Injectable()
export class TraceStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TraceStorageService.name);
  private cleanupTimer: NodeJS.Timeout | null = null;
  private static readonly RETENTION_DAYS = 30;
  private static readonly CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(AgentTrace)
    private readonly traceRepo: Repository<AgentTrace>,
    @InjectRepository(AgentSpan)
    private readonly spanRepo: Repository<AgentSpan>,
  ) {}

  onModuleInit(): void {
    // 延迟执行首轮滚动清理，避免阻塞服务冷启动
    const initialTimer = setTimeout(() => {
      void this.cleanupExpiredTraces();
    }, 30 * 1000);
    initialTimer.unref();

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredTraces();
    }, TraceStorageService.CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 写入 Trace 初始记录
   */
  async createTrace(input: CreateTraceInput): Promise<void> {
    try {
      const entity = this.traceRepo.create({
        traceId: input.traceId,
        userId: input.userId,
        source: input.source,
        workflowId: input.workflowId ?? null,
        sessionId: input.sessionId ?? null,
        channelInstanceId: input.channelInstanceId ?? null,
        roleId: input.roleId ?? null,
        title: input.title ? summarizeTracePayload(input.title, 150) : null,
        status: 'running',
        durationMs: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCredits: 0,
        errorSummary: null,
      });
      await this.traceRepo.save(entity);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`创建 Trace[${input.traceId}] 失败: ${msg}`);
    }
  }

  /**
   * 收敛更新 Trace 结束态与聚合消耗
   */
  async finalizeTrace(input: FinalizeTraceInput): Promise<void> {
    try {
      await this.traceRepo.update(
        { traceId: input.traceId },
        {
          status: input.status,
          durationMs: Math.max(0, Math.round(input.durationMs)),
          totalPromptTokens: Math.max(0, Math.round(input.totalPromptTokens)),
          totalCompletionTokens: Math.max(
            0,
            Math.round(input.totalCompletionTokens),
          ),
          totalCredits: Number(Math.max(0, input.totalCredits).toFixed(4)),
          errorSummary: input.errorSummary
            ? summarizeTracePayload(input.errorSummary, 512)
            : null,
        },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`收敛 Trace[${input.traceId}] 失败: ${msg}`);
    }
  }

  /**
   * 追加单条脱敏裁剪后的 Span 记录
   */
  async appendSpan(input: AppendSpanInput): Promise<void> {
    try {
      const entity = this.spanRepo.create({
        traceId: input.traceId,
        spanId: input.spanId,
        parentSpanId: input.parentSpanId ?? null,
        nodeId: input.nodeId ?? null,
        spanType: input.spanType,
        name: summarizeTracePayload(input.name, 150) || input.spanType,
        modelId: input.modelId ?? null,
        status: input.status,
        startedAt: Math.max(0, Math.round(input.startedAt)),
        durationMs: Math.max(0, Math.round(input.durationMs)),
        promptTokens: Math.max(0, Math.round(input.promptTokens ?? 0)),
        completionTokens: Math.max(0, Math.round(input.completionTokens ?? 0)),
        estimatedCredits: Number(
          Math.max(0, input.estimatedCredits ?? 0).toFixed(4),
        ),
        inputSummary: summarizeTracePayload(input.input, 1024),
        outputSummary: summarizeTracePayload(input.output, 1024),
        metadata: input.metadata ?? null,
      });
      await this.spanRepo.save(entity);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `写入 Span[${input.traceId}/${input.spanId}] 失败: ${msg}`,
      );
    }
  }

  /**
   * 分页查询用户的 Trace 列表
   */
  async listTraces(userId: string, query: ListTracesQuery = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 20)));

    const qb = this.traceRepo
      .createQueryBuilder('trace')
      .where('trace.userId = :userId', { userId });

    if (query.source) {
      qb.andWhere('trace.source = :source', { source: query.source });
    }
    if (query.status) {
      qb.andWhere('trace.status = :status', { status: query.status });
    }
    if (query.workflowId) {
      qb.andWhere('trace.workflowId = :workflowId', {
        workflowId: query.workflowId,
      });
    }
    if (query.channelInstanceId) {
      qb.andWhere('trace.channelInstanceId = :channelInstanceId', {
        channelInstanceId: query.channelInstanceId,
      });
    }
    if (query.traceId?.trim()) {
      qb.andWhere('trace.traceId ILIKE :traceIdPattern', {
        traceIdPattern: `%${query.traceId.trim()}%`,
      });
    }
    if (query.days && query.days > 0) {
      const since = new Date(
        Date.now() - Math.min(90, query.days) * 24 * 60 * 60 * 1000,
      );
      qb.andWhere('trace.createdAt >= :since', { since });
    }

    const [items, total] = await qb
      .orderBy('trace.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取聚合可观测真实 KPI 统计（总数、成功率、P95 延迟、Token 与积分）
   */
  async getTraceStats(
    userId: string,
    query: Pick<ListTracesQuery, 'source' | 'workflowId' | 'days'> = {},
  ) {
    const days = Math.min(90, Math.max(1, Number(query.days || 7)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const qb = this.traceRepo
      .createQueryBuilder('trace')
      .select('COUNT(*)::int', 'totalTraces')
      .addSelect(
        `COUNT(*) FILTER (WHERE trace.status = 'completed')::int`,
        'completedCount',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE trace.status IN ('failed', 'aborted'))::int`,
        'failedCount',
      )
      .addSelect(
        `COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY trace."durationMs") FILTER (WHERE trace.status != 'running'), 0)`,
        'p95DurationMs',
      )
      .addSelect(
        'COALESCE(SUM(trace."totalPromptTokens" + trace."totalCompletionTokens"), 0)::bigint',
        'totalTokens',
      )
      .addSelect('COALESCE(SUM(trace."totalCredits"), 0)', 'totalCredits')
      .where('trace.userId = :userId', { userId })
      .andWhere('trace.createdAt >= :since', { since });

    if (query.source) {
      qb.andWhere('trace.source = :source', { source: query.source });
    }
    if (query.workflowId) {
      qb.andWhere('trace.workflowId = :workflowId', {
        workflowId: query.workflowId,
      });
    }

    const row = await qb.getRawOne<{
      totalTraces?: string | number | null;
      completedCount?: string | number | null;
      failedCount?: string | number | null;
      p95DurationMs?: string | number | null;
      totalTokens?: string | number | null;
      totalCredits?: string | number | null;
    }>();
    const totalTraces = Number(row?.totalTraces ?? 0);
    const completedCount = Number(row?.completedCount ?? 0);
    const failedCount = Number(row?.failedCount ?? 0);
    const finishedCount = completedCount + failedCount;
    const successRate =
      finishedCount > 0
        ? Number(((completedCount / finishedCount) * 100).toFixed(1))
        : 0;

    return {
      days,
      totalTraces,
      completedCount,
      failedCount,
      successRate,
      p95DurationMs: Math.round(Number(row?.p95DurationMs ?? 0)),
      totalTokens: Number(row?.totalTokens ?? 0),
      totalCredits: Number(Number(row?.totalCredits ?? 0).toFixed(2)),
    };
  }

  /**
   * 按 traceId 获取完整 Trace 与时序 Span 树
   */
  async getTraceDetail(userId: string, traceId: string) {
    const trace = await this.traceRepo.findOne({
      where: { traceId, userId },
    });

    if (!trace) {
      throw new NotFoundException(`未找到追踪记录: ${traceId}`);
    }

    const spans = await this.spanRepo.find({
      where: { traceId },
      order: { startedAt: 'ASC', createdAt: 'ASC' },
    });

    return {
      trace,
      spans,
    };
  }

  /**
   * 滚动清理超过保留天数的历史 Trace（关联 Span 由外键 CASCADE 自动清理）
   */
  async cleanupExpiredTraces(
    retentionDays = TraceStorageService.RETENTION_DAYS,
  ): Promise<number> {
    try {
      const cutoff = new Date(
        Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000,
      );
      const result = await this.traceRepo.delete({
        createdAt: LessThan(cutoff),
      });
      const affected = Number(result.affected ?? 0);
      if (affected > 0) {
        this.logger.log(
          `[Trace清理] 已滚动清除 ${affected} 条超过 ${retentionDays} 天的历史链路记录`,
        );
      }
      return affected;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Trace清理] 执行异常: ${msg}`);
      return 0;
    }
  }
}
