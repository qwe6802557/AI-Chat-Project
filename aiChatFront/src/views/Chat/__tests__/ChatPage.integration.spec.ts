import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  routerPush,
  mockGetActiveModels,
  mockGetSessionList,
  mockCreateSession,
  mockDeleteSession,
  mockGetSessionMessages,
  mockUpdateSessionTitle,
  mockClearAllSessions,
  mockSendStreamMessage,
  mockMessageWarning,
  mockMessageError,
} = vi.hoisted(() => ({
  routerPush: vi.fn(),
  mockGetActiveModels: vi.fn(),
  mockGetSessionList: vi.fn(),
  mockCreateSession: vi.fn(),
  mockDeleteSession: vi.fn(),
  mockGetSessionMessages: vi.fn(),
  mockUpdateSessionTitle: vi.fn(),
  mockClearAllSessions: vi.fn(),
  mockSendStreamMessage: vi.fn(),
  mockMessageWarning: vi.fn(),
  mockMessageError: vi.fn(),
}))

vi.mock('vue-router', () => ({
  createRouter: () => ({
    beforeEach: vi.fn(),
    currentRoute: { value: { name: 'chat' } },
    replace: vi.fn(),
    push: vi.fn(),
  }),
  createWebHistory: vi.fn(() => ({})),
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('@/api/model', () => ({
  getActiveModels: mockGetActiveModels,
}))

vi.mock('@/api/chat', async () => {
  const actual = await vi.importActual<typeof import('@/api/chat')>('@/api/chat')
  return {
    ...actual,
    getSessionList: mockGetSessionList,
    createSession: mockCreateSession,
    deleteSession: mockDeleteSession,
    getSessionMessages: mockGetSessionMessages,
    updateSessionTitle: mockUpdateSessionTitle,
    clearAllSessions: mockClearAllSessions,
    sendStreamMessage: mockSendStreamMessage,
  }
})

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<typeof import('ant-design-vue')>('ant-design-vue')
  return {
    ...actual,
    message: {
      warning: mockMessageWarning,
      success: vi.fn(),
      error: mockMessageError,
      info: vi.fn(),
    },
  }
})

const ChatAreaStub = defineComponent({
  name: 'ChatAreaStub',
  props: {
    messages: {
      type: Array,
      required: true,
    },
    loading: {
      type: Boolean,
      required: true,
    },
    currentSessionId: {
      type: String,
      default: '',
    },
    selectedModel: {
      type: String,
      default: '',
    },
  },
  emits: ['send-message', 'update:selected-model'],
  template: `
    <div class="chat-area-stub">
      <div class="session-probe">{{ currentSessionId }}</div>
      <div class="loading-probe">{{ loading }}</div>
      <div class="model-probe">{{ selectedModel }}</div>
      <div class="messages-probe">{{ JSON.stringify(messages) }}</div>
      <button class="send-text" @click="$emit('send-message', '你好')">send</button>
      <button class="change-model" @click="$emit('update:selected-model', 'MODEL-X')">change-model</button>
    </div>
  `,
})

const SidebarStub = defineComponent({
  name: 'SidebarStub',
  emits: ['new-chat', 'logout'],
  template: `
    <div class="sidebar-stub">
      <button class="sidebar-new-chat" @click="$emit('new-chat')">new-chat</button>
      <button class="sidebar-logout" @click="$emit('logout')">logout</button>
    </div>
  `,
})

const waitForRaf = async () => {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
}

const mountChatPage = async (userOverrides?: Partial<{
  id: string
  username: string
  role: 'admin' | 'user'
  isActive: boolean
  createdAt: string
  updatedAt: string
}>) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const { useAuthStore } = await import('@/stores')
  const authStore = useAuthStore()
  authStore.setAuthSession({
    token: 'token-1',
    user: {
      id: 'user-1',
      username: 'tester',
      role: 'user',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...userOverrides,
    },
  })

  const { default: ChatPage } = await import('../index.vue')
  const wrapper = mount(ChatPage, {
    global: {
      plugins: [pinia],
      stubs: {
        Sidebar: SidebarStub,
        ChatArea: ChatAreaStub,
      },
    },
  })

  await flushPromises()

  return { wrapper, pinia }
}

