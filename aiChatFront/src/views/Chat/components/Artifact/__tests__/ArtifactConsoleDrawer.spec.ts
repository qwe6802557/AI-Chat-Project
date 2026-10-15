import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArtifactConsoleDrawer, { type ConsoleEntry } from '../ArtifactConsoleDrawer.vue'

describe('ArtifactConsoleDrawer', () => {
  const mockEntries: ConsoleEntry[] = [
    {
      id: '1',
      level: 'log',
      message: 'App initialized',
      time: 1700000000000,
    },
    {
      id: '2',
      level: 'warn',
      message: 'Deprecated API called',
      time: 1700000001000,
    },
    {
      id: '3',
      level: 'error',
      message: 'Uncaught TypeError: Cannot read properties of undefined',
      time: 1700000002000,
    },
  ]

  it('renders badge pills for errors, warnings, and logs', () => {
    const wrapper = mount(ArtifactConsoleDrawer, {
      props: {
        entries: mockEntries,
      },
    })

    expect(wrapper.text()).toContain('1 错误')
    expect(wrapper.text()).toContain('1 警告')
    expect(wrapper.text()).toContain('1 日志')
  })

  it('toggles expanded state and filters entries', async () => {
    const wrapper = mount(ArtifactConsoleDrawer, {
      props: {
        entries: mockEntries,
      },
    })

    // 默认收起
    expect(wrapper.find('.console-panel-body').exists()).toBe(false)

    // 点击状态条展开
    await wrapper.find('.console-status-bar').trigger('click')
    expect(wrapper.find('.console-panel-body').exists()).toBe(true)

    // 全部日志
    expect(wrapper.findAll('.log-row')).toHaveLength(3)

    // 筛选错误
    const errorBtn = wrapper.findAll('.filter-btn').find((b) => b.text().includes('错误'))
    await errorBtn?.trigger('click')
    expect(wrapper.findAll('.log-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('Cannot read properties of undefined')
  })

  it('emits clear event when clear button is clicked', async () => {
    const wrapper = mount(ArtifactConsoleDrawer, {
      props: {
        entries: mockEntries,
      },
    })

    const clearBtn = wrapper.find('.btn-clear')
    await clearBtn.trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })
})
