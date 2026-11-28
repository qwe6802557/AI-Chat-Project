/**
 * 可视化 DAG 工作流编排与调试运行 API
 */
import request, { type ResponseData } from '@/utils/request'
import { useAuthStore } from '@/stores'
import { getApiBaseUrl } from '@/utils/common'
import type { SwarmTimelineEvent, UsageStats } from '@/interface/chat'

export type DagNodeType = 'start' | 'agent' | 'rag' | 'tool' | 'condition' | 'end'

export type DagNodeRuntimeStatus = 'running' | 'completed' | 'failed' | 'skipped'

export interface DagConditionRule {
  id: string
  label: string
  variable: string
  operator:
    | 'contains'
    | 'not_contains'
    | 'equals'
    | 'not_equals'
    | 'regex'
    | 'gt'
    | 'lt'
    | 'not_empty'
  value?: string
}

export interface DagNodeData {
  label: string
  description?: string
  defaultInput?: string
  roleId?: string | null
  modelId?: string | null
  systemPrompt?: string
  promptTemplate?: string
  knowledgeBaseIds?: string[]
  enabledTools?: string[]
  maxLoops?: number
  queryTemplate?: string
  topK?: number
  toolName?: string
  argsTemplate?: Record<string, string>
  rules?: DagConditionRule[]
  responseTemplate?: string
}

export interface DagWorkflowNode {
  id: string
  type: DagNodeType
  position: { x: number; y: number }
  data: DagNodeData
}

export interface DagWorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
}

export interface DagWorkflowGraph {
  nodes: DagWorkflowNode[]
  edges: DagWorkflowEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export interface WorkflowItem {
  id: string
  userId: string
  name: string
  description?: string | null
  status: 'draft' | 'published'
  version: number
  draftGraph: DagWorkflowGraph
  publishedGraph?: DagWorkflowGraph | null
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface DagDebugStreamEvent {
  type: 'trace_started' | 'dag_node_status' | 'agent_timeline_event' | 'done' | 'error'
  traceId?: string
  nodeId?: string
  nodeType?: DagNodeType
  label?: string
  status?: DagNodeRuntimeStatus
  modelId?: string | null
  durationMs?: number
  outputSnippet?: string
  error?: string
  timelineEvent?: SwarmTimelineEvent
  message?: string
  usage?: UsageStats
  chargedCredits?: number
  nodeStatuses?: Record<string, DagNodeRuntimeStatus>
  timeline?: SwarmTimelineEvent[]
}

export function getWorkflowList() {
  return request.get<never, ResponseData<WorkflowItem[]>>('/workflows')
}

export function getPublishedWorkflows() {
  return request.get<never, ResponseData<WorkflowItem[]>>('/workflows/published')
}

export function getWorkflowDetail(id: string) {
  return request.get<never, ResponseData<WorkflowItem>>(`/workflows/${id}`)
}

export function createWorkflow(data: {
  name: string
  description?: string | null
  draftGraph?: DagWorkflowGraph
}) {
  return request.post<never, ResponseData<WorkflowItem>>('/workflows', data)
}

export function updateWorkflow(
  id: string,
  data: {
    name?: string
    description?: string | null
    draftGraph?: DagWorkflowGraph
  },
) {
  return request.put<never, ResponseData<WorkflowItem>>(`/workflows/${id}`, data)
}

export function publishWorkflow(id: string) {
  return request.post<never, ResponseData<WorkflowItem>>(`/workflows/${id}/publish`)
}

export function deleteWorkflow(id: string) {
  return request.delete<never, ResponseData<{ success: boolean; message: string }>>(
    `/workflows/${id}`,
  )
}

/**
 * 发起流式 DAG 工作流调试运行（SSE 实时推送节点运行态与 Trace ID）
 */
export function debugRunWorkflowStream(
  workflowId: string,
  input: string,
  callbacks: {
    onEvent: (event: DagDebugStreamEvent) => void
    onError: (errMsg: string) => void
  },
): { close: () => void } {
  const baseURL = getApiBaseUrl()
  const authStore = useAuthStore()
  const token = authStore.getToken()
  const abortController = new AbortController()

  const start = async () => {
    try {
      const response = await fetch(`${baseURL}/workflows/${workflowId}/debug-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ input }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const text = await response.text()
        let errMessage = `HTTP error ${response.status}`
        try {
          const parsed = JSON.parse(text)
          errMessage = parsed.message || parsed.error || errMessage
        } catch {
          if (text.trim()) errMessage = text.trim()
        }
        throw new Error(errMessage)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取工作流 SSE 响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        if (abortController.signal.aborted) return
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6)) as DagDebugStreamEvent
            callbacks.onEvent(evt)
          } catch {
            // 忽略半包心跳
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      callbacks.onError(err instanceof Error && err.message ? err.message : '工作流调试运行异常')
    }
  }

  void start()
  return {
    close: () => abortController.abort(),
  }
}
