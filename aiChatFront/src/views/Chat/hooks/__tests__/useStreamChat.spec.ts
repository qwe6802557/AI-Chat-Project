import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const {
  mockSendStreamMessage,
  mockCreateSession,
  mockMessageError,
} = vi.hoisted(() => ({
  mockSendStreamMessage: vi.fn(),
  mockCreateSession: vi.fn(),
  mockMessageError: vi.fn(),
}))

vi.mock('@/api/chat', async () => {
  const actual = await vi.importActual<typeof import('@/api/chat')>('@/api/chat')
  return {
    ...actual,
    sendStreamMessage: mockSendStreamMessage,
    createSession: mockCreateSession,
  }
})

vi.mock('ant-design-vue', () => ({
  message: {
    error: mockMessageError,
  },
}))

describe('useStreamChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setActivePinia(createPinia())
    mockCreateSession.mockResolvedValue({
      code: 0,
      data: { id: 'session-1' },
      message: 'ok',
    })
  })

  it('cancels active stream when conversation id changes', async () => {
    const { useConversationStore } = await import('@/stores')
    const store = useConversationStore()
    store.createConversation()

    const close = vi.fn()
    let callbacks: {
      onChunk: (chunk: {
        type?: string
        delta?: string
        message?: string
      }) => void
      onComplete: (chunk: {
        type?: string
        message?: string
        model?: string
      }) => void
      onError: (error: string) => void
    } | undefined

    mockSendStreamMessage.mockImplementation((_data, cb) => {
      callbacks = cb
      return { close }
    })

    const { useStreamChat } = await import('../useStreamChat')
    const Harness = defineComponent({
      setup(_, { expose }) {
        const api = useStreamChat()
        expose(api)
        return () => null
      },
    })

    const wrapper = mount(Harness)
    const api = wrapper.vm as unknown as {
      sendMessage: (
        userId: string,
        content: string,
        options?: { fileIds?: string[]; serverFiles?: Array<{ id: string; url: string; name: string; type: string }> }
      ) => Promise<void>
    }

    await api.sendMessage('user-1', '你好', {
      fileIds: ['file-1'],
      serverFiles: [{ id: 'file-1', url: '/files/1', name: 'demo.png', type: 'image/png' }],
    })
    const payload = mockSendStreamMessage.mock.calls[0]?.[0]

    expect(payload).toMatchObject({
      userId: 'user-1',
      sessionId: 'session-1',
      message: '你好',
      fileIds: ['file-1'],
    })
    expect(payload.files).toBeUndefined()

    callbacks?.onChunk({
      type: 'answer_delta',
      delta: 'hello',
    })
    await nextTick()

    store.currentConversationId = 'session-2'
    await nextTick()

    expect(close).toHaveBeenCalledTimes(1)
    const assistantMessage = store.getConversationById('session-1')?.messages.find((item) => item.role === 'assistant')
    expect(assistantMessage?.streaming).toBe(false)
  })

  it('passes webSearch option and updates message with search_start and search_sources events', async () => {
    const { useConversationStore } = await import('@/stores')
    const store = useConversationStore()
    store.createConversation()

    let callbacks: {
      onChunk: (chunk: any) => void
      onComplete: (chunk: any) => void
      onError: (error: string) => void
    } | undefined

    mockSendStreamMessage.mockImplementation((_data, cb) => {
      callbacks = cb
      return { close: vi.fn() }
    })

    const { useStreamChat } = await import('../useStreamChat')
    const Harness = defineComponent({
      setup(_, { expose }) {
        const api = useStreamChat()
        expose(api)
        return () => null
      },
    })

    const wrapper = mount(Harness)
    const api = wrapper.vm as unknown as {
      sendMessage: (
        userId: string,
        content: string,
        options?: { webSearch?: boolean }
      ) => Promise<void>
    }

    await api.sendMessage('user-1', '今天天气如何', { webSearch: true })
    const payload = mockSendStreamMessage.mock.calls[0]?.[0]
    expect(payload.webSearch).toBe(true)

    // 发送 search_start
    callbacks?.onChunk({
      type: 'search_start',
      query: '今天天气',
    })
    await nextTick()

    let assistantMsg = store.getConversationById('session-1')?.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg?.searchStatus).toBe('searching')
    expect(assistantMsg?.searchQuery).toBe('今天天气')

    // 发送 search_sources
    const mockSources = [
      { id: 1, title: '天气网', url: 'https://weather.com', snippet: '晴天' },
    ]
    callbacks?.onChunk({
      type: 'search_sources',
      sources: mockSources,
    })
    await nextTick()

    assistantMsg = store.getConversationById('session-1')?.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg?.searchStatus).toBe('done')
    expect(assistantMsg?.sources).toEqual(mockSources)

    // 完成
    callbacks?.onComplete({
      type: 'done',
      message: '今天天气晴朗',
      sources: mockSources,
    })
    await nextTick()

    assistantMsg = store.getConversationById('session-1')?.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg?.sources).toEqual(mockSources)
    expect(assistantMsg?.content).toBe('今天天气晴朗')
  })
})
