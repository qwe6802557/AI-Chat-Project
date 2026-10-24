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
  isDefault?: boolean
  category?: 'chat' | 'image' | 'video' | 'voice'
  billingMode?: string
  creditCost?: number
  sortOrder?: number
  reasoningCapability?: 'none' | 'summary' | 'raw'
  reasoningStrategy?: 'provider_preferred' | 'summary_preferred'
  reasoningIntegration?: 'responses_summary' | 'anthropic_blocks' | 'inline_tag' | 'none'
  reasoningBadgeLabel?: string
  providerId: string
  provider?: BackendAiProvider
}

export interface GetActiveModelsParams {
  includeProvider?: boolean
  category?: 'chat' | 'image' | 'video' | 'voice'
}

export interface ModelLatencyResult {
  id: string
  modelId: string
  modelName: string
  providerName: string
  category: 'chat' | 'image' | 'video' | 'voice'
  status: 'healthy' | 'slow' | 'timeout' | 'error'
  connectTimeMs: number
  firstTokenMs: number
  totalTimeMs: number
  httpStatus: number
  sampleOutput?: string
  errorMessage?: string
  testedAt: string
}

export interface UpdateModelDto {
  modelName?: string
  modelId?: string
  inputPrice?: number
  outputPrice?: number
  contextLength?: number
  maxOutput?: number
  availability?: number
  tps?: number
  description?: string
  isActive?: boolean
  isDefault?: boolean
  category?: 'chat' | 'image' | 'video' | 'voice'
  creditCost?: number
  sortOrder?: number
  providerId?: string
}
