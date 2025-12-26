/**
 * 聊天相关 API
 */
import request, { type ResponseData } from '@/utils/request'

// ---数据类型---

/**
 * 返回的附件信息
 */
export interface BackendAttachment {
  id: string
  url: string       // 文件访问路径，如 /files/uuid
  name: string
  type: string      // MIME type
  sizeBytes: number
  width?: number | null
  height?: number | null
}

/**
 * 聊天消息
 */
export interface BackendChatMessage {
  id: string
  userId: string
  sessionId: string
  userMessage: string
  aiMessage: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** 消息附件（后端返回） */
  attachments?: BackendAttachment[]
  createdAt: string
  updatedAt: string
}

/**
 * 后端会话数据
 */
export interface BackendChatSession {
  id: string
  userId: string
  title: string
  isArchived: boolean
  isDeleted: boolean
  lastMessagePreview: string | null
  lastActiveAt: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
  chatMessages?: BackendChatMessage[]
}

// ---请求参数类型---

/**
 * 文件数据接口
 */
export interface FileDataParam {
  base64: string  // data:xxx;base64,...
  type: string    // MIME type
  name: string    // 文件名
}

/**
 * 发送聊天消息请求参数
 */
export interface SendMessageParams {
  userId: string
  sessionId?: string
  message: string
  model?: string
  temperature?: number
  maxTokens?: number
  /** 已上传的文件 ID 列表 */
  fileIds?: string[]
  /** 附件文件列表 - base64 方式（兼容旧版） */
  files?: FileDataParam[]
}

/**
 * 聊天消息响应
 */
export interface ChatMessageResponse {
  id: string
  sessionId: string
  message: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  createdAt: string
}

/**
 * 流式聊天数据块
 */
export interface StreamChunk {
  delta: string
  finish_reason: string | null
  sessionId?: string
  message?: string
  model?: string
  error?: string
}

/**
 * 发送聊天消息（非流式）
 */
export function sendMessage(data: SendMessageParams) {
  return request.post<never, ResponseData<ChatMessageResponse>>('/chat/create', data)
}

/**
 * 发送流式聊天消息
 * 使用 SSE
 */
export interface StreamRequestController {
  close: () => void
}

export function sendStreamMessage(
  data: SendMessageParams,
  callbacks: {
    onMessage: (delta: string, sessionId?: string) => void
    onComplete: (fullMessage: string, sessionId: string, model: string) => void
    onError: (error: string) => void
  }
): StreamRequestController {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  const token = localStorage.getItem('token')
  const abortController = new AbortController()

  // 使用fetch发送并接收SSE流
  const fetchStream = async () => {
    try {
      const response = await fetch(`${baseURL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(data),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      let fullMessage = ''
      let buffer = ''

      while (true) {
        if (abortController.signal.aborted) {
          return
        }
        const { done, value } = await reader.read()

        if (done) break

        // 解码数据块
        buffer += decoder.decode(value, { stream: true })

        // 处理SSE数据-可能包含多条消息
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一行不完整的数据

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6) // 去掉 "data: " 前缀

            try {
              const chunk: StreamChunk = JSON.parse(dataStr)

              // 检查是否有错误
              if (chunk.error) {
                callbacks.onError(chunk.error)
                return
              }

              // 处理增量内容
              if (chunk.delta) {
                fullMessage += chunk.delta
                callbacks.onMessage(chunk.delta, chunk.sessionId)
              }

              // 检查是否完成
              if (chunk.finish_reason) {
                callbacks.onComplete(
                  chunk.message || fullMessage,
                  chunk.sessionId || '',
                  chunk.model || 'claude-opus-4-5-20251101'
                )
                return
              }
            } catch (e) {
              console.log('解析 SSE 数据失败:', e, dataStr)
            }
          }
        }
      }
    } catch (error: unknown) {
      // 主动取消-不视为错误
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      console.log('流式请求失败:', error)
      const errorMessage =
        error instanceof Error ? error.message : '流式请求失败'
      callbacks.onError(errorMessage)
    }
  }

  // 启动流式请求
  fetchStream()

  return {
    close: () => abortController.abort(),
  }
}

/**
 * 获取聊天历史
 */
export interface GetHistoryParams {
  sessionId?: string
  userId?: string
  limit?: number
}

export function getHistory(params: GetHistoryParams) {
  return request.get<never, ResponseData<never[]>>('/chat/history', { params })
}

/**
 * 获取会话列表
 */
export interface GetSessionListParams {
  userId: string
  includeArchived?: boolean
}

export function getSessionList(params: GetSessionListParams) {
  return request.get<never, ResponseData<BackendChatSession[]>>('/chat/session/list', { params })
}

/**
 * 创建新会话
 */
export interface CreateSessionParams {
  userId: string
  title?: string
}

export function createSession(data: CreateSessionParams) {
  return request.post<never, ResponseData<BackendChatSession>>('/chat/session/create', data)
}

/**
 * 删除会话
 */
export interface DeleteSessionParams {
  id: string
}

export function deleteSession(data: DeleteSessionParams) {
  return request.post<never, ResponseData<void>>('/chat/session/delete', data)
}

/**
 * 清空所有会话
 */
export interface ClearAllSessionsParams {
  userId: string
}

export interface ClearAllSessionsResponse {
  message: string
  deletedCount: number
}

export function clearAllSessions(data: ClearAllSessionsParams) {
  return request.post<never, ResponseData<ClearAllSessionsResponse>>('/chat/session/clear-all', data)
}

/**
 * 获取会话消息
 */
export interface GetSessionMessagesParams {
  sessionId: string
  page?: number
  pageSize?: number
  /** 排序方式：asc正序，desc倒序 */
  order?: 'asc' | 'desc'
}

export interface SessionMessagesResponse {
  messages: BackendChatMessage[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function getSessionMessages(params: GetSessionMessagesParams) {
  return request.get<never, ResponseData<SessionMessagesResponse>>('/chat/session/messages', { params })
}

/**
 * 更新会话标题
 */
export interface UpdateSessionTitleParams {
  id: string
  title: string
}

export function updateSessionTitle(data: UpdateSessionTitleParams) {
  return request.post<never, ResponseData<BackendChatSession>>('/chat/session/update', data)
}

// ---文件上传---

/**
 * 上传文件响应
 */
export interface UploadedFileResponse {
  id: string
  url: string       // 访问路径，如 /files/uuid
  name: string
  mime: string
  sizeBytes: number
  width?: number | null
  height?: number | null
}

/**
 * 上传图片文件
 * - 最多 4 张
 * - 单张 <= 5MB
 * - 服务端会自动压缩重编码
 */
export async function uploadFiles(files: File[]): Promise<ResponseData<UploadedFileResponse[]>> {
  console.log('[uploadFiles] 收到文件数量:', files.length)
  console.log('[uploadFiles] 文件列表:', files)

  const formData = new FormData()
  files.forEach((file, index) => {
    console.log(`[uploadFiles] 添加文件 ${index}:`, file?.name, file?.size, file instanceof File)
    if (file instanceof File) {
      formData.append('files', file)
    }
  })

  // 检查 FormData 内容
  console.log('[uploadFiles] FormData entries:')
  for (const [key, value] of formData.entries()) {
    console.log(`  ${key}:`, value)
  }

  // 不要手动设置 Content-Type，让 axios 自动处理 boundary
  return request.post<never, ResponseData<UploadedFileResponse[]>>('/files/upload', formData)
}
