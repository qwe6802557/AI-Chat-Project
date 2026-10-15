import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import KnowledgeBaseCapsule from '../KnowledgeBaseCapsule.vue'
import { useKnowledgeStore } from '@/stores'

describe('KnowledgeBaseCapsule', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认状态渲染正常，展示胶囊按钮', () => {
    const wrapper = mount(KnowledgeBaseCapsule, {
      props: {
        selectedIds: [],
        disabled: false,
      },
      global: {
        stubs: {
          'a-popover': {
            template: '<div class="a-popover-stub"><slot /><slot name="content" /></div>',
          },
          'router-link': {
            template: '<a class="router-link-stub"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.find('.kb-capsule-btn').exists()).toBe(true)
    expect(wrapper.find('.capsule-label').text()).toBe('知识库')
  })

  it('选中知识库时高亮展示计数角标', () => {
    const wrapper = mount(KnowledgeBaseCapsule, {
      props: {
        selectedIds: ['kb-1', 'kb-2'],
      },
      global: {
        stubs: {
          'a-popover': {
            template: '<div class="a-popover-stub"><slot /><slot name="content" /></div>',
          },
          'router-link': {
            template: '<a class="router-link-stub"><slot /></a>',
          },
        },
      },
    })

    const btn = wrapper.find('.kb-capsule-btn')
    expect(btn.classes()).toContain('active')
    expect(wrapper.find('.capsule-label').text()).toBe('知识库 (2)')
    expect(wrapper.find('.active-dot').exists()).toBe(true)
  })

  it('有缓存数据时立即渲染知识库列表，无 loading 抖动', async () => {
    const store = useKnowledgeStore()
    store.knowledgeBases = [
      {
        id: 'kb-test-1',
        name: 'AI研报知识库',
        documentCount: 3,
        chunkCount: 120,
        isActive: true,
      } as any,
    ]

    const wrapper = mount(KnowledgeBaseCapsule, {
      props: {
        selectedIds: [],
      },
      global: {
        stubs: {
          'a-popover': {
            template: '<div class="a-popover-stub"><slot /><slot name="content" /></div>',
          },
          'router-link': {
            template: '<a class="router-link-stub"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.find('.dropdown-loading').exists()).toBe(false)
    expect(wrapper.find('.kb-options-list').exists()).toBe(true)
    expect(wrapper.find('.kb-option-name').text()).toBe('AI研报知识库')
    expect(wrapper.find('.kb-option-stats').text()).toContain('3 文档 · 120 切片')

    // 点击切换选中
    await wrapper.find('.kb-option-item').trigger('click')
    expect(wrapper.emitted('update:selectedIds')?.[0]).toEqual([['kb-test-1']])
  })
})
