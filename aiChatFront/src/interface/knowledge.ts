/**
 * 知识库模块类型定义
 */

export interface HighlightSpan {
  start: number
  end: number
  term: string
}

export type RetrievalMode = 'hybrid' | 'dense' | 'sparse'

export type RagHitSource = 'hybrid' | 'dense' | 'sparse'

export interface KnowledgeBaseItem {
  id: string
  userId: string
  name: string
  description?: string
  avatar?: string
  documentCount: number
  chunkCount: number
  isActive?: boolean
  status?: 'active' | 'disabled'
  createdAt: string
  updatedAt: string
}

export type DocumentParseStage =
  | 'queued'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'saving'
  | 'completed'
  | 'failed'

export interface KnowledgeDocumentItem {
  id: string
  knowledgeBaseId: string
  userId: string
  title: string
  fileName?: string
  fileType: 'pdf' | 'docx' | 'md' | 'txt'
  fileSize: number
  charCount: number
  chunkCount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  stage?: DocumentParseStage
  progress?: number
  processedChunks?: number
  totalChunks?: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface DocumentProgressSnapshotItem {
  documentId: string
  knowledgeBaseId: string
  status: KnowledgeDocumentItem['status']
  stage: DocumentParseStage
  progress: number
  chunkCount?: number
  charCount?: number
  errorMessage?: string | null
  updatedAt: string
}

export type DocumentProgressStreamEvent =
  | {
      type: 'snapshot'
      knowledgeBaseId: string
      documents: DocumentProgressSnapshotItem[]
    }
  | {
      type: 'progress' | 'completed' | 'failed'
      documentId: string
      knowledgeBaseId: string
      userId: string
      status: KnowledgeDocumentItem['status']
      stage: DocumentParseStage
      progress: number
      processedChunks?: number
      totalChunks?: number
      chunkCount?: number
      charCount?: number
      errorMessage?: string | null
      updatedAt: string
    }
  | {
      type: 'error'
      message: string
    }

export interface KnowledgeChunkItem {
  id: string
  documentId: string
  knowledgeBaseId: string
  chunkIndex: number
  content: string
  charCount: number
  isEnabled?: boolean
  metadata?: Record<string, any> | null
  createdAt: string
  updatedAt?: string
}

export interface RagSearchResultItem {
  chunkId: string
  documentId: string
  knowledgeBaseId: string
  documentTitle: string
  content: string
  chunkIndex: number
  score: number
  charCount: number
  hitSource?: RagHitSource
  denseScore?: number
  denseRank?: number
  sparseRank?: number
  rerankScore?: number
  rerankApplied?: boolean
  matchedTerms?: string[]
  highlights?: HighlightSpan[]
  metadata?: Record<string, any>
}

export interface SearchKnowledgeBaseParams {
  query: string
  knowledgeBaseIds?: string[]
  documentIds?: string[]
  limit?: number
  mode?: RetrievalMode
  minScore?: number
  enableRerank?: boolean
}

export interface ChunkContextResponse {
  document: {
    id: string
    knowledgeBaseId: string
    title: string
    fileName: string
    fileType: string
    chunkCount: number
    charCount: number
  }
  targetChunk: KnowledgeChunkItem
  prevChunks: KnowledgeChunkItem[]
  nextChunks: KnowledgeChunkItem[]
  window: number
}

export interface CreateKnowledgeBaseDto {
  name: string
  description?: string
  avatar?: string
}

export interface UpdateKnowledgeBaseDto {
  name?: string
  description?: string
  avatar?: string
  status?: 'active' | 'disabled'
}
