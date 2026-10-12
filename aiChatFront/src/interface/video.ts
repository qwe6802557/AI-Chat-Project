/**
 * 视频生成任务状态
 */
export type VideoTaskStatus = 'pending' | 'processing' | 'success' | 'failed'

/**
 * 视频任务记录接口
 */
export interface VideoGenerationTask {
  id: string
  userId: string
  prompt: string
  modelId: string
  imageUrl?: string | null
  aspectRatio: string
  duration: number
  videoUrl?: string | null
  upstreamTaskId?: string | null
  costCredits: number
  status: VideoTaskStatus
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * 发起视频生成请求参数
 */
export interface CreateVideoGenerationParams {
  prompt: string
  model?: string
  image?: string
  aspect_ratio?: '16:9' | '9:16' | '1:1' | string
}

/**
 * 视频历史分页响应
 */
export interface VideoHistoryResponse {
  list: VideoGenerationTask[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * 轮询视频状态响应
 */
export interface VideoStatusResponse {
  id: string
  status: VideoTaskStatus
  videoUrl?: string | null
  errorMessage?: string | null
  updatedAt: string
}