describe('ChatPage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockGetSessionList.mockResolvedValue({
      code: 0,
      data: [],
      message: 'ok',
    })
    mockCreateSession.mockResolvedValue({
      code: 0,
      data: {
        id: 'session-1',
        title: '新对话',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      message: 'ok',
    })
    mockGetSessionMessages.mockResolvedValue({
      code: 0,
      data: {
        messages: [],
        total: 0,
        page: 1,
        pageSize: 5,
        totalPages: 0,
      },
      message: 'ok',
    })
    mockGetActiveModels.mockResolvedValue({
      code: 0,
      data: [
        {
          modelId: 'GLM-5',
          provider: {
            name: 'Zaiwen',
          },
        },
      ],
      message: 'ok',
    })
  })

  it('creates a session and writes streamed assistant response back into page state', async () => {
    let streamCallbacks:
      | {
          onMessage: (delta: string, sessionId?: string) => void
          onComplete: (
            fullMessage: string,
            sessionId: string,
            model: string,
            usage?: {
              promptTokens: number
              completionTokens: number
              totalTokens: number
              estimatedInputCost?: number
              estimatedOutputCost?: number
              estimatedTotalCost?: number
            }
          ) => void
          onError: (error: string) => void
        }
      | undefined

    mockSendStreamMessage.mockImplementation((payload, callbacks) => {
      streamCallbacks = callbacks
      return {
        close: vi.fn(),
        }
    })

    const { wrapper } = await mountChatPage()

    expect(mockGetSessionList).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(mockGetActiveModels).toHaveBeenCalledWith({ includeProvider: true })

    await wrapper.find('.send-text').trigger('click')
    await flushPromises()

    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: 'user-1',
      title: '你好',
    })
    expect(mockSendStreamMessage).toHaveBeenCalledTimes(1)
    expect(mockSendStreamMessage.mock.calls[0]?.[0]).toMatchObject({
      userId: 'user-1',
      sessionId: 'session-1',
      message: '你好',
      model: 'GLM-5',
    })

    streamCallbacks?.onMessage('世界')
    await nextTick()
    await waitForRaf()

    streamCallbacks?.onComplete('世界', 'session-1', 'GLM-5', {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      estimatedInputCost: 0.01,
      estimatedOutputCost: 0.02,
      estimatedTotalCost: 0.03,
    })
    await flushPromises()

    expect(wrapper.find('.session-probe').text()).toBe('session-1')

    const messages = JSON.parse(wrapper.find('.messages-probe').text()) as Array<Record<string, unknown>>
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: '你好',
    })
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: '世界',
      streaming: false,
      model: 'GLM-5',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        estimatedInputCost: 0.01,
        estimatedOutputCost: 0.02,
        estimatedTotalCost: 0.03,
      },
    })
  }, 20000)

  it('falls back to default model and shows warning when model list loading fails', async () => {
    mockGetActiveModels.mockRejectedValueOnce(new Error('model load failed'))

    const { wrapper } = await mountChatPage()

    expect(mockMessageWarning).toHaveBeenCalledWith('模型列表加载失败，已使用默认模型 GLM-5')
    expect(wrapper.find('.model-probe').text()).toBe('GLM-5')
  })

  it('creates a local temporary conversation when session initialization fails', async () => {
    mockGetSessionList.mockRejectedValueOnce(new Error('session list failed'))

    const { wrapper } = await mountChatPage()

    const sessionId = wrapper.find('.session-probe').text()
    expect(sessionId.startsWith('temp-')).toBe(true)
  })

  it('restores local conversation from localStorage when session initialization fails', async () => {
    localStorage.setItem('chatConversations', JSON.stringify([
      {
        id: 'local-session-1',
        title: '本地会话',
        createdAt: 1,
        updatedAt: 2,
        sessionId: 'local-session-1',
        messages: [
          {
            id: 'local-user',
            role: 'user',
            content: '本地消息',
            timestamp: 1,
          },
          {
            id: 'local-assistant',
            role: 'assistant',
            content: '本地回复',
            timestamp: 2,
          },
        ],
      },
    ]))
    localStorage.setItem('currentConversationId', 'local-session-1')
    mockGetSessionList.mockRejectedValueOnce(new Error('session list failed'))

    const { wrapper } = await mountChatPage()

    expect(wrapper.find('.session-probe').text()).toBe('local-session-1')
    const messages = JSON.parse(wrapper.find('.messages-probe').text()) as Array<Record<string, unknown>>
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: '本地消息',
    })
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: '本地回复',
    })
  })

  it('restores and persists selected model through localStorage', async () => {
    localStorage.setItem('selectedChatModel', JSON.stringify('MODEL-X'))
    mockGetActiveModels.mockResolvedValueOnce({
      code: 0,
      data: [
        {
          modelId: 'GLM-5',
          provider: { name: 'Zaiwen' },
        },
        {
          modelId: 'MODEL-X',
          provider: { name: 'Zaiwen' },
        },
      ],
      message: 'ok',
    })

    const { wrapper } = await mountChatPage()

    expect(wrapper.find('.model-probe').text()).toBe('MODEL-X')

    await wrapper.find('.change-model').trigger('click')
    await nextTick()

    expect(wrapper.find('.model-probe').text()).toBe('MODEL-X')
    expect(localStorage.getItem('selectedChatModel')).toBe('"MODEL-X"')
  })

  it('removes streaming assistant message when stream returns error', async () => {
    let streamCallbacks:
      | {
          onMessage: (delta: string, sessionId?: string) => void
          onComplete: (
            fullMessage: string,
            sessionId: string,
            model: string,
            usage?: {
              promptTokens: number
              completionTokens: number
              totalTokens: number
            }
          ) => void
          onError: (error: string) => void
        }
      | undefined

    mockSendStreamMessage.mockImplementation((_payload, callbacks) => {
      streamCallbacks = callbacks
      return {
        close: vi.fn(),
      }
    })

    const { wrapper } = await mountChatPage()

    await wrapper.find('.send-text').trigger('click')
    await flushPromises()

    streamCallbacks?.onMessage('部分内容')
    await nextTick()
    await waitForRaf()

    streamCallbacks?.onError('stream failed')
    await flushPromises()

    const messages = JSON.parse(wrapper.find('.messages-probe').text()) as Array<Record<string, unknown>>
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: '你好',
    })
    expect(wrapper.find('.loading-probe').text()).toBe('false')
    expect(mockMessageError).toHaveBeenCalledWith('stream failed')
  })

  it('closes active stream when user starts a new chat during streaming', async () => {
    const close = vi.fn()
    let streamCallbacks:
      | {
          onMessage: (delta: string, sessionId?: string) => void
          onComplete: (
            fullMessage: string,
            sessionId: string,
            model: string,
            usage?: {
              promptTokens: number
              completionTokens: number
              totalTokens: number
            }
          ) => void
          onError: (error: string) => void
        }
      | undefined

    mockSendStreamMessage.mockImplementation((_payload, callbacks) => {
      streamCallbacks = callbacks
      return {
        close,
      }
    })

    const { wrapper } = await mountChatPage()
    const { useConversationStore } = await import('@/stores')

    await wrapper.find('.send-text').trigger('click')
    await flushPromises()

    streamCallbacks?.onMessage('处理中')
    await nextTick()
    await waitForRaf()

    await wrapper.find('.sidebar-new-chat').trigger('click')
    await flushPromises()

    expect(close).toHaveBeenCalledTimes(1)
    const store = useConversationStore()
    expect(store.currentConversationId.startsWith('temp-')).toBe(true)

    const oldConversation = store.getConversationById('session-1')
    const assistantMessage = oldConversation?.messages.find((item) => item.role === 'assistant')
    expect(assistantMessage?.streaming).toBe(false)
  })

  it('clears auth state, local conversations and redirects on logout', async () => {
    localStorage.setItem('chatConversations', JSON.stringify([
      {
        id: 'local-session-1',
        title: '本地会话',
        createdAt: 1,
        updatedAt: 2,
        sessionId: 'local-session-1',
        messages: [],
      },
    ]))
    localStorage.setItem('currentConversationId', 'local-session-1')

    const { wrapper } = await mountChatPage()
    const { useAuthStore, useConversationStore } = await import('@/stores')

    await wrapper.find('.sidebar-logout').trigger('click')
    await flushPromises()

    const authStore = useAuthStore()
    const conversationStore = useConversationStore()

    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.userId).toBeNull()
    expect(conversationStore.currentConversationId).toBe('')
    expect(conversationStore.conversations).toEqual([])
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('userId')).toBeNull()
    expect(localStorage.getItem('chatConversations')).toBeNull()
    expect(localStorage.getItem('currentConversationId')).toBeNull()
    expect(routerPush).toHaveBeenCalledWith('/login')
  })
})
