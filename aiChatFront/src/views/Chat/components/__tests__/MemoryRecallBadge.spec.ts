import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MemoryRecallBadge from '../MemoryRecallBadge.vue'
import type { MemoryRecallPayload } from '@/interface/memory'

describe('MemoryRecallBadge', () => {
  it('当无召回数据时安全不渲染', () => {
    const memoryRecall: MemoryRecallPayload = {
      profileRecalled: false,
      recalledCount: 0,
      items: [],
    }
    const wrapper = mount(MemoryRecallBadge, {
      props: { memoryRecall },
    })
    expect(wrapper.find('.memory-recall-badge').exists()).toBe(false)
  })

  it('正确展示核心画像与情境记忆召回摘要', async () => {
    const memoryRecall: MemoryRecallPayload = {
      profileRecalled: true,
      recalledCount: 1,
      coreSummary: '用户为主力全栈架构师，偏好 Vue3 / NestJS / PostgreSQL',
      items: [
        {
          id: 'mem_1',
          category: 'decision',
          summary: '采用 PostgreSQL 向量与轻量极速模型完成记忆蒸馏',
          similarity: 0.92,
        },
      ],
    }

    const wrapper = mount(MemoryRecallBadge, {
      props: { memoryRecall },
    })

    expect(wrapper.find('.memory-recall-badge').exists()).toBe(true)
    expect(wrapper.text()).toContain('MEM')
    expect(wrapper.text()).toContain('已激活 核心画像 + 1 条情境记忆')

    // 默认折叠，不渲染详情面板
    expect(wrapper.find('.recall-details-panel').exists()).toBe(false)

    // 点击展开
    await wrapper.find('.recall-summary-bar').trigger('click')
    expect(wrapper.find('.recall-details-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('CORE PROFILE')
    expect(wrapper.text()).toContain('用户为主力全栈架构师')
    expect(wrapper.text()).toContain('DECISION · 决策')
    expect(wrapper.text()).toContain('92%')
  })
})
