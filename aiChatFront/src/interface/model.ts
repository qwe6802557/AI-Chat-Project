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
  billingMode?: string
  creditCost?: number
  reasoningCapability?: 'none' | 'summary' | 'raw'
  reasoningStrategy?: 'provider_preferred' | 'summary_preferred'
  reasoningIntegration?: 'responses_summary' | 'anthropic_blocks' | 'inline_tag' | 'none'
  reasoningBadgeLabel?: string
  providerId: string
  provider?: BackendAiProvider
}

export interface GetActiveModelsParams {
  includeProvider?: boolean
}
