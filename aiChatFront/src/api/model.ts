import request, { type ResponseData } from '@/utils/request'
import type {
  BackendAiModel,
  GetActiveModelsParams,
} from '@/interface/model'

export type {
  BackendAiProvider,
  BackendAiModel,
  GetActiveModelsParams,
} from '@/interface/model'

/**
 * 获取启用的模型列表
 */
export function getActiveModels(params: GetActiveModelsParams = {}) {
  return request.get<never, ResponseData<BackendAiModel[]>>('/ai-model/list-active', { params })
}
