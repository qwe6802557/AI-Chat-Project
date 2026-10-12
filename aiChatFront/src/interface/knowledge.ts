/**
 * 知识库模块类型定义
 */

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

export interface KnowledgeDocumentItem {
  id: string
  knowledgeBaseId: string
  userId: string
  title: string
  fileType: 'pdf' | 'docx' | 'md' | 'txt'
  fileSize: number
  charCount: number
  chunkCount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface KnowledgeChunkItem {
  id: string
  documentId: string
  knowledgeBaseId: string
  chunkIndex: number
  content: string
  charCount: number
  createdAt: string
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
