/**
 * Pinia Stores 统一导出
 */

// 认证状态
export { useAuthStore } from './auth'
export type { UserInfo } from '@/types/user'

// 对话管理
export { useConversationStore } from './conversation'
export type { Conversation, Message, MessageAttachment } from '@/interface/conversation'
