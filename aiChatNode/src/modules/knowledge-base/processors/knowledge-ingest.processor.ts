import { Logger, Optional } from '@nestjs/common';
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
import { KnowledgeAssetType } from '../entities/knowledge-asset.entity';
import {
  DocumentProgressEvent,
  KNOWLEDGE_INGEST_QUEUE,
  KnowledgeIngestJobData,
} from '../constants/knowledge-queue.constants';
import { DocumentParserService } from '../services/document-parser.service';
import { RecursiveChunkerService } from '../services/recursive-chunker.service';
import { EmbeddingService } from '../services/embedding.service';
import { KnowledgeProgressService } from '../services/knowledge-progress.service';
import {
  KnowledgeAssetService,
  WrittenAssetFileResult,
} from '../services/knowledge-asset.service';
import { KnowledgeVisionService } from '../services/knowledge-vision.service';
import { PdfVisualRouterService } from '../services/pdf-visual-router.service';
import { toPgVectorLiteral } from '../utils/pg-vector.util';

class DocumentDeletedError extends Error {
  constructor(documentId: string) {
    super(`文档 [${documentId}] 已被删除，终止解析`);
    this.name = 'DocumentDeletedError';
  }
}

interface PendingVisualTask {
  assetType: KnowledgeAssetType;
  pageNumber?: number;
  pageTextHint?: string;
  writtenAsset: WrittenAssetFileResult;
}

interface PreparedChunkRecord {
  chunkIndex: number;
  content: string;
  charCount: number;
  metadata: Record<string, any>;
}

/**
 * 知识库文档与多模态图像后台解析、分块与向量入库 Worker
 */
