import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let mockKbRepo: any;
  let mockDocRepo: any;
  let mockChunkRepo: any;
  let mockParserService: any;
  let mockChunkerService: any;
  let mockEmbeddingService: any;

  beforeEach(() => {
    mockKbRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    mockDocRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    mockChunkRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };
    mockParserService = {};
    mockChunkerService = {};
    mockEmbeddingService = {
      embedQuery: jest.fn(),
    };

    service = new KnowledgeBaseService(
      mockKbRepo,
      mockDocRepo,
      mockChunkRepo,
      mockParserService,
      mockChunkerService,
      mockEmbeddingService,
    );
  });

  it('getChunks 应支持关键词过滤并剥离 embedding 字段', async () => {
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
            embedding: [0.1, 0.2, 0.3],
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
      embedding: [0.5],
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

  it('updateChunk 应在正文变更时重算向量并刷新文档字符数，仅切换启停时不重算向量', async () => {
    const chunk = {
      id: 'c1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      userId: 'u1',
      chunkIndex: 0,
      content: '旧文本',
      charCount: 3,
      isEnabled: true,
      embedding: [0.1, 0.2],
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
    expect(updatedContent.charCount).toBe(8);
    expect(mockDocRepo.update).toHaveBeenCalledWith('doc-1', { charCount: 8 });

    mockEmbeddingService.embedQuery.mockClear();
    const toggled = await service.updateChunk('u1', 'c1', { isEnabled: false });
    expect(mockEmbeddingService.embedQuery).not.toHaveBeenCalled();
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
