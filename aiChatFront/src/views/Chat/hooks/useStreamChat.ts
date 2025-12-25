import { ref, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import { sendStreamMessage, type StreamRequestController } from '@/api/chat'
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
  addMessageToConversation: (conversationId: string, message: Message) => void
  updateMessageContentById: (
    conversationId: string,
    messageId: string,
    content: string,
    isAppend?: boolean
  ) => void
  patchMessageById: (
    conversationId: string,
    messageId: string,
    patch: Partial<Message>
  ) => void
  clearMessageAttachmentBase64: (conversationId: string, messageId: string) => void
  deleteMessageById: (conversationId: string, messageId: string) => void
  saveConversations: (options?: { immediate?: boolean }) => void
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
    // 使用服务端URL作为预览-跨设备可访问
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
) {
  const {
    addMessageToConversation,
    updateMessageContentById,
    patchMessageById,
    clearMessageAttachmentBase64,
    deleteMessageById,
    saveConversations,
    ensureServerSession
  } = conversationMethods
  const loading = ref(false)

  const activeRequestId = ref<string | null>(null)
  const activeController = ref<StreamRequestController | null>(null)
  const activeStreamContext = ref<{
    conversationId: string
    assistantMessageId: string | null
  } | null>(null)

  const createId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as Crypto).randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  /**
   * 取消当前流式请求（如切换会话/重新发送/清空对话）
   */
  const cancelCurrentStream = () => {
    activeRequestId.value = null
    activeController.value?.close()
    activeController.value = null

    // 取消时-将已生成的AI消息标记为非流式，避免UI卡在 streaming 状态
    if (activeStreamContext.value?.assistantMessageId) {
      patchMessageById(activeStreamContext.value.conversationId, activeStreamContext.value.assistantMessageId, {
        streaming: false,
      })
      saveConversations({ immediate: true })
    }
    activeStreamContext.value = null
    loading.value = false
  }

  onBeforeUnmount(() => {
    cancelCurrentStream()
  })

  /**
   * 发送消息
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
    // 新请求开始前，先取消旧请求，避免串会话/串消息
    cancelCurrentStream()

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

    // 消息内容作为会话标题（如果有内容）-否则用文件名
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
    const userMessageId = createId()
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: content || '',
      timestamp: Date.now(),
      attachments
    }
    addMessageToConversation(sessionId, userMessage)

    // 流式请求状态
    loading.value = true
    const requestId = createId()
    activeRequestId.value = requestId
    activeStreamContext.value = { conversationId: sessionId, assistantMessageId: null }

    // AI 消息 id（首次收到 delta 时创建）
    let assistantMessageId: string | null = null
    let pendingDelta = ''
    let flushRafId: number | null = null

    const scheduleFlushDelta = () => {
      if (flushRafId !== null) return
      flushRafId = requestAnimationFrame(() => {
        flushRafId = null

        // 请求已切换/取消，丢弃缓存，避免串会话
        if (activeRequestId.value !== requestId) {
          pendingDelta = ''
          return
        }
        if (!assistantMessageId) return
        if (!pendingDelta) return

        const chunk = pendingDelta
        pendingDelta = ''
        updateMessageContentById(sessionId, assistantMessageId, chunk, true)
      })
    }

    try {
      const controller = sendStreamMessage(
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
            if (activeRequestId.value !== requestId) return

            if (!assistantMessageId) {
              assistantMessageId = createId()
              if (activeStreamContext.value?.conversationId === sessionId) {
                activeStreamContext.value.assistantMessageId = assistantMessageId
              }
              const assistantMessage: Message = {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                streaming: true
              }
              addMessageToConversation(sessionId, assistantMessage)
            }

            pendingDelta += delta
            scheduleFlushDelta()
          },

          onComplete: (fullMessage: string, _sessionId: string, model: string) => {
            if (activeRequestId.value !== requestId) return

            if (flushRafId !== null) {
              cancelAnimationFrame(flushRafId)
              flushRafId = null
              pendingDelta = ''
            }

            if (!assistantMessageId) {
              assistantMessageId = createId()
              if (activeStreamContext.value?.conversationId === sessionId) {
                activeStreamContext.value.assistantMessageId = assistantMessageId
              }
              addMessageToConversation(sessionId, {
                id: assistantMessageId,
                role: 'assistant',
                content: fullMessage,
                timestamp: Date.now(),
                streaming: false,
              })
            } else {
              updateMessageContentById(sessionId, assistantMessageId, fullMessage, false)
              patchMessageById(sessionId, assistantMessageId, { streaming: false })
            }

            // 清理用户消息中的 base64 数据（节省内存）
            clearMessageAttachmentBase64(sessionId, userMessageId)

            saveConversations({ immediate: true })
            loading.value = false
            console.log('AI 回复完成，模型:', model)

            activeController.value = null
            activeRequestId.value = null
            activeStreamContext.value = null
          },

          onError: (error: string) => {
            if (activeRequestId.value !== requestId) return

            if (flushRafId !== null) {
              cancelAnimationFrame(flushRafId)
              flushRafId = null
              pendingDelta = ''
            }

            message.error(`${error}`)
            if (assistantMessageId) {
              deleteMessageById(sessionId, assistantMessageId)
            }
            loading.value = false

            saveConversations({ immediate: true })
            activeController.value = null
            activeRequestId.value = null
            activeStreamContext.value = null
          }
        }
      )

      activeController.value = controller
    } catch (error: unknown) {
      console.log(error)
      message.error('发送消息失败，请稍后重试')
      if (assistantMessageId) {
        deleteMessageById(sessionId, assistantMessageId)
      }
      loading.value = false

      saveConversations({ immediate: true })
      activeController.value = null
      activeRequestId.value = null
      activeStreamContext.value = null
    }
  }

  return {
    loading,
    sendMessage,
    cancelCurrentStream
  }
}
