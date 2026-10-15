import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CitationPopover from '../CitationPopover.vue'

describe('CitationPopover', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  const mockKbSource = {
    id: 1,
    title: '知识库核心架构设计.pdf',
    url: '',
    snippet: '本系统基于 PostgreSQL pgvector 扩展实现高维密集向量检索与语义切片。',
    score: 0.952,
    isKnowledgeBase: true,
    documentId: 'doc-123',
    chunkIndex: 2,
  }

  const mockWebSource = {
    id: 2,
    title: 'Vue 3 官方文档 - 响应式原理解析',
    url: 'https://vuejs.org/guide/reactivity.html',
    snippet: 'Vue 的响应性系统是基于 JavaScript Proxy 实现的。',
    isKnowledgeBase: false,
    sitename: 'Vue.js',
  }

  const anchorRect = {
    top: 300,
    bottom: 320,
    left: 200,
    width: 20,
    height: 20,
  }

  it('展示知识库切片来源时渲染置信度与切片标签', () => {
    mount(CitationPopover, {
      props: {
        visible: true,
        source: mockKbSource,
        citationId: 1,
        anchorRect,
      },
      attachTo: document.body,
    })

    const bodyText = document.body.textContent || ''
    expect(bodyText).toContain('知识库切片')
    expect(bodyText).toContain('置信度 95%')
    expect(bodyText).toContain('知识库核心架构设计.pdf')
    expect(bodyText).toContain('PostgreSQL pgvector')
    expect(document.body.querySelector('.footer-action-btn.primary')?.textContent).toContain('查看切片详情')
  })

  it('点击查看切片详情触发 open-detail 事件', async () => {
    const wrapper = mount(CitationPopover, {
      props: {
        visible: true,
        source: mockKbSource,
        citationId: 1,
        anchorRect,
      },
      attachTo: document.body,
    })

    const btn = document.body.querySelector('.footer-action-btn.primary') as HTMLButtonElement
    expect(btn).not.toBeNull()
    btn.click()

    expect(wrapper.emitted('open-detail')?.[0]).toEqual([mockKbSource])
  })

  it('展示外部网页来源时渲染域名与外链跳转按钮', () => {
    mount(CitationPopover, {
      props: {
        visible: true,
        source: mockWebSource,
        citationId: 2,
        anchorRect,
      },
      attachTo: document.body,
    })

    const bodyText = document.body.textContent || ''
    expect(bodyText).toContain('外部检索来源')
    expect(bodyText).toContain('vuejs.org')
    expect(bodyText).toContain('Vue 3 官方文档')
    const link = document.body.querySelector('a.footer-action-btn.external') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://vuejs.org/guide/reactivity.html')
  })
})
