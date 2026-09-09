/**
 * 生图任务状态
 */
export type ImageTaskStatus = 'pending' | 'success' | 'failed';

/**
 * 生图任务记录接口
 */
export interface ImageGenerationTask {
  id: string;
  userId: string;
  prompt: string;
  modelId: string;
  aspectRatio: string;
  resolution: string;
  quality: string;
  numGenerations: number;
  imageUrls: string[];
  costCredits: number;
  status: ImageTaskStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 发起生图请求参数
 */
export interface CreateImageGenerationParams {
  prompt: string;
  model?: string;
  n?: number;
  aspect_ratio?: string;
  resolution?: string;
  quality?: string;
}

/**
 * 生图历史分页响应
 */
export interface ImageHistoryResponse {
  items: ImageGenerationTask[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
