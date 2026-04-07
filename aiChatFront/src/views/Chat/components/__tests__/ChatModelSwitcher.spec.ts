import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChatModelSwitcher from '../ChatModelSwitcher.vue'

describe('ChatModelSwitcher', () => {
  it('renders reasoning badge label when model supports reasoning', () => {
    const wrapper = mount(ChatModelSwitcher, {
      props: {
        selectedModel: 'GLM-5',
        modelOptions: [{ label: 'GLM-5', value: 'GLM-5' }],
        selectedModelInputPrice: 0.92,
        selectedModelOutputPrice: 3.66,
        selectedModelReserveCredits: 100,
        selectedModelReasoningCapability: 'raw',
        selectedModelReasoningBadgeLabel: '支持思考过程',
      },
      global: {
        stubs: ['a-select'],
      },
    })

    expect(wrapper.text()).toContain('支持思考过程')
  })
})
