import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownMessage from '../MarkdownMessage.vue'

describe('MarkdownMessage 交互引用角标', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  const mockSources = [
    {
      id: 1,
      title: '高维向量召回规范.md',
      url: '',
      snippet: '系统采用 BGE-M3 与 BM25 混合检索。',
      score: 0.94,
      isKnowledgeBase: true,
      documentId: 'doc-001',
      chunkIndex: 0,
    },
    {
      id: 2,
      title: 'PostgreSQL 官方手册',
      url: 'https://postgresql.org/docs',
      snippet: 'PostgreSQL is a powerful, open source object-relational database.',
      isKnowledgeBase: false,
    },
  ]

  it('渲染正文中的引用角标按钮', () => {
    const wrapper = mount(MarkdownMessage, {
      props: {
        messageId: 'msg-1',
        content: '根据参考文档[1]以及外部资料[2]，系统稳定运行。',
        sources: mockSources,
      },
    })

    const badges = wrapper.findAll('.citation-ref-badge')
    expect(badges.length).toBe(2)
    expect(badges[0].text()).toBe('[1]')
    expect(badges[0].attributes('data-citation')).toBe('1')
    expect(badges[1].text()).toBe('[2]')
    expect(badges[1].attributes('data-citation')).toBe('2')
  })

  it('点击知识库角标触发 open-source 事件', async () => {
    const wrapper = mount(MarkdownMessage, {
      props: {
        messageId: 'msg-1',
        content: '根据核心切片[1]分析...',
        sources: mockSources,
      },
    })

    const badge = wrapper.find('.citation-ref-badge')
    expect(badge.exists()).toBe(true)
    await badge.trigger('click')

    expect(wrapper.emitted('open-source')?.[0]).toEqual([mockSources[0]])
  })

  it('点击外部网页角标在新窗口打开 URL', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const wrapper = mount(MarkdownMessage, {
      props: {
        messageId: 'msg-1',
        content: '参考官方文档[2]',
        sources: mockSources,
      },
    })

    const badge = wrapper.find('.citation-ref-badge')
    expect(badge.exists()).toBe(true)
    await badge.trigger('click')

    expect(openSpy).toHaveBeenCalledWith('https://postgresql.org/docs', '_blank', 'noopener,noreferrer')
    openSpy.mockRestore()
  })

  it('悬浮引用角标时显示切片浮窗卡片', async () => {
    const wrapper = mount(MarkdownMessage, {
      props: {
        messageId: 'msg-1',
        content: '查看技术切片[1]',
        sources: mockSources,
      },
      attachTo: document.body,
    })

    const badge = wrapper.find('.citation-ref-badge')
    // 模拟 getBoundingClientRect
    vi.spyOn(badge.element, 'getBoundingClientRect').mockReturnValue({
      top: 150,
      bottom: 170,
      left: 100,
      right: 120,
      width: 20,
      height: 20,
      x: 100,
      y: 150,
      toJSON: () => {},
    })

    await badge.trigger('mouseover')

    // Teleport 到 body
    const popoverCard = document.body.querySelector('.popover-content-card')
    expect(popoverCard).not.toBeNull()
    expect(document.body.textContent).toContain('高维向量召回规范.md')
    expect(document.body.textContent).toContain('BGE-M3 与 BM25')
  })
})
