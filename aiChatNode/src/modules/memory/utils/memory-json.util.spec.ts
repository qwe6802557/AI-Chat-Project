import { extractJsonFromLlmOutput } from './memory-json.util';

describe('extractJsonFromLlmOutput', () => {
  it('直接解析标准 JSON 字符串', () => {
    const parsed = extractJsonFromLlmOutput<{ items: unknown[] }>(
      '{"items":[{"category":"fact","content":"项目使用 PostgreSQL 15"}]}',
    );
    expect(parsed.items).toHaveLength(1);
  });

  it('剥离 Markdown ```json 代码块与前后解释文本并解析', () => {
    const raw = `好的，以下是提取结果：
\`\`\`json
{
  "preferences": { "style": "concise" },
  "facts": { "db": "pgvector" },
  "rawSummary": "偏好极简代码"
}
\`\`\`
希望这对您有帮助。`;
    const parsed = extractJsonFromLlmOutput<{
      preferences: Record<string, string>;
      rawSummary: string;
    }>(raw);

    expect(parsed.preferences.style).toBe('concise');
    expect(parsed.rawSummary).toBe('偏好极简代码');
  });

  it('无效输出或数组根节点时应明确抛错', () => {
    expect(() => extractJsonFromLlmOutput('')).toThrow();
    expect(() => extractJsonFromLlmOutput('[1, 2, 3]')).toThrow();
    expect(() => extractJsonFromLlmOutput('没有 JSON 内容')).toThrow();
  });
});
