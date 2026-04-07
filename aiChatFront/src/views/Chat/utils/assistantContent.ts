import type { MessageReasoning } from '@/interface/conversation'

const THINK_OPEN_TAG_PATTERN = /<think\b[^>]*>/i
const THINK_CLOSE_TAG = '</think>'

export interface ExtractedAssistantContent {
  answer: string
  reasoning?: MessageReasoning
  reasoningOpen: boolean
}

/**
 * 从旧格式 assistant 文本中拆出前置 think 推理块与最终答案。
 * 用于兼容历史消息，以及 provider 尚未完全结构化时的兜底处理。
 */
export const extractVisibleAssistantContent = (content: string): ExtractedAssistantContent => {
  const rawContent = content || ''
  const leadingWhitespaceLength = rawContent.match(/^\s*/)?.[0]?.length || 0
  const trimmedContent = rawContent.slice(leadingWhitespaceLength)
  const openTagMatch = trimmedContent.match(THINK_OPEN_TAG_PATTERN)

  if (!openTagMatch || openTagMatch.index !== 0) {
    return {
      answer: rawContent,
      reasoningOpen: false,
    }
  }

  const openTagLength = openTagMatch[0].length
  const reasoningStart = leadingWhitespaceLength + openTagLength
  const lowerCaseContent = rawContent.toLowerCase()
  const closeTagIndex = lowerCaseContent.indexOf(THINK_CLOSE_TAG, reasoningStart)

  if (closeTagIndex === -1) {
    return {
      answer: '',
      reasoning: {
        mode: 'raw',
        source: 'extracted_tag',
        title: '思考过程',
        content: rawContent.slice(reasoningStart).trim(),
      },
      reasoningOpen: true,
    }
  }

  return {
    answer: rawContent.slice(closeTagIndex + THINK_CLOSE_TAG.length).replace(/^\s+/, ''),
    reasoning: {
      mode: 'raw',
      source: 'extracted_tag',
      title: '思考过程',
      content: rawContent.slice(reasoningStart, closeTagIndex).trim(),
    },
    reasoningOpen: false,
  }
}

export const sanitizeVisibleAssistantContent = (content: string): string => {
  return extractVisibleAssistantContent(content).answer
}
