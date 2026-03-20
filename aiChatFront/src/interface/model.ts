export interface BackendAiProvider {
  id: string
  name: string
  description?: string
  website?: string
  isActive: boolean
}

export interface BackendAiModel {
  id: string
  modelName: string
  modelId: string
  inputPrice: number | string
  outputPrice: number | string
  contextLength: number
  maxOutput: number
  availability: number | string
  tps: number
  description?: string
  isActive: boolean
  providerId: string
  provider?: BackendAiProvider
}

export interface GetActiveModelsParams {
  includeProvider?: boolean
}
