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
    expect(wrapper.text()).toContain('估算 ¥0.030000')
  })
})
