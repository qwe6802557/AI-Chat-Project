export type AttachmentType = 'image' | 'pdf' | 'document'

export interface MessageUsageStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedInputCost?: number
  estimatedOutputCost?: number
  estimatedTotalCost?: number
}

export interface MessageChargeSummary {
  id: string
  clientRequestId: string
  modelId: string
  billingMode: string
  credits: number
  status: string
}

export interface MessageReasoning {
  mode: 'summary' | 'raw' | 'omitted'
  source: 'provider_summary' | 'provider_block' | 'extracted_tag' | 'none'
  title?: string
  content: string
  status?: 'streaming' | 'done'
}

export interface ConversationUsageSummary {
  lastModel?: string | null
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  totalEstimatedCost: number
  totalChargedCredits: number
}

export type ConversationSortMode = 'recent' | 'tokens_desc' | 'cost_desc'

export type ConversationFilterMode = 'all' | 'with_tokens' | 'with_cost'

export interface ConversationStatsSummary {
  totalSessions: number
  visibleSessions: number
  billableSessions: number
  totalTokens: number
  totalEstimatedCost: number
  topModel?: string | null
}

/**
 * 消息附件接口
 */
export interface MessageAttachment {
  type: AttachmentType
  name: string
  preview: string
  base64?: string
  url?: string
}

/**
 * 消息接口
 */
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  streaming?: boolean
  model?: string
  usage?: MessageUsageStats
  charge?: MessageChargeSummary
  reasoning?: MessageReasoning
  attachments?: MessageAttachment[]
}

/**
 * 对话接口
 */
export interface Conversation {
  id: string
  title: string
  messages: Message[]
  usageSummary?: ConversationUsageSummary
  createdAt: number
  updatedAt: number
  sessionId?: string
}
