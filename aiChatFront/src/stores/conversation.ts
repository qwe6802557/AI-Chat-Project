/**
 * 对话管理 Store
 *
 * 统一管理对话列表、当前对话、消息等状态
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import logger from '@/utils/logger'
import {
  getSessionList,
  createSession,
  deleteSession,
  getSessionMessages,
  updateSessionTitle,
  clearAllSessions
} from '@/api/chat'
import type { BackendChatSession, BackendChatMessage } from '@/interface/chat'
import type {
  Conversation,
  Message,
  MessageAttachment,
  MessageChargeSummary,
  MessageReasoning,
  MessageUsageStats,
} from '@/interface/conversation'
import { extractVisibleAssistantContent } from '@/views/Chat/utils/assistantContent'

// 常量

const MAX_PERSISTED_MESSAGES_PER_CONVERSATION = 50
const CURRENT_CONVERSATION_STORAGE_KEY = 'currentConversationId'

// 工具函数

const isBlobUrl = (value: string | undefined): boolean => {
  return typeof value === 'string' && value.startsWith('blob:')
}

const mapMimeToAttachmentType = (mimeType: string): MessageAttachment['type'] => {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'document'
}

const mapUsage = (
  usage: BackendChatMessage['usage'] | undefined | null
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
  charge: BackendChatMessage['charge'] | undefined | null,
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
  reasoning: BackendChatMessage['reasoning'] | undefined | null,
): MessageReasoning | undefined => {
  if (!reasoning) return undefined
  return {
    mode: reasoning.mode,
    source: reasoning.source,
    title: reasoning.title,
    content: reasoning.content,
    status: 'done',
  }
}

const hasPersistedAttachments = (conversation: Conversation | undefined): boolean => {
  if (!conversation) return false
  return conversation.messages.some((message) => (message.attachments?.length || 0) > 0)
}

/**
 * 转换消息格式
 */
