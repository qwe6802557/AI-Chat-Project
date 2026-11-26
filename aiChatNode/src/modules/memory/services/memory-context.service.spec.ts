import { MemoryContextService } from './memory-context.service';
import type { Repository } from 'typeorm';
import type { AgentCoreProfile } from '../entities/agent-core-profile.entity';
import type { AgentDailyMemory } from '../entities/agent-daily-memory.entity';
import type { MemoryExtractorService } from './memory-extractor.service';
import type { MemoryDistillerService } from './memory-distiller.service';
import type { MemoryVectorStoreService } from './memory-vector-store.service';

describe('MemoryContextService', () => {
  let service: MemoryContextService;
  let coreProfileRepoMock: jest.Mocked<Partial<Repository<AgentCoreProfile>>>;
  let dailyMemoryRepoMock: jest.Mocked<Partial<Repository<AgentDailyMemory>>>;
  let extractorServiceMock: jest.Mocked<Partial<MemoryExtractorService>>;
  let distillerServiceMock: jest.Mocked<Partial<MemoryDistillerService>>;
  let vectorStoreMock: jest.Mocked<Partial<MemoryVectorStoreService>>;

  beforeEach(() => {
    coreProfileRepoMock = {
      findOne: jest.fn().mockResolvedValue({
        id: 'cp_1',
        userId: 'user_1',
        rawSummary: '用户偏好使用 TypeScript 和 Stitch 极简设计规范',
        preferences: {},
        facts: {},
        version: 1,
      } as unknown as AgentCoreProfile),
    };

    dailyMemoryRepoMock = {
      count: jest.fn().mockResolvedValue(2),
    };

    extractorServiceMock = {
      extractFromSession: jest.fn().mockResolvedValue(1),
    };

    distillerServiceMock = {
      distillCoreProfile: jest.fn().mockResolvedValue({} as AgentCoreProfile),
    };

    vectorStoreMock = {
      searchDailyMemories: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'dm_1',
            userId: 'user_1',
            sessionId: null,
            dateKey: '2026-11-26',
            category: 'preference',
            content: '前端组件必须使用等宽字体展示元数据',
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            score: 0.91,
          },
        ],
        total: 1,
        page: 1,
        limit: 3,
        totalPages: 1,
      }),
    };

    service = new MemoryContextService(
      coreProfileRepoMock as Repository<AgentCoreProfile>,
      dailyMemoryRepoMock as Repository<AgentDailyMemory>,
      extractorServiceMock as MemoryExtractorService,
      distillerServiceMock as MemoryDistillerService,
      vectorStoreMock as MemoryVectorStoreService,
    );
  });

  it('应该通过 pgvector+pg_trgm 召回长期核心画像与相关日常情境记忆', async () => {
    const result = await service.buildMemoryInjection('user_1', '前端样式规范');

    expect(vectorStoreMock.searchDailyMemories).toHaveBeenCalledWith(
      'user_1',
      '前端样式规范',
      { limit: 3, forAutoRecall: true },
    );
    expect(result.hasCoreProfile).toBe(true);
    expect(result.promptAddition).toContain('<user_core_profile>');
    expect(result.promptAddition).toContain(
      'TypeScript 和 Stitch 极简设计规范',
    );
    expect(result.promptAddition).toContain('<relevant_past_memory>');
    expect(result.recalledMemories).toHaveLength(1);
    expect(result.recalledMemories[0].content).toContain(
      '前端组件必须使用等宽字体展示元数据',
    );
    expect(result.recalledMemories[0].score).toBe(0.91);
  });

  it('当用户无核心画像且无相似情境记忆时应安全返回空结果', async () => {
    coreProfileRepoMock.findOne = jest.fn().mockResolvedValue(null);
    vectorStoreMock.searchDailyMemories = jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 3,
      totalPages: 0,
    });

    const result = await service.buildMemoryInjection('user_2', '任意查询');

    expect(result.hasCoreProfile).toBe(false);
    expect(result.promptAddition).toBe('');
    expect(result.recalledMemories).toHaveLength(0);
  });
});
