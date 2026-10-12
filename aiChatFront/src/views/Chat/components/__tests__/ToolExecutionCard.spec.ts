import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToolExecutionCard from '../ToolExecutionCard.vue'
import type { ToolCallItem } from '@/interface/chat'

describe('ToolExecutionCard', () => {
  it('renders nothing when toolCalls is empty', () => {
    const wrapper = mount(ToolExecutionCard, {
      props: {
        toolCalls: [],
      },
    })
    expect(wrapper.find('.tool-execution-container').exists()).toBe(false)
  })

  it('renders calling state correctly', () => {
    const toolCalls: ToolCallItem[] = [
      {
        id: 'call_1',
        name: 'calculator',
        status: 'calling',
        arguments: { expression: '12 * 8' },
      },
    ]

    const wrapper = mount(ToolExecutionCard, {
      props: { toolCalls },
    })

    expect(wrapper.text()).toContain('计算器')
    expect(wrapper.text()).toContain('准备调用')
    expect(wrapper.find('.badge-calling').exists()).toBe(true)
  })

  it('renders executing state correctly', () => {
    const toolCalls: ToolCallItem[] = [
      {
        id: 'call_2',
        name: 'web_search_v2',
        status: 'executing',
        arguments: { query: 'AI最新资讯' },
      },
    ]

    const wrapper = mount(ToolExecutionCard, {
      props: { toolCalls },
    })

    expect(wrapper.text()).toContain('深度联网搜索')
    expect(wrapper.text()).toContain('正在执行...')
    expect(wrapper.find('.badge-executing').exists()).toBe(true)
  })

  it('renders completed state with duration and output upon expand', async () => {
    const toolCalls: ToolCallItem[] = [
      {
        id: 'call_3',
        name: 'calculator',
        status: 'completed',
        arguments: { expression: '12 * 8' },
        result: { result: 96 },
        durationMs: 42,
      },
    ]

    const wrapper = mount(ToolExecutionCard, {
      props: { toolCalls },
    })

    expect(wrapper.text()).toContain('执行成功')
    expect(wrapper.text()).toContain('42ms')

    expect(wrapper.find('.tool-card-body').exists()).toBe(false)

    await wrapper.find('.tool-card-header').trigger('click')

    expect(wrapper.find('.tool-card-body').exists()).toBe(true)
    expect(wrapper.text()).toContain('调用参数')
    expect(wrapper.text()).toContain('12 * 8')
    expect(wrapper.text()).toContain('执行输出')
    expect(wrapper.text()).toContain('96')
  })

  it('renders failed state with error message upon expand', async () => {
    const toolCalls: ToolCallItem[] = [
      {
        id: 'call_4',
        name: 'weather',
        status: 'failed',
        arguments: { city: 'Mars' },
        result: { error: 'City not found' },
        durationMs: 85,
      },
    ]

    const wrapper = mount(ToolExecutionCard, {
      props: { toolCalls },
    })

    expect(wrapper.text()).toContain('天气查询')
    expect(wrapper.text()).toContain('执行失败')
    expect(wrapper.text()).toContain('85ms')

    await wrapper.find('.tool-card-header').trigger('click')

    expect(wrapper.text()).toContain('City not found')
  })
})
