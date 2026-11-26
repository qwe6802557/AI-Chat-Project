/**
 * 知识库管理与 RAG 检索 API
 */
import request, { type ResponseData } from '@/utils/request'
import { getApiBaseUrl } from '@/utils/common'
import { useAuthStore } from '@/stores'
import type {
  KnowledgeBaseItem,
  KnowledgeDocumentItem,
  KnowledgeChunkItem,
  RagSearchResultItem,
  SearchKnowledgeBaseParams,
  ChunkContextResponse,
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
  DocumentProgressStreamEvent,
} from '@/interface/knowledge'

export function getKnowledgeBases() {
  return request.get<never, ResponseData<KnowledgeBaseItem[]>>('/knowledge-bases')
}

export function getKnowledgeBaseDetail(id: string) {
  return request.get<never, ResponseData<KnowledgeBaseItem>>(`/knowledge-bases/${id}`)
}

export function createKnowledgeBase(data: CreateKnowledgeBaseDto) {
  return request.post<never, ResponseData<KnowledgeBaseItem>>('/knowledge-bases', data)
}

export function updateKnowledgeBase(id: string, data: UpdateKnowledgeBaseDto) {
  return request.put<never, ResponseData<KnowledgeBaseItem>>(`/knowledge-bases/${id}`, data)
}

export function deleteKnowledgeBase(id: string) {
  return request.delete<never, ResponseData<void>>(`/knowledge-bases/${id}`)
}

export function getKnowledgeDocuments(kbId: string) {
  return request.get<never, ResponseData<KnowledgeDocumentItem[]>>(`/knowledge-bases/${kbId}/documents`)
}

export function uploadKnowledgeDocument(kbId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<never, ResponseData<KnowledgeDocumentItem>>(
    `/knowledge-bases/${kbId}/documents`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
}

export function deleteKnowledgeDocument(docId: string) {
  return request.delete<never, ResponseData<void>>(`/knowledge-bases/documents/${docId}`)
}

export function retryKnowledgeDocument(docId: string) {
  return request.post<never, ResponseData<KnowledgeDocumentItem>>(
    `/knowledge-bases/documents/${docId}/retry`,
  )
}

/**
 * 订阅指定知识库的文档异步解析进度 SSE 流（使用 fetch 携带 Bearer 鉴权）
 */
export function subscribeKnowledgeDocumentEvents(
  kbId: string,
  callbacks: {
    onEvent: (event: DocumentProgressStreamEvent) => void
    onError?: (error: Error) => void
  },
): { abort: () => void } {
  const controller = new AbortController()
  const baseURL = getApiBaseUrl()
  const authStore = useAuthStore()
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const connect = async () => {
    if (controller.signal.aborted) return

    try {
      const token = authStore.getToken()
      const response = await fetch(`${baseURL}/knowledge-bases/${kbId}/documents/events`, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`订阅文档进度失败 (${response.status})`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('浏览器不支持流式读取响应')
      }

      reconnectAttempts = 0
      const decoder = new TextDecoder()
      let buffer = ''

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload) continue

          try {
            const event = JSON.parse(payload) as DocumentProgressStreamEvent
            callbacks.onEvent(event)
          } catch {
            // 忽略非 JSON 心跳或注释片段
          }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const err = error instanceof Error ? error : new Error(String(error))
      callbacks.onError?.(err)
    }

    if (!controller.signal.aborted) {
      const delayMs = Math.min(15000, 1500 * Math.pow(2, reconnectAttempts))
      reconnectAttempts += 1
      reconnectTimer = setTimeout(() => {
        void connect()
      }, delayMs)
    }
  }

  void connect()

  return {
    abort: () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      controller.abort()
    },
  }
}

export function getKnowledgeChunks(
  docId: string,
  page = 1,
  pageSize = 20,
  params?: { keyword?: string; enabledOnly?: boolean },
) {
  return request.get<
    never,
    ResponseData<{
      items: KnowledgeChunkItem[]
      total: number
      page?: number
      pageSize?: number
    }>
  >(`/knowledge-bases/documents/${docId}/chunks`, {
    params: {
      page,
      pageSize,
      ...(params?.keyword ? { keyword: params.keyword } : {}),
      ...(params?.enabledOnly ? { enabledOnly: 'true' } : {}),
    },
  })
}

export function getKnowledgeChunkContext(chunkId: string, window = 1) {
  return request.get<never, ResponseData<ChunkContextResponse>>(
    `/knowledge-bases/chunks/${chunkId}/context`,
    {
      params: { window },
    },
  )
}

export function updateKnowledgeChunk(
  chunkId: string,
  data: { content?: string; isEnabled?: boolean },
) {
  return request.patch<never, ResponseData<KnowledgeChunkItem>>(
    `/knowledge-bases/chunks/${chunkId}`,
    data,
  )
}

export function searchKnowledgeBase(data: SearchKnowledgeBaseParams) {
  return request.post<never, ResponseData<RagSearchResultItem[]>>('/knowledge-bases/search', data)
}
