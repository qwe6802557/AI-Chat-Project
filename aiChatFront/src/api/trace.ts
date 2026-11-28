/**
 * 分布式 Trace ID 与 Span 全链路可观测查询 API
 */
import request, { type ResponseData } from '@/utils/request'

export type AgentTraceSource = 'web_chat' | 'workflow_debug' | 'workflow_chat' | 'channel'

export type AgentTraceStatus = 'running' | 'completed' | 'failed' | 'aborted'

export type AgentSpanType =
  | 'workflow'
  | 'dag_node'
  | 'llm'
  | 'tool'
  | 'rag'
  | 'memory'
  | 'swarm_handoff'
  | 'channel_dispatch'

export type AgentSpanStatus = 'running' | 'completed' | 'failed' | 'skipped'

export interface AgentTraceItem {
  id: string
  traceId: string
  userId: string
  source: AgentTraceSource
  workflowId?: string | null
  sessionId?: string | null
  channelInstanceId?: string | null
  roleId?: string | null
  title?: string | null
  status: AgentTraceStatus
  durationMs: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCredits: number
  errorSummary?: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentSpanItem {
  id: string
  traceId: string
  spanId: string
  parentSpanId?: string | null
  nodeId?: string | null
  spanType: AgentSpanType
  name: string
  modelId?: string | null
  status: AgentSpanStatus
  startedAt: number
  durationMs: number
  promptTokens: number
  completionTokens: number
  estimatedCredits: number
  inputSummary?: string | null
  outputSummary?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface TraceListResponse {
  items: AgentTraceItem[]
  total: number
  page: number
  pageSize: number
}

export interface TraceStatsSummary {
  days: number
  totalTraces: number
  completedCount: number
  failedCount: number
  successRate: number
  p95DurationMs: number
  totalTokens: number
  totalCredits: number
}

export interface TraceDetailResponse {
  trace: AgentTraceItem
  spans: AgentSpanItem[]
}

export function getTraceList(params?: {
  source?: AgentTraceSource
  status?: AgentTraceStatus
  workflowId?: string
  channelInstanceId?: string
  traceId?: string
  days?: number
  page?: number
  pageSize?: number
}) {
  return request.get<never, ResponseData<TraceListResponse>>('/traces', { params })
}

export function getTraceStats(params?: {
  source?: AgentTraceSource
  workflowId?: string
  days?: number
}) {
  return request.get<never, ResponseData<TraceStatsSummary>>('/traces/stats', { params })
}

export function getTraceDetail(traceId: string) {
  return request.get<never, ResponseData<TraceDetailResponse>>(`/traces/${traceId}`)
}
