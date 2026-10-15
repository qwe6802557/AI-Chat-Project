import { describe, it, expect } from 'vitest'
import { renderMarkdown, canRenderSafely } from '../markdown'

describe('markdown.ts 引用角标与渲染解析', () => {
  it('正确将正文中的 [1] 转换为交互式 citation-ref-badge 按钮', () => {
    const md = '根据技术架构文档[1]，系统采用双路召回。'
    const html = renderMarkdown(md)
    expect(html).toContain('class="citation-ref-badge"')
    expect(html).toContain('data-citation="1"')
    expect(html).toContain('[1]')
  })

  it('支持逗号分隔的复合引用 [1, 2] 展开为两个独立角标', () => {
    const md = '综合权威报告[1, 2]以及最新数据[3]表明...'
    const html = renderMarkdown(md)
    expect(html).toContain('data-citation="1"')
    expect(html).toContain('data-citation="2"')
    expect(html).toContain('data-citation="3"')
  })

  it('支持全角中文括号【1】和全角逗号【1，2】解析', () => {
    const md = '大模型回答测试【1】以及组合切片【2，3】'
    const html = renderMarkdown(md)
    expect(html).toContain('data-citation="1"')
    expect(html).toContain('data-citation="2"')
    expect(html).toContain('data-citation="3"')
  })

  it('保护代码块和行内代码，不被错误解析为引用按钮', () => {
    const md = '这是一个代码示例：\n```python\narray = [1]\nprint(array[0])\n```\n行内代码 `nums[2]`'
    const html = renderMarkdown(md)
    expect(html).toContain('python')
    expect(html).toContain('nums[2]')
    // 代码块内部不应被替换为 citation-ref-badge
    expect(html).not.toMatch(/<code[^>]*>[\s\S]*class="citation-ref-badge"[\s\S]*<\/code>/)
    expect(html).not.toMatch(/<span[^>]*class="citation-ref-badge"/)
  })

  it('保护标准 markdown 链接 [1](https://example.com)', () => {
    const md = '访问 [1](https://example.com) 获取更多信息'
    const html = renderMarkdown(md)
    expect(html).toContain('<a href="https://example.com"')
  })

  it('canRenderSafely 正确判定完整性', () => {
    expect(canRenderSafely('正常段落文本')).toBe(true)
    expect(canRenderSafely('未闭合代码块 ```ts\nconst a = 1')).toBe(false)
    expect(canRenderSafely('已闭合代码块 ```ts\nconst a = 1\n```')).toBe(true)
  })
})
