export type AssistantReasoningMode = 'summary' | 'raw' | 'omitted';
export type AssistantReasoningSource =
  | 'provider_summary'
  | 'provider_block'
  | 'extracted_tag'
  | 'none';

export interface ExtractedAssistantReasoning {
  mode: AssistantReasoningMode;
  source: AssistantReasoningSource;
  title?: string;
  content: string;
}

export interface ExtractedAssistantContent {
  answer: string;
  reasoning: ExtractedAssistantReasoning | null;
  reasoningOpen: boolean;
}

const THINK_OPEN_TAG_PATTERN = /<think\b[^>]*>/i;
const THINK_CLOSE_TAG = '</think>';

const trimReasoningContent = (content: string): string => {
  return content.trim();
};

/**
 * 从模型原始文本中拆出最终答案与前置 think 推理块。
 * 当前只处理“前置 think 块 + 正式答案”的主路径，兼容旧历史消息与内联推理模型。
 */
export const extractAssistantContent = (
  content: string,
): ExtractedAssistantContent => {
  const rawContent = content || '';
  const leadingWhitespaceLength = rawContent.match(/^\s*/)?.[0]?.length || 0;
  const trimmedContent = rawContent.slice(leadingWhitespaceLength);
  const openTagMatch = trimmedContent.match(THINK_OPEN_TAG_PATTERN);

  if (!openTagMatch || openTagMatch.index !== 0) {
    return {
      answer: rawContent,
      reasoning: null,
      reasoningOpen: false,
    };
  }

  const openTagLength = openTagMatch[0].length;
  const reasoningStart = leadingWhitespaceLength + openTagLength;
  const lowerCaseContent = rawContent.toLowerCase();
  const closeTagIndex = lowerCaseContent.indexOf(
    THINK_CLOSE_TAG,
    reasoningStart,
  );

  if (closeTagIndex === -1) {
    return {
      answer: '',
      reasoning: {
        mode: 'raw',
        source: 'extracted_tag',
        title: 'Think',
        content: trimReasoningContent(rawContent.slice(reasoningStart)),
      },
      reasoningOpen: true,
    };
  }

  const reasoningContent = rawContent.slice(reasoningStart, closeTagIndex);
  const answer = rawContent
    .slice(closeTagIndex + THINK_CLOSE_TAG.length)
    .replace(/^\s+/, '');

  return {
    answer,
    reasoning: {
      mode: 'raw',
      source: 'extracted_tag',
      title: 'Think',
      content: trimReasoningContent(reasoningContent),
    },
    reasoningOpen: false,
  };
};

/**
 * 仅保留最终展示给用户的答案文本。
 */
export const sanitizeAssistantContent = (content: string): string => {
  return extractAssistantContent(content).answer;
};
