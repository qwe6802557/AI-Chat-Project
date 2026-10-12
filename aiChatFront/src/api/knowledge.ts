/**
 * 知识库管理与 RAG 检索 API
 */
import request, { type ResponseData } from '@/utils/request'
import type {
  KnowledgeBaseItem,
  KnowledgeDocumentItem,
  KnowledgeChunkItem,
  RagSearchResultItem,
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
} from '@/interface/knowledge'

export function getKnowledgeBases() {
  return request.get<never, ResponseData<KnowledgeBaseItem[]>>('/knowledge-bases')
}

export function getKnowledgeBaseDetail(id: string) {
  return request.get<never, ResponseData<KnowledgeBaseItem>>(`/knowledge-bases/${id}`)
}

export function createKnowledgeBase(data: CreateKnowledgeBaseDto) {
  return request.post<never, ResponseData<KnowledgeBaseItem>>('/knowledge-bases', data)
}

export function updateKnowledgeBase(id: string, data: UpdateKnowledgeBaseDto) {
  return request.put<never, ResponseData<KnowledgeBaseItem>>(`/knowledge-bases/${id}`, data)
}

export function deleteKnowledgeBase(id: string) {
  return request.delete<never, ResponseData<void>>(`/knowledge-bases/${id}`)
}

export function getKnowledgeDocuments(kbId: string) {
  return request.get<never, ResponseData<KnowledgeDocumentItem[]>>(`/knowledge-bases/${kbId}/documents`)
}

export function uploadKnowledgeDocument(kbId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<never, ResponseData<KnowledgeDocumentItem>>(
    `/knowledge-bases/${kbId}/documents`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
}

export function deleteKnowledgeDocument(docId: string) {
  return request.delete<never, ResponseData<void>>(`/knowledge-bases/documents/${docId}`)
}

export function getKnowledgeChunks(docId: string, page = 1, pageSize = 20) {
  return request.get<
    never,
    ResponseData<{
      items: KnowledgeChunkItem[]
      total: number
      page?: number
      pageSize?: number
    }>
  >(`/knowledge-bases/documents/${docId}/chunks`, {
    params: { page, pageSize },
  })
}

export function searchKnowledgeBase(data: {
  query: string
  knowledgeBaseIds?: string[]
  limit?: number
}) {
  return request.post<never, ResponseData<RagSearchResultItem[]>>('/knowledge-bases/search', data)
}
