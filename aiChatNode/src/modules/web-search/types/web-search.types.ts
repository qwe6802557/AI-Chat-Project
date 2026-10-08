/**
 * 联网检索来源定义
 */
export interface SearchSource {
  id: number;
  title: string;
  url: string;
  snippet: string;
  icon?: string;
  sitename?: string;
}

/**
 * 联网检索执行结果
 */
export interface WebSearchResult {
  query: string;
  sources: SearchSource[];
  contextPrompt: string;
}
