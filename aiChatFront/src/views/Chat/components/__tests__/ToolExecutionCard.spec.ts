import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolExecutionCard from '../ToolExecutionCard.vue'
import type { ToolExecutionRecord } from '@/interface/tools'

describe('ToolExecutionCard', () => {
  const mockTools: ToolExecutionRecord[] = [
    {
      id: 'exec-1',
      name: 'code_interpreter',
      title: '代码解释器',
      callType: 'user_preset',
      args: { language: 'python', code: 'print(42)' },
      result: {
        status: 'success',
        output: { stdout: '42\n' },
        rawOutput: '42',
        durationMs: 120,
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'exec-2',
      name: 'calculator',
      title: '数学计算器',
      callType: 'user_preset',
      args: { expression: '100 / 0' },
      result: {
        status: 'error',
        output: null,
        error: '除数不能为0',
        durationMs: 5,
      },
      createdAt: new Date().toISOString(),
    },
  ]

  it('正确渲染工具卡片列表与状态标签', () => {
    const wrapper = mount(ToolExecutionCard, {
      props: {
        toolCalls: mockTools,
      },
    })

    expect(wrapper.text()).toContain('代码解释器')
    expect(wrapper.text()).toContain('执行成功')
    expect(wrapper.text()).toContain('120ms')

    expect(wrapper.text()).toContain('数学计算器')
    expect(wrapper.text()).toContain('执行失败')
  })

  it('点击头部可展开/折叠查看执行结果与参数', async () => {
    const wrapper = mount(ToolExecutionCard, {
      props: {
        toolCalls: mockTools,
      },
    })

    expect(wrapper.find('.tool-card-body').exists()).toBe(false)

    // 点击第一个卡片头部
    const header = wrapper.find('.tool-card-header')
    await header.trigger('click')

    expect(wrapper.find('.tool-card-body').exists()).toBe(true)
    expect(wrapper.text()).toContain('42')
  })
})
