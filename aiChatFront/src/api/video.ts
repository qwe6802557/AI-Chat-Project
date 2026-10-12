import type { AxiosRequestConfig } from 'axios'
import request, { type ResponseData } from '@/utils/request'
import type {
  CreateVideoGenerationParams,
  VideoGenerationTask,
  VideoHistoryResponse,
  VideoStatusResponse,
} from '@/interface/video'

/**
 * 发起视频生成任务 (配置 60 秒超时用于任务提交)
 */
export function generateVideoApi(
  params: CreateVideoGenerationParams,
  config?: AxiosRequestConfig,
) {
  return request.post<never, ResponseData<VideoGenerationTask>>('/videos/generations', params, {
    timeout: 60000,
    ...config,
  })
}

/**
 * 获取用户视频生成历史记录列表
 */
export function getVideoHistoryApi(page: number = 1, pageSize: number = 20) {
  return request.get<never, ResponseData<VideoHistoryResponse>>('/videos/history', {
    params: { page, pageSize },
  })
}

/**
 * 轮询单个视频任务的最新生成状态
 */
export function getVideoStatusApi(taskId: string) {
  return request.get<never, ResponseData<VideoStatusResponse>>(`/videos/status/${taskId}`)
}

/**
 * 删除指定的视频历史记录及对应本地媒体资源
 */
export function deleteVideoTaskApi(taskId: string) {
  return request.delete<never, ResponseData<{ success: boolean; message: string }>>(`/videos/${taskId}`)
}
