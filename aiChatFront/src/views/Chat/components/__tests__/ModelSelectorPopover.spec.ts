import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ModelSelectorPopover from '../ModelSelectorPopover.vue'

describe('ModelSelectorPopover', () => {
  const createMount = (props: {
    selectedModel: string
    modelOptions: Array<{
      label: string
      value: string
      reserveCredits?: number
      reasoningBadgeLabel?: string
    }>
  }) => {
    return mount(ModelSelectorPopover, {
      props: {
        ...props,
        creditsRemaining: 1000,
      },
      global: {
        stubs: {
          'a-popover': {
            template: '<div><slot /><slot name="content" /></div>',
          },
          ThunderboltOutlined: true,
          DownOutlined: true,
          CheckCircleFilled: true,
          CheckOutlined: true,
        },
      },
    })
  }

  it('无可用 Gemini 模型时隐藏顶部分组 Tab 并直接展示现有可用模型列表', () => {
    const wrapper = createMount({
      selectedModel: 'grok-chat-fast',
      modelOptions: [
        { label: 'Grok Chat Fast', value: 'grok-chat-fast', reserveCredits: 10 },
        { label: 'Spark-X2.6-4B (轻量开源)', value: 'spark-x2.6-4b', reserveCredits: 0 },
      ],
    })

    expect(wrapper.find('.category-segmented-container').exists()).toBe(false)
    expect(wrapper.find('.gemini-section').exists()).toBe(false)
    expect(wrapper.find('.other-section').exists()).toBe(true)
    expect(wrapper.text()).toContain('现有可用模型')
    expect(wrapper.text()).toContain('Spark-X2.6-4B (轻量开源)')
  })

  it('存在启用的 Gemini 模型时展示 Gemini 系列与其它模型切换 Tab 并支持动态显隐', async () => {
    const wrapper = createMount({
      selectedModel: 'gemini-3.8-flash-medium',
      modelOptions: [
        { label: 'Gemini 3.8 Flash (Medium 思考)', value: 'gemini-3.8-flash-medium', reserveCredits: 10 },
        { label: 'Grok Chat Fast', value: 'grok-chat-fast', reserveCredits: 10 },
      ],
    })

    expect(wrapper.find('.category-segmented-container').exists()).toBe(true)
    expect(wrapper.find('.gemini-section').exists()).toBe(true)
    expect(wrapper.text()).toContain('Gemini 系列')
    expect(wrapper.text()).toContain('其它模型')

    await wrapper.findAll('.segmented-pill')[1]!.trigger('click')
    expect(wrapper.emitted('update:selectedModel')?.[0]).toEqual(['grok-chat-fast'])

    await wrapper.setProps({
      selectedModel: 'grok-chat-fast',
      modelOptions: [
        { label: 'Grok Chat Fast', value: 'grok-chat-fast', reserveCredits: 10 },
      ],
    })

    expect(wrapper.find('.category-segmented-container').exists()).toBe(false)
    expect(wrapper.find('.other-section').exists()).toBe(true)
  })
})
