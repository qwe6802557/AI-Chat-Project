import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Between, In, Repository } from 'typeorm';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import {
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
  UpdateKnowledgeChunkDto,
} from '../dto';
import { DocumentParserService } from './document-parser.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeProgressService } from './knowledge-progress.service';
import {
  KNOWLEDGE_INGEST_JOB,
  KNOWLEDGE_INGEST_QUEUE,
  KnowledgeIngestJobData,
  resolveKnowledgeUploadDir,
} from '../constants/knowledge-queue.constants';
import { toPgVectorLiteral } from '../utils/pg-vector.util';

export interface KnowledgeChunkSummary {
  id: string;
  knowledgeBaseId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  charCount: number;
  isEnabled: boolean;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkContextResponse {
  document: {
    id: string;
    knowledgeBaseId: string;
    title: string;
    fileName: string;
    fileType: string;
    chunkCount: number;
    charCount: number;
  };
  targetChunk: KnowledgeChunkSummary;
  prevChunks: KnowledgeChunkSummary[];
  nextChunks: KnowledgeChunkSummary[];
  window: number;
}

/**
 * 知识库综合业务管理服务
 */
@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    @InjectRepository(KnowledgeBase)
    private readonly kbRepo: Repository<KnowledgeBase>,
    @InjectRepository(KnowledgeDocument)
    private readonly docRepo: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeChunk)
    private readonly chunkRepo: Repository<KnowledgeChunk>,
    private readonly embeddingService: EmbeddingService,
    private readonly progressService: KnowledgeProgressService,
    @InjectQueue(KNOWLEDGE_INGEST_QUEUE)
    private readonly ingestQueue: Queue<KnowledgeIngestJobData>,
  ) {}

  /**
   * 构造切片摘要视图（KnowledgeChunk 已隔离向量列，仅保持契约映射）
   */
  private toChunkSummary(chunk: KnowledgeChunk): KnowledgeChunkSummary {
    return {
      id: chunk.id,
      knowledgeBaseId: chunk.knowledgeBaseId,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      charCount: chunk.charCount,
      isEnabled: chunk.isEnabled !== false,
      metadata: chunk.metadata || null,
      createdAt: chunk.createdAt,
      updatedAt: chunk.updatedAt,
    };
  }

  /**
   * 创建新知识库
   */
  async createKnowledgeBase(
    userId: string,
    dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBase> {
    const kb = this.kbRepo.create({
      userId,
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      avatar: dto.avatar || null,
      documentCount: 0,
      chunkCount: 0,
      isActive: true,
    });
    return this.kbRepo.save(kb);
  }

  /**
   * 获取用户所有知识库列表
   */
  async getKnowledgeBases(userId: string): Promise<KnowledgeBase[]> {
    return this.kbRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取单个知识库详情
   */
  async getKnowledgeBaseById(
    userId: string,
    id: string,
  ): Promise<KnowledgeBase> {
    const kb = await this.kbRepo.findOne({ where: { id, userId } });
    if (!kb) {
      throw new NotFoundException('知识库不存在或无权访问');
    }
    return kb;
  }

  /**
   * 更新知识库信息
   */
  async updateKnowledgeBase(
    userId: string,
    id: string,
    dto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBase> {
    const kb = await this.getKnowledgeBaseById(userId, id);
    if (dto.name !== undefined) kb.name = dto.name.trim();
    if (dto.description !== undefined) kb.description = dto.description.trim();
    if (dto.avatar !== undefined) kb.avatar = dto.avatar;
    return this.kbRepo.save(kb);
  }

  /**
   * 删除知识库（同步清理队列任务与磁盘原文件，再级联删除数据库记录）
   */
  async deleteKnowledgeBase(userId: string, id: string): Promise<void> {
    const kb = await this.getKnowledgeBaseById(userId, id);
    const docs = await this.docRepo.find({
      where: { knowledgeBaseId: kb.id, userId },
      select: ['id', 'filePath'],
    });
    await Promise.all(
      docs.map((doc) => this.cleanupDocumentArtifacts(doc.id, doc.filePath)),
    );
    await this.kbRepo.remove(kb);
  }

  /**
   * 上传文件落盘并投递 BullMQ 异步解析队列
   */
  async uploadAndProcessDocument(
    userId: string,
    knowledgeBaseId: string,
    file: Express.Multer.File,
  ): Promise<KnowledgeDocument> {
    const kb = await this.getKnowledgeBaseById(userId, knowledgeBaseId);

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const dotIndex = originalName.lastIndexOf('.');
    const ext = dotIndex >= 0 ? originalName.slice(dotIndex).toLowerCase() : '';
    if (!DocumentParserService.isSupportedFile(originalName, file.mimetype)) {
      throw new BadRequestException(
        `暂不支持的文件格式: ${ext || '未知'}，仅支持 .pdf, .docx, .md, .txt 等格式`,
      );
    }

    const docId = randomUUID();
    const targetPath = path.join(
      resolveKnowledgeUploadDir(),
      userId,
      `${docId}${ext}`,
    );
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.buffer);

    try {
      const doc = this.docRepo.create({
        id: docId,
        knowledgeBaseId: kb.id,
        userId,
        title: originalName.replace(/\.[^/.]+$/, ''),
        fileName: originalName,
        fileType: ext.replace('.', ''),
        fileSize: file.size,
        filePath: targetPath,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        errorMessage: null,
        chunkCount: 0,
        charCount: 0,
      });
      const savedDoc = await this.docRepo.save(doc);

      await this.enqueueIngestJob({
        documentId: savedDoc.id,
        knowledgeBaseId: kb.id,
        userId,
      });

      await this.progressService.publish({
        type: 'progress',
        documentId: savedDoc.id,
        knowledgeBaseId: kb.id,
        userId,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        updatedAt: new Date().toISOString(),
      });

      return savedDoc;
    } catch (err) {
      await this.removeTempFile(targetPath);
      throw err;
    }
  }

  /**
   * 失败文档一键重新入队解析
   */
  async retryDocument(
    userId: string,
    documentId: string,
  ): Promise<KnowledgeDocument> {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, userId },
    });
    if (!doc) {
      throw new NotFoundException('文档不存在或无权访问');
    }
    if (doc.status !== 'failed') {
      throw new BadRequestException('仅支持对解析失败的文档执行重试');
    }
    if (!doc.filePath) {
      throw new BadRequestException('原文件已清理，请重新上传文档');
    }

    try {
      await fs.access(doc.filePath);
    } catch {
      throw new BadRequestException('磁盘原文件不存在，请重新上传文档');
    }

    await this.removeQueueJob(doc.id);

    doc.status = 'pending';
    doc.stage = 'queued';
    doc.progress = 0;
    doc.errorMessage = null;
    const savedDoc = await this.docRepo.save(doc);

    await this.enqueueIngestJob({
      documentId: savedDoc.id,
      knowledgeBaseId: savedDoc.knowledgeBaseId,
      userId,
    });

    await this.progressService.publish({
      type: 'progress',
      documentId: savedDoc.id,
      knowledgeBaseId: savedDoc.knowledgeBaseId,
      userId,
      status: 'pending',
      stage: 'queued',
      progress: 0,
      updatedAt: new Date().toISOString(),
    });

    return savedDoc;
  }

  /**
   * 获取知识库当前排队或处理中的文档快照，消除 SSE 建连前状态竞态
   */
  async getActiveDocumentsSnapshot(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<KnowledgeDocument[]> {
    return this.docRepo.find({
      where: {
        knowledgeBaseId,
        userId,
        status: In(['pending', 'processing']),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取指定知识库的文档列表
   */
  async getDocuments(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<KnowledgeDocument[]> {
    await this.getKnowledgeBaseById(userId, knowledgeBaseId);
    return this.docRepo.find({
      where: { knowledgeBaseId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 删除文档（清除排队任务与临时原文件，再级联删除切片）
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, userId },
    });
    if (!doc) {
      throw new NotFoundException('文档不存在或无权访问');
    }
    const kbId = doc.knowledgeBaseId;
    await this.cleanupDocumentArtifacts(doc.id, doc.filePath);
    await this.docRepo.remove(doc);
    await this.recalculateStats(kbId);
  }

  /**
   * 获取文档的分页切片列表（支持关键词与启停状态筛选，剔除高维向量）
   */
  async getChunks(
    userId: string,
    documentId: string,
    page = 1,
    pageSize = 20,
    options?: { keyword?: string; enabledOnly?: boolean },
  ): Promise<{
    items: KnowledgeChunkSummary[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, userId },
    });
    if (!doc) {
      throw new NotFoundException('文档不存在或无权访问');
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));

    const qb = this.chunkRepo
      .createQueryBuilder('chunk')
      .where('chunk.documentId = :documentId', { documentId })
      .andWhere('chunk.userId = :userId', { userId });

    const keyword = options?.keyword?.trim();
    if (keyword) {
      qb.andWhere('chunk.content ILIKE :keyword', {
        keyword: `%${keyword}%`,
      });
    }

    if (options?.enabledOnly === true) {
      qb.andWhere('chunk.isEnabled = :isEnabled', { isEnabled: true });
    }

    const [items, total] = await qb
      .orderBy('chunk.chunkIndex', 'ASC')
      .skip((safePage - 1) * safePageSize)
      .take(safePageSize)
      .getManyAndCount();

    return {
      items: items.map((c) => this.toChunkSummary(c)),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /**
   * 获取命中切片及其前后邻接窗口上下文
   */
  async getChunkContext(
    userId: string,
    chunkId: string,
    window = 1,
  ): Promise<ChunkContextResponse> {
    const target = await this.chunkRepo.findOne({
      where: { id: chunkId, userId },
      relations: ['document'],
    });
    if (!target || !target.document) {
      throw new NotFoundException('切片不存在或无权访问');
    }

    const clampedWindow = Math.min(5, Math.max(1, Math.floor(window || 1)));
    const minIndex = Math.max(0, target.chunkIndex - clampedWindow);
    const maxIndex = target.chunkIndex + clampedWindow;

    const neighbors = await this.chunkRepo.find({
      where: {
        documentId: target.documentId,
        userId,
        chunkIndex: Between(minIndex, maxIndex),
      },
      order: { chunkIndex: 'ASC' },
    });

    const prevChunks = neighbors
      .filter((c) => c.chunkIndex < target.chunkIndex)
      .map((c) => this.toChunkSummary(c));
    const nextChunks = neighbors
      .filter((c) => c.chunkIndex > target.chunkIndex)
      .map((c) => this.toChunkSummary(c));

    return {
      document: {
        id: target.document.id,
        knowledgeBaseId: target.document.knowledgeBaseId,
        title: target.document.title,
        fileName: target.document.fileName,
        fileType: target.document.fileType,
        chunkCount: target.document.chunkCount,
        charCount: target.document.charCount,
      },
      targetChunk: this.toChunkSummary(target),
      prevChunks,
      nextChunks,
      window: clampedWindow,
    };
  }

  /**
   * 更新单条切片正文（自动重算向量）或启停状态
   */
  async updateChunk(
    userId: string,
    chunkId: string,
    dto: UpdateKnowledgeChunkDto,
  ): Promise<KnowledgeChunkSummary> {
    const chunk = await this.chunkRepo.findOne({
      where: { id: chunkId, userId },
    });
    if (!chunk) {
      throw new NotFoundException('切片不存在或无权访问');
    }

    let newVector: number[] | null = null;
    if (dto.content !== undefined) {
      const trimmed = dto.content.trim();
      if (!trimmed) {
        throw new BadRequestException('切片正文不能为空');
      }
      if (trimmed !== chunk.content) {
        chunk.content = trimmed;
        chunk.charCount = trimmed.length;
        newVector = await this.embeddingService.embedQuery(trimmed);
      }
    }

    if (dto.isEnabled !== undefined) {
      chunk.isEnabled = dto.isEnabled;
    }

    const saved = await this.chunkRepo.save(chunk);

    if (newVector) {
      await this.chunkRepo.manager.query(
        'UPDATE "knowledge_chunks" SET "embedding" = $1::vector(1024) WHERE "id" = $2 AND "userId" = $3',
        [toPgVectorLiteral(newVector), chunk.id, userId],
      );
      const docChunks = await this.chunkRepo.find({
        where: { documentId: chunk.documentId, userId },
        select: ['id', 'charCount'],
      });
      const totalChars = docChunks.reduce((acc, item) => acc + item.charCount, 0);
      await this.docRepo.update(chunk.documentId, { charCount: totalChars });
    }

    return this.toChunkSummary(saved);
  }

  /**
   * 重新统计并更新知识库的文档数与切片数
   */
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

  private async enqueueIngestJob(data: KnowledgeIngestJobData): Promise<void> {
    await this.ingestQueue.add(KNOWLEDGE_INGEST_JOB, data, {
      jobId: data.documentId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }

  private async cleanupDocumentArtifacts(
    documentId: string,
    filePath: string | null,
  ): Promise<void> {
    await this.removeQueueJob(documentId);
    await this.removeTempFile(filePath);
  }

  private async removeQueueJob(documentId: string): Promise<void> {
    try {
      const existingJob = await this.ingestQueue.getJob(documentId);
      if (existingJob) {
        await existingJob.remove();
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`移除队列任务失败 [${documentId}]: ${msg}`);
    }
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
