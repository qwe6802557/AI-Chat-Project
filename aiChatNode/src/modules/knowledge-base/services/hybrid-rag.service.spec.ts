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
  let mockEntityManager: any;

  beforeEach(() => {
    mockEntityManager = {
      query: jest.fn(),
    };
    mockChunkRepo = {
      manager: {
        transaction: jest.fn((cb: (em: any) => Promise<any>) =>
          cb(mockEntityManager),
        ),
        query: jest.fn(),
      },
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

  it('should push down dense pgvector HNSW iterative scan and sparse pg_trgm SQL', async () => {
    mockEmbeddingService.embedQuery.mockResolvedValue([1, 0, 0]);

    mockEntityManager.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          knowledgeBaseId: 'kb-1',
          content: 'PostgreSQL 向量检索系统设计与索引原理',
          chunkIndex: 0,
          charCount: 22,
          metadata: null,
          documentTitle: 'PostgreSQL架构指南',
          denseScore: 0.99,
        },
        {
          id: 'chunk-2',
          documentId: 'doc-2',
          knowledgeBaseId: 'kb-1',
          content: 'PostgreSQL 索引优化与配置',
          chunkIndex: 0,
          charCount: 15,
          metadata: null,
          documentTitle: '其他指南',
          denseScore: 0.6,
        },
      ]);

    mockChunkRepo.manager.query.mockResolvedValueOnce([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        knowledgeBaseId: 'kb-1',
        content: 'PostgreSQL 向量检索系统设计与索引原理',
        chunkIndex: 0,
        charCount: 22,
        metadata: null,
        documentTitle: 'PostgreSQL架构指南',
        matchCount: 2,
        trgmScore: 0.85,
      },
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        knowledgeBaseId: 'kb-1',
        content: 'PostgreSQL 索引优化与配置',
        chunkIndex: 0,
        charCount: 15,
        metadata: null,
        documentTitle: '其他指南',
        matchCount: 1,
        trgmScore: 0.5,
      },
    ]);

    const results = await service.search({
      userId: 'u1',
      query: 'PostgreSQL 向量检索',
      knowledgeBaseIds: ['kb-1'],
      limit: 2,
    });

    expect(mockEntityManager.query).toHaveBeenCalledWith(
      "SET LOCAL hnsw.iterative_scan = 'relaxed_order'",
    );
    expect(mockEntityManager.query).toHaveBeenCalledWith(
      'SET LOCAL hnsw.ef_search = 64',
    );
    const denseSqlCall = mockEntityManager.query.mock.calls[2];
    expect(denseSqlCall[0]).toContain('<=> $1::vector');
    expect(denseSqlCall[1][0]).toBe('[1,0,0]');
    expect(denseSqlCall[1][2]).toEqual(['kb-1']);

    const sparseSqlCall = mockChunkRepo.manager.query.mock.calls[0];
    expect(sparseSqlCall[0]).toContain('ILIKE ANY($2::text[])');
    expect(sparseSqlCall[0]).toContain('word_similarity($3, c."content")');

    expect(results.length).toBe(2);
    expect(results[0].chunkId).toBe('chunk-1');
    expect(results[0].documentTitle).toBe('PostgreSQL架构指南');
    expect(results[0].score).toBeGreaterThan(0.6);
    expect(results[0].hitSource).toBe('hybrid');
    expect(results[0].highlights.length).toBeGreaterThan(0);
    expect(results[0].matchedTerms).toContain('PostgreSQL');
  });

  it('should filter out low-similarity dense hits and return empty list when nothing matches', async () => {
    mockEmbeddingService.embedQuery.mockResolvedValue([1, 0, 0]);
    mockEntityManager.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          id: 'chunk-irrelevant',
          documentId: 'doc-irr',
          knowledgeBaseId: 'kb-1',
          content: '完全无关的文本内容',
          chunkIndex: 0,
          charCount: 10,
          metadata: null,
          documentTitle: '无关文档',
          denseScore: 0.12,
        },
      ]);
    mockChunkRepo.manager.query.mockResolvedValueOnce([]);

    const results = await service.search({
      userId: 'u1',
      query: '今天天气怎么样',
      limit: 2,
    });

    expect(results).toEqual([]);
  });

  it('should support sparse and dense retrieval modes independently', async () => {
    mockChunkRepo.manager.query.mockResolvedValueOnce([
      {
        id: 'chunk-sparse',
        documentId: 'doc-1',
        knowledgeBaseId: 'kb-1',
        content: 'Redis 缓存穿透与布隆过滤器方案',
        chunkIndex: 0,
        charCount: 18,
        metadata: null,
        documentTitle: '缓存指南',
        matchCount: 1,
        trgmScore: 0.8,
      },
    ]);

    const sparseRes = await service.search({
      userId: 'u1',
      query: '布隆过滤器',
      mode: 'sparse',
      enableRerank: false,
    });

    expect(mockEmbeddingService.embedQuery).not.toHaveBeenCalled();
    expect(mockEntityManager.query).not.toHaveBeenCalled();
    expect(sparseRes).toHaveLength(1);
    expect(sparseRes[0].hitSource).toBe('sparse');
    expect(sparseRes[0].sparseRank).toBe(1);
    expect(sparseRes[0].denseRank).toBeUndefined();

    mockEmbeddingService.embedQuery.mockResolvedValue([0, 1, 0]);
    mockEntityManager.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          id: 'chunk-dense',
          documentId: 'doc-1',
          knowledgeBaseId: 'kb-1',
          content: 'Redis 缓存穿透与布隆过滤器方案',
          chunkIndex: 0,
          charCount: 18,
          metadata: null,
          documentTitle: '缓存指南',
          denseScore: 0.9,
        },
      ]);

    const denseRes = await service.search({
      userId: 'u1',
      query: '布隆过滤器',
      mode: 'dense',
      enableRerank: false,
    });

    expect(mockEmbeddingService.embedQuery).toHaveBeenCalledTimes(1);
    expect(mockChunkRepo.manager.query).toHaveBeenCalledTimes(1);
    expect(denseRes).toHaveLength(1);
    expect(denseRes[0].hitSource).toBe('dense');
    expect(denseRes[0].denseRank).toBe(1);
    expect(denseRes[0].sparseRank).toBeUndefined();
  });

  it('should reorder results with RerankService and fallback to RRF when rerank returns null', async () => {
    mockEmbeddingService.embedQuery.mockResolvedValue([1, 0, 0]);

    const denseRows = [
      {
        id: 'chunk-a',
        documentId: 'doc-1',
        knowledgeBaseId: 'kb-1',
        content: 'PostgreSQL 基础语法介绍',
        chunkIndex: 0,
        charCount: 14,
        metadata: null,
        documentTitle: 'Doc A',
        denseScore: 0.95,
      },
      {
        id: 'chunk-b',
        documentId: 'doc-2',
        knowledgeBaseId: 'kb-1',
        content: 'PostgreSQL 向量索引与 BGE-Reranker 精排实践',
        chunkIndex: 1,
        charCount: 28,
        metadata: null,
        documentTitle: 'Doc B',
        denseScore: 0.75,
      },
    ];
    const sparseRows = [
      { ...denseRows[0], matchCount: 1, trgmScore: 0.6 },
      { ...denseRows[1], matchCount: 2, trgmScore: 0.8 },
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

    mockEntityManager.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(denseRows);
    mockChunkRepo.manager.query.mockResolvedValueOnce(sparseRows);

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

    mockRerankService.rerank.mockResolvedValue(null);
    mockEntityManager.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(denseRows);
    mockChunkRepo.manager.query.mockResolvedValueOnce(sparseRows);

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

  it('should enrich visual chunks with chunkType, pageNumber and signed visualAssetUrl', async () => {
    const mockAssetService = {
      buildSignedAssetUrl: jest.fn(
        (id: string) => `/knowledge-bases/assets/${id}?expires=123&signature=sig`,
      ),
    };
    const visualRagService = new HybridRagService(
      mockChunkRepo,
      mockDocRepo,
      mockEmbeddingService,
      undefined,
      mockAssetService as any,
    );

    mockEmbeddingService.embedQuery.mockResolvedValue([1, 0, 0]);
    mockEntityManager.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          id: 'chunk-visual-1',
          documentId: 'doc-pdf-1',
          knowledgeBaseId: 'kb-1',
          content: '[第 4 页 · 视觉内容(chart)] 营收趋势图',
          chunkIndex: 3,
          charCount: 25,
          metadata: {
            chunkType: 'visual',
            assetId: 'asset-44',
            assetType: 'pdf_page',
            visualType: 'chart',
            pageNumber: 4,
          },
          documentTitle: '2026财报',
          denseScore: 0.91,
        },
      ]);
    mockChunkRepo.manager.query.mockResolvedValueOnce([]);

    const res = await visualRagService.search({
      userId: 'u1',
      query: '营收趋势',
      limit: 3,
    });

    expect(res).toHaveLength(1);
    expect(res[0].chunkType).toBe('visual');
    expect(res[0].assetId).toBe('asset-44');
    expect(res[0].visualType).toBe('chart');
    expect(res[0].pageNumber).toBe(4);
    expect(res[0].visualAssetUrl).toBe(
      '/knowledge-bases/assets/asset-44?expires=123&signature=sig',
    );
  });
});
