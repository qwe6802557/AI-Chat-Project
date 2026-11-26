import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ChatReasoningPanel from '../ChatReasoningPanel.vue'

describe('ChatReasoningPanel', () => {
  const globalOptions = {
    stubs: {
      MarkdownMessage: {
        props: ['content'],
        template: '<div class="markdown-stub">{{ content }}</div>',
      },
      BulbOutlined: true,
      RightOutlined: true,
    },
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-26T15:50:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('流式思考默认展开、无重复预览且显示 Shimmer 与实时耗时', async () => {
    const wrapper = mount(ChatReasoningPanel, {
      props: {
        messageId: 'msg-1',
        reasoning: {
          mode: 'raw',
          title: '思考过程',
          content: '第一步分析问题',
          status: 'streaming',
        },
      },
      global: globalOptions,
    })

    expect(wrapper.find('.reasoning-panel').classes()).toContain('expanded')
    expect(wrapper.find('.reasoning-label').text()).toBe('深度思考中')
    expect(wrapper.find('.reasoning-label').classes()).toContain('is-shimmer')
    expect(wrapper.find('.reasoning-preview').exists()).toBe(false)
    expect(wrapper.find('.reasoning-body').classes()).toContain('is-streaming-scroll')

    await vi.advanceTimersByTimeAsync(1200)
    await nextTick()
    expect(wrapper.find('.reasoning-duration').text()).toBe('1.2s')
  })

  it('思考结束后自动收起为紧凑胶囊并冻结总耗时', async () => {
    const wrapper = mount(ChatReasoningPanel, {
      props: {
        messageId: 'msg-2',
        reasoning: {
          mode: 'raw',
          title: '思考过程',
          content: '推理推演中',
          status: 'streaming',
        },
      },
      global: globalOptions,
    })

    await vi.advanceTimersByTimeAsync(1200)
    await wrapper.setProps({
      reasoning: {
        mode: 'raw',
        title: '思考过程',
        content: '推理推演完成',
        status: 'done',
      },
    })

    expect(wrapper.find('.reasoning-panel').classes()).not.toContain('expanded')
    expect(wrapper.find('.reasoning-label').text()).toBe('已深度思考')
    expect(wrapper.find('.reasoning-label').classes()).not.toContain('is-shimmer')
    expect(wrapper.find('.reasoning-duration').text()).toBe('用时 1.2s')
  })

  it('历史已完成消息默认折叠且不伪造耗时，点击后懒挂载展开', async () => {
    const wrapper = mount(ChatReasoningPanel, {
      props: {
        messageId: 'msg-3',
        reasoning: {
          mode: 'raw',
          title: '思考过程',
          content: '历史思考记录内容',
          status: 'done',
        },
      },
      global: globalOptions,
    })

    expect(wrapper.find('.reasoning-panel').classes()).not.toContain('expanded')
    expect(wrapper.find('.reasoning-duration').exists()).toBe(false)
    expect(wrapper.find('.markdown-stub').exists()).toBe(false)

    await wrapper.find('.reasoning-toggle').trigger('click')
    expect(wrapper.find('.reasoning-panel').classes()).toContain('expanded')
    expect(wrapper.find('.markdown-stub').text()).toBe('历史思考记录内容')
  })

  it('用户手动折叠后，思考结束不会覆盖用户的折叠状态', async () => {
    const wrapper = mount(ChatReasoningPanel, {
      props: {
        messageId: 'msg-4',
        reasoning: {
          mode: 'raw',
          title: '思考过程',
          content: '正在推理',
          status: 'streaming',
        },
      },
      global: globalOptions,
    })

    await wrapper.find('.reasoning-toggle').trigger('click')
    expect(wrapper.find('.reasoning-panel').classes()).not.toContain('expanded')

    await wrapper.find('.reasoning-toggle').trigger('click')
    expect(wrapper.find('.reasoning-panel').classes()).toContain('expanded')

    await wrapper.setProps({
      reasoning: {
        mode: 'raw',
        title: '思考过程',
        content: '推理完成',
        status: 'done',
      },
    })
    expect(wrapper.find('.reasoning-panel').classes()).toContain('expanded')
  })
})
