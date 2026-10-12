import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import { CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto } from '../dto';
import { DocumentParserService } from './document-parser.service';
import { RecursiveChunkerService } from './recursive-chunker.service';
import { EmbeddingService } from './embedding.service';

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
   * 获取文档的切片列表
   */
  async getChunks(
    userId: string,
    documentId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ items: KnowledgeChunk[]; total: number }> {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, userId },
    });
    if (!doc) {
      throw new NotFoundException('文档不存在或无权访问');
    }

    const [items, total] = await this.chunkRepo.findAndCount({
      where: { documentId, userId },
      order: { chunkIndex: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
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
