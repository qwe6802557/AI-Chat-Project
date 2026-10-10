import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mockResetUserScrolling = vi.fn()
const mockScrollToBottom = vi.fn()
const mockForceScrollToBottom = vi.fn()

vi.mock('@/hooks/useScrollManager', () => ({
  useScrollManager: () => ({
    isUserScrolling: ref(false),
    showScrollButton: ref(false),
    distanceFromBottom: ref(0),
    scrollToBottom: mockScrollToBottom,
    forceScrollToBottom: mockForceScrollToBottom,
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

  it('triggers forceScrollToBottom and resets user scrolling when currentSessionId changes', async () => {
    const wrapper = mount(ChatMessageViewport, {
      props: {
        messages: [
          {
            id: 'm-1',
            role: 'user',
            content: 'hi',
            timestamp: Date.now(),
          },
        ],
        loading: false,
        currentSessionId: 'session-1',
      },
      shallow: true,
      global: {
        stubs: ['a-avatar', 'a-image', 'a-image-preview-group'],
      },
    })

    await wrapper.setProps({ currentSessionId: 'session-2' })

    expect(mockResetUserScrolling).toHaveBeenCalled()
    expect(mockForceScrollToBottom).toHaveBeenCalled()
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
            durationMs: 8520,
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
    expect(wrapper.text()).toContain('耗时 8.5s')
    // 估算成本 chip 已暂时隐藏
    expect(wrapper.text()).not.toContain('估算')
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

  it('renders assistant-error-card and emits retry-message on click', async () => {
    const wrapper = mount(ChatMessageViewport, {
      props: {
        messages: [
          {
            id: 'assistant-error-1',
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            streaming: false,
            error: '客户端请求ID格式不正确',
          },
        ],
        loading: false,
      },
      global: {
        stubs: [
          'a-avatar',
          'a-image',
          'a-image-preview-group',
          'MarkdownMessage',
          'ChatReasoningPanel',
          'DocumentPreviewModal',
        ],
      },
    })

    expect(wrapper.find('.assistant-error-card').exists()).toBe(true)
    expect(wrapper.find('.error-title').text()).toBe('生成遇到问题')
    expect(wrapper.find('.error-desc').text()).toBe('客户端请求ID格式不正确')

    await wrapper.find('.error-retry-btn').trigger('click')
    expect(wrapper.emitted('retry-message')?.[0]).toEqual(['assistant-error-1'])
  })

  it('renders SearchSourceGallery when assistant message has sources or searching status', () => {
    const wrapper = mount(ChatMessageViewport, {
      props: {
        messages: [
          {
            id: 'assistant-sources-1',
            role: 'assistant',
            content: '根据检索结果...',
            timestamp: Date.now(),
            streaming: false,
            sources: [
              { id: 1, title: '测试来源', url: 'https://test.com', snippet: '内容' },
            ],
            searchStatus: 'done',
          },
        ],
        loading: false,
      },
      shallow: true,
      global: {
        stubs: ['a-avatar', 'a-image', 'a-image-preview-group', 'MarkdownMessage', 'ChatReasoningPanel', 'SearchSourceGallery'],
      },
    })

    expect(wrapper.findComponent({ name: 'SearchSourceGallery' }).exists()).toBe(true)
  })

  it('renders document attachment pill cards with format badge and parsed character count', () => {
    const wrapper = mount(ChatMessageViewport, {
      props: {
        messages: [
          {
            id: 'user-doc-1',
            role: 'user',
            content: '请总结这份架构文档',
            timestamp: Date.now(),
            attachments: [
              {
                type: 'pdf',
                name: 'architecture-spec.pdf',
                preview: 'http://localhost:3000/files/pdf-1',
                url: 'http://localhost:3000/files/pdf-1',
                sizeBytes: 2048,
                charCount: 1580,
                extractedText: '架构设计正文...',
              },
            ],
          },
        ],
        loading: false,
      },
      global: {
        stubs: {
          'a-avatar': true,
          'a-image': true,
          'a-image-preview-group': { template: '<div><slot /></div>' },
          DocumentPreviewModal: true,
        },
      },
    })

    expect(wrapper.find('.attachment-file').exists()).toBe(true)
    expect(wrapper.find('.doc-badge').text()).toBe('PDF')
    expect(wrapper.text()).toContain('architecture-spec.pdf')
    expect(wrapper.text()).toContain('2 KB')
    expect(wrapper.text()).toContain('已解析 1,580 字')
  })
})
