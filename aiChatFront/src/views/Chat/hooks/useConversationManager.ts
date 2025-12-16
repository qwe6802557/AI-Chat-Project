import { ref, computed, type Ref } from 'vue'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import {
  getSessionList,
  createSession,
  deleteSession,
  getSessionMessages,
  updateSessionTitle,
  type BackendChatSession,
  type BackendChatMessage
} from '@/api/chat'

/**
 * 消息附件接口
 */
export interface MessageAttachment {
  type: 'image' | 'pdf' | 'document'
  name: string
  preview: string  // 用于显示（blob URL 或空字符串）
  base64?: string  // 用于发送给 AI（发送后可清理以节省内存）
}

/**
 * 消息接口
 */
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /** 消息附件（图片、文档等） */
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
  sessionId?: string // 后端会话 ID-用于兼容
}

/**
 * 对话管理 Hook
 *
 * @description 管理所有对话的 CRUD 操作、消息管理、持久化等
 */
export function useConversationManager() {
  // 对话列表持久化
  const {
    data: conversations,
    save: saveConversations
  } = useLocalStorage<Conversation[]>('chatConversations', [])

  // 加载状态
  const isLoading = ref(false)

  // 当前选中的对话ID
  const currentConversationId = ref('')

  // 当前对话对象
  const currentConversation = computed(() =>
    conversations.value.find(c => c.id === currentConversationId.value)
  )

  // 当前对话的消息列表
  const currentMessages = computed(() =>
    currentConversation.value?.messages || []
  )

  /**
   * 转换消息
   * 一条记录包含 userMessage + aiMessage -需要拆分为两条
   */
  const transformBackendMessages = (backendMessages: BackendChatMessage[]): Message[] => {
    const messages: Message[] = []

    // 按创建时间排序
    const sortedMessages = [...backendMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    sortedMessages.forEach((msg) => {
      const timestamp = new Date(msg.createdAt).getTime()

      // 用户消息
      if (msg.userMessage) {
        messages.push({
          id: `${msg.id}-user`,
          role: 'user',
          content: msg.userMessage,
          timestamp
        })
      }

      // AI 回复
      if (msg.aiMessage) {
        messages.push({
          id: `${msg.id}-assistant`,
          role: 'assistant',
          content: msg.aiMessage,
          timestamp: timestamp + 1
        })
      }
    })

    return messages
  }

  /**
   * 将后端会话转换为前端对话格式
   * 消息按需加载-初始为空数组
   */
  const transformBackendSession = (session: BackendChatSession): Conversation => {
    return {
      id: session.id,
      title: session.title,
      messages: [],
      createdAt: new Date(session.createdAt).getTime(),
      updatedAt: session.lastActiveAt
        ? new Date(session.lastActiveAt).getTime()
        : new Date(session.updatedAt).getTime(),
      sessionId: session.id
    }
  }

  /**
   * 加载会话列表
   * @returns 分页信息-用于初始化hasMore状态
   */
  const loadFromServer = async (userId: string): Promise<{ hasMore: boolean; total: number; totalPages: number } | null> => {
    if (!userId) {
      console.warn('loadFromServer: userId 为空')
      return null
    }

    isLoading.value = true

    try {
      const response = await getSessionList({ userId })

      if (response.code === 0 && response.data) {
        // 转换数据
        const serverConversations = response.data.map(transformBackendSession)

        // 更新本地数据
        conversations.value = serverConversations
        saveConversations()

        // 如果有会话-选中第一个并加载其消息
        if (serverConversations.length > 0 && serverConversations[0]) {
          currentConversationId.value = serverConversations[0].id
          // 加载第一个会话的消息并返回分页信息
          return await loadMessagesForSession(serverConversations[0].id)
        }

        return null
      } else {
        console.error('加载会话列表失败:', response.message)
        return null
      }
    } catch (error) {
      console.error('加载会话列表出错:', error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载指定会话的消息
   * @param sessionId 会话 ID
   * @param page 页码-默认1
   * @param pageSize 每页数量-默认20
   * @param order 排序方式：desc 加载最新消息，asc 加载最早消息
   * @returns 分页信息-包含是否还有更多消息
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

        // 找到对应的会话并更新消息
        const conversation = conversations.value.find(c => c.id === sessionId)
        if (conversation) {
          // 如果是第一页-替换消息
          if (page === 1) {
            conversation.messages = frontendMessages
          } else {
            // 追加到前面-更早的消息
            conversation.messages = [...frontendMessages, ...conversation.messages]
          }
          saveConversations()
        }

        // 返回分页信息
        return {
          hasMore: page < totalPages,
          total,
          totalPages
        }
      } else {
        console.error('加载会话消息失败:', response.message)
        return { hasMore: false, total: 0, totalPages: 0 }
      }
    } catch (error) {
      console.error('加载会话消息出错:', error)
      return { hasMore: false, total: 0, totalPages: 0 }
    }
  }

  /**
   * 在后端创建新会话
   */
  const createConversationOnServer = async (userId: string, title?: string): Promise<string | null> => {
    // 验证 userId 有效性
    if (!userId || userId === 'null' || userId === 'undefined' || userId.trim() === '') {
      console.error('createConversationOnServer: userId 无效:', userId)
      return null
    }

    try {
      const response = await createSession({ userId, title })

      if (response.code === 0 && response.data) {
        return response.data.id
      } else {
        console.error('创建会话失败:', response.message)
        return null
      }
    } catch (error) {
      console.error('创建会话出错:', error)
      return null
    }
  }

  /**
   * 在后端删除会话
   */
  const deleteConversationOnServer = async (id: string): Promise<boolean> => {
    try {
      const response = await deleteSession({ id })
      return response.code === 0
    } catch (error) {
      console.error('删除会话出错:', error)
      return false
    }
  }

  /**
   * 判断是否为临时对话
   */
  const isTemporaryConversation = (conv: Conversation): boolean => {
    return !conv.sessionId || conv.id.startsWith('temp-')
  }

  /**
   * 清理空的临时对话
   * @param excludeId 排除的对话ID
   */
  const cleanupEmptyTemporaryConversations = (excludeId?: string): void => {
    const toRemove: number[] = []

    conversations.value.forEach((conv, index) => {
      // 排除指定的对话
      if (excludeId && conv.id === excludeId) return

      // 临时对话且没有消息-标记删除
      if (isTemporaryConversation(conv) && conv.messages.length === 0) {
        toRemove.push(index)
      }
    })

    // 往前删除-避免索引错乱
    toRemove.reverse().forEach(index => {
      conversations.value.splice(index, 1)
    })

    if (toRemove.length > 0) {
      saveConversations()
      console.log(`清理了 ${toRemove.length} 个空临时对话`)
    }
  }

  /**
   * 创建新对话-本地创建
   * 会话在发送第一条消息时才会同步到后端
   * @returns
   */
  const createConversation = (): string => {
    // 检查当前对话是否为空，避免重复创建
    if (currentConversationId.value) {
      const current = currentConversation.value
      if (current && current.messages.length === 0) {
        return current.id
      }
    }

    // 清理空的临时对话
    cleanupEmptyTemporaryConversations()

    // 创建本地临时对话
    const tempId = `temp-${Date.now()}`
    const newConversation: Conversation = {
      id: tempId,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: undefined  // 临时对话
    }

    conversations.value.unshift(newConversation)
    currentConversationId.value = newConversation.id
    saveConversations()

    console.log('创建本地临时对话:', tempId)
    return newConversation.id
  }

  /**
   * 确保当前对话有后端 sessionId
   * 临时对话-创建后端会话并更新本地数据
   * @param userId 用户 ID
   * @param title 会话标题（可选-用于首次创建时设置标题）
   * @returns sessionId-失败返回 null
   */
  const ensureServerSession = async (userId: string, title?: string): Promise<string | null> => {
    const conversation = currentConversation.value
    if (!conversation) {
      console.error('ensureServerSession: 当前没有对话')
      return null
    }

    // 已有sessionId-直接返回
    if (conversation.sessionId && !conversation.id.startsWith('temp-')) {
      return conversation.sessionId
    }

    // 验证userId
    if (!userId || userId === 'null' || userId === 'undefined' || userId.trim() === '') {
      console.error('ensureServerSession: userId 无效')
      return null
    }

    console.log('首次发送消息-创建会话')

    // 生成会话标题
    const sessionTitle = title ? (title.slice(0, 30) + (title.length > 30 ? '...' : '')) : '新对话'

    // 创建后端会话
    const serverSessionId = await createConversationOnServer(userId, sessionTitle)
    if (!serverSessionId) {
      console.error('ensureServerSession: 后端创建会话失败')
      return null
    }

    // 更新本地对话数据
    const oldId = conversation.id
    conversation.id = serverSessionId
    conversation.sessionId = serverSessionId
    conversation.title = sessionTitle  // 同步更新本地标题

    // 当前选中的是这个对话-更新选中 ID
    if (currentConversationId.value === oldId) {
      currentConversationId.value = serverSessionId
    }

    saveConversations()
    console.log(`临时对话 ${oldId} 已同步到后端: ${serverSessionId}`)

    return serverSessionId
  }

  /**
   * 选择对话-按需加载消息
   * 切换时会清理当前对话-如果是空的临时对话
   * @returns 分页信息-用于更新hasMore状态
   */
  const selectConversation = async (id: string): Promise<{ hasMore: boolean; total: number; totalPages: number } | null> => {
    // 切换到同一个对话则无需操作
    if (currentConversationId.value === id) return null

    // 检查当前对话是否为空的临时对话-是则删除
    const currentConv = currentConversation.value
    if (currentConv && isTemporaryConversation(currentConv) && currentConv.messages.length === 0) {
      const currentIndex = conversations.value.findIndex(c => c.id === currentConv.id)
      if (currentIndex !== -1) {
        conversations.value.splice(currentIndex, 1)
        console.log('切换对话时清理空临时对话:', currentConv.id)
      }
    }

    currentConversationId.value = id

    // 是否需要从服务器加载消息
    const targetConversation = conversations.value.find(c => c.id === id)
    if (targetConversation && targetConversation.sessionId && targetConversation.messages.length === 0) {
      // 有sessionId的对话才从服务器加载消息，并返回分页信息
      const paginationInfo = await loadMessagesForSession(id)
      saveConversations()
      return paginationInfo
    }

    saveConversations()
    return null
  }

  /**
   * 清空所有对话
   */
  const clearAllConversations = (): void => {
    conversations.value = []
    currentConversationId.value = ''
    saveConversations()
  }

  /**
   * 删除单个对话（同步到后端）
   */
  const deleteConversation = async (id: string): Promise<void> => {
    const index = conversations.value.findIndex(c => c.id === id)
    if (index !== -1) {
      // 先从本地删除
      conversations.value.splice(index, 1)

      // 删除当前对话-切换到第一个对话
      if (currentConversationId.value === id) {
        currentConversationId.value = conversations.value[0]?.id || ''
      }

      saveConversations()

      // 同步
      await deleteConversationOnServer(id)
    }
  }

  /**
   * 更新对话标题（同步到后端）
   * @param id 对话 ID
   * @param title 新标题
   * @returns 是否更新成功
   */
  const updateConversationTitle = async (id: string, title: string): Promise<boolean> => {
    const conversation = conversations.value.find(c => c.id === id)
    if (!conversation) return false

    // 临时对话（没有后端 sessionId）只更新本地
    if (!conversation.sessionId || conversation.id.startsWith('temp-')) {
      conversation.title = title
      conversation.updatedAt = Date.now()
      saveConversations()
      return true
    }

    // 已同步的对话需要调用后端接口
    try {
      const response = await updateSessionTitle({ id, title })
      if (response.code === 0) {
        conversation.title = title
        conversation.updatedAt = Date.now()
        saveConversations()
        return true
      } else {
        console.error('更新会话标题失败:', response.message)
        return false
      }
    } catch (error) {
      console.error('更新会话标题出错:', error)
      return false
    }
  }

  /**
   * 更新当前对话的后端会话 ID
   */
  const updateSessionId = (sessionId: string): void => {
    const conversation = currentConversation.value
    if (conversation && !conversation.sessionId) {
      conversation.sessionId = sessionId
      saveConversations()
    }
  }

  /**
   * 添加消息到当前对话
   */
  const addMessage = (message: Message): void => {
    const conversation = currentConversation.value
    if (!conversation) return

    conversation.messages.push(message)
    conversation.updatedAt = Date.now()

    // 生成标题
    if (conversation.messages.length === 1 && message.role === 'user') {
      const content = message.content
      conversation.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
    }

    saveConversations()
  }

  /**
   * 更新指定索引的消息内容
   */
  const updateMessageContent = (index: number, content: string, isAppend = false): void => {
    const conversation = currentConversation.value
    if (!conversation) return

    const message = conversation.messages[index]
    if (message) {
      message.content = isAppend ? message.content + content : content
      conversation.updatedAt = Date.now()
    }
  }

  /**
   * 删除消息
   */
  const deleteMessage = (messageId: string): void => {
    const conversation = currentConversation.value
    if (!conversation) return

    const index = conversation.messages.findIndex(m => m.id === messageId)
    if (index !== -1) {
      conversation.messages.splice(index, 1)
      saveConversations()
    }
  }

  /**
   * 删除指定索引的消息
   */
  const deleteMessageByIndex = (index: number): void => {
    const conversation = currentConversation.value
    if (!conversation) return

    if (index >= 0 && index < conversation.messages.length) {
      conversation.messages.splice(index, 1)
      saveConversations()
    }
  }

  /**
   * 初始化
   */
  const initialize = (): void => {
    if (conversations.value.length === 0) {
      // 不自动创建-等待加载
      currentConversationId.value = ''
    } else {
      currentConversationId.value = conversations.value[0]?.id || ''
    }
  }

  /**
   * 初始化并从后端加载会话列表
   * @returns 分页信息-用于初始化hasMore状态
   */
  const initializeFromServer = async (userId: string): Promise<{ hasMore: boolean; total: number; totalPages: number } | null> => {
    // 验证 userId
    if (!userId || userId === 'null' || userId === 'undefined' || userId.trim() === '') {
      console.error('initializeFromServer: userId 无效')
      return null
    }

    // 清理本地存储的空临时对话
    cleanupEmptyTemporaryConversations()

    const paginationInfo = await loadFromServer(userId)

    // 无会话-创建一个本地临时对话
    if (conversations.value.length === 0) {
      createConversation()
    }

    return paginationInfo
  }

  return {
    // 状态
    conversations: conversations as Ref<Conversation[]>,
    currentConversationId,
    currentConversation,
    currentMessages,
    isLoading,

    // 对话管理
    createConversation,
    selectConversation,
    clearAllConversations,
    deleteConversation,
    updateConversationTitle,
    updateSessionId,
    ensureServerSession,
    cleanupEmptyTemporaryConversations,

    // 消息管理
    addMessage,
    updateMessageContent,
    deleteMessage,
    deleteMessageByIndex,

    // 持久化
    saveConversations,

    // 初始化
    initialize,

    // 同步
    loadFromServer,
    initializeFromServer,
    loadMessagesForSession
  }
}
