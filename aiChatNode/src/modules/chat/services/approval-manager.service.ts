import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import { randomUUID } from 'crypto';
import type { ToolRiskEvaluation } from '../../tools/types/tools.types';

export interface PendingApprovalData {
  approvalId: string;
  sessionId: string;
  userId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  riskEvaluation: ToolRiskEvaluation;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  createdAt: number;
  expiresAt: number;
  decidedAt?: number;
  decisionReason?: string;
  decisionUserId?: string;
}

export type ApprovalDecision = 'approved' | 'rejected' | 'timeout';

@Injectable()
export class ApprovalManagerService {
  private readonly logger = new Logger(ApprovalManagerService.name);
  private readonly keyPrefix = 'chat:approval:';
  private readonly ttlSeconds = 600;

  private readonly pendingResolvers = new Map<
    string,
    (res: { decision: ApprovalDecision; reason?: string }) => void
  >();

  private readonly memoryStore = new Map<string, PendingApprovalData>();

  constructor(private readonly redisService: RedisService) {}

  /**
   * 构造待审批的高危工具调用任务
   */
  async createPendingApproval(params: {
    sessionId: string;
    userId: string;
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    riskEvaluation: ToolRiskEvaluation;
  }): Promise<PendingApprovalData> {
    const approvalId = randomUUID();
    const now = Date.now();
    const data: PendingApprovalData = {
      approvalId,
      sessionId: params.sessionId,
      userId: params.userId,
      toolCallId: params.toolCallId,
      toolName: params.toolName,
      args: params.args,
      riskEvaluation: params.riskEvaluation,
      status: 'pending',
      createdAt: now,
      expiresAt: now + this.ttlSeconds * 1000,
    };

    this.memoryStore.set(approvalId, data);

    try {
      if (this.redisService.isReady()) {
        await this.redisService.set(
          `${this.keyPrefix}${approvalId}`,
          JSON.stringify(data),
          { EX: this.ttlSeconds },
        );
      }
    } catch (err: any) {
      this.logger.warn(`写入 Redis 审批暂态失败: ${err.message}`);
    }

    this.logger.log(`创建高危工具待审批任务: approvalId=${approvalId}, tool=${params.toolName}`);
    return data;
  }

  /**
   * 挂起并等待操作者裁决（或超时自动收敛）
   */
  async waitForDecision(
    approvalId: string,
    timeoutMs: number = 600000,
  ): Promise<{ decision: ApprovalDecision; reason?: string }> {
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.pendingResolvers.delete(approvalId);
      };

      const resolveCallback = (result: { decision: ApprovalDecision; reason?: string }) => {
        cleanup();
        resolve(result);
      };

      this.pendingResolvers.set(approvalId, resolveCallback);

      timer = setTimeout(async () => {
        this.logger.warn(`审批等待超时: approvalId=${approvalId}`);
        await this.markTimeout(approvalId);
        resolveCallback({
          decision: 'timeout',
          reason: '审批超时未确认（超过 10 分钟），系统自动终止执行',
        });
      }, Math.min(timeoutMs, this.ttlSeconds * 1000));
    });
  }

  /**
   * 操作者裁决
   */
  async resolveApproval(
    approvalId: string,
    decision: 'approved' | 'rejected',
    userId?: string,
    reason?: string,
  ): Promise<PendingApprovalData> {
    const existing = await this.getPendingApproval(approvalId);
    if (!existing) {
      throw new NotFoundException(`审批任务不存在或已过期: ${approvalId}`);
    }

    if (existing.status !== 'pending') {
      throw new BadRequestException(`该审批任务已处理完毕，当前状态: ${existing.status}`);
    }

    const now = Date.now();
    existing.status = decision;
    existing.decidedAt = now;
    existing.decisionReason = reason;
    existing.decisionUserId = userId;

    this.memoryStore.set(approvalId, existing);

    try {
      if (this.redisService.isReady()) {
        const remainingTtl = Math.max(1, Math.floor((existing.expiresAt - now) / 1000));
        await this.redisService.set(
          `${this.keyPrefix}${approvalId}`,
          JSON.stringify(existing),
          { EX: remainingTtl },
        );
      }
    } catch (err: any) {
      this.logger.warn(`更新 Redis 审批状态失败: ${err.message}`);
    }

    const resolver = this.pendingResolvers.get(approvalId);
    if (resolver) {
      resolver({ decision, reason });
    }

    this.logger.log(`高危审批决策完成: approvalId=${approvalId}, 裁决=${decision}`);
    return existing;
  }

  /**
   * 获取审批任务详情
   */
  async getPendingApproval(approvalId: string): Promise<PendingApprovalData | null> {
    try {
      if (this.redisService.isReady()) {
        const raw = await this.redisService.get(`${this.keyPrefix}${approvalId}`);
        if (raw) {
          return JSON.parse(raw) as PendingApprovalData;
        }
      }
    } catch (err: any) {
      this.logger.warn(`读取 Redis 审批状态失败: ${err.message}`);
    }

    return this.memoryStore.get(approvalId) || null;
  }

  /**
   * 标记为超时
   */
  private async markTimeout(approvalId: string): Promise<void> {
    const existing = await this.getPendingApproval(approvalId);
    if (existing && existing.status === 'pending') {
      existing.status = 'timeout';
      this.memoryStore.set(approvalId, existing);
      try {
        if (this.redisService.isReady()) {
          await this.redisService.set(
            `${this.keyPrefix}${approvalId}`,
            JSON.stringify(existing),
            { EX: 60 },
          );
        }
      } catch {
        // 静默容错
      }
    }
  }
}
