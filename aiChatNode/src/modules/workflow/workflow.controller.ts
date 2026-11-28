import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { DagWorkflowGraph } from './entities/agent-workflow.entity';
import { WorkflowService } from './services/workflow.service';

interface AuthenticatedRequest {
  user: { id: string };
}

/**
 * 智能体可视化 DAG 工作流编排与调试运行控制器
 */
@ApiTags('智能编排-工作流')
@ApiBearerAuth()
@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户的全部工作流定义' })
  async listWorkflows(@Request() req: AuthenticatedRequest) {
    return this.workflowService.listWorkflows(req.user.id);
  }

  @Get('published')
  @ApiOperation({
    summary: '获取当前用户已发布的工作流列表（供对话与通道绑定）',
  })
  async listPublishedWorkflows(@Request() req: AuthenticatedRequest) {
    return this.workflowService.listPublishedWorkflows(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个工作流详情' })
  async getWorkflow(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.workflowService.getWorkflow(req.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: '创建新的工作流定义' })
  async createWorkflow(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      name: string;
      description?: string | null;
      draftGraph?: DagWorkflowGraph;
    },
  ) {
    return this.workflowService.createWorkflow(req.user.id, body);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新工作流草稿图与元信息' })
  async updateWorkflow(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      draftGraph?: DagWorkflowGraph;
    },
  ) {
    return this.workflowService.updateWorkflow(req.user.id, id, body);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: '校验拓扑无环并发布不可变运行快照' })
  async publishWorkflow(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.workflowService.publishWorkflow(req.user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除工作流定义' })
  async deleteWorkflow(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.workflowService.deleteWorkflow(req.user.id, id);
    return { success: true, message: '工作流已删除' };
  }

  @Post(':id/debug-run')
  @ApiOperation({
    summary: '以 SSE 流式调试试跑工作流草稿（实时推回节点态与 Trace ID）',
  })
  async debugRunWorkflow(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { input?: string },
    @Res() res: Response,
  ) {
    const input = (body?.input || '').trim();
    if (!input) {
      throw new BadRequestException('调试输入不能为空');
    }

    const abortController = new AbortController();
    const onClose = () => abortController.abort();
    res.on('close', onClose);
    res.on('error', onClose);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const writeSse = (payload: Record<string, unknown>) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      const outcome = await this.workflowService.debugRunStream({
        userId: req.user.id,
        workflowId: id,
        input,
        abortSignal: abortController.signal,
        onTraceReady: (traceId) => {
          writeSse({ type: 'trace_started', traceId });
        },
        onEvent: (evt) => {
          if (evt.type === 'node_status') {
            writeSse({
              type: 'dag_node_status',
              ...evt.event,
            });
          } else if (evt.type === 'timeline') {
            writeSse({
              type: 'agent_timeline_event',
              timelineEvent: evt.timelineEvent,
            });
          }
        },
      });

      if (outcome.status === 'failed' || outcome.status === 'aborted') {
        writeSse({
          type: 'error',
          traceId: outcome.traceId,
          error: outcome.error || '工作流运行未完成',
        });
      } else {
        writeSse({
          type: 'done',
          traceId: outcome.traceId,
          message: outcome.content,
          usage: outcome.usage,
          durationMs: outcome.durationMs,
          chargedCredits: outcome.chargedCredits,
          nodeStatuses: outcome.nodeStatuses,
          timeline: outcome.timeline,
        });
      }
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      writeSse({ type: 'error', error: errMsg });
    } finally {
      res.off('close', onClose);
      res.off('error', onClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
}
