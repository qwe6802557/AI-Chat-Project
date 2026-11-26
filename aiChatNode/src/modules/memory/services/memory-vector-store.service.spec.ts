import type { EntityManager, Repository } from 'typeorm';
import type { AgentDailyMemory } from '../entities/agent-daily-memory.entity';
import type { EmbeddingService } from '../../knowledge-base/services/embedding.service';
import { MemoryVectorStoreService } from './memory-vector-store.service';

describe('MemoryVectorStoreService', () => {
  const vector1024 = Array.from({ length: 1024 }, (_, idx) =>
    idx === 0 ? 1 : 0,
  );

  let queryMock: jest.Mock<Promise<unknown>, [string, unknown[]?]>;
  let repoMock: Repository<AgentDailyMemory>;
  let embeddingMock: jest.Mocked<Partial<EmbeddingService>>;
  let service: MemoryVectorStoreService;

  beforeEach(() => {
    queryMock = jest.fn<Promise<unknown>, [string, unknown[]?]>();
    repoMock = {
      manager: {
        transaction: jest.fn(
          async (cb: (em: EntityManager) => Promise<unknown>) =>
            cb({ query: queryMock } as unknown as EntityManager),
        ),
      },
    } as unknown as Repository<AgentDailyMemory>;

    embeddingMock = {
      embedQuery: jest.fn().mockResolvedValue(vector1024),
    };

    service = new MemoryVectorStoreService(
      repoMock,
      embeddingMock as EmbeddingService,
    );
  });

  it('语义去重：存在余弦相似度 >= 0.90 的记录时合并更新并重置未归档状态', async () => {
    queryMock
      .mockResolvedValueOnce(undefined) // SET LOCAL iterative_scan
      .mockResolvedValueOnce(undefined) // SET LOCAL ef_search
      .mockResolvedValueOnce([{ id: 'dm-old', similarity: 0.94 }])
      .mockResolvedValueOnce([
        {
          id: 'dm-old',
          userId: 'u-1',
          sessionId: 's-2',
          dateKey: '2026-11-26',
          category: 'preference',
          content: '偏好使用 pgvector 原生检索',
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

    const result = await service.upsertDailyMemory('u-1', {
      sessionId: 's-2',
      category: 'preference',
      content: '偏好使用 pgvector 原生检索',
      embedding: vector1024,
    });

    expect(result.action).toBe('merged');
    expect(result.item.id).toBe('dm-old');
    expect(result.item.isArchived).toBe(false);
    expect(String(queryMock.mock.calls[0]?.[0])).toContain(
      "SET LOCAL hnsw.iterative_scan = 'relaxed_order'",
    );
    expect(String(queryMock.mock.calls[3]?.[0])).toContain(
      'UPDATE "agent_daily_memories"',
    );
  });

  it('语义去重：最相似记录低于 0.90 时插入全新记录', async () => {
    queryMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: 'dm-old', similarity: 0.72 }])
      .mockResolvedValueOnce([
        {
          id: 'dm-new',
          userId: 'u-1',
          sessionId: null,
          dateKey: '2026-11-26',
          category: 'fact',
          content: '生产数据库版本为 pgvector 0.8.7',
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

    const result = await service.createManualDailyMemory('u-1', {
      category: 'fact',
      content: '生产数据库版本为 pgvector 0.8.7',
    });

    expect(embeddingMock.embedQuery).toHaveBeenCalledWith(
      '生产数据库版本为 pgvector 0.8.7',
    );
    expect(result.action).toBe('created');
    expect(result.item.id).toBe('dm-new');
    expect(String(queryMock.mock.calls[3]?.[0])).toContain(
      'INSERT INTO "agent_daily_memories"',
    );
  });

  it('混合检索：在单事务内下推 HNSW 与 pg_trgm 查询并按 RRF 融合排序', async () => {
    const now = new Date();
    queryMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          id: 'dm-dense-1',
          userId: 'u-1',
          sessionId: null,
          dateKey: '2026-11-26',
          category: 'decision',
          content: '选择 pgvector HNSW 索引方案',
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          denseScore: 0.88,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'dm-dense-1',
          userId: 'u-1',
          sessionId: null,
          dateKey: '2026-11-26',
          category: 'decision',
          content: '选择 pgvector HNSW 索引方案',
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          matchCount: 2,
          trgmScore: 0.62,
        },
        {
          id: 'dm-sparse-only',
          userId: 'u-1',
          sessionId: null,
          dateKey: '2026-11-20',
          category: 'fact',
          content: 'pgvector 扩展版本为 0.8.7',
          isArchived: true,
          createdAt: now,
          updatedAt: now,
          matchCount: 1,
          trgmScore: 0.45,
        },
      ]);

    const pageRes = await service.searchDailyMemories('u-1', 'pgvector HNSW', {
      category: 'decision',
      page: 1,
      limit: 10,
    });

    expect(pageRes.total).toBe(2);
    expect(pageRes.items[0].id).toBe('dm-dense-1');
    expect(pageRes.items[0].score).toBeGreaterThan(0.8);
    expect(String(queryMock.mock.calls[2]?.[0])).toContain(
      '1 - ("embedding" <=> $1::vector(1024))',
    );
    expect(String(queryMock.mock.calls[3]?.[0])).toContain(
      'word_similarity($3, "content")',
    );
  });
});
