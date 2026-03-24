/**
 * 返回的附件信息
 */
export interface BackendAttachment {
  id: string
  url: string
  name: string
  type: string
  sizeBytes: number
  width?: number | null
  height?: number | null
}

/**
 * 用量统计
 */
export interface UsageStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedInputCost?: number
  estimatedOutputCost?: number
  estimatedTotalCost?: number
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
  usage: UsageStats
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
  usageSummary?: {
    lastModel?: string | null
    totalPromptTokens: number
    totalCompletionTokens: number
    totalTokens: number
    totalEstimatedCost: number
  }
  createdAt: string
  updatedAt: string
  chatMessages?: BackendChatMessage[]
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
  fileIds?: string[]
}

/**
 * 聊天消息响应
 */
export interface ChatMessageResponse {
  id: string
  sessionId: string
  message: string
  model: string
  usage: UsageStats
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
  usage?: UsageStats
  error?: string
}

/**
 * 流式聊天控制器
 */
export interface StreamRequestController {
  close: () => void
}

/**
 * 获取聊天历史参数
 */
export interface GetHistoryParams {
  sessionId?: string
  userId?: string
  limit?: number
}

/**
 * 获取会话列表参数
 */
export interface GetSessionListParams {
  userId: string
  includeArchived?: boolean
}

/**
 * 创建新会话参数
 */
export interface CreateSessionParams {
  userId: string
  title?: string
}

/**
 * 删除会话参数
 */
export interface DeleteSessionParams {
  id: string
}

/**
 * 清空所有会话参数
 */
export interface ClearAllSessionsParams {
  userId: string
}

/**
 * 清空所有会话响应
 */
export interface ClearAllSessionsResponse {
  message: string
  deletedCount: number
}

/**
 * 获取会话消息参数
 */
export interface GetSessionMessagesParams {
  sessionId: string
  page?: number
  pageSize?: number
  order?: 'asc' | 'desc'
}

/**
 * 会话消息响应
 */
export interface SessionMessagesResponse {
  messages: BackendChatMessage[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 更新会话标题参数
 */
export interface UpdateSessionTitleParams {
  id: string
  title: string
}

/**
 * 上传文件响应
 */
export interface UploadedFileResponse {
  id: string
  url: string
  name: string
  mime: string
  sizeBytes: number
  width?: number | null
  height?: number | null
}
