import request, { type ResponseData } from '@/utils/request'
import type {
  BackendAiModel,
  GetActiveModelsParams,
  ModelLatencyResult,
  UpdateModelDto,
} from '@/interface/model'

export type {
  BackendAiProvider,
  BackendAiModel,
  GetActiveModelsParams,
  ModelLatencyResult,
  UpdateModelDto,
} from '@/interface/model'

/**
 * 获取启用的模型列表
 */
export function getActiveModels(params: GetActiveModelsParams = {}) {
  return request.get<never, ResponseData<BackendAiModel[]>>('/ai-model/list-active', { params })
}

/**
 * 获取所有模型列表（含已停用模型，超管管理使用）
 */
export function getAllModels(includeProvider = true) {
  return request.get<never, ResponseData<BackendAiModel[]>>('/ai-model/list', {
    params: { includeProvider: includeProvider ? 'true' : 'false' },
  })
}

/**
 * 更新模型（超管）
 */
export function updateModel(id: string, data: UpdateModelDto) {
  return request.post<never, ResponseData<BackendAiModel>>('/ai-model/update', data, {
    params: { id },
  })
}

/**
 * 设置为系统默认模型（超管）
 */
export function setDefaultModel(id: string) {
  return request.post<never, ResponseData<BackendAiModel>>('/ai-model/set-default', {}, {
    params: { id },
  })
}

/**
 * 测试模型响应速度（超管）
 */
export function testModelLatency(id: string) {
  return request.post<never, ResponseData<ModelLatencyResult>>('/ai-model/test-latency', {}, {
    params: { id },
  })
}
