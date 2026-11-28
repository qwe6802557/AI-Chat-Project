import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type {
  AgentTraceSource,
  AgentTraceStatus,
} from './entities/agent-trace.entity';
import { TraceStorageService } from './services/trace-storage.service';

interface AuthenticatedRequest {
  user: { id: string };
}

/**
 * 全链路分布式可观测 Trace 与 Span 瀑布流查询控制器
 */
@ApiTags('可观测中心-Traces')
@ApiBearerAuth()
@Controller('traces')
@UseGuards(JwtAuthGuard)
export class ObservabilityController {
  constructor(private readonly traceStorage: TraceStorageService) {}

  @Get()
  @ApiOperation({ summary: '分页查询当前用户的分布式追踪链路列表' })
  async listTraces(
    @Request() req: AuthenticatedRequest,
    @Query('source') source?: AgentTraceSource,
    @Query('status') status?: AgentTraceStatus,
    @Query('workflowId') workflowId?: string,
    @Query('channelInstanceId') channelInstanceId?: string,
    @Query('traceId') traceId?: string,
    @Query('days') days?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.traceStorage.listTraces(req.user.id, {
      source,
      status,
      workflowId,
      channelInstanceId,
      traceId,
      days: days ? Number(days) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({
    summary: '获取链路总数、成功率、P95 延迟与 Token/积分聚合统计',
  })
  async getTraceStats(
    @Request() req: AuthenticatedRequest,
    @Query('source') source?: AgentTraceSource,
    @Query('workflowId') workflowId?: string,
    @Query('days') days?: string,
  ) {
    return this.traceStorage.getTraceStats(req.user.id, {
      source,
      workflowId,
      days: days ? Number(days) : undefined,
    });
  }

  @Get(':traceId')
  @ApiOperation({ summary: '按 Trace ID 查询完整 Span 树与脱敏摘要详情' })
  async getTraceDetail(
    @Request() req: AuthenticatedRequest,
    @Param('traceId') traceId: string,
  ) {
    return this.traceStorage.getTraceDetail(req.user.id, traceId);
  }
}
