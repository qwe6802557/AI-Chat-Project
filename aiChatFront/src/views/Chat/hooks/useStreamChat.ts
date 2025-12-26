import { ref, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import { sendStreamMessage, type StreamRequestController } from '@/api/chat'
import { useConversationStore, type Message, type MessageAttachment } from '@/stores'

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
  id: string
  url: string
  name: string
  type: string
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
 * 将服务端文件信息转换为 MessageAttachment
 */
const convertServerFilesToAttachments = (serverFiles: ServerFileInfo[]): MessageAttachment[] => {
  return serverFiles.map(file => ({
    type: mapFileTypeToAttachmentType(file.type),
    name: file.name,
    url: file.url,
    preview: file.url
  }))
}

/**
 * 流式聊天 Hook
 */
export function useStreamChat() {
  const conversationStore = useConversationStore()

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
   * 取消当前流式请求
   */
  const cancelCurrentStream = () => {
    activeRequestId.value = null
    activeController.value?.close()
    activeController.value = null

    if (activeStreamContext.value?.assistantMessageId) {
      conversationStore.patchMessageById(
        activeStreamContext.value.conversationId,
        activeStreamContext.value.assistantMessageId,
        { streaming: false }
      )
      conversationStore.saveConversations({ immediate: true })
    }
    activeStreamContext.value = null
    loading.value = false
  }

  onBeforeUnmount(() => {
    cancelCurrentStream()
  })

  /**
   * 发送消息
   */
  const sendMessage = async (
    userId: string,
    content: string,
    options?: {
      fileIds?: string[]
      serverFiles?: ServerFileInfo[]
      files?: FileData[]
      model?: string
    }
  ) => {
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

    const hasContent = content.trim().length > 0
    const hasFileIds = fileIds && fileIds.length > 0
    const hasFiles = files && files.length > 0
    const hasAnyFiles = hasFileIds || hasFiles

    if (!hasContent && !hasAnyFiles) {
      message.error('请输入消息内容或上传文件')
      return
    }

    const firstFileName = serverFiles?.[0]?.name || files?.[0]?.name
    const title = hasContent
      ? content
      : (firstFileName ? `[${firstFileName}]` : '新对话')

    const sessionId = await conversationStore.ensureServerSession(userId, title)
    if (!sessionId) {
      message.error('创建会话失败，请稍后重试')
      return
    }

    let attachments: MessageAttachment[] | undefined
    if (serverFiles && serverFiles.length > 0) {
      attachments = convertServerFilesToAttachments(serverFiles)
    } else if (hasFiles) {
      attachments = convertToAttachments(files!)
    }

    const userMessageId = createId()
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: content || '',
      timestamp: Date.now(),
      attachments
    }
    conversationStore.addMessageToConversation(sessionId, userMessage)

    loading.value = true
    const requestId = createId()
    activeRequestId.value = requestId
    activeStreamContext.value = { conversationId: sessionId, assistantMessageId: null }

    let assistantMessageId: string | null = null
    let pendingDelta = ''
    let flushRafId: number | null = null

    const scheduleFlushDelta = () => {
      if (flushRafId !== null) return
      flushRafId = requestAnimationFrame(() => {
        flushRafId = null

        if (activeRequestId.value !== requestId) {
          pendingDelta = ''
          return
        }
        if (!assistantMessageId) return
        if (!pendingDelta) return

        const chunk = pendingDelta
        pendingDelta = ''
        conversationStore.updateMessageContentById(sessionId, assistantMessageId, chunk, true)
      })
    }

    try {
      const controller = sendStreamMessage(
        {
          userId,
          sessionId,
          message: content || '请分析这些文件',
          model,
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
              conversationStore.addMessageToConversation(sessionId, assistantMessage)
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
              conversationStore.addMessageToConversation(sessionId, {
                id: assistantMessageId,
                role: 'assistant',
                content: fullMessage,
                timestamp: Date.now(),
                streaming: false,
              })
            } else {
              conversationStore.updateMessageContentById(sessionId, assistantMessageId, fullMessage, false)
              conversationStore.patchMessageById(sessionId, assistantMessageId, { streaming: false })
            }

            conversationStore.clearMessageAttachmentBase64(sessionId, userMessageId)
            conversationStore.saveConversations({ immediate: true })
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
              conversationStore.deleteMessageById(sessionId, assistantMessageId)
            }
            loading.value = false

            conversationStore.saveConversations({ immediate: true })
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
        conversationStore.deleteMessageById(sessionId, assistantMessageId)
      }
      loading.value = false

      conversationStore.saveConversations({ immediate: true })
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
