import type { MessageReasoning } from '@/interface/conversation'

const THINK_OPEN_TAG_PATTERN = /<think\b[^>]*>/i
const THINK_CLOSE_TAG = '</think>'

const ARTIFACT_OPEN_TAG_PATTERN = /<antArtifact\b([^>]*)>/i
const ARTIFACT_CLOSE_TAG_PATTERN = /<\/antArtifact>/i

export interface ExtractedArtifactTag {
  identifier: string
  type: string
  title: string
  language?: string
  content: string
  isComplete: boolean
}

export interface ExtractedAssistantContent {
  answer: string
  reasoning?: MessageReasoning
  reasoningOpen: boolean
  artifacts?: ExtractedArtifactTag[]
}

/**
 * 解析标签属性键值对（支持双引号或单引号）
 */
function parseTagAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null

  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1]
    const value = match[2] !== undefined ? match[2] : match[3]
    if (key) {
      attrs[key] = value || ''
    }
  }

  return attrs
}

/**
 * 递归解析文本中的全部 <antArtifact> 标签
 */
export function extractArtifactTags(text: string): { cleanedText: string; artifacts: ExtractedArtifactTag[] } {
  const artifacts: ExtractedArtifactTag[] = []
  let remaining = text || ''
  let cleaned = ''

  while (remaining) {
    const match = remaining.match(ARTIFACT_OPEN_TAG_PATTERN)
    if (!match || match.index === undefined) {
      cleaned += remaining
      break
    }

    // 将标签前面的文本添加到 cleaned 中
    cleaned += remaining.slice(0, match.index)

    const rawAttrs = match[1] || ''
    const attrs = parseTagAttributes(rawAttrs)
    const contentStartIndex = match.index + match[0].length

    const contentSegment = remaining.slice(contentStartIndex)
    const closeMatch = contentSegment.match(ARTIFACT_CLOSE_TAG_PATTERN)

    if (!closeMatch || closeMatch.index === undefined) {
      // 未闭合的标签（通常处于流式生成中）
      artifacts.push({
        identifier: attrs.identifier || 'artifact-' + (artifacts.length + 1),
        type: attrs.type || 'application/vnd.ant.code',
        title: attrs.title || '代码生成产物',
        language: attrs.language,
        content: contentSegment,
        isComplete: false,
      })
      remaining = ''
      break
    }

    // 已闭合的完整标签
    const artifactContent = contentSegment.slice(0, closeMatch.index)
    artifacts.push({
      identifier: attrs.identifier || 'artifact-' + (artifacts.length + 1),
      type: attrs.type || 'application/vnd.ant.code',
      title: attrs.title || '代码生成产物',
      language: attrs.language,
      content: artifactContent.trim(),
      isComplete: true,
    })

    const tagEndOffset = contentStartIndex + closeMatch.index + closeMatch[0].length
    remaining = remaining.slice(tagEndOffset)
  }

  return {
    cleanedText: cleaned.trim(),
    artifacts,
  }
}

/**
 * 从旧格式或流式 assistant 文本中拆出前置 think 推理块、最终答案及 <antArtifact> 产物。
 */
export const extractVisibleAssistantContent = (content: string): ExtractedAssistantContent => {
  const rawContent = content || ''
  const leadingWhitespaceLength = rawContent.match(/^\s*/)?.[0]?.length || 0
  const trimmedContent = rawContent.slice(leadingWhitespaceLength)
  const openTagMatch = trimmedContent.match(THINK_OPEN_TAG_PATTERN)

  let rawAnswer = rawContent
  let reasoning: MessageReasoning | undefined
  let reasoningOpen = false

  if (openTagMatch && openTagMatch.index === 0) {
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

    reasoning = {
      mode: 'raw',
      source: 'extracted_tag',
      title: '思考过程',
      content: rawContent.slice(reasoningStart, closeTagIndex).trim(),
    }
    rawAnswer = rawContent.slice(closeTagIndex + THINK_CLOSE_TAG.length).replace(/^\s+/, '')
  }

  // 提取 Artifacts 产物
  const { cleanedText, artifacts } = extractArtifactTags(rawAnswer)

  return {
    answer: cleanedText,
    reasoning,
    reasoningOpen,
    artifacts: artifacts.length > 0 ? artifacts : undefined,
  }
}

export const sanitizeVisibleAssistantContent = (content: string): string => {
  return extractVisibleAssistantContent(content).answer
}
