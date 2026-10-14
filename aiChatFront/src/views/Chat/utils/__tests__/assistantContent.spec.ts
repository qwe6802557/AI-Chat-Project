import { describe, expect, it } from 'vitest'
import {
  extractVisibleAssistantContent,
  sanitizeVisibleAssistantContent,
  extractArtifactTags,
} from '../assistantContent'

describe('assistantContent parser', () => {
  it('removes leading complete think block', () => {
    expect(
      sanitizeVisibleAssistantContent('<think>\n内部推理\n</think>\n最终答案'),
    ).toBe('最终答案')
  })

  it('hides content while leading think block is still open', () => {
    expect(
      sanitizeVisibleAssistantContent('<think>\n内部推理进行中'),
    ).toBe('')
  })

  it('extracts reasoning payload from legacy assistant content', () => {
    expect(
      extractVisibleAssistantContent('<think>\n推理\n</think>\n答案'),
    ).toEqual({
      answer: '答案',
      reasoning: {
        mode: 'raw',
        source: 'extracted_tag',
        title: '思考过程',
        content: '推理',
      },
      reasoningOpen: false,
      artifacts: undefined,
    })
  })

  it('extracts complete antArtifact tag and cleans visible answer', () => {
    const raw = '为您生成了如下代码：\n<antArtifact identifier="todo-app" type="text/html" title="待办清单应用">\n<div>Hello Todo</div>\n</antArtifact>\n请在右侧查看。'
    const result = extractVisibleAssistantContent(raw)

    expect(result.answer).toBe('为您生成了如下代码：\n\n请在右侧查看。')
    expect(result.artifacts).toHaveLength(1)
    expect(result.artifacts![0]).toEqual({
      identifier: 'todo-app',
      type: 'text/html',
      title: '待办清单应用',
      language: undefined,
      content: '<div>Hello Todo</div>',
      isComplete: true,
    })
  })

  it('handles streaming unclosed antArtifact tag cleanly', () => {
    const raw = '正在生成应用：\n<antArtifact identifier="chart-widget" type="image/svg+xml" title="折线图">\n<svg width="100">'
    const result = extractVisibleAssistantContent(raw)

    expect(result.answer).toBe('正在生成应用：')
    expect(result.artifacts).toHaveLength(1)
    expect(result.artifacts![0].identifier).toBe('chart-widget')
    expect(result.artifacts![0].isComplete).toBe(false)
    expect(result.artifacts![0].content).toBe('\n<svg width="100">')
  })

  it('handles multiple artifacts in single response', () => {
    const raw = '<antArtifact identifier="part1" type="text/html" title="网页 1"><h1>1</h1></antArtifact>\n中间文本\n<antArtifact identifier="part2" type="text/html" title="网页 2"><h1>2</h1></antArtifact>'
    const { cleanedText, artifacts } = extractArtifactTags(raw)

    expect(cleanedText).toBe('中间文本')
    expect(artifacts).toHaveLength(2)
    expect(artifacts[0].identifier).toBe('part1')
    expect(artifacts[1].identifier).toBe('part2')
  })
})
