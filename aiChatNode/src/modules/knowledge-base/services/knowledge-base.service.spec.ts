import { BadRequestException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KnowledgeBaseService } from './knowledge-base.service';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let mockKbRepo: any;
  let mockDocRepo: any;
  let mockChunkRepo: any;
  let mockEmbeddingService: any;
  let mockProgressService: any;
  let mockIngestQueue: any;
  let tempUploadDir: string;

  beforeEach(async () => {
    tempUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kb-service-test-'));
    process.env.KNOWLEDGE_UPLOAD_DIR = tempUploadDir;

    mockKbRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    mockDocRepo = {
      create: jest.fn((data: any) => data),
      save: jest.fn(async (data: any) => data),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    mockChunkRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      manager: {
        query: jest.fn().mockResolvedValue(undefined),
      },
    };
    mockEmbeddingService = {
      embedQuery: jest.fn(),
    };
    mockProgressService = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    mockIngestQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn().mockResolvedValue(null),
    };

    service = new KnowledgeBaseService(
      mockKbRepo,
      mockDocRepo,
      mockChunkRepo,
      mockEmbeddingService,
      mockProgressService,
      mockIngestQueue,
    );
  });

  afterEach(async () => {
    delete process.env.KNOWLEDGE_UPLOAD_DIR;
    await fs.rm(tempUploadDir, { recursive: true, force: true });
  });

  it('uploadAndProcessDocument 应落盘原文件并投递异步队列后即时返回', async () => {
    mockKbRepo.findOne.mockResolvedValue({ id: 'kb-1', userId: 'u1' });

    const doc = await service.uploadAndProcessDocument('u1', 'kb-1', {
      originalname: 'guide.md',
      mimetype: 'text/markdown',
      size: 18,
      buffer: Buffer.from('# RAG Guide\nhello'),
    } as any);

    expect(doc.status).toBe('pending');
    expect(doc.stage).toBe('queued');
    expect(doc.progress).toBe(0);
    expect(doc.filePath).toBeTruthy();
    await expect(fs.access(doc.filePath!)).resolves.toBeUndefined();
    expect(mockIngestQueue.add).toHaveBeenCalledWith(
      'ingest-document',
      { documentId: doc.id, knowledgeBaseId: 'kb-1', userId: 'u1' },
      expect.objectContaining({ jobId: doc.id, attempts: 3 }),
    );
    expect(mockProgressService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'progress',
        documentId: doc.id,
        stage: 'queued',
        progress: 0,
      }),
    );

    mockKbRepo.findOne.mockResolvedValue({ id: 'kb-1', userId: 'u1' });

    const imgDoc = await service.uploadAndProcessDocument('u1', 'kb-1', {
      originalname: 'arch.png',
      mimetype: 'image/png',
      size: 64,
      buffer: Buffer.from('fake-png'),
    } as any);
    expect(imgDoc.fileType).toBe('png');
    expect(imgDoc.stage).toBe('queued');

    await expect(
      service.uploadAndProcessDocument('u1', 'kb-1', {
        originalname: 'archive.zip',
        mimetype: 'application/zip',
        size: 10,
        buffer: Buffer.from('zip'),
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('retryDocument 应对失败且原文件存在的文档重新入队，删档时清理队列与原文件', async () => {
    const failedFilePath = path.join(tempUploadDir, 'u1', 'doc-fail.txt');
    await fs.mkdir(path.dirname(failedFilePath), { recursive: true });
    await fs.writeFile(failedFilePath, 'retry content');

    const mockJob = { remove: jest.fn().mockResolvedValue(undefined) };
    mockIngestQueue.getJob.mockResolvedValue(mockJob);

    mockDocRepo.findOne.mockResolvedValue({
      id: 'doc-fail',
      knowledgeBaseId: 'kb-1',
      userId: 'u1',
      status: 'failed',
      stage: 'failed',
      progress: 30,
      errorMessage: '429 Too Many Requests',
      filePath: failedFilePath,
    });

    const retried = await service.retryDocument('u1', 'doc-fail');
    expect(mockJob.remove).toHaveBeenCalledTimes(1);
    expect(retried.status).toBe('pending');
    expect(retried.stage).toBe('queued');
    expect(retried.progress).toBe(0);
    expect(retried.errorMessage).toBeNull();
    expect(mockIngestQueue.add).toHaveBeenCalledTimes(1);

    await service.deleteDocument('u1', 'doc-fail');
    expect(mockDocRepo.remove).toHaveBeenCalled();
    await expect(fs.access(failedFilePath)).rejects.toThrow();
  });

  it('getChunks 应支持关键词过滤且不包含 embedding 字段', async () => {
    mockDocRepo.findOne.mockResolvedValue({ id: 'doc-1', userId: 'u1' });

    const qbMock: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'c1',
            knowledgeBaseId: 'kb-1',
            documentId: 'doc-1',
            chunkIndex: 0,
            content: 'BGE-M3 向量检索配置说明',
            charCount: 15,
            isEnabled: true,
            metadata: { docTitle: '手册' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        1,
      ]),
    };
    mockChunkRepo.createQueryBuilder.mockReturnValue(qbMock);

    const res = await service.getChunks('u1', 'doc-1', 1, 20, {
      keyword: 'BGE-M3',
      enabledOnly: true,
    });

    expect(qbMock.andWhere).toHaveBeenCalledWith('chunk.content ILIKE :keyword', {
      keyword: '%BGE-M3%',
    });
    expect(qbMock.andWhere).toHaveBeenCalledWith('chunk.isEnabled = :isEnabled', {
      isEnabled: true,
    });
    expect(res.total).toBe(1);
    expect(res.items[0]).not.toHaveProperty('embedding');
    expect(res.items[0].isEnabled).toBe(true);
  });

  it('getChunkContext 应返回前后邻接切片并限定窗口范围', async () => {
    const target = {
      id: 'c2',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      userId: 'u1',
      chunkIndex: 2,
      content: '目标命中切片',
      charCount: 6,
      isEnabled: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      document: {
        id: 'doc-1',
        knowledgeBaseId: 'kb-1',
        title: '架构手册',
        fileName: 'arch.md',
        fileType: 'md',
        chunkCount: 5,
        charCount: 100,
      },
    };
    mockChunkRepo.findOne.mockResolvedValue(target);
    mockChunkRepo.find.mockResolvedValue([
      { ...target, id: 'c1', chunkIndex: 1, content: '上一段' },
      target,
      { ...target, id: 'c3', chunkIndex: 3, content: '下一段' },
    ]);

    const ctx = await service.getChunkContext('u1', 'c2', 10);

    expect(ctx.window).toBe(5);
    expect(ctx.document.title).toBe('架构手册');
    expect(ctx.prevChunks.map((c) => c.id)).toEqual(['c1']);
    expect(ctx.targetChunk.id).toBe('c2');
    expect(ctx.nextChunks.map((c) => c.id)).toEqual(['c3']);
    expect((ctx.targetChunk as any).embedding).toBeUndefined();
  });

  it('updateChunk 应在正文变更时通过 vector SQL 重算向量，仅切换启停时不重算向量', async () => {
    const chunk = {
      id: 'c1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      userId: 'u1',
      chunkIndex: 0,
      content: '旧文本',
      charCount: 3,
      isEnabled: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockChunkRepo.findOne.mockResolvedValue(chunk);
    mockEmbeddingService.embedQuery.mockResolvedValue([0.9, 0.1]);
    mockChunkRepo.save.mockImplementation(async (c: any) => c);
    mockChunkRepo.find.mockResolvedValue([{ id: 'c1', charCount: 8 }]);

    const updatedContent = await service.updateChunk('u1', 'c1', {
      content: '更新后的文本内容',
    });

    expect(mockEmbeddingService.embedQuery).toHaveBeenCalledWith('更新后的文本内容');
    expect(mockChunkRepo.manager.query).toHaveBeenCalledWith(
      'UPDATE "knowledge_chunks" SET "embedding" = $1::vector(1024) WHERE "id" = $2 AND "userId" = $3',
      ['[0.9,0.1]', 'c1', 'u1'],
    );
    expect(updatedContent.charCount).toBe(8);
    expect(mockDocRepo.update).toHaveBeenCalledWith('doc-1', { charCount: 8 });

    mockEmbeddingService.embedQuery.mockClear();
    mockChunkRepo.manager.query.mockClear();
    const toggled = await service.updateChunk('u1', 'c1', { isEnabled: false });
    expect(mockEmbeddingService.embedQuery).not.toHaveBeenCalled();
    expect(mockChunkRepo.manager.query).not.toHaveBeenCalled();
    expect(toggled.isEnabled).toBe(false);

    await expect(
      service.updateChunk('u1', 'c1', { content: '   ' }),
    ).rejects.toThrow(BadRequestException);

    mockChunkRepo.findOne.mockResolvedValue(null);
    await expect(service.getChunkContext('u1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
