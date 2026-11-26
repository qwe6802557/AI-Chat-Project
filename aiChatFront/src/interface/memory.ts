/**
 * 智能体三层记忆系统相关接口
 */

export type MemoryCategory = 'fact' | 'preference' | 'decision' | 'todo'

/**
 * 长期核心画像 (Layer 3)
 */
export interface AgentCoreProfile {
  id: string
  userId: string
  preferences: Record<string, unknown>
  facts: Record<string, unknown>
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
  category: MemoryCategory | string
  content: string
  isArchived: boolean
  score?: number
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
  preferences?: Record<string, unknown>
  facts?: Record<string, unknown>
  rawSummary?: string
}

/**
 * 手动录入日常记忆 DTO
 */
export interface CreateDailyMemoryDto {
  category: MemoryCategory
  content: string
}

/**
 * 手动或自动写入记忆结果（支持语义去重合并提示）
 */
export interface UpsertDailyMemoryResult {
  item: AgentDailyMemory
  action: 'created' | 'merged'
  similarity?: number
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
