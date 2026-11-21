import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import {
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
  UpdateKnowledgeChunkDto,
} from '../dto';
import { DocumentParserService } from './document-parser.service';
import { RecursiveChunkerService } from './recursive-chunker.service';
import { EmbeddingService } from './embedding.service';

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
    private readonly parserService: DocumentParserService,
    private readonly chunkerService: RecursiveChunkerService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * 剔除高维 embedding 向量字段，减少切片响应负载
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
   * 删除知识库（级联删除全部文档与切片）
   */
  async deleteKnowledgeBase(userId: string, id: string): Promise<void> {
    const kb = await this.getKnowledgeBaseById(userId, id);
    await this.kbRepo.remove(kb);
  }

  /**
   * 上传并异步解析文档、切片与向量入库
   */
  async uploadAndProcessDocument(
    userId: string,
    knowledgeBaseId: string,
    file: Express.Multer.File,
  ): Promise<KnowledgeDocument> {
    const kb = await this.getKnowledgeBaseById(userId, knowledgeBaseId);

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();

    // 1. 初始化文档记录为 processing 状态
    const doc = this.docRepo.create({
      knowledgeBaseId: kb.id,
      userId,
      title: originalName.replace(/\.[^/.]+$/, ''),
      fileName: originalName,
      fileType: ext.replace('.', ''),
      fileSize: file.size,
      filePath: null,
      status: 'processing',
      errorMessage: null,
      chunkCount: 0,
      charCount: 0,
    });
    const savedDoc = await this.docRepo.save(doc);

    // 2. 执行文本提取与切片向量化（同步完成以确保入库即时可查）
    try {
      const parsed = await this.parserService.parseBuffer(
        file.buffer,
        originalName,
        file.mimetype,
      );

      const chunks = this.chunkerService.splitText(parsed.text);
      if (chunks.length === 0) {
        throw new BadRequestException('切片后未提取到有效文本片段');
      }

      // 批量计算 Embedding
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await this.embeddingService.embedDocuments(chunkTexts);

      // 构建切片实体批量入库
      const chunkEntities = chunks.map((c, idx) =>
        this.chunkRepo.create({
          knowledgeBaseId: kb.id,
          documentId: savedDoc.id,
          userId,
          chunkIndex: c.chunkIndex,
          content: c.content,
          charCount: c.charCount,
          isEnabled: true,
          embedding: embeddings[idx] || null,
          metadata: {
            docTitle: savedDoc.title,
            fileName: savedDoc.fileName,
            fileType: savedDoc.fileType,
          },
        }),
      );

      await this.chunkRepo.save(chunkEntities);

      // 更新文档为已完成
      savedDoc.status = 'completed';
      savedDoc.chunkCount = chunks.length;
      savedDoc.charCount = parsed.charCount;
      await this.docRepo.save(savedDoc);

      // 更新知识库统计指标
      await this.recalculateStats(kb.id);

      return savedDoc;
    } catch (err: any) {
      this.logger.error(`文档 [${savedDoc.fileName}] 处理失败: ${err.message}`, err.stack);
      savedDoc.status = 'failed';
      savedDoc.errorMessage = err.message || '文档切片或向量化失败';
      await this.docRepo.save(savedDoc);
      throw err;
    }
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
   * 删除文档（级联清除其切片）
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, userId },
    });
    if (!doc) {
      throw new NotFoundException('文档不存在或无权访问');
    }
    const kbId = doc.knowledgeBaseId;
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

    let contentChanged = false;
    if (dto.content !== undefined) {
      const trimmed = dto.content.trim();
      if (!trimmed) {
        throw new BadRequestException('切片正文不能为空');
      }
      if (trimmed !== chunk.content) {
        chunk.content = trimmed;
        chunk.charCount = trimmed.length;
        chunk.embedding = await this.embeddingService.embedQuery(trimmed);
        contentChanged = true;
      }
    }

    if (dto.isEnabled !== undefined) {
      chunk.isEnabled = dto.isEnabled;
    }

    const saved = await this.chunkRepo.save(chunk);

    if (contentChanged) {
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
}
