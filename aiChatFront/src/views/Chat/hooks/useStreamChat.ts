import { ref, onBeforeUnmount, watch } from 'vue'
import { message } from 'ant-design-vue'
import { sendStreamMessage } from '@/api/chat'
import type { StreamChunk, StreamRequestController } from '@/interface/chat'
import { useConversationStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import logger from '@/utils/logger'
import { generateUUID } from '@/utils/common'
import type {
  Message,
  MessageAttachment,
  MessageChargeSummary,
  MessageReasoning,
  MessageUsageStats,
} from '@/interface/conversation'
import type { ServerFileInfo } from '@/interface/upload'

/**
 * 将文件类型映射为附件类型
 */
const mapFileTypeToAttachmentType = (mimeType: string): MessageAttachment['type'] => {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'document'
}

/**
 * 将服务端文件信息转换为 MessageAttachment
 */
const convertServerFilesToAttachments = (serverFiles: ServerFileInfo[]): MessageAttachment[] => {
  return serverFiles.map(file => ({
    type: mapFileTypeToAttachmentType(file.type),
    name: file.name,
    url: file.url,
    preview: file.url,
  }))
}

/**
 * 流式聊天 Hook
 */
export function useStreamChat() {
  const conversationStore = useConversationStore()
  const authStore = useAuthStore()

  const loading = ref(false)
  const activeRequestId = ref<string | null>(null)
  const activeController = ref<StreamRequestController | null>(null)
  const activeStreamContext = ref<{
    conversationId: string
    assistantMessageId: string | null
  } | null>(null)

  const createId = generateUUID

  const mapUsage = (
    usage: StreamChunk['usage'],
  ): MessageUsageStats | undefined => {
    if (!usage) return undefined
    const promptTokens = Number(usage.promptTokens || 0)
    const completionTokens = Number(usage.completionTokens || 0)
    return {
      promptTokens,
      completionTokens,
      totalTokens: Number(usage.totalTokens || 0) || promptTokens + completionTokens,
      estimatedInputCost: usage.estimatedInputCost,
      estimatedOutputCost: usage.estimatedOutputCost,
      estimatedTotalCost: usage.estimatedTotalCost,
    }
  }

  const mapCharge = (
    charge: StreamChunk['charge'],
  ): MessageChargeSummary | undefined => {
    if (!charge) return undefined
    return {
      id: charge.id,
      clientRequestId: charge.clientRequestId,
      modelId: charge.modelId,
      billingMode: charge.billingMode,
      credits: charge.credits,
      status: charge.status,
    }
  }

  const mapReasoning = (
    reasoning: StreamChunk['reasoning'],
    status: MessageReasoning['status'],
  ): MessageReasoning | undefined => {
    if (!reasoning) return undefined
    return {
      mode: reasoning.mode || 'raw',
      source: reasoning.source || 'none',
      title: reasoning.title,
      content: reasoning.content || '',
      status,
    }
  }

  const withReasoningDefaults = (
    reasoning: StreamChunk['reasoning'],
  ): NonNullable<StreamChunk['reasoning']> => {
    return {
      mode: reasoning?.mode || 'raw',
      source: reasoning?.source || 'none',
      title: reasoning?.title,
      content: reasoning?.content || '',
    }
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
        { streaming: false },
      )
      conversationStore.saveConversations({ immediate: true })
    }

    activeStreamContext.value = null
    loading.value = false
  }

  onBeforeUnmount(() => {
    cancelCurrentStream()
  })

  // 会话切换时兜底取消旧流
  watch(
    () => conversationStore.currentConversationId,
    (nextConversationId) => {
      const activeConversationId = activeStreamContext.value?.conversationId
      if (!activeConversationId) return
      if (nextConversationId === activeConversationId) return
      cancelCurrentStream()
    },
  )

  /**
   * 发送消息
   */
  const sendMessage = async (
    userId: string,
    content: string,
    options?: {
      fileIds?: string[]
      serverFiles?: ServerFileInfo[]
      model?: string
    },
  ) => {
    cancelCurrentStream()

    const {
      fileIds,
      serverFiles,
      model: selectedModelId = 'grok-chat-fast',
    } = options || {}

    if (!userId) {
      message.error('请先登录')
      return
    }

    const hasContent = content.trim().length > 0
    const hasFileIds = !!(fileIds && fileIds.length > 0)
    const hasAnyFiles = hasFileIds

    if (!hasContent && !hasAnyFiles) {
      message.error('请输入消息内容或上传文件')
      return
    }

    const firstFileName = serverFiles?.[0]?.name
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
    }

    const userMessageId = createId()
    conversationStore.addMessageToConversation(sessionId, {
      id: userMessageId,
      role: 'user',
      content: content || '',
      timestamp: Date.now(),
      attachments,
    })

    loading.value = true
    const requestId = createId()
    activeRequestId.value = requestId
    activeStreamContext.value = { conversationId: sessionId, assistantMessageId: null }

    let assistantMessageId: string | null = null
    let pendingAnswerDelta = ''
    let pendingReasoningDelta = ''
    let flushRafId: number | null = null
    let latestReasoning: MessageReasoning | undefined

    const ensureAssistantMessage = (): string => {
      if (assistantMessageId) {
        return assistantMessageId
      }

      assistantMessageId = createId()
      if (activeStreamContext.value?.conversationId === sessionId) {
        activeStreamContext.value.assistantMessageId = assistantMessageId
      }

      conversationStore.addMessageToConversation(sessionId, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      })

      return assistantMessageId
    }

    const scheduleFlushDelta = () => {
      if (flushRafId !== null) return

      flushRafId = requestAnimationFrame(() => {
        flushRafId = null

        if (activeRequestId.value !== requestId) {
          pendingAnswerDelta = ''
          pendingReasoningDelta = ''
          return
        }

        if (!assistantMessageId) return

        if (pendingReasoningDelta) {
          const reasoningDelta = pendingReasoningDelta
          pendingReasoningDelta = ''
          conversationStore.appendMessageReasoningById(
            sessionId,
            assistantMessageId,
            reasoningDelta,
            latestReasoning ? {
              mode: latestReasoning.mode,
              source: latestReasoning.source,
              title: latestReasoning.title,
              status: latestReasoning.status,
            } : undefined,
          )
        }

        if (!pendingAnswerDelta) return

        const answerDelta = pendingAnswerDelta
        pendingAnswerDelta = ''
        conversationStore.updateMessageContentById(
          sessionId,
          assistantMessageId,
          answerDelta,
          true,
        )
      })
    }

    try {
      const controller = sendStreamMessage(
        {
          userId,
          sessionId,
          clientRequestId: requestId,
          message: content || '请分析这些文件',
          model: selectedModelId,
          fileIds: hasFileIds ? fileIds : undefined,
        },
        {
          onChunk: (chunk: StreamChunk) => {
            if (activeRequestId.value !== requestId) return

            switch (chunk.type) {
              case 'reasoning_start': {
                const messageId = ensureAssistantMessage()
                latestReasoning = mapReasoning(
                  withReasoningDefaults(chunk.reasoning),
                  'streaming',
                )
                conversationStore.setMessageReasoningById(
                  sessionId,
                  messageId,
                  latestReasoning,
                )
                return
              }
              case 'reasoning_delta': {
                ensureAssistantMessage()
                const mappedReasoning = mapReasoning(
                  withReasoningDefaults(chunk.reasoning),
                  'streaming',
                )
                latestReasoning = {
                  ...(latestReasoning || mappedReasoning || {
                    mode: 'raw',
                    source: 'none',
                    content: '',
                  }),
                  ...(mappedReasoning || {}),
                  content: latestReasoning?.content || '',
                  status: 'streaming',
                }
                pendingReasoningDelta += chunk.delta || ''
                scheduleFlushDelta()
                return
              }
              case 'reasoning_done':
                if (!assistantMessageId || !latestReasoning) return
                latestReasoning = {
                  ...latestReasoning,
                  status: 'done',
                }
                conversationStore.setMessageReasoningById(
                  sessionId,
                  assistantMessageId,
                  latestReasoning,
                )
                return
              case 'answer_delta':
              default:
                ensureAssistantMessage()
                pendingAnswerDelta += chunk.delta || ''
                scheduleFlushDelta()
            }
          },

          onComplete: (chunk: StreamChunk) => {
            if (activeRequestId.value !== requestId) return

            if (flushRafId !== null) {
              cancelAnimationFrame(flushRafId)
              flushRafId = null
              pendingAnswerDelta = ''
              pendingReasoningDelta = ''
            }

            const fullMessage = chunk.message || ''
            const finalModel = chunk.model || selectedModelId
            const usage = chunk.usage
            const creditsSnapshot = chunk.creditsSnapshot
            const charge = chunk.charge
            const reasoning =
              mapReasoning(chunk.reasoning, 'done') ||
              (latestReasoning
                ? {
                    ...latestReasoning,
                    status: 'done',
                  }
                : undefined)

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
                model: finalModel,
                usage: mapUsage(usage),
                charge: mapCharge(charge),
                reasoning,
              })
            } else {
              conversationStore.updateMessageContentById(
                sessionId,
                assistantMessageId,
                fullMessage,
                false,
              )
              conversationStore.patchMessageById(sessionId, assistantMessageId, {
                streaming: false,
                model: finalModel,
                usage: mapUsage(usage),
                charge: mapCharge(charge),
                reasoning,
              })
            }

            if (creditsSnapshot) {
              authStore.setUserCredits(creditsSnapshot)
            }

            conversationStore.clearMessageAttachmentBase64(sessionId, userMessageId)
            conversationStore.saveConversations({ immediate: true })
            loading.value = false
            logger.debug('AI 回复完成，模型:', finalModel)

            activeController.value = null
            activeRequestId.value = null
            activeStreamContext.value = null
          },

          onError: (error: string) => {
            if (activeRequestId.value !== requestId) return

            if (flushRafId !== null) {
              cancelAnimationFrame(flushRafId)
              flushRafId = null
              pendingAnswerDelta = ''
              pendingReasoningDelta = ''
            }

            const finalAssistantId = ensureAssistantMessage()
            conversationStore.patchMessageById(sessionId, finalAssistantId, {
              streaming: false,
              error: error || '流式请求失败，请稍后重试',
            })
            loading.value = false

            conversationStore.saveConversations({ immediate: true })
            activeController.value = null
            activeRequestId.value = null
            activeStreamContext.value = null
          },
        },
      )

      activeController.value = controller
    } catch (error: unknown) {
      logger.error('发送消息失败:', error)
      const errorMessage =
        error instanceof Error ? error.message : '发送消息失败，请稍后重试'
      const finalAssistantId = ensureAssistantMessage()
      conversationStore.patchMessageById(sessionId, finalAssistantId, {
        streaming: false,
        error: errorMessage,
      })
      loading.value = false

      conversationStore.saveConversations({ immediate: true })
      activeController.value = null
      activeRequestId.value = null
      activeStreamContext.value = null
    }
  }

  /**
   * 重试某条失败的消息
   */
  const retryMessage = async (sessionId: string, failedMessageId: string) => {
    const conversation = conversationStore.getConversationById(sessionId)
    if (!conversation) return

    const messages = conversation.messages
    const failedIndex = messages.findIndex((m) => m.id === failedMessageId)
    if (failedIndex === -1) return

    // 向上寻找对应的用户消息
    let userMessage: Message | undefined
    for (let i = failedIndex - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg && msg.role === 'user') {
        userMessage = msg
        break
      }
    }
    if (!userMessage) return

    // 删除当前失败的助手消息
    conversationStore.deleteMessageById(sessionId, failedMessageId)

    const userId = authStore.getUserId()
    if (!userId) {
      message.warning('未获取到用户信息，请重新登录')
      return
    }

    await sendMessage(userId, userMessage.content, {
      model: userMessage.model || undefined,
    })
  }

  return {
    loading,
    sendMessage,
    cancelCurrentStream,
    retryMessage,
  }
}
