/**
 * 聊天相关 API
 */
import request, { type ResponseData } from '@/utils/request'

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
export function sendStreamMessage(
  data: SendMessageParams,
  callbacks: {
    onMessage: (delta: string, sessionId?: string) => void
    onComplete: (fullMessage: string, sessionId: string, model: string) => void
    onError: (error: string) => void
  }
): EventSource {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  const token = localStorage.getItem('token')

  // 使用 fetch 发送 POST 请求并接收 SSE 流
  const fetchStream = async () => {
    try {
      const response = await fetch(`${baseURL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(data),
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
        const { done, value } = await reader.read()

        if (done) break

        // 解码数据块
        buffer += decoder.decode(value, { stream: true })

        // 处理 SSE 数据（可能包含多条消息）
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
                  chunk.model || 'claude-sonnet-4-5-20250929'
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
      console.log('流式请求失败:', error)
      const errorMessage =
        error instanceof Error ? error.message : '流式请求失败'
      callbacks.onError(errorMessage)
    }
  }

  // 启动流式请求
  fetchStream()

  // 返回一个虚拟的 EventSource 对象（用于兼容）
  return {} as EventSource
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
  return request.get<never, ResponseData<any[]>>('/chat/history', { params })
}

/**
 * 获取会话列表
 */
export interface GetSessionListParams {
  userId: string
  includeArchived?: boolean
}

export function getSessionList(params: GetSessionListParams) {
  return request.get<never, ResponseData<any[]>>('/chat/session/list', { params })
}

/**
 * 创建新会话
 */
export interface CreateSessionParams {
  userId: string
  title?: string
}

export function createSession(data: CreateSessionParams) {
  return request.post<never, ResponseData<any>>('/chat/session/create', data)
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
