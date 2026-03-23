import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const {
  mockSendStreamMessage,
  mockMessageError,
} = vi.hoisted(() => ({
  mockSendStreamMessage: vi.fn(),
  mockMessageError: vi.fn(),
}))

vi.mock('@/api/chat', async () => {
  const actual = await vi.importActual<typeof import('@/api/chat')>('@/api/chat')
  return {
    ...actual,
    sendStreamMessage: mockSendStreamMessage,
    createSession: vi.fn().mockResolvedValue({
      code: 0,
      data: { id: 'session-1' },
      message: 'ok',
    }),
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
  })

  it('cancels active stream when conversation id changes', async () => {
    const { useConversationStore } = await import('@/stores')
    const store = useConversationStore()
    store.createConversation()

    const close = vi.fn()
    let callbacks: {
      onMessage: (delta: string) => void
      onComplete: (fullMessage: string, sessionId: string, model: string) => void
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

    callbacks?.onMessage('hello')
    await nextTick()

    store.currentConversationId = 'session-2'
    await nextTick()

    expect(close).toHaveBeenCalledTimes(1)
    const assistantMessage = store.getConversationById('session-1')?.messages.find((item) => item.role === 'assistant')
    expect(assistantMessage?.streaming).toBe(false)
  })

})
