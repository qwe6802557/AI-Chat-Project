import type { AxiosRequestConfig } from 'axios'
import request, { type ResponseData } from '@/utils/request'
import type {
  CreateImageGenerationParams,
  ImageGenerationTask,
  ImageHistoryResponse,
} from '@/interface/image'

/**
 * 发起图片生成任务 (独立配置 180 秒长超时，防止大模型生图被过早中断)
 */
export function generateImageApi(params: CreateImageGenerationParams, config?: AxiosRequestConfig) {
  return request.post<never, ResponseData<ImageGenerationTask>>('/images/generations', params, {
    timeout: 180000,
    ...config,
  })
}

/**
 * 获取用户生图历史记录列表
 */
export function getImageHistoryApi(page: number = 1, pageSize: number = 20) {
  return request.get<never, ResponseData<ImageHistoryResponse>>('/images/history', {
    params: { page, pageSize },
  })
}

/**
 * 删除指定的生图历史记录及对应图片资源
 */
export function deleteImageTaskApi(taskId: string) {
  return request.delete<never, ResponseData<{ success: boolean; message: string }>>(`/images/${taskId}`)
}

