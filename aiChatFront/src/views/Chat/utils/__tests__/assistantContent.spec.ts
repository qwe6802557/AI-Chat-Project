import { describe, expect, it } from 'vitest'
import {
  extractVisibleAssistantContent,
  sanitizeVisibleAssistantContent,
} from '../assistantContent'

describe('sanitizeVisibleAssistantContent', () => {
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
        title: 'Think',
        content: '推理',
      },
      reasoningOpen: false,
    })
  })
})
