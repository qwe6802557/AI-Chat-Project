export type AttachmentType = 'image' | 'pdf' | 'document'

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
  attachments?: MessageAttachment[]
}

/**
 * 对话接口
 */
export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  sessionId?: string
}
