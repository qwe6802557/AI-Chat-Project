import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { sendStreamMessage } from '@/api/chat'
import type { Message, MessageAttachment } from './useConversationManager'

/**
 * 文件数据接口
 */
export interface FileData {
  base64: string
  type: string
  name: string
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
 * 将 FileData 转换为 MessageAttachment
 */
const convertToAttachments = (files: FileData[]): MessageAttachment[] => {
  return files.map(file => ({
    type: mapFileTypeToAttachmentType(file.type),
    name: file.name,
    preview: file.type.startsWith('image/') ? file.base64 : '', // 图片用 base64 作为预览
    base64: file.base64
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
   * 发送消息
   * @param userId 用户 ID
   * @param content 消息文本内容
   * @param files 附件文件列表（可选）
   * @param model 模型名称（可选）
   */
  const sendMessage = async (
    userId: string,
    content: string,
    files?: FileData[],
    model = 'claude-opus-4-5-20251101'
  ) => {
    if (!userId) {
      message.error('请先登录')
      return
    }

    // 必须有内容或文件
    const hasContent = content.trim().length > 0
    const hasFiles = files && files.length > 0

    if (!hasContent && !hasFiles) {
      message.error('请输入消息内容或上传文件')
      return
    }

    // 消息内容作为会话标题（如果有内容），否则用文件名
    const title = hasContent
      ? content
      : (hasFiles ? `[${files![0].name}]` : '新对话')

    const sessionId = await ensureServerSession(userId, title)
    if (!sessionId) {
      message.error('创建会话失败，请稍后重试')
      return
    }

    // 构建附件
    const attachments = hasFiles ? convertToAttachments(files!) : undefined

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content || '', // 允许纯文件消息
      timestamp: Date.now(),
      attachments
    }
    addMessage(userMessage)

    loading.value = true

    // AI 消息索引（第一次收到数据时创建）
    let messageIndex = -1
    let updateCount = 0 // 节流

    try {
      sendStreamMessage(
        {
          userId,
          sessionId,
          message: content || '请分析这些文件', // 如果没有文本，提供默认提示
          model,
          // 传递文件数据
          files: hasFiles ? files : undefined
        },
        {
          // 接收到增量内容
          onMessage: (delta: string) => {
            // 第一次收到数据时创建 AI 消息
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
              // 后续追加内容
              updateMessageContent(messageIndex, delta, true)
            }

            // 节流保存：每50次更新保存一次
            updateCount++
            if (updateCount % 50 === 0) {
              saveConversations()
            }
          },

          // 流式传输完成
          onComplete: (fullMessage: string, _sessionId: string, model: string) => {
            if (messageIndex >= 0) {
              updateMessageContent(messageIndex, fullMessage, false)
            }

            // 清理用户消息中的 base64 数据（节省内存）
            const userMsg = getCurrentMessages().find(m => m.id === userMessage.id)
            if (userMsg?.attachments) {
              userMsg.attachments.forEach(att => {
                // 图片保留 preview（已经是 base64），其他清理
                if (att.type === 'image') {
                  att.base64 = undefined
                } else {
                  att.base64 = undefined
                }
              })
            }

            saveConversations()
            loading.value = false
            console.log('AI 回复完成，模型:', model)
          },

          // 错误处理
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