@Processor(KNOWLEDGE_INGEST_QUEUE, { concurrency: 2 })
export class KnowledgeIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeIngestProcessor.name);
  private static readonly INSERT_BATCH_SIZE = 50;
  private static readonly VISION_CONCURRENCY = 2;

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
    @Optional()
    private readonly assetService?: KnowledgeAssetService,
    @Optional()
    private readonly visionService?: KnowledgeVisionService,
    @Optional()
    private readonly pdfVisualRouter?: PdfVisualRouterService,
  ) {
    super();
  }

  async process(job: Job<KnowledgeIngestJobData>): Promise<void> {
    const { documentId, knowledgeBaseId, userId } = job.data;
    let docFilePath: string | null = null;
    const createdStoragePaths: string[] = [];

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
      const docKind = DocumentParserService.resolveDocumentKind(
        initialDoc.fileName,
      );

      const baseMetadata = {
        docTitle: initialDoc.title,
        fileName: initialDoc.fileName,
        fileType: initialDoc.fileType,
      };

      const preparedAssets: Array<{
        id: string;
        knowledgeBaseId: string;
        documentId: string;
        userId: string;
        assetType: KnowledgeAssetType;
        pageNumber: number | null;
        storagePath: string;
        mimeType: string;
        width: number;
        height: number;
        sizeBytes: number;
      }> = [];
      const preparedChunks: PreparedChunkRecord[] = [];
      let totalCharCount = 0;

      if (docKind === 'image') {
        const assetService = this.requireAssetService();
        const visionService = this.requireVisionService();
        const writtenAsset = await assetService.writeNormalizedAssetFile({
          userId,
          documentId,
          buffer: fileBuffer,
        });
        createdStoragePaths.push(writtenAsset.storagePath);

        await this.assertAndReportProgress({
          documentId,
          knowledgeBaseId,
          userId,
          status: 'processing',
          stage: 'vision_extracting',
          progress: 15,
          processedVisuals: 0,
          totalVisuals: 1,
        });

        const extraction = await visionService.extractVisualContent({
          imageBuffer: writtenAsset.buffer,
          mimeType: writtenAsset.mimeType,
          fileName: initialDoc.fileName,
        });

        await this.assertAndReportProgress({
          documentId,
          knowledgeBaseId,
          userId,
          status: 'processing',
          stage: 'vision_extracting',
          progress: 45,
          processedVisuals: 1,
          totalVisuals: 1,
        });

        preparedAssets.push({
          id: writtenAsset.assetId,
          knowledgeBaseId,
          documentId,
          userId,
          assetType: 'standalone_image',
          pageNumber: null,
          storagePath: writtenAsset.storagePath,
          mimeType: writtenAsset.mimeType,
          width: writtenAsset.width,
          height: writtenAsset.height,
          sizeBytes: writtenAsset.sizeBytes,
        });

        await this.assertAndReportProgress({
          documentId,
          knowledgeBaseId,
          userId,
          status: 'processing',
          stage: 'chunking',
          progress: 50,
        });

        this.appendVisualChunks(preparedChunks, {
          searchableText: extraction.searchableText,
          baseMetadata,
          assetId: writtenAsset.assetId,
          assetType: 'standalone_image',
          visualType: extraction.visualType,
          caption: extraction.title,
          width: writtenAsset.width,
          height: writtenAsset.height,
        });
        totalCharCount = extraction.searchableText.length;
      } else if (docKind === 'pdf' && this.pdfVisualRouter) {
        const routeResult = await this.pdfVisualRouter.inspectAndRenderPages(
          fileBuffer,
        );
        const visualTasks: PendingVisualTask[] = [];
        const pageResults = new Map<
          number,
          { text: string; visualText?: string; task?: PendingVisualTask }
        >();

        for (const page of routeResult.pages) {
          let task: PendingVisualTask | undefined;
          if (page.renderedPngBuffer) {
            const assetService = this.requireAssetService();
            const writtenAsset = await assetService.writeNormalizedAssetFile({
              userId,
              documentId,
              buffer: page.renderedPngBuffer,
            });
            createdStoragePaths.push(writtenAsset.storagePath);
            task = {
              assetType: 'pdf_page',
              pageNumber: page.pageNumber,
              pageTextHint: page.text,
              writtenAsset,
            };
            visualTasks.push(task);
          }
          pageResults.set(page.pageNumber, {
            text: page.text,
            task,
          });
        }

        const visualExtractionMap = new Map<
          number,
          {
            searchableText: string;
            visualType: string;
            title: string;
          }
        >();

        if (visualTasks.length > 0) {
          const visionService = this.requireVisionService();
          const totalVisuals = visualTasks.length;
          let completedVisuals = 0;

          await this.assertAndReportProgress({
            documentId,
            knowledgeBaseId,
            userId,
            status: 'processing',
            stage: 'vision_extracting',
            progress: 15,
            processedVisuals: 0,
            totalVisuals,
          });

          await this.runWithConcurrency(
            visualTasks,
            KnowledgeIngestProcessor.VISION_CONCURRENCY,
            async (task) => {
              const extraction = await visionService.extractVisualContent({
                imageBuffer: task.writtenAsset.buffer,
                mimeType: task.writtenAsset.mimeType,
                fileName: initialDoc.fileName,
                pageNumber: task.pageNumber,
                pageTextHint: task.pageTextHint,
              });

              preparedAssets.push({
                id: task.writtenAsset.assetId,
                knowledgeBaseId,
                documentId,
                userId,
                assetType: task.assetType,
                pageNumber: task.pageNumber ?? null,
                storagePath: task.writtenAsset.storagePath,
                mimeType: task.writtenAsset.mimeType,
                width: task.writtenAsset.width,
                height: task.writtenAsset.height,
                sizeBytes: task.writtenAsset.sizeBytes,
              });

              if (task.pageNumber !== undefined) {
                visualExtractionMap.set(task.pageNumber, {
                  searchableText: extraction.searchableText,
                  visualType: extraction.visualType,
                  title: extraction.title,
                });
              }

              completedVisuals += 1;
              const pct = Math.min(
                45,
                15 + Math.round((completedVisuals / totalVisuals) * 30),
              );
              await this.assertAndReportProgress({
                documentId,
                knowledgeBaseId,
                userId,
                status: 'processing',
                stage: 'vision_extracting',
                progress: pct,
                processedVisuals: completedVisuals,
                totalVisuals,
              });
            },
          );
        }

        await this.assertAndReportProgress({
          documentId,
          knowledgeBaseId,
          userId,
          status: 'processing',
          stage: 'chunking',
          progress: 50,
        });

        for (const page of routeResult.pages) {
          const visualMeta = visualExtractionMap.get(page.pageNumber);
          const pageEntry = pageResults.get(page.pageNumber);
          const hasRichText = page.text.trim().length >= 80;

          if (!visualMeta || hasRichText) {
            const textChunks = this.chunkerService.splitText(page.text);
            for (const tc of textChunks) {
              preparedChunks.push({
                chunkIndex: preparedChunks.length,
                content: tc.content,
                charCount: tc.charCount,
                metadata: {
                  ...baseMetadata,
                  chunkType: 'text',
                  pageNumber: page.pageNumber,
                },
              });
              totalCharCount += tc.charCount;
            }
          }

          if (visualMeta && pageEntry?.task) {
            this.appendVisualChunks(preparedChunks, {
              searchableText: visualMeta.searchableText,
              baseMetadata,
              assetId: pageEntry.task.writtenAsset.assetId,
              assetType: 'pdf_page',
              visualType: visualMeta.visualType,
              pageNumber: page.pageNumber,
              caption: visualMeta.title,
              width: pageEntry.task.writtenAsset.width,
              height: pageEntry.task.writtenAsset.height,
            });
            totalCharCount += visualMeta.searchableText.length;
          }
        }
      } else {
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
          progress: 50,
        });

        const textChunks = this.chunkerService.splitText(parsed.text);
        for (const tc of textChunks) {
          preparedChunks.push({
            chunkIndex: preparedChunks.length,
            content: tc.content,
            charCount: tc.charCount,
            metadata: {
              ...baseMetadata,
              chunkType: 'text',
            },
          });
        }
        totalCharCount = parsed.charCount;
      }

      if (preparedChunks.length === 0) {
        throw new UnrecoverableError('切片后未提取到有效文本或视觉内容');
      }

      const chunkTexts = preparedChunks.map((c) => c.content);
      await this.assertAndReportProgress({
        documentId,
        knowledgeBaseId,
        userId,
        status: 'processing',
        stage: 'embedding',
        progress: 50,
        processedChunks: 0,
        totalChunks: chunkTexts.length,
      });

      const embeddings = await this.embeddingService.embedDocuments(
        chunkTexts,
        16,
        async (processed, total) => {
          const pct = Math.min(85, 50 + Math.round((processed / total) * 35));
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

      if (embeddings.length !== preparedChunks.length) {
        throw new Error(
          `向量数量 (${embeddings.length}) 与切片数量 (${preparedChunks.length}) 不一致`,
        );
      }

      await this.assertAndReportProgress({
        documentId,
        knowledgeBaseId,
        userId,
        status: 'processing',
        stage: 'saving',
        progress: 90,
        processedChunks: preparedChunks.length,
        totalChunks: preparedChunks.length,
      });

      const oldAssetPaths: string[] = [];
      const saved = await this.docRepo.manager.transaction(
        async (em: EntityManager) => {
          const currentDoc = await em.findOne(KnowledgeDocument, {
            where: { id: documentId, userId },
          });
          if (!currentDoc) {
            return false;
          }

          if (this.assetService) {
            const existingAssets: Array<{ storagePath?: string }> =
              await em.query(
                'SELECT "storagePath" FROM "knowledge_assets" WHERE "documentId" = $1',
                [documentId],
              );
            for (const row of existingAssets || []) {
              if (row?.storagePath) {
                oldAssetPaths.push(row.storagePath);
              }
            }
          }

          // 重试入库前清理可能残留的历史切片与旧视觉资产记录，保证写入幂等
          await em.query(
            'DELETE FROM "knowledge_chunks" WHERE "documentId" = $1',
            [documentId],
          );
          if (this.assetService) {
            await em.query(
              'DELETE FROM "knowledge_assets" WHERE "documentId" = $1',
              [documentId],
            );
          }

          if (preparedAssets.length > 0) {
            await this.insertAssetBatch(em, preparedAssets);
          }

          for (
            let offset = 0;
            offset < preparedChunks.length;
            offset += KnowledgeIngestProcessor.INSERT_BATCH_SIZE
          ) {
            const batch = preparedChunks.slice(
              offset,
              offset + KnowledgeIngestProcessor.INSERT_BATCH_SIZE,
            );
            await this.insertChunkBatch(em, {
              documentId,
              knowledgeBaseId,
              userId,
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
            chunkCount: preparedChunks.length,
            charCount: totalCharCount,
            errorMessage: null,
            filePath: null,
          });

          return true;
        },
      );

      if (!saved) {
        await this.removeTempFile(docFilePath);
        await this.assetService?.removeAssetFiles(createdStoragePaths);
        return;
      }

      if (oldAssetPaths.length > 0) {
        await this.assetService?.removeAssetFiles(oldAssetPaths);
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
        processedChunks: preparedChunks.length,
        totalChunks: preparedChunks.length,
        chunkCount: preparedChunks.length,
        charCount: totalCharCount,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (createdStoragePaths.length > 0) {
        await this.assetService?.removeAssetFiles(createdStoragePaths);
      }

      if (error instanceof DocumentDeletedError) {
        await this.removeTempFile(docFilePath);
        await this.assetService?.cleanupDocumentAssetFiles(userId, documentId);
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

  private requireAssetService(): KnowledgeAssetService {
    if (!this.assetService) {
      throw new UnrecoverableError('视觉资产存储服务未初始化');
    }
    return this.assetService;
  }

  private requireVisionService(): KnowledgeVisionService {
    if (!this.visionService) {
      throw new UnrecoverableError('视觉解析模型服务未初始化');
    }
    return this.visionService;
  }

  private appendVisualChunks(
    target: PreparedChunkRecord[],
    params: {
      searchableText: string;
      baseMetadata: Record<string, any>;
      assetId: string;
      assetType: KnowledgeAssetType;
      visualType: string;
      pageNumber?: number;
      caption?: string;
      width: number;
      height: number;
    },
  ): void {
    const pieces =
      params.searchableText.length > 1200
        ? this.chunkerService.splitText(params.searchableText, {
            chunkSize: 800,
            overlap: 120,
          })
        : [
            {
              chunkIndex: 0,
              content: params.searchableText,
              charCount: params.searchableText.length,
            },
          ];

    for (const piece of pieces) {
      target.push({
        chunkIndex: target.length,
        content: piece.content,
        charCount: piece.charCount,
        metadata: {
          ...params.baseMetadata,
          chunkType: 'visual',
          assetId: params.assetId,
          assetType: params.assetType,
          visualType: params.visualType,
          ...(params.pageNumber !== undefined
            ? { pageNumber: params.pageNumber }
            : {}),
          ...(params.caption ? { caption: params.caption } : {}),
          width: params.width,
          height: params.height,
        },
      });
    }
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
  ): Promise<void> {
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      async () => {
        while (cursor < items.length) {
          const currentIndex = cursor;
          cursor += 1;
          await worker(items[currentIndex], currentIndex);
        }
      },
    );
    await Promise.all(workers);
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
    processedVisuals?: number;
    totalVisuals?: number;
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
      processedVisuals: params.processedVisuals,
      totalVisuals: params.totalVisuals,
      updatedAt: new Date().toISOString(),
    };
    await this.progressService.publish(event);
  }

  private async insertAssetBatch(
    em: EntityManager,
    assets: Array<{
      id: string;
      knowledgeBaseId: string;
      documentId: string;
      userId: string;
      assetType: KnowledgeAssetType;
      pageNumber: number | null;
      storagePath: string;
      mimeType: string;
      width: number;
      height: number;
      sizeBytes: number;
    }>,
  ): Promise<void> {
    if (assets.length === 0) return;

    const now = new Date();
    const valuesSql: string[] = [];
    const sqlParams: unknown[] = [];

    for (const asset of assets) {
      const base = sqlParams.length;
      valuesSql.push(
        `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}::uuid, $${base + 4}::uuid, $${base + 5}::varchar, $${base + 6}::int, $${base + 7}::varchar, $${base + 8}::varchar, $${base + 9}::int, $${base + 10}::int, $${base + 11}::int, $${base + 12}::timestamptz)`,
      );
      sqlParams.push(
        asset.id,
        asset.knowledgeBaseId,
        asset.documentId,
        asset.userId,
        asset.assetType,
        asset.pageNumber,
        asset.storagePath,
        asset.mimeType,
        asset.width,
        asset.height,
        asset.sizeBytes,
        now,
      );
    }

    await em.query(
      `
        INSERT INTO "knowledge_assets" (
          "id", "knowledgeBaseId", "documentId", "userId",
          "assetType", "pageNumber", "storagePath", "mimeType",
          "width", "height", "sizeBytes", "createdAt"
        ) VALUES ${valuesSql.join(', ')}
      `,
      sqlParams,
    );
  }

  private async insertChunkBatch(
    em: EntityManager,
    params: {
      documentId: string;
      knowledgeBaseId: string;
      userId: string;
      chunks: PreparedChunkRecord[];
      embeddings: number[][];
    },
  ): Promise<void> {
    if (params.chunks.length === 0) return;

    const now = new Date();
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
        JSON.stringify(chunk.metadata),
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
