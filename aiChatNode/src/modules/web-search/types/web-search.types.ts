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
  score?: number;
  isKnowledgeBase?: boolean;
  knowledgeBaseId?: string;
  documentId?: string;
  chunkId?: string;
  chunkIndex?: number;
  hitSource?: 'hybrid' | 'dense' | 'sparse';
  denseScore?: number;
  rerankScore?: number;
  matchedTerms?: string[];
  highlights?: Array<{ start: number; end: number; term: string }>;
  chunkType?: 'text' | 'visual';
  assetId?: string;
  assetType?: 'standalone_image' | 'pdf_page' | 'docx_image';
  visualType?:
    | 'chart'
    | 'table'
    | 'diagram'
    | 'screenshot'
    | 'document_page'
    | 'photo';
  pageNumber?: number;
  visualAssetUrl?: string;
  visualInjected?: boolean;
}

/**
 * 联网检索执行结果
 */
export interface WebSearchResult {
  query: string;
  sources: SearchSource[];
  contextPrompt: string;
}
