import { HybridRagService } from './hybrid-rag.service';
import {
  computeHighlightSpans,
  extractSearchTerms,
} from '../utils/chunk-highlight.util';

describe('HybridRagService', () => {
  let service: HybridRagService;
  let mockChunkRepo: any;
  let mockDocRepo: any;
  let mockEmbeddingService: any;

  const createQbMock = (chunks: any[]) => ({
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(chunks),
  });

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

  it('should perform hybrid ranking, apply isEnabled filter, and return highlights', async () => {
    mockEmbeddingService.embedQuery.mockResolvedValue([1, 0, 0]);

    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        knowledgeBaseId: 'kb-1',
        content: 'PostgreSQL 向量检索系统设计与索引原理',
        embedding: [0.99, 0.05, 0],
        chunkIndex: 0,
        charCount: 22,
        isEnabled: true,
        document: { title: 'PostgreSQL架构指南' },
      },
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        knowledgeBaseId: 'kb-1',
        content: 'PostgreSQL 索引优化与配置',
        embedding: [0.6, 0.8, 0],
        chunkIndex: 0,
        charCount: 15,
        isEnabled: true,
        document: { title: '其他指南' },
      },
    ];

    const qbMock = createQbMock(mockChunks);
    mockChunkRepo.createQueryBuilder.mockReturnValue(qbMock);

    const results = await service.search({
      userId: 'u1',
      query: 'PostgreSQL 向量检索',
      limit: 2,
    });

    expect(qbMock.andWhere).toHaveBeenCalledWith(
      'chunk.isEnabled = :isEnabled',
      { isEnabled: true },
    );
    expect(results.length).toBe(2);
    expect(results[0].chunkId).toBe('chunk-1');
    expect(results[0].documentTitle).toBe('PostgreSQL架构指南');
    expect(results[0].score).toBeGreaterThan(0.6);
    expect(results[0].hitSource).toBe('hybrid');
    expect(results[0].highlights.length).toBeGreaterThan(0);
    expect(results[0].matchedTerms).toContain('PostgreSQL');
  });

  it('should return empty list when no chunks pass confidence threshold', async () => {
    mockEmbeddingService.embedQuery.mockResolvedValue([1, 0, 0]);

    const mockChunks = [
      {
        id: 'chunk-irrelevant',
        documentId: 'doc-irr',
        knowledgeBaseId: 'kb-1',
        content: '完全无关的文本内容',
        embedding: [0, 1, 0],
        chunkIndex: 0,
        charCount: 10,
        isEnabled: true,
        document: { title: '无关文档' },
      },
    ];

    mockChunkRepo.createQueryBuilder.mockReturnValue(createQbMock(mockChunks));

    const results = await service.search({
      userId: 'u1',
      query: '今天天气怎么样',
      limit: 2,
    });

    expect(results.length).toBe(0);
  });

  it('should support sparse and dense retrieval modes', async () => {
    const mockChunks = [
      {
        id: 'chunk-sparse',
        documentId: 'doc-1',
        knowledgeBaseId: 'kb-1',
        content: 'Redis 缓存穿透与布隆过滤器方案',
        embedding: [0.1, 0.9, 0],
        chunkIndex: 0,
        charCount: 18,
        isEnabled: true,
        document: { title: '缓存指南' },
      },
    ];
    mockChunkRepo.createQueryBuilder.mockReturnValue(createQbMock(mockChunks));

    const sparseRes = await service.search({
      userId: 'u1',
      query: '布隆过滤器',
      mode: 'sparse',
      enableRerank: false,
    });

    expect(mockEmbeddingService.embedQuery).not.toHaveBeenCalled();
    expect(sparseRes).toHaveLength(1);
    expect(sparseRes[0].hitSource).toBe('sparse');
    expect(sparseRes[0].sparseRank).toBe(1);
    expect(sparseRes[0].denseRank).toBeUndefined();

    mockEmbeddingService.embedQuery.mockResolvedValue([0, 1, 0]);
    const denseRes = await service.search({
      userId: 'u1',
      query: '布隆过滤器',
      mode: 'dense',
      enableRerank: false,
    });

    expect(mockEmbeddingService.embedQuery).toHaveBeenCalledTimes(1);
    expect(denseRes).toHaveLength(1);
    expect(denseRes[0].hitSource).toBe('dense');
    expect(denseRes[0].denseRank).toBe(1);
    expect(denseRes[0].sparseRank).toBeUndefined();
  });

  it('should reorder results with RerankService and fallback gracefully when rerank returns null', async () => {
    mockEmbeddingService.embedQuery.mockResolvedValue([1, 0, 0]);

    const mockChunks = [
      {
        id: 'chunk-a',
        documentId: 'doc-1',
        knowledgeBaseId: 'kb-1',
        content: 'PostgreSQL 基础语法介绍',
        embedding: [0.95, 0.05, 0],
        chunkIndex: 0,
        charCount: 14,
        isEnabled: true,
        document: { title: 'Doc A' },
      },
      {
        id: 'chunk-b',
        documentId: 'doc-2',
        knowledgeBaseId: 'kb-1',
        content: 'PostgreSQL 向量索引与 BGE-Reranker 精排实践',
        embedding: [0.75, 0.1, 0],
        chunkIndex: 1,
        charCount: 28,
        isEnabled: true,
        document: { title: 'Doc B' },
      },
    ];

    const mockRerankService = {
      rerank: jest.fn().mockResolvedValue([
        { index: 1, relevanceScore: 0.94 },
        { index: 0, relevanceScore: 0.42 },
      ]),
    };

    const serviceWithRerank = new HybridRagService(
      mockChunkRepo,
      mockDocRepo,
      mockEmbeddingService,
      mockRerankService as any,
    );

    mockChunkRepo.createQueryBuilder.mockReturnValue(createQbMock(mockChunks));
    const reranked = await serviceWithRerank.search({
      userId: 'u1',
      query: 'PostgreSQL 精排',
      limit: 2,
      enableRerank: true,
    });

    expect(mockRerankService.rerank).toHaveBeenCalledTimes(1);
    expect(reranked[0].chunkId).toBe('chunk-b');
    expect(reranked[0].rerankApplied).toBe(true);
    expect(reranked[0].rerankScore).toBe(0.94);
    expect(reranked[0].score).toBe(0.94);

    // 精排不可用时平滑回退到 RRF
    mockRerankService.rerank.mockResolvedValue(null);
    mockChunkRepo.createQueryBuilder.mockReturnValue(createQbMock(mockChunks));
    const fallback = await serviceWithRerank.search({
      userId: 'u1',
      query: 'PostgreSQL 精排',
      limit: 2,
      minScore: 0.5,
    });

    expect(fallback.every((r) => r.rerankApplied === false)).toBe(true);
    expect(fallback.every((r) => r.score >= 0.5)).toBe(true);
  });

  it('should compute non-overlapping highlight spans prioritizing longer terms', () => {
    const terms = extractSearchTerms('PostgreSQL 和 Postgres 向量检索');
    const content = 'PostgreSQL 数据库支持向量检索能力';
    const { highlights, matchedTerms } = computeHighlightSpans(content, terms);

    expect(highlights.length).toBeGreaterThan(0);
    for (let i = 1; i < highlights.length; i++) {
      expect(highlights[i].start).toBeGreaterThanOrEqual(highlights[i - 1].end);
    }
    expect(matchedTerms).toContain('PostgreSQL');
    expect(matchedTerms).not.toContain('Postgres');
  });
});
