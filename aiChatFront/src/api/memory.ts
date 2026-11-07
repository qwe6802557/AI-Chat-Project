/**
 * 三层长短期记忆引擎 API
 */
import request, { type ResponseData } from '@/utils/request'
import type {
  AgentCoreProfile,
  AgentDailyMemory,
  DailyMemoryPageResult,
  QueryDailyMemoryDto,
  UpdateCoreProfileDto,
} from '@/interface/memory'

export type {
  AgentCoreProfile,
  AgentDailyMemory,
  DailyMemoryPageResult,
  QueryDailyMemoryDto,
  UpdateCoreProfileDto,
} from '@/interface/memory'

/**
 * 获取当前用户的长期核心画像
 */
export function getCoreProfile() {
  return request.get<never, ResponseData<AgentCoreProfile>>('/memory/profile')
}

/**
 * 手动就地纠偏与更新核心画像
 */
export function updateCoreProfile(data: UpdateCoreProfileDto) {
  return request.put<never, ResponseData<AgentCoreProfile>>('/memory/profile', data)
}

/**
 * 分页查询日常情境记忆列表
 */
export function getDailyMemories(params?: QueryDailyMemoryDto) {
  return request.get<never, ResponseData<DailyMemoryPageResult>>('/memory/daily', {
    params,
  })
}

/**
 * 彻底遗忘并删除指定日常记忆条目
 */
export function deleteDailyMemory(id: string) {
  return request.delete<never, ResponseData<{ success: boolean; message: string }>>(`/memory/daily/${id}`)
}

/**
 * 手动触发日常记忆向核心画像的深度蒸馏
 */
export function triggerDistillMemories() {
  return request.post<never, ResponseData<AgentCoreProfile>>('/memory/distill')
}
