/**
 * 从大模型原始文本中提取 JSON 对象（兼容 Markdown 代码块与前后解释文本）
 */
export function extractJsonFromLlmOutput<T extends Record<string, unknown>>(
  rawContent: string,
): T {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    throw new Error('模型输出为空，无法解析 JSON');
  }

  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('模型输出未包含有效的 JSON 对象边界');
  }

  const jsonSlice = candidate.slice(firstBrace, lastBrace + 1);
  const parsed: unknown = JSON.parse(jsonSlice);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('模型输出的 JSON 根节点必须是对象');
  }

  return parsed as T;
}
