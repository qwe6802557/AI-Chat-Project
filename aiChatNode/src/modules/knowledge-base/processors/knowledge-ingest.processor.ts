import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, UnrecoverableError } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { EntityManager, Repository } from 'typeorm';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import {
  DocumentParseStage,
  DocumentParseStatus,
  KnowledgeDocument,
} from '../entities/knowledge-document.entity';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import {
  DocumentProgressEvent,
  KNOWLEDGE_INGEST_QUEUE,
  KnowledgeIngestJobData,
} from '../constants/knowledge-queue.constants';
import { DocumentParserService } from '../services/document-parser.service';
import { RecursiveChunkerService } from '../services/recursive-chunker.service';
import { EmbeddingService } from '../services/embedding.service';
import { KnowledgeProgressService } from '../services/knowledge-progress.service';
import { toPgVectorLiteral } from '../utils/pg-vector.util';

class DocumentDeletedError extends Error {
  constructor(documentId: string) {
    super(`文档 [${documentId}] 已被删除，终止解析`);
    this.name = 'DocumentDeletedError';
  }
}

/**
 * 知识库文档后台解析、分块与向量入库 Worker
 */
@Processor(KNOWLEDGE_INGEST_QUEUE, { concurrency: 2 })
export class KnowledgeIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeIngestProcessor.name);
  private static readonly INSERT_BATCH_SIZE = 50;

  constructor(
    @InjectRepository(KnowledgeBase)
    private readonly kbRepo: Repository<KnowledgeBase>,
    @InjectRepository(KnowledgeDocument)
    private readonly docRepo: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeChunk)
    private readonly chunkRepo: Repository<KnowledgeChunk>,
    private readonly parserService: DocumentParserService,
    private readonly chunkerService: RecursiveChunkerService,
    private readonly embeddingService: EmbeddingService,
    private readonly progressService: KnowledgeProgressService,
  ) {
    super();
  }

  async process(job: Job<KnowledgeIngestJobData>): Promise<void> {
    const { documentId, knowledgeBaseId, userId } = job.data;
    let docFilePath: string | null = null;

    try {
      const initialDoc = await this.docRepo.findOne({
        where: { id: documentId, userId },
      });
      if (!initialDoc) {
        return;
      }

      docFilePath = initialDoc.filePath;
      if (!docFilePath) {
        throw new UnrecoverableError('缺少待解析的原文件路径，请重新上传文档');
      }

      await this.assertAndReportProgress({
        documentId,
        knowledgeBaseId,
        userId,
        status: 'processing',
        stage: 'parsing',
        progress: 10,
      });

      const fileBuffer = await fs.readFile(docFilePath);
      const parsed = await this.parserService.parseBuffer(
        fileBuffer,
        initialDoc.fileName,
      );

      await this.assertAndReportProgress({
        documentId,
        knowledgeBaseId,
        userId,
        status: 'processing',
        stage: 'chunking',
        progress: 25,
      });

      const chunks = this.chunkerService.splitText(parsed.text);
      if (chunks.length === 0) {
        throw new UnrecoverableError('切片后未提取到有效文本片段');
      }

      const chunkTexts = chunks.map((c) => c.content);
      await this.assertAndReportProgress({
        documentId,
        knowledgeBaseId,
        userId,
        status: 'processing',
        stage: 'embedding',
        progress: 25,
        processedChunks: 0,
        totalChunks: chunkTexts.length,
      });

      const embeddings = await this.embeddingService.embedDocuments(
        chunkTexts,
        16,
        async (processed, total) => {
          const pct = Math.min(85, 25 + Math.round((processed / total) * 60));
          await this.assertAndReportProgress({
            documentId,
            knowledgeBaseId,
            userId,
            status: 'processing',
            stage: 'embedding',
            progress: pct,
            processedChunks: processed,
            totalChunks: total,
          });
        },
      );

      if (embeddings.length !== chunks.length) {
        throw new Error(
          `向量数量 (${embeddings.length}) 与切片数量 (${chunks.length}) 不一致`,
        );
      }

      await this.assertAndReportProgress({
        documentId,
        knowledgeBaseId,
        userId,
        status: 'processing',
        stage: 'saving',
        progress: 90,
        processedChunks: chunks.length,
        totalChunks: chunks.length,
      });

      const saved = await this.docRepo.manager.transaction(
        async (em: EntityManager) => {
          const currentDoc = await em.findOne(KnowledgeDocument, {
            where: { id: documentId, userId },
          });
          if (!currentDoc) {
            return false;
          }

          // 重试入库前清理可能残留的历史切片，保证写入幂等
          await em.query(
            'DELETE FROM "knowledge_chunks" WHERE "documentId" = $1',
            [documentId],
          );

          const metadata = {
            docTitle: currentDoc.title,
            fileName: currentDoc.fileName,
            fileType: currentDoc.fileType,
          };

          for (
            let offset = 0;
            offset < chunks.length;
            offset += KnowledgeIngestProcessor.INSERT_BATCH_SIZE
          ) {
            const batch = chunks.slice(
              offset,
              offset + KnowledgeIngestProcessor.INSERT_BATCH_SIZE,
            );
            await this.insertChunkBatch(em, {
              documentId,
              knowledgeBaseId,
              userId,
              metadata,
              chunks: batch,
              embeddings: embeddings.slice(
                offset,
                offset + KnowledgeIngestProcessor.INSERT_BATCH_SIZE,
              ),
            });
          }

          await em.update(KnowledgeDocument, documentId, {
            status: 'completed',
            stage: 'completed',
            progress: 100,
            chunkCount: chunks.length,
            charCount: parsed.charCount,
            errorMessage: null,
            filePath: null,
          });

          return true;
        },
      );

      if (!saved) {
        await this.removeTempFile(docFilePath);
        return;
      }

      await this.recalculateStats(knowledgeBaseId);
      await this.removeTempFile(docFilePath);

      await this.progressService.publish({
        type: 'completed',
        documentId,
        knowledgeBaseId,
        userId,
        status: 'completed',
        stage: 'completed',
        progress: 100,
        processedChunks: chunks.length,
        totalChunks: chunks.length,
        chunkCount: chunks.length,
        charCount: parsed.charCount,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof DocumentDeletedError) {
        await this.removeTempFile(docFilePath);
        return;
      }

      const reason = error instanceof Error ? error.message : String(error);
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalFailure =
        error instanceof UnrecoverableError ||
        job.attemptsMade + 1 >= maxAttempts;

      if (isFinalFailure) {
        this.logger.error(
          `文档 [${documentId}] 解析入库最终失败: ${reason}`,
          error instanceof Error ? error.stack : undefined,
        );
        const existing = await this.docRepo.findOne({
          where: { id: documentId, userId },
        });
        if (existing) {
          await this.docRepo.update(documentId, {
            status: 'failed',
            stage: 'failed',
            errorMessage: reason || '文档切片或向量化失败',
          });
          await this.progressService.publish({
            type: 'failed',
            documentId,
            knowledgeBaseId,
            userId,
            status: 'failed',
            stage: 'failed',
            progress: existing.progress ?? 0,
            errorMessage: reason || '文档切片或向量化失败',
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        this.logger.warn(
          `文档 [${documentId}] 第 ${job.attemptsMade + 1} 次解析失败，等待重试: ${reason}`,
        );
      }

      throw error;
    }
  }

  private async assertAndReportProgress(params: {
    documentId: string;
    knowledgeBaseId: string;
    userId: string;
    status: DocumentParseStatus;
    stage: DocumentParseStage;
    progress: number;
    processedChunks?: number;
    totalChunks?: number;
  }): Promise<void> {
    const result = await this.docRepo.update(
      { id: params.documentId, userId: params.userId },
      {
        status: params.status,
        stage: params.stage,
        progress: params.progress,
      },
    );
    if (!result.affected) {
      throw new DocumentDeletedError(params.documentId);
    }

    const event: DocumentProgressEvent = {
      type: 'progress',
      documentId: params.documentId,
      knowledgeBaseId: params.knowledgeBaseId,
      userId: params.userId,
      status: params.status,
      stage: params.stage,
      progress: params.progress,
      processedChunks: params.processedChunks,
      totalChunks: params.totalChunks,
      updatedAt: new Date().toISOString(),
    };
    await this.progressService.publish(event);
  }

  private async insertChunkBatch(
    em: EntityManager,
    params: {
      documentId: string;
      knowledgeBaseId: string;
      userId: string;
      metadata: Record<string, any>;
      chunks: Array<{ chunkIndex: number; content: string; charCount: number }>;
      embeddings: number[][];
    },
  ): Promise<void> {
    if (params.chunks.length === 0) return;

    const now = new Date();
    const metadataJson = JSON.stringify(params.metadata);
    const valuesSql: string[] = [];
    const sqlParams: unknown[] = [];

    params.chunks.forEach((chunk, idx) => {
      const base = sqlParams.length;
      const vectorLiteral = toPgVectorLiteral(params.embeddings[idx]);
      valuesSql.push(
        `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}::uuid, $${base + 4}::uuid, $${base + 5}::int, $${base + 6}::text, $${base + 7}::int, $${base + 8}::boolean, $${base + 9}::jsonb, $${base + 10}::vector(1024), $${base + 11}::timestamptz, $${base + 12}::timestamptz)`,
      );
      sqlParams.push(
        randomUUID(),
        params.documentId,
        params.knowledgeBaseId,
        params.userId,
        chunk.chunkIndex,
        chunk.content,
        chunk.charCount,
        true,
        metadataJson,
        vectorLiteral,
        now,
        now,
      );
    });

    await em.query(
      `
        INSERT INTO "knowledge_chunks" (
          "id", "documentId", "knowledgeBaseId", "userId",
          "chunkIndex", "content", "charCount", "isEnabled",
          "metadata", "embedding", "createdAt", "updatedAt"
        ) VALUES ${valuesSql.join(', ')}
      `,
      sqlParams,
    );
  }

  private async recalculateStats(kbId: string): Promise<void> {
    const docCount = await this.docRepo.count({
      where: { knowledgeBaseId: kbId, status: 'completed' },
    });
    const chunkCount = await this.chunkRepo.count({
      where: { knowledgeBaseId: kbId },
    });

    await this.kbRepo.update(kbId, {
      documentCount: docCount,
      chunkCount,
    });
  }

  private async removeTempFile(filePath: string | null): Promise<void> {
    if (!filePath) return;
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      const nodeErr = error as NodeJS.ErrnoException;
      if (nodeErr?.code !== 'ENOENT') {
        this.logger.warn(
          `清理临时文件失败 [${filePath}]: ${nodeErr?.message || String(error)}`,
        );
      }
    }
  }
}
