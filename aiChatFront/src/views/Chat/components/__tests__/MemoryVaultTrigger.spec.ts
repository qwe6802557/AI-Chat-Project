import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MemoryVaultTrigger from '../MemoryVaultTrigger.vue'

describe('MemoryVaultTrigger', () => {
  const globalOptions = {
    stubs: {
      'a-tooltip': {
        props: ['title'],
        template: '<div class="a-tooltip-stub" :data-title="title"><slot /></div>',
      },
    },
  }

  it('正确渲染 Tooltip 提示与按钮文字标签', () => {
    const wrapper = mount(MemoryVaultTrigger, {
      global: globalOptions,
    })

    expect(wrapper.find('.a-tooltip-stub').attributes('data-title')).toBe(
      '打开记忆工坊 (查看长期核心画像与情境记忆)',
    )
    expect(wrapper.find('.vault-label').text()).toBe('记忆工坊')
    expect(wrapper.find('button.memory-vault-trigger').attributes('aria-label')).toBe('打开记忆工坊')
  })

  it('点击按钮应触发 open 事件', async () => {
    const wrapper = mount(MemoryVaultTrigger, {
      global: globalOptions,
    })

    await wrapper.find('button.memory-vault-trigger').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('禁用状态下点击不触发 open 事件', async () => {
    const wrapper = mount(MemoryVaultTrigger, {
      props: {
        disabled: true,
      },
      global: globalOptions,
    })

    await wrapper.find('button.memory-vault-trigger').trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
  })
})
