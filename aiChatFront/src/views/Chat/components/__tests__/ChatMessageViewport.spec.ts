import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mockResetUserScrolling = vi.fn()
const mockScrollToBottom = vi.fn()

vi.mock('@/hooks/useScrollManager', () => ({
  useScrollManager: () => ({
    isUserScrolling: ref(false),
    showScrollButton: ref(false),
    distanceFromBottom: ref(0),
    scrollToBottom: mockScrollToBottom,
    handleStreamingScroll: vi.fn(),
    isNearBottom: vi.fn(() => true),
    resetUserScrolling: mockResetUserScrolling,
  }),
}))

vi.mock('@/hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: () => ({
    isLoading: ref(false),
    hasMore: ref(false),
  }),
}))

vi.mock('@/views/Chat/hooks/useMessageListWatcher', () => ({
  useMessageListWatcher: vi.fn(),
}))

import ChatMessageViewport from '../ChatMessageViewport.vue'

describe('ChatMessageViewport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders welcome screen when message list is empty', () => {
    const wrapper = mount(ChatMessageViewport, {
      props: {
        messages: [],
        loading: false,
      },
      shallow: true,
      global: {
        stubs: ['a-avatar', 'a-image', 'a-image-preview-group'],
      },
    })

    expect(wrapper.text()).toContain('AICHAT')
    expect(wrapper.text()).toContain('示例')
  })

  it('emits prompt-click when welcome card is clicked', async () => {
    const wrapper = mount(ChatMessageViewport, {
      props: {
        messages: [],
        loading: false,
      },
      shallow: true,
      global: {
        stubs: ['a-avatar', 'a-image', 'a-image-preview-group'],
      },
    })

    await wrapper.find('button.example-card').trigger('click')

    expect(wrapper.emitted('prompt-click')?.[0]).toEqual(['用简单的话解释量子计算'])
  })

  it('reacts to scroll signal by restoring auto-follow and scrolling to bottom', async () => {
    const wrapper = mount(ChatMessageViewport, {
      props: {
        messages: [
          {
            id: 'user-1',
            role: 'user',
            content: 'hello',
            timestamp: Date.now(),
          },
        ],
        loading: false,
        scrollSignal: 0,
      },
      shallow: true,
      global: {
        stubs: ['a-avatar', 'a-image', 'a-image-preview-group'],
      },
    })

    await wrapper.setProps({ scrollSignal: 1 })

    expect(mockResetUserScrolling).toHaveBeenCalledTimes(1)
    expect(mockScrollToBottom).toHaveBeenCalledWith(true)
  })

  it('renders assistant usage metadata when available', () => {
    const wrapper = mount(ChatMessageViewport, {
      props: {
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: 'hello',
            timestamp: Date.now(),
            model: 'GLM-5',
            usage: {
              promptTokens: 10,
              completionTokens: 5,
              totalTokens: 15,
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
          },
        ],
        loading: false,
      },
      shallow: true,
      global: {
        stubs: ['a-avatar', 'a-image', 'a-image-preview-group', 'MarkdownMessage'],
      },
    })

    expect(wrapper.text()).toContain('GLM-5')
    expect(wrapper.text()).toContain('输入 10 tok')
    expect(wrapper.text()).toContain('输出 5 tok')
    expect(wrapper.text()).toContain('总计 15 tok')
    expect(wrapper.text()).toContain('估算 0.030000')
    expect(wrapper.text()).not.toContain('扣费 100 积分')
  })

  it('does not render duplicate plain-text block for streaming assistant message', () => {
    const wrapper = mount(ChatMessageViewport, {
      props: {
        messages: [
          {
            id: 'assistant-streaming-1',
            role: 'assistant',
            content: '流式内容',
            timestamp: Date.now(),
            streaming: true,
          },
        ],
        loading: false,
      },
      shallow: true,
      global: {
        stubs: ['a-avatar', 'a-image', 'a-image-preview-group', 'MarkdownMessage', 'ChatReasoningPanel'],
      },
    })

    expect(wrapper.find('.user-message-content').exists()).toBe(false)
  })
})
