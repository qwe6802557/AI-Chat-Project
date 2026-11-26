import type { EmbeddingService } from '../../knowledge-base/services/embedding.service';
import type { MemoryLlmService } from './memory-llm.service';
import type { MemoryVectorStoreService } from './memory-vector-store.service';
import { MemoryExtractorService } from './memory-extractor.service';

describe('MemoryExtractorService', () => {
  let memoryLlmMock: jest.Mocked<Partial<MemoryLlmService>>;
  let vectorStoreMock: jest.Mocked<Partial<MemoryVectorStoreService>>;
  let embeddingMock: jest.Mocked<Partial<EmbeddingService>>;
  let service: MemoryExtractorService;

  beforeEach(() => {
    memoryLlmMock = {
      completeJson: jest.fn(),
    };
    vectorStoreMock = {
      upsertDailyMemory: jest.fn(),
    };
    embeddingMock = {
      embedDocuments: jest.fn(),
    };

    service = new MemoryExtractorService(
      memoryLlmMock as MemoryLlmService,
      vectorStoreMock as MemoryVectorStoreService,
      embeddingMock as EmbeddingService,
    );
  });

  it('通过 MemoryLlmService 提取记忆并批量向量化后执行去重写入', async () => {
    memoryLlmMock.completeJson = jest.fn().mockResolvedValue({
      items: [
        { category: 'preference', content: '代码注释保持极简意图说明' },
        { category: 'invalid_cat', content: '生产使用 PostgreSQL 15' },
        { category: 'fact', content: ' ' },
      ],
    });
    embeddingMock.embedDocuments = jest.fn().mockResolvedValue([[0.1], [0.2]]);
    vectorStoreMock.upsertDailyMemory = jest
      .fn()
      .mockResolvedValueOnce({ action: 'created', item: {} as never })
      .mockResolvedValueOnce({ action: 'merged', item: {} as never });

    const count = await service.extractFromSession('u-1', 's-1', [
      { role: 'user', content: '注意保持简洁注释，数据库用 PG15' },
      { role: 'assistant', content: '好的，已了解' },
    ]);

    expect(count).toBe(2);
    expect(embeddingMock.embedDocuments).toHaveBeenCalledWith([
      '代码注释保持极简意图说明',
      '生产使用 PostgreSQL 15',
    ]);
    expect(vectorStoreMock.upsertDailyMemory).toHaveBeenNthCalledWith(
      1,
      'u-1',
      expect.objectContaining({
        sessionId: 's-1',
        category: 'preference',
        content: '代码注释保持极简意图说明',
        embedding: [0.1],
      }),
    );
    expect(vectorStoreMock.upsertDailyMemory).toHaveBeenNthCalledWith(
      2,
      'u-1',
      expect.objectContaining({
        category: 'fact',
        content: '生产使用 PostgreSQL 15',
        embedding: [0.2],
      }),
    );
  });

  it('对话条数不足 2 条时直接跳过不调用模型', async () => {
    const count = await service.extractFromSession('u-1', 's-1', [
      { role: 'user', content: '你好' },
    ]);
    expect(count).toBe(0);
    expect(memoryLlmMock.completeJson).not.toHaveBeenCalled();
  });

  it('模型调用失败时记录错误并返回 0 不阻塞主流程', async () => {
    memoryLlmMock.completeJson = jest
      .fn()
      .mockRejectedValue(new Error('模型不可用'));

    const count = await service.extractFromSession('u-1', 's-1', [
      { role: 'user', content: '问题1' },
      { role: 'assistant', content: '回答1' },
    ]);
    expect(count).toBe(0);
  });
});
