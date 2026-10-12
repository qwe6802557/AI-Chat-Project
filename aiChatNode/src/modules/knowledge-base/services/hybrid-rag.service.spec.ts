import { HybridRagService } from './hybrid-rag.service';

describe('HybridRagService', () => {
  let service: HybridRagService;
  let mockChunkRepo: any;
  let mockDocRepo: any;
  let mockEmbeddingService: any;

  beforeEach(() => {
    mockChunkRepo = {
      createQueryBuilder: jest.fn(),
    };
    mockDocRepo = {};
    mockEmbeddingService = {
      embedQuery: jest.fn(),
    };

    service = new HybridRagService(
      mockChunkRepo,
      mockDocRepo,
      mockEmbeddingService,
    );
  });

  it('should return empty array when query is empty', async () => {
    const res = await service.search({ userId: 'u1', query: '' });
    expect(res).toEqual([]);
  });

  it('should perform hybrid ranking and return top results', async () => {
    mockEmbeddingService.embedQuery.mockResolvedValue([1, 0, 0]);

    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        knowledgeBaseId: 'kb-1',
        content: 'PostgreSQL 向量检索系统设计',
        embedding: [0.99, 0.05, 0],
        chunkIndex: 0,
        charCount: 20,
        document: { title: 'PostgreSQL架构指南' },
      },
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        knowledgeBaseId: 'kb-1',
        content: '这是完全无关的内容介绍',
        embedding: [0, 1, 0],
        chunkIndex: 0,
        charCount: 15,
        document: { title: '其他指南' },
      },
    ];

    const qbMock: any = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockChunks),
    };
    mockChunkRepo.createQueryBuilder.mockReturnValue(qbMock);

    const results = await service.search({
      userId: 'u1',
      query: 'PostgreSQL 向量检索',
      limit: 2,
    });

    expect(results.length).toBe(2);
    expect(results[0].chunkId).toBe('chunk-1');
    expect(results[0].documentTitle).toBe('PostgreSQL架构指南');
    expect(results[0].score).toBeGreaterThan(0.6);
  });
});
