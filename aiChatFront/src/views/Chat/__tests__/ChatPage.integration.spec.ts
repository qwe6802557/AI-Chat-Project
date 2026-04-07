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
    modelOptions: {
      type: Array,
      required: true,
    },
    selectedModelInputPrice: {
      type: Number,
      default: 0,
    },
    selectedModelOutputPrice: {
      type: Number,
      default: 0,
    },
    selectedModelReserveCredits: {
      type: Number,
      default: 0,
    },
    currentCreditsRemaining: {
      type: Number,
      default: 0,
    },
    hasCreditSnapshot: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['send-message', 'update:selected-model'],
  template: `
    <div class="chat-area-stub">
      <div class="session-probe">{{ currentSessionId }}</div>
      <div class="loading-probe">{{ loading }}</div>
      <div class="model-probe">{{ selectedModel }}</div>
      <div class="model-input-price-probe">{{ selectedModelInputPrice }}</div>
      <div class="model-output-price-probe">{{ selectedModelOutputPrice }}</div>
      <div class="model-reserve-credits-probe">{{ selectedModelReserveCredits }}</div>
      <div class="model-options-probe">{{ JSON.stringify(modelOptions) }}</div>
      <div class="current-credits-probe">{{ currentCreditsRemaining }}</div>
      <div class="has-credit-snapshot-probe">{{ hasCreditSnapshot }}</div>
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
  credits: {
    total: number
    consumed: number
    remaining: number
    reserved?: number
  }
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
        credits: {
          total: 2000,
          consumed: 0,
          remaining: 2000,
          reserved: 0,
        },
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
          inputPrice: 1.83,
          outputPrice: 7.32,
          creditCost: 100,
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
          onChunk: (chunk: Record<string, unknown>) => void
          onComplete: (chunk: Record<string, unknown>) => void
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
    expect(wrapper.find('.model-input-price-probe').text()).toBe('1.83')
    expect(wrapper.find('.model-output-price-probe').text()).toBe('7.32')
    expect(wrapper.find('.model-reserve-credits-probe').text()).toBe('100')
    expect(wrapper.find('.model-options-probe').text()).toContain('"label":"GLM-5"')

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

    streamCallbacks?.onChunk({
      type: 'reasoning_start',
      reasoning: {
        mode: 'raw',
        source: 'provider_block',
        title: 'Think',
        content: '',
      },
    })
    streamCallbacks?.onChunk({
      type: 'reasoning_delta',
      delta: '先分析问题意图',
      reasoning: {
        mode: 'raw',
        source: 'provider_block',
        title: 'Think',
        content: '',
      },
    })
    streamCallbacks?.onChunk({
      type: 'reasoning_done',
    })
    streamCallbacks?.onChunk({
      type: 'answer_delta',
      delta: '世界',
    })
    await nextTick()
    await waitForRaf()

    streamCallbacks?.onComplete({
      type: 'done',
      message: '世界',
      sessionId: 'session-1',
      model: 'GLM-5',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        estimatedInputCost: 0.01,
        estimatedOutputCost: 0.02,
        estimatedTotalCost: 0.03,
      },
      creditsSnapshot: {
        total: 2000,
        consumed: 100,
        remaining: 1900,
        reserved: 0,
      },
      charge: {
        id: 'charge-1',
        clientRequestId: 'request-1',
        modelId: 'GLM-5',
        billingMode: 'flat_per_request',
        credits: 100,
        status: 'captured',
      },
      reasoning: {
        mode: 'raw',
        source: 'provider_block',
        title: 'Think',
        content: '先分析问题意图',
      },
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
      charge: {
        id: 'charge-1',
        clientRequestId: 'request-1',
        modelId: 'GLM-5',
        billingMode: 'flat_per_request',
        credits: 100,
        status: 'captured',
      },
      reasoning: {
        mode: 'raw',
        source: 'provider_block',
        title: 'Think',
        content: '先分析问题意图',
        status: 'done',
      },
    })

    const { useAuthStore } = await import('@/stores')
    expect(useAuthStore().userProfile?.credits?.remaining).toBe(1900)
  }, 20000)

  it('falls back to default model and shows warning when model list loading fails', async () => {
    mockGetActiveModels.mockRejectedValueOnce(new Error('model load failed'))

    const { wrapper } = await mountChatPage()

    expect(mockMessageWarning).toHaveBeenCalledWith('模型列表加载失败，已使用默认模型 GLM-5')
    expect(wrapper.find('.model-probe').text()).toBe('GLM-5')
  })

  it('does not show model fallback warning when model request fails because auth expired', async () => {
    mockGetActiveModels.mockRejectedValueOnce(new Error('未授权，请先登录'))

    const { wrapper } = await mountChatPage()

    expect(mockMessageWarning).not.toHaveBeenCalledWith('模型列表加载失败，已使用默认模型 GLM-5')
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
          inputPrice: 1.83,
          outputPrice: 7.32,
          creditCost: 100,
          provider: { name: 'Zaiwen' },
        },
        {
          modelId: 'MODEL-X',
          inputPrice: 2.5,
          outputPrice: 10,
          creditCost: 200,
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
    expect(wrapper.find('.model-input-price-probe').text()).toBe('2.5')
    expect(wrapper.find('.model-output-price-probe').text()).toBe('10')
    expect(wrapper.find('.model-reserve-credits-probe').text()).toBe('200')
    expect(wrapper.find('.model-options-probe').text()).toContain('"label":"MODEL-X"')
    expect(localStorage.getItem('selectedChatModel')).toBe('"MODEL-X"')
  })

  it('blocks sending when current credits are lower than selected model cost', async () => {
    const { wrapper } = await mountChatPage({
      credits: {
        total: 2000,
        consumed: 1950,
        remaining: 50,
        reserved: 0,
      },
    })

    expect(wrapper.find('.current-credits-probe').text()).toBe('50')
    expect(wrapper.find('.has-credit-snapshot-probe').text()).toBe('true')

    await wrapper.find('.send-text').trigger('click')
    await flushPromises()

    expect(mockCreateSession).not.toHaveBeenCalled()
    expect(mockSendStreamMessage).not.toHaveBeenCalled()
    expect(mockMessageWarning).toHaveBeenCalledWith('当前模型发送前至少需预留 100 积分，最终按实际 token 结算，剩余 50 积分')
  })

  it('removes streaming assistant message when stream returns error', async () => {
    let streamCallbacks:
      | {
          onChunk: (chunk: Record<string, unknown>) => void
          onComplete: (chunk: Record<string, unknown>) => void
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

    streamCallbacks?.onChunk({
      type: 'answer_delta',
      delta: '部分内容',
    })
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
          onChunk: (chunk: Record<string, unknown>) => void
          onComplete: (chunk: Record<string, unknown>) => void
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

    streamCallbacks?.onChunk({
      type: 'answer_delta',
      delta: '处理中',
    })
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
