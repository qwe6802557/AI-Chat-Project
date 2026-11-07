/**
 * 智能体三层记忆系统相关接口
 */

/**
 * 长期核心画像 (Layer 3)
 */
export interface AgentCoreProfile {
  id: string
  userId: string
  preferences: Record<string, any>
  facts: Record<string, any>
  rawSummary: string
  version: number
  createdAt: string
  updatedAt: string
}

/**
 * 日常情境工作记忆条目 (Layer 2)
 */
export interface AgentDailyMemory {
  id: string
  userId: string
  sessionId?: string
  dateKey: string
  category: 'decision' | 'preference' | 'work_progress' | 'fact' | 'insight' | string
  content: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 单条召回记忆
 */
export interface MemoryRecallItem {
  id: string
  category: string
  summary: string
  similarity?: number
}

/**
 * 对话召回记忆摘要载荷
 */
export interface MemoryRecallPayload {
  profileRecalled: boolean
  recalledCount: number
  coreSummary?: string
  items: MemoryRecallItem[]
}

/**
 * 更新核心画像 DTO
 */
export interface UpdateCoreProfileDto {
  preferences?: Record<string, any>
  facts?: Record<string, any>
  rawSummary?: string
}

/**
 * 查询日常记忆 DTO
 */
export interface QueryDailyMemoryDto {
  dateKey?: string
  category?: string
  keyword?: string
  page?: number
  limit?: number
}

/**
 * 分页记忆查询返回结构
 */
export interface DailyMemoryPageResult {
  items: AgentDailyMemory[]
  total: number
  page: number
  limit: number
  totalPages: number
}
