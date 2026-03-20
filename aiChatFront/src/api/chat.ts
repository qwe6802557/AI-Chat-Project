/**
 * 聊天相关 API
 */
import request, { type ResponseData } from '@/utils/request'
import type {
  BackendChatSession,
  SendMessageParams,
  ChatMessageResponse,
  StreamChunk,
  StreamRequestController,
  GetHistoryParams,
  GetSessionListParams,
  CreateSessionParams,
  DeleteSessionParams,
  ClearAllSessionsParams,
  ClearAllSessionsResponse,
  GetSessionMessagesParams,
  SessionMessagesResponse,
  UpdateSessionTitleParams,
  UploadedFileResponse,
} from '@/interface/chat'

export type {
  BackendAttachment,
  BackendChatSession,
  BackendChatMessage,
  FileDataParam,
  SendMessageParams,
  ChatMessageResponse,
  StreamChunk,
  StreamRequestController,
  GetHistoryParams,
  GetSessionListParams,
  CreateSessionParams,
  DeleteSessionParams,
  ClearAllSessionsParams,
  ClearAllSessionsResponse,
  GetSessionMessagesParams,
  SessionMessagesResponse,
  UpdateSessionTitleParams,
  UploadedFileResponse,
} from '@/interface/chat'
export function sendMessage(data: SendMessageParams) {
  return request.post<never, ResponseData<ChatMessageResponse>>('/chat/create', data)
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
                  chunk.model || 'GLM-5'
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

export function getHistory(params: GetHistoryParams) {
  return request.get<never, ResponseData<never[]>>('/chat/history', { params })
}

export function getSessionList(params: GetSessionListParams) {
  return request.get<never, ResponseData<BackendChatSession[]>>('/chat/session/list', { params })
}

export function createSession(data: CreateSessionParams) {
  return request.post<never, ResponseData<BackendChatSession>>('/chat/session/create', data)
}

export function deleteSession(data: DeleteSessionParams) {
  return request.post<never, ResponseData<void>>('/chat/session/delete', data)
}

export function clearAllSessions(data: ClearAllSessionsParams) {
  return request.post<never, ResponseData<ClearAllSessionsResponse>>('/chat/session/clear-all', data)
}

export function getSessionMessages(params: GetSessionMessagesParams) {
  return request.get<never, ResponseData<SessionMessagesResponse>>('/chat/session/messages', { params })
}

export function updateSessionTitle(data: UpdateSessionTitleParams) {
  return request.post<never, ResponseData<BackendChatSession>>('/chat/session/update', data)
}

// ---文件上传---

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

  // 不手动设置 Content-Type，让 axios 自动处理 boundary
  return request.post<never, ResponseData<UploadedFileResponse[]>>('/files/upload', formData)
}
