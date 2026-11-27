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
      props,
      global: {
        stubs: {
          'a-popover': {
            template: '<div><slot /><slot name="content" /></div>',
          },
          'a-tooltip': {
            props: ['title'],
            template: '<div class="a-tooltip-stub" :data-title="title"><slot /></div>',
          },
          ThunderboltOutlined: true,
          DownOutlined: true,
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
      selectedModel: 'gemini-2.5-flash',
      modelOptions: [
        { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', reserveCredits: 10 },
        { label: 'Grok Chat Fast', value: 'grok-chat-fast', reserveCredits: 10 },
      ],
    })

    expect(wrapper.find('.category-segmented-container').exists()).toBe(true)
    expect(wrapper.find('.gemini-section').exists()).toBe(true)
    expect(wrapper.text()).toContain('Gemini 系列')
    expect(wrapper.text()).toContain('Gemini 2.5 Flash')
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

  it('底部信息栏移除重复余额并单行截断超长模型 ID，同时通过 Tooltip 承载完整名称', () => {
    const longModelId = 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B'
    const wrapper = createMount({
      selectedModel: longModelId,
      modelOptions: [
        {
          label: 'DeepSeek-R1-Distill (7B)',
          value: longModelId,
          reserveCredits: 10,
          reasoningBadgeLabel: '支持思考过程',
        },
      ],
    })

    expect(wrapper.find('.footer-credits').exists()).toBe(false)
    expect(wrapper.find('.popover-footer').text()).not.toContain('余额')
    expect(wrapper.find('.footer-model-id').text()).toBe(longModelId)
    expect(wrapper.find('.a-tooltip-stub').attributes('data-title')).toBe(longModelId)
  })
})
