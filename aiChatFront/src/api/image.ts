import type { AxiosRequestConfig } from 'axios'
import request, { type ResponseData } from '@/utils/request'
import type {
  CreateImageGenerationParams,
  ImageGenerationTask,
  ImageHistoryResponse,
} from '@/interface/image'

/**
 * 发起图片生成任务
 */
export function generateImageApi(params: CreateImageGenerationParams, config?: AxiosRequestConfig) {
  return request.post<never, ResponseData<ImageGenerationTask>>('/images/generations', params, config)
}

/**
 * 获取用户生图历史记录列表
 */
export function getImageHistoryApi(page: number = 1, pageSize: number = 20) {
  return request.get<never, ResponseData<ImageHistoryResponse>>('/images/history', {
    params: { page, pageSize },
  })
}
