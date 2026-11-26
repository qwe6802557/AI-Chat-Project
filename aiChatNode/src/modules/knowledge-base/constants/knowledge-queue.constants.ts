import path from 'node:path';
import type {
  DocumentParseStage,
  DocumentParseStatus,
} from '../entities/knowledge-document.entity';

export const KNOWLEDGE_INGEST_QUEUE = 'knowledge-ingest';
export const KNOWLEDGE_INGEST_JOB = 'ingest-document';

export interface KnowledgeIngestJobData {
  documentId: string;
  knowledgeBaseId: string;
  userId: string;
}

export interface DocumentProgressEvent {
  type: 'progress' | 'completed' | 'failed';
  documentId: string;
  knowledgeBaseId: string;
  userId: string;
  status: DocumentParseStatus;
  stage: DocumentParseStage;
  progress: number;
  processedChunks?: number;
  totalChunks?: number;
  chunkCount?: number;
  charCount?: number;
  errorMessage?: string | null;
  updatedAt: string;
}

/**
 * 解析知识库上传文件在本地/容器磁盘中的落盘根目录
 */
export function resolveKnowledgeUploadDir(): string {
  const configured = process.env.KNOWLEDGE_UPLOAD_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(process.cwd(), 'uploads', 'knowledge');
}
