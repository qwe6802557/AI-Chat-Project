import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WebSearchToggle from '../WebSearchToggle.vue'

describe('WebSearchToggle', () => {
  const globalOptions = {
    stubs: {
      'a-tooltip': {
        template: '<div><slot /></div>',
      },
    },
  }

  it('renders correctly with default inactive state', () => {
    const wrapper = mount(WebSearchToggle, {
      props: {
        enabled: false,
      },
      global: globalOptions,
    })

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('联网搜索')
    expect(button.classes()).not.toContain('active')
  })

  it('renders active class and indicator when enabled is true', () => {
    const wrapper = mount(WebSearchToggle, {
      props: {
        enabled: true,
      },
      global: globalOptions,
    })

    const button = wrapper.find('button')
    expect(button.classes()).toContain('active')
    expect(wrapper.find('.active-indicator').exists()).toBe(true)
  })

  it('emits update:enabled with inverted value on click', async () => {
    const wrapper = mount(WebSearchToggle, {
      props: {
        enabled: false,
      },
      global: globalOptions,
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:enabled')?.[0]).toEqual([true])
  })

  it('does not emit update:enabled when disabled', async () => {
    const wrapper = mount(WebSearchToggle, {
      props: {
        enabled: false,
        disabled: true,
      },
      global: globalOptions,
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:enabled')).toBeUndefined()
  })
})
