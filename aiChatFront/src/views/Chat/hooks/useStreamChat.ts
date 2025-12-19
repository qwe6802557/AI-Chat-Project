import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { sendStreamMessage } from '@/api/chat'
import type { Message, MessageAttachment } from './useConversationManager'

/**
 * 文件数据接口（兼容旧版 base64 方式）
 */
export interface FileData {
  base64: string
  type: string
  name: string
}

/**
 * 服务端上传文件信息
 */
export interface ServerFileInfo {
  id: string       // 服务端文件 ID
  url: string      // 服务端文件访问 URL
  name: string
  type: string
}

/**
 * 对话管理器方法接口
 */
interface ConversationMethods {
  addMessage: (message: Message) => void
  updateMessageContent: (index: number, content: string, isAppend?: boolean) => void
  deleteMessageByIndex: (index: number) => void
  updateSessionId: (sessionId: string) => void
  saveConversations: () => void
  ensureServerSession: (userId: string, title?: string) => Promise<string | null>
}

/**
 * 将文件类型映射为附件类型
 */
const mapFileTypeToAttachmentType = (mimeType: string): MessageAttachment['type'] => {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'document'
}

/**
 * 将 FileData 转换为 MessageAttachment（兼容旧版）
 */
const convertToAttachments = (files: FileData[]): MessageAttachment[] => {
  return files.map(file => ({
    type: mapFileTypeToAttachmentType(file.type),
    name: file.name,
    preview: file.type.startsWith('image/') ? file.base64 : '',
    base64: file.base64
  }))
}

/**
 * 将服务端文件信息转换为 MessageAttachment（推荐方式）
 */
const convertServerFilesToAttachments = (serverFiles: ServerFileInfo[]): MessageAttachment[] => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  return serverFiles.map(file => ({
    type: mapFileTypeToAttachmentType(file.type),
    name: file.name,
    // 使用服务端 URL 作为预览（跨设备可访问）
    url: `${baseURL}${file.url}`,
    preview: `${baseURL}${file.url}`
  }))
}

/**
 * 流式聊天 Hook
 *
 * @description 流式聊天逻辑：消息发送、流式接收、错误处理等
 */
export function useStreamChat(
  conversationMethods: ConversationMethods,
  getCurrentMessages: () => Message[],
) {
  const { addMessage, updateMessageContent, deleteMessageByIndex,  saveConversations, ensureServerSession } = conversationMethods
  const loading = ref(false)

  /**
   * 发送消息（推荐：使用已上传的 fileIds）
   * @param userId 用户 ID
   * @param content 消息文本内容
   * @param options 可选参数
   */
  const sendMessage = async (
    userId: string,
    content: string,
    options?: {
      /** 已上传到服务器的文件 ID 列表（推荐） */
      fileIds?: string[]
      /** 服务端文件信息（用于本地显示附件） */
      serverFiles?: ServerFileInfo[]
      /** 兼容旧版：base64 文件列表（不推荐） */
      files?: FileData[]
      /** 模型名称 */
      model?: string
    }
  ) => {
    const {
      fileIds,
      serverFiles,
      files,
      model = 'claude-opus-4-5-20251101'
    } = options || {}

    if (!userId) {
      message.error('请先登录')
      return
    }

    // 必须有内容或文件
    const hasContent = content.trim().length > 0
    const hasFileIds = fileIds && fileIds.length > 0
    const hasFiles = files && files.length > 0
    const hasAnyFiles = hasFileIds || hasFiles

    if (!hasContent && !hasAnyFiles) {
      message.error('请输入消息内容或上传文件')
      return
    }

    // 消息内容作为会话标题（如果有内容），否则用文件名
    const firstFileName = serverFiles?.[0]?.name || files?.[0]?.name
    const title = hasContent
      ? content
      : (firstFileName ? `[${firstFileName}]` : '新对话')

    const sessionId = await ensureServerSession(userId, title)
    if (!sessionId) {
      message.error('创建会话失败，请稍后重试')
      return
    }

    // 构建附件（优先使用服务端文件信息）
    let attachments: MessageAttachment[] | undefined
    if (serverFiles && serverFiles.length > 0) {
      attachments = convertServerFilesToAttachments(serverFiles)
    } else if (hasFiles) {
      attachments = convertToAttachments(files!)
    }

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content || '',
      timestamp: Date.now(),
      attachments
    }
    addMessage(userMessage)

    loading.value = true

    // AI 消息索引（第一次收到数据时创建）
    let messageIndex = -1
    let updateCount = 0

    try {
      sendStreamMessage(
        {
          userId,
          sessionId,
          message: content || '请分析这些文件',
          model,
          // 优先使用 fileIds（推荐），否则使用 files（兼容旧版）
          fileIds: hasFileIds ? fileIds : undefined,
          files: (!hasFileIds && hasFiles) ? files : undefined
        },
        {
          onMessage: (delta: string) => {
            if (messageIndex === -1) {
              const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: delta,
                timestamp: Date.now()
              }
              addMessage(assistantMessage)
              messageIndex = getCurrentMessages().length - 1
              loading.value = false
            } else {
              updateMessageContent(messageIndex, delta, true)
            }

            updateCount++
            if (updateCount % 50 === 0) {
              saveConversations()
            }
          },

          onComplete: (fullMessage: string, _sessionId: string, model: string) => {
            if (messageIndex >= 0) {
              updateMessageContent(messageIndex, fullMessage, false)
            }

            // 清理用户消息中的 base64 数据（节省内存）
            const userMsg = getCurrentMessages().find(m => m.id === userMessage.id)
            if (userMsg?.attachments) {
              userMsg.attachments.forEach(att => {
                att.base64 = undefined
              })
            }

            saveConversations()
            loading.value = false
            console.log('AI 回复完成，模型:', model)
          },

          onError: (error: string) => {
            message.error(`${error}`)
            if (messageIndex >= 0) {
              deleteMessageByIndex(messageIndex)
            }
            loading.value = false
          }
        }
      )
    } catch (error: unknown) {
      console.log(error)
      message.error('发送消息失败，请稍后重试')
      if (messageIndex >= 0) {
        deleteMessageByIndex(messageIndex)
      }
      loading.value = false
    }
  }

  return {
    loading,
    sendMessage
  }
}
