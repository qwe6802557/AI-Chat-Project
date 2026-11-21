/**
 * 切片正文高亮匹配区间
 */
export interface HighlightSpan {
  start: number;
  end: number;
  term: string;
}

const CN_STOP_DELIMITER_REGEX =
  /(?:的|了|是|在|和|与|或|如何|什么|哪些|请问|一下|怎么|为什么|吗|呢|啊|能否|可以|关于|使用)+/g;

/**
 * 提取检索词元（英文标识符与中文短语/滑窗词缀，按长度降序去重）
 */
export function extractSearchTerms(query: string): string[] {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const tokens: string[] = [];
  const enTokens = cleanQuery.match(/[a-zA-Z0-9_\-.]{2,}/g) || [];
  tokens.push(...enTokens);

  const cnSegments = cleanQuery.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const seg of cnSegments) {
    const phrases = seg
      .split(CN_STOP_DELIMITER_REGEX)
      .map((p) => p.trim())
      .filter((p) => p.length >= 2);

    for (const phrase of phrases) {
      if (phrase.length <= 12) {
        tokens.push(phrase);
      }
      if (phrase.length > 2) {
        for (let i = 0; i < phrase.length - 1; i++) {
          tokens.push(phrase.slice(i, i + 2));
          if (i + 3 <= phrase.length) {
            tokens.push(phrase.slice(i, i + 3));
          }
        }
      }
    }
  }

  // 若中文全部被虚词拆散，降级对原始连续中文段执行 2~3 字滑窗
  if (tokens.length === enTokens.length) {
    const cnOnly = cleanQuery.replace(/[^\u4e00-\u9fa5]/g, '');
    for (let i = 0; i < cnOnly.length - 1; i++) {
      tokens.push(cnOnly.slice(i, i + 2));
      if (i + 3 <= cnOnly.length) {
        tokens.push(cnOnly.slice(i, i + 3));
      }
    }
  }

  const deduped = new Map<string, string>();
  for (const token of tokens) {
    if (token.length < 2) continue;
    const key = token.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, token);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.length - a.length)
    .slice(0, 40);
}

/**
 * 计算切片正文中的非重叠安全高亮区间（优先匹配长词并按 start 升序返回）
 */
export function computeHighlightSpans(
  content: string,
  terms: string[],
  maxSpans = 30,
): { highlights: HighlightSpan[]; matchedTerms: string[] } {
  if (!content || !terms || terms.length === 0) {
    return { highlights: [], matchedTerms: [] };
  }

  const lowerContent = content.toLowerCase();
  const sortedTerms = Array.from(
    new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2)),
  ).sort((a, b) => b.length - a.length);

  const candidates: HighlightSpan[] = [];
  for (const term of sortedTerms) {
    const lowerTerm = term.toLowerCase();
    let searchFrom = 0;
    while (searchFrom < lowerContent.length) {
      const idx = lowerContent.indexOf(lowerTerm, searchFrom);
      if (idx === -1) break;
      candidates.push({
        start: idx,
        end: idx + term.length,
        term: content.slice(idx, idx + term.length),
      });
      searchFrom = idx + term.length;
      if (candidates.length >= maxSpans * 4) break;
    }
  }

  if (candidates.length === 0) {
    return { highlights: [], matchedTerms: [] };
  }

  // 长词优先占坑，避免短切片词缀打断完整词高亮
  candidates.sort((a, b) => {
    const lenDiff = b.end - b.start - (a.end - a.start);
    return lenDiff !== 0 ? lenDiff : a.start - b.start;
  });

  const selected: HighlightSpan[] = [];
  for (const span of candidates) {
    const overlaps = selected.some(
      (kept) => span.start < kept.end && span.end > kept.start,
    );
    if (!overlaps) {
      selected.push(span);
      if (selected.length >= maxSpans) break;
    }
  }

  selected.sort((a, b) => a.start - b.start);

  const matchedSet = new Set<string>();
  const matchedTerms: string[] = [];
  for (const span of selected) {
    const key = span.term.toLowerCase();
    if (!matchedSet.has(key)) {
      matchedSet.add(key);
      matchedTerms.push(span.term);
    }
  }

  return { highlights: selected, matchedTerms };
}
