import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChunkHighlightText from '../ChunkHighlightText.vue'

describe('ChunkHighlightText', () => {
  it('按 highlights 区间准确切分高亮片段并保持纯文本拼接', () => {
    const content = 'PostgreSQL 向量检索与 BGE-Reranker 精排'
    const bgeStart = content.indexOf('BGE-Reranker')
    const wrapper = mount(ChunkHighlightText, {
      props: {
        content,
        highlights: [
          { start: 0, end: 10, term: 'PostgreSQL' },
          { start: bgeStart, end: bgeStart + 'BGE-Reranker'.length, term: 'BGE-Reranker' },
        ],
      },
    })

    const marks = wrapper.findAll('mark.chunk-highlight-mark')
    expect(marks).toHaveLength(2)
    expect(marks[0]?.text()).toBe('PostgreSQL')
    expect(marks[1]?.text()).toBe('BGE-Reranker')
    expect(wrapper.text()).toBe(content)
  })

  it('无 highlights 时回退到 keyword 高亮且对 HTML/XSS 字符纯文本转义', () => {
    const xssContent = '测试 <script>alert(1)</script> 关键词匹配'
    const wrapper = mount(ChunkHighlightText, {
      props: {
        content: xssContent,
        keyword: '<script>',
      },
    })

    expect(wrapper.find('script').exists()).toBe(false)
    const marks = wrapper.findAll('mark.chunk-highlight-mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]?.text()).toBe('<script>')
    expect(wrapper.text()).toBe(xssContent)
  })
})
