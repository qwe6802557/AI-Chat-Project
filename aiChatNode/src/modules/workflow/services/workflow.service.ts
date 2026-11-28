import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditsService } from '../../credits/credits.service';
import { CreditBusinessType } from '../../credits/types/credits.types';
import { TraceContextService } from '../../observability/services/trace-context.service';
import {
  AgentWorkflow,
  type DagWorkflowGraph,
} from '../entities/agent-workflow.entity';
import {
  createStarterWorkflowGraph,
  validateDagGraph,
} from '../utils/dag-validator.util';
import {
  DagWorkflowExecutorService,
  type DagExecutionResult,
  type DagExecutionStreamEvent,
} from './dag-workflow-executor.service';

export interface CreateWorkflowDto {
  name: string;
  description?: string | null;
  draftGraph?: DagWorkflowGraph;
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string | null;
  draftGraph?: DagWorkflowGraph;
}

/**
 * 工作流定义 CRUD、草稿/发布快照管理与多节点按实结算调度服务
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  private static readonly MIN_START_CREDITS = 1;

  constructor(
    @InjectRepository(AgentWorkflow)
    private readonly workflowRepo: Repository<AgentWorkflow>,
    private readonly dagExecutor: DagWorkflowExecutorService,
    private readonly creditsService: CreditsService,
    @Optional()
    private readonly traceContext?: TraceContextService,
  ) {}

  async listWorkflows(userId: string): Promise<AgentWorkflow[]> {
    return this.workflowRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async listPublishedWorkflows(userId: string): Promise<AgentWorkflow[]> {
    return this.workflowRepo.find({
      where: { userId, status: 'published' },
      order: { publishedAt: 'DESC', updatedAt: 'DESC' },
    });
  }

  async getWorkflow(userId: string, id: string): Promise<AgentWorkflow> {
    const workflow = await this.workflowRepo.findOne({
      where: { id, userId },
    });
    if (!workflow) {
      throw new NotFoundException('未找到指定工作流或无权访问');
    }
    return workflow;
  }

  async createWorkflow(
    userId: string,
    dto: CreateWorkflowDto,
  ): Promise<AgentWorkflow> {
    const cleanName = dto.name?.trim();
    if (!cleanName) {
      throw new BadRequestException('工作流名称不能为空');
    }

    const graph = dto.draftGraph || createStarterWorkflowGraph();
    validateDagGraph(graph);

    const entity = this.workflowRepo.create({
      userId,
      name: cleanName,
      description: dto.description?.trim() || null,
      status: 'draft',
      version: 1,
      draftGraph: graph,
      publishedGraph: null,
      publishedAt: null,
    });

    return this.workflowRepo.save(entity);
  }

  async updateWorkflow(
    userId: string,
    id: string,
    dto: UpdateWorkflowDto,
  ): Promise<AgentWorkflow> {
    const workflow = await this.getWorkflow(userId, id);

    if (dto.name !== undefined) {
      const cleanName = dto.name.trim();
      if (!cleanName) {
        throw new BadRequestException('工作流名称不能为空');
      }
      workflow.name = cleanName;
    }

    if (dto.description !== undefined) {
      workflow.description = dto.description?.trim() || null;
    }

    if (dto.draftGraph !== undefined) {
      validateDagGraph(dto.draftGraph);
      workflow.draftGraph = dto.draftGraph;
    }

    return this.workflowRepo.save(workflow);
  }

  /**
   * 校验并将草稿固化为不可变发布快照（防止编辑中途破坏线上对话或通道流量）
   */
  async publishWorkflow(userId: string, id: string): Promise<AgentWorkflow> {
    const workflow = await this.getWorkflow(userId, id);
    validateDagGraph(workflow.draftGraph);

    const nextVersion =
      workflow.status === 'published' ? workflow.version + 1 : workflow.version;
    workflow.publishedGraph = JSON.parse(
      JSON.stringify(workflow.draftGraph),
    ) as DagWorkflowGraph;
    workflow.status = 'published';
    workflow.version = nextVersion;
    workflow.publishedAt = new Date();

    return this.workflowRepo.save(workflow);
  }

  async deleteWorkflow(userId: string, id: string): Promise<void> {
    const workflow = await this.getWorkflow(userId, id);
    await this.workflowRepo.remove(workflow);
  }

  /**
   * 校验用户启动积分底线，并在工作流执行后依据各节点实际 LLM Span 消费精确扣费
   */
  async assertStartCreditsAvailable(userId: string): Promise<void> {
    const snapshot = await this.creditsService.getSnapshotForUser(userId);
    if (snapshot.remaining < WorkflowService.MIN_START_CREDITS) {
      throw new BadRequestException(
        `当前可用积分不足（剩余 ${snapshot.remaining}），至少需要 ${WorkflowService.MIN_START_CREDITS} 积分才可启动工作流`,
      );
    }
  }

  async settleTraceCreditsSafely(params: {
    userId: string;
    workflowId: string;
    workflowName: string;
    traceId?: string | null;
  }): Promise<number> {
    const usageSummary = this.traceContext?.getCurrentUsageSummary();
    const rawEstimated = Number(usageSummary?.estimatedCredits || 0);
    const hasTokenConsumption =
      (usageSummary?.promptTokens || 0) +
        (usageSummary?.completionTokens || 0) >
      0;
    const chargedCredits = hasTokenConsumption
      ? Math.max(1, Math.ceil(rawEstimated))
      : 0;

    if (chargedCredits <= 0) {
      return 0;
    }

    try {
      await this.creditsService.deductDirectCredits({
        userId: params.userId,
        amount: chargedCredits,
        businessType: CreditBusinessType.CHAT_MESSAGE,
        businessId: params.traceId || params.workflowId,
        remark: `工作流[${params.workflowName}]多节点实耗结算`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`工作流[${params.workflowId}]扣减实耗积分异常: ${msg}`);
    }

    return chargedCredits;
  }

  /**
   * 调试运行当前草稿（流式回传节点实时态，带全链路 Trace ID）
   */
  async debugRunStream(params: {
    userId: string;
    workflowId: string;
    input: string;
    abortSignal?: AbortSignal;
    onTraceReady?: (traceId: string) => void;
    onEvent: (event: DagExecutionStreamEvent) => void;
  }): Promise<
    DagExecutionResult & { traceId?: string | null; chargedCredits: number }
  > {
    const workflow = await this.getWorkflow(params.userId, params.workflowId);
    await this.assertStartCreditsAvailable(params.userId);

    const runCore = async (
      traceId: string | null,
    ): Promise<
      DagExecutionResult & { traceId?: string | null; chargedCredits: number }
    > => {
      if (traceId && params.onTraceReady) {
        params.onTraceReady(traceId);
      }

      const gen = this.dagExecutor.executeStream({
        graph: workflow.draftGraph,
        userId: params.userId,
        input: params.input,
        abortSignal: params.abortSignal,
      });

      while (true) {
        const next = await gen.next();
        if (next.done) {
          const result = next.value;
          if (result.status === 'failed' || result.status === 'aborted') {
            this.traceContext?.markCurrentTraceOutcome(
              result.status,
              result.error,
            );
          }
          const chargedCredits = await this.settleTraceCreditsSafely({
            userId: params.userId,
            workflowId: workflow.id,
            workflowName: workflow.name,
            traceId,
          });
          if (chargedCredits > 0) {
            this.traceContext?.ensureMinimumTraceCredits(chargedCredits);
          }
          return {
            ...result,
            traceId,
            chargedCredits,
          };
        }
        params.onEvent(next.value);
      }
    };

    if (!this.traceContext) {
      return runCore(null);
    }

    return this.traceContext.runWithTrace(
      {
        userId: params.userId,
        source: 'workflow_debug',
        workflowId: workflow.id,
        title: `调试: ${workflow.name}`,
      },
      async (traceId) => runCore(traceId),
    );
  }

  /**
   * 外部通道或 Web 对话运行已发布的工作流快照
   */
  async executePublishedWorkflow(params: {
    userId: string;
    workflowId: string;
    input: string;
    sessionId?: string;
    defaultModelId?: string;
    abortSignal?: AbortSignal;
    onEvent?: (event: DagExecutionStreamEvent) => void;
  }): Promise<DagExecutionResult> {
    const workflow = await this.getWorkflow(params.userId, params.workflowId);
    const graph = workflow.publishedGraph || workflow.draftGraph;

    if (workflow.status !== 'published' || !workflow.publishedGraph) {
      throw new BadRequestException(
        `工作流 [${workflow.name}] 尚未发布快照，请先在编排画板完成发布`,
      );
    }

    const gen = this.dagExecutor.executeStream({
      graph,
      userId: params.userId,
      input: params.input,
      sessionId: params.sessionId,
      defaultModelId: params.defaultModelId,
      abortSignal: params.abortSignal,
    });

    while (true) {
      const next = await gen.next();
      if (next.done) {
        const result = next.value;
        if (result.status === 'failed' || result.status === 'aborted') {
          this.traceContext?.markCurrentTraceOutcome(
            result.status,
            result.error,
          );
        }
        return result;
      }
      params.onEvent?.(next.value);
    }
  }
}