const transformBackendMessages = (backendMessages: BackendChatMessage[]): Message[] => {
  const messages: Message[] = []
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

  const sortedMessages = [...backendMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  sortedMessages.forEach((msg) => {
    const timestamp = new Date(msg.createdAt).getTime()

    let attachments: MessageAttachment[] | undefined
    if (msg.attachments && msg.attachments.length > 0) {
      attachments = msg.attachments.map(att => ({
        type: mapMimeToAttachmentType(att.type),
        name: att.name,
        preview: `${baseURL}${att.url}`,
        url: `${baseURL}${att.url}`
      }))
    }

    if (msg.userMessage) {
      messages.push({
        id: `${msg.id}-user`,
        role: 'user',
        content: msg.userMessage,
        timestamp,
        attachments
      })
    }

    if (msg.aiMessage) {
      const extracted = extractVisibleAssistantContent(msg.aiMessage)
      const reasoning = mapReasoning(msg.reasoning) || extracted.reasoning
      messages.push({
        id: `${msg.id}-assistant`,
        role: 'assistant',
        content: reasoning ? extracted.answer : msg.aiMessage,
        timestamp: timestamp + 1,
        model: msg.model,
        usage: mapUsage(msg.usage),
        charge: mapCharge(msg.charge),
        reasoning,
      })
    }
  })

  return messages
}

/**
 * 转换会话格式
 */
const transformBackendSession = (session: BackendChatSession): Conversation => {
  return {
    id: session.id,
    title: session.title,
    messages: [],
    usageSummary: session.usageSummary
      ? {
          lastModel: session.usageSummary.lastModel,
          totalPromptTokens: session.usageSummary.totalPromptTokens,
          totalCompletionTokens: session.usageSummary.totalCompletionTokens,
          totalTokens: session.usageSummary.totalTokens,
          totalEstimatedCost: session.usageSummary.totalEstimatedCost,
          totalChargedCredits: session.usageSummary.totalChargedCredits,
        }
      : undefined,
    createdAt: new Date(session.createdAt).getTime(),
    updatedAt: session.lastActiveAt
      ? new Date(session.lastActiveAt).getTime()
      : new Date(session.updatedAt).getTime(),
    sessionId: session.id
  }
}

// Store定义

export const useConversationStore = defineStore('conversation', () => {
  // State

  // 使用 localStorage 持久化对话列表
  const {
    data: conversations,
    save: saveNow,
    saveDebounced,
    clear: clearPersistedConversations,
  } = useLocalStorage<Conversation[]>(
    'chatConversations',
    [],
    {
      serialize: (value) => {
        return value.map((conv) => {
          const persistedMessages = conv.messages.length > MAX_PERSISTED_MESSAGES_PER_CONVERSATION
            ? conv.messages.slice(-MAX_PERSISTED_MESSAGES_PER_CONVERSATION)
            : conv.messages

          return {
            id: conv.id,
            title: conv.title,
            usageSummary: conv.usageSummary,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            sessionId: conv.sessionId,
            messages: persistedMessages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              model: m.model,
              usage: m.usage,
              charge: m.charge,
              reasoning: m.reasoning,
              attachments: m.attachments?.map((att) => ({
                type: att.type,
                name: att.name,
                url: att.url,
                preview: isBlobUrl(att.preview) ? '' : att.preview,
              })),
            })),
          }
        })
      },
      deserialize: (raw) => raw as Conversation[],
    }
  )

  /** 当前选中的对话 ID */
  const currentConversationId = ref(localStorage.getItem(CURRENT_CONVERSATION_STORAGE_KEY) || '')

  /** 加载状态 */
  const isLoading = ref(false)

  // Getters

  /** 当前对话 */
  const currentConversation = computed(() =>
    conversations.value.find(c => c.id === currentConversationId.value)
  )

  /** 当前消息列表 */
  const currentMessages = computed(() =>
    currentConversation.value?.messages || []
  )

  /** 对话数量 */
  const conversationCount = computed(() => conversations.value.length)

  const setCurrentConversationId = (conversationId: string): void => {
    currentConversationId.value = conversationId
    if (conversationId) {
      localStorage.setItem(CURRENT_CONVERSATION_STORAGE_KEY, conversationId)
    } else {
      localStorage.removeItem(CURRENT_CONVERSATION_STORAGE_KEY)
    }
  }

  const normalizeCurrentConversationSelection = (): void => {
    if (conversations.value.length === 0) {
      setCurrentConversationId('')
      return
    }

    if (!currentConversationId.value || !getConversationById(currentConversationId.value)) {
      const firstConversation = conversations.value[0]
      setCurrentConversationId(firstConversation?.id || '')
    }
  }

  // Actions

  /**
   * 保存对话到 localStorage
   */
  const saveConversations = (options?: { immediate?: boolean; delayMs?: number }): void => {
    if (options?.immediate) {
      saveNow()
      return
    }
    saveDebounced(options?.delayMs)
  }

  /**
   * 判断是否为临时对话
   */
  const isTemporaryConversation = (conv: Conversation): boolean => {
    return !conv.sessionId || conv.id.startsWith('temp-')
  }

  /**
   * 获取对话
   */
  const getConversationById = (conversationId: string): Conversation | undefined => {
    return conversations.value.find(c => c.id === conversationId)
  }

  /**
   * 清理空的临时对话
   */
  const cleanupEmptyTemporaryConversations = (excludeId?: string): void => {
    const toRemove: number[] = []

    conversations.value.forEach((conv, index) => {
      if (excludeId && conv.id === excludeId) return
      if (isTemporaryConversation(conv) && conv.messages.length === 0) {
        toRemove.push(index)
      }
    })

    toRemove.reverse().forEach(index => {
      conversations.value.splice(index, 1)
    })

    if (toRemove.length > 0) {
      saveConversations()
    }
  }

  /**
   * 创建新对话（本地）
   */
  const createConversation = (): string => {
    if (currentConversationId.value) {
      const current = currentConversation.value
      if (current && current.messages.length === 0) {
        return current.id
      }
    }

    cleanupEmptyTemporaryConversations()

    const tempId = `temp-${Date.now()}`
    const newConversation: Conversation = {
      id: tempId,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: undefined
    }

    conversations.value.unshift(newConversation)
    setCurrentConversationId(newConversation.id)
    saveConversations()

    return newConversation.id
  }

  /**
   * 服务端创建会话
   */
  const createConversationOnServer = async (userId: string, title?: string): Promise<string | null> => {
    if (!userId || userId === 'null' || userId === 'undefined' || userId.trim() === '') {
      return null
    }

    try {
      const response = await createSession({ userId, title })
      if (response.code === 0 && response.data) {
        return response.data.id
      }
      return null
    } catch (error) {
      logger.error('创建会话出错:', error)
      return null
    }
  }

  /**
   * 确保当前对话有 sessionId
   */
  const ensureServerSession = async (userId: string, title?: string): Promise<string | null> => {
    const conversation = currentConversation.value
    if (!conversation) return null

    if (conversation.sessionId && !conversation.id.startsWith('temp-')) {
      return conversation.sessionId
    }

    if (!userId || userId === 'null' || userId === 'undefined' || userId.trim() === '') {
      return null
    }

    const sessionTitle = title ? (title.slice(0, 30) + (title.length > 30 ? '...' : '')) : '新对话'
    const serverSessionId = await createConversationOnServer(userId, sessionTitle)

    if (!serverSessionId) return null

    const oldId = conversation.id
    conversation.id = serverSessionId
    conversation.sessionId = serverSessionId
    conversation.title = sessionTitle

    if (currentConversationId.value === oldId) {
      setCurrentConversationId(serverSessionId)
    }

    saveConversations()
    return serverSessionId
  }

  /**
   * 选择对话
   */
  const selectConversation = async (id: string): Promise<{ hasMore: boolean; total: number; totalPages: number } | null> => {
    if (currentConversationId.value === id) return null

    const currentConv = currentConversation.value
    if (currentConv && isTemporaryConversation(currentConv) && currentConv.messages.length === 0) {
      const currentIndex = conversations.value.findIndex(c => c.id === currentConv.id)
      if (currentIndex !== -1) {
        conversations.value.splice(currentIndex, 1)
      }
    }

    setCurrentConversationId(id)

    const targetConversation = conversations.value.find(c => c.id === id)
    if (
      targetConversation &&
      targetConversation.sessionId &&
      (
        targetConversation.messages.length === 0 ||
        hasPersistedAttachments(targetConversation)
      )
    ) {
      const paginationInfo = await loadMessagesForSession(id)
      saveConversations()
      return paginationInfo
    }

    saveConversations()
    return null
  }

  /**
   * 加载会话消息
   */
  const loadMessagesForSession = async (
    sessionId: string,
    page: number = 1,
    pageSize: number = 5,
    order: 'asc' | 'desc' = 'desc'
  ): Promise<{ hasMore: boolean; total: number; totalPages: number }> => {
    try {
      const response = await getSessionMessages({ sessionId, page, pageSize, order })

      if (response.code === 0 && response.data) {
        const { messages: backendMessages, total, totalPages } = response.data
        const frontendMessages = transformBackendMessages(backendMessages)

        const conversation = conversations.value.find(c => c.id === sessionId)
        if (conversation) {
          if (page === 1) {
            conversation.messages = frontendMessages
          } else {
            conversation.messages = [...frontendMessages, ...conversation.messages]
          }
          saveConversations()
        }

        return { hasMore: page < totalPages, total, totalPages }
      }
      return { hasMore: false, total: 0, totalPages: 0 }
    } catch (error) {
      logger.error('加载会话消息出错:', error)
      return { hasMore: false, total: 0, totalPages: 0 }
    }
  }

  /**
   * 从服务器加载会话列表
   */
  const loadFromServer = async (userId: string): Promise<{ hasMore: boolean; total: number; totalPages: number } | null> => {
    if (!userId) return null

    isLoading.value = true

    try {
      const response = await getSessionList({ userId })

      if (response.code === 0 && response.data) {
        const serverConversations = response.data.map(transformBackendSession)
        conversations.value = serverConversations
        saveConversations()

        if (serverConversations.length > 0 && serverConversations[0]) {
          setCurrentConversationId(serverConversations[0].id)
          return await loadMessagesForSession(serverConversations[0].id)
        }

        setCurrentConversationId('')
        return null
      }
      return null
    } catch (error) {
      logger.error('加载会话列表出错:', error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 初始化
   */
  const initializeFromServer = async (userId: string): Promise<{ hasMore: boolean; total: number; totalPages: number } | null> => {
    if (!userId || userId === 'null' || userId === 'undefined' || userId.trim() === '') {
      return null
    }

    cleanupEmptyTemporaryConversations()
    const paginationInfo = await loadFromServer(userId)

    if (conversations.value.length === 0) {
      createConversation()
    } else {
      normalizeCurrentConversationSelection()
    }

    return paginationInfo
  }

  /**
   * 清空所有对话
   */
  const clearAllConversations = async (userId?: string): Promise<{ deletedCount: number } | null> => {
    let serverDeletedCount = 0

    if (userId && userId !== 'null' && userId !== 'undefined' && userId.trim() !== '') {
      try {
        const response = await clearAllSessions({ userId })
        if (response.code !== 0) return null
        serverDeletedCount = response.data.deletedCount
      } catch (error) {
        return null
      }
    } else {
      serverDeletedCount = conversations.value.length
    }

    conversations.value = []
    setCurrentConversationId('')
    saveConversations()

    return { deletedCount: serverDeletedCount }
  }

  /**
   * 删除对话
   */
  const deleteConversation = async (id: string): Promise<void> => {
    const index = conversations.value.findIndex(c => c.id === id)
    if (index !== -1) {
      conversations.value.splice(index, 1)

      if (currentConversationId.value === id) {
        setCurrentConversationId(conversations.value[0]?.id || '')
      }

      saveConversations()
      await deleteSession({ id })
    }
  }

  /**
   * 更新对话标题
   */
  const updateConversationTitle = async (id: string, title: string): Promise<boolean> => {
    const conversation = conversations.value.find(c => c.id === id)
    if (!conversation) return false

    if (!conversation.sessionId || conversation.id.startsWith('temp-')) {
      conversation.title = title
      conversation.updatedAt = Date.now()
      saveConversations()
      return true
    }

    try {
      const response = await updateSessionTitle({ id, title })
      if (response.code === 0) {
        conversation.title = title
        conversation.updatedAt = Date.now()
        saveConversations()
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  // 消息管理

  /**
   * 添加消息到指定对话
   */
  const addMessageToConversation = (conversationId: string, message: Message): void => {
    const conversation = getConversationById(conversationId)
    if (!conversation) return

    conversation.messages.push(message)
    conversation.updatedAt = Date.now()

    if (conversation.messages.length === 1 && message.role === 'user') {
      const content = message.content
      conversation.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
    }

    if (!message.streaming) {
      saveConversations()
    }
  }

  /**
   * 更新消息内容
   */
  const updateMessageContentById = (
    conversationId: string,
    messageId: string,
    content: string,
    isAppend = false
  ): void => {
    const conversation = getConversationById(conversationId)
    if (!conversation) return

    const msg = conversation.messages.find(m => m.id === messageId)
    if (!msg) return

    msg.content = isAppend ? msg.content + content : content
    conversation.updatedAt = Date.now()
  }

  /**
   * 局部更新消息
   */
  const patchMessageById = (
    conversationId: string,
    messageId: string,
    patch: Partial<Message>
  ): void => {
    const conversation = getConversationById(conversationId)
    if (!conversation) return

    const msg = conversation.messages.find(m => m.id === messageId)
    if (!msg) return

    Object.assign(msg, patch)
    conversation.updatedAt = Date.now()
  }

  /**
   * 设置消息的思考过程
   */
  const setMessageReasoningById = (
    conversationId: string,
    messageId: string,
    reasoning?: MessageReasoning,
  ): void => {
    const conversation = getConversationById(conversationId)
    if (!conversation) return

    const msg = conversation.messages.find(m => m.id === messageId)
    if (!msg) return

    msg.reasoning = reasoning
    conversation.updatedAt = Date.now()
  }

  /**
   * 追加消息的思考过程内容
   */
  const appendMessageReasoningById = (
    conversationId: string,
    messageId: string,
    delta: string,
    patch?: Partial<MessageReasoning>,
  ): void => {
    const conversation = getConversationById(conversationId)
    if (!conversation) return

    const msg = conversation.messages.find(m => m.id === messageId)
    if (!msg) return

    const nextReasoning: MessageReasoning = {
      mode: msg.reasoning?.mode || 'raw',
      source: msg.reasoning?.source || 'none',
      title: msg.reasoning?.title,
      content: `${msg.reasoning?.content || ''}${delta}`,
      status: msg.reasoning?.status,
      ...patch,
    }

    msg.reasoning = nextReasoning
    conversation.updatedAt = Date.now()
  }

  /**
   * 清理消息附件 base64
   */
  const clearMessageAttachmentBase64 = (conversationId: string, messageId: string): void => {
    const conversation = getConversationById(conversationId)
    if (!conversation) return

    const msg = conversation.messages.find(m => m.id === messageId)
    if (!msg?.attachments) return

    msg.attachments.forEach(att => {
      att.base64 = undefined
    })
  }

  /**
   * 删除消息
   */
  const deleteMessageById = (conversationId: string, messageId: string): void => {
    const conversation = getConversationById(conversationId)
    if (!conversation) return

    const index = conversation.messages.findIndex(m => m.id === messageId)
    if (index === -1) return

    conversation.messages.splice(index, 1)
    saveConversations()
  }

  /**
   * 清空本地会话状态（不触发后端删除）
   * 用于退出登录后的本地状态清理，避免会话残留到下一个登录会话
   */
  const resetLocalState = (): void => {
    conversations.value = []
    setCurrentConversationId('')
    clearPersistedConversations()
  }

  return {
    // State
    conversations,
    currentConversationId,
    isLoading,

    // Getters
    currentConversation,
    currentMessages,
    conversationCount,

    // Actions - 对话管理
    createConversation,
    selectConversation,
    deleteConversation,
    clearAllConversations,
    updateConversationTitle,
    ensureServerSession,
    cleanupEmptyTemporaryConversations,
    getConversationById,

    // Actions - 消息管理
    addMessageToConversation,
    updateMessageContentById,
    patchMessageById,
    setMessageReasoningById,
    appendMessageReasoningById,
    clearMessageAttachmentBase64,
    deleteMessageById,
    resetLocalState,

    // Actions - 持久化和初始化
    saveConversations,
    loadFromServer,
    loadMessagesForSession,
    initializeFromServer
  }
})
