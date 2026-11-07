import { MemoryContextService } from './memory-context.service';
import type { Repository } from 'typeorm';
import type { AgentCoreProfile } from '../entities/agent-core-profile.entity';
import type { AgentDailyMemory } from '../entities/agent-daily-memory.entity';
import type { EmbeddingService } from '../../knowledge-base/services/embedding.service';
import type { MemoryExtractorService } from './memory-extractor.service';
import type { MemoryDistillerService } from './memory-distiller.service';

describe('MemoryContextService', () => {
  let service: MemoryContextService;
  let coreProfileRepoMock: jest.Mocked<Partial<Repository<AgentCoreProfile>>>;
  let dailyMemoryRepoMock: jest.Mocked<Partial<Repository<AgentDailyMemory>>>;
  let embeddingServiceMock: jest.Mocked<Partial<EmbeddingService>>;
  let extractorServiceMock: jest.Mocked<Partial<MemoryExtractorService>>;
  let distillerServiceMock: jest.Mocked<Partial<MemoryDistillerService>>;

  beforeEach(() => {
    coreProfileRepoMock = {
      findOne: jest.fn().mockResolvedValue({
        id: 'cp_1',
        userId: 'user_1',
        rawSummary: '用户偏好使用 TypeScript 和 Stitch 极简设计规范',
        preferences: {},
        facts: {},
        version: 1,
      } as any),
    };

    dailyMemoryRepoMock = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'dm_1',
          userId: 'user_1',
          category: 'preference',
          content: '前端组件必须使用等宽字体展示元数据',
          dateKey: '2026-11-08',
          embedding: [0.1, 0.2, 0.3],
          isArchived: false,
        },
      ] as any),
      count: jest.fn().mockResolvedValue(2),
    };

    embeddingServiceMock = {
      embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };

    extractorServiceMock = {
      extractFromSession: jest.fn().mockResolvedValue(1),
    };

    distillerServiceMock = {
      distillCoreProfile: jest.fn().mockResolvedValue({} as any),
    };

    service = new MemoryContextService(
      coreProfileRepoMock as Repository<AgentCoreProfile>,
      dailyMemoryRepoMock as Repository<AgentDailyMemory>,
      embeddingServiceMock as EmbeddingService,
      extractorServiceMock as MemoryExtractorService,
      distillerServiceMock as MemoryDistillerService,
    );
  });

  it('应该正确召回长期核心画像与语义相关日常情境记忆', async () => {
    const result = await service.buildMemoryInjection('user_1', '前端样式规范');

    expect(result.hasCoreProfile).toBe(true);
    expect(result.promptAddition).toContain('<user_core_profile>');
    expect(result.promptAddition).toContain('TypeScript 和 Stitch 极简设计规范');
    expect(result.promptAddition).toContain('<relevant_past_memory>');
    expect(result.recalledMemories.length).toBe(1);
    expect(result.recalledMemories[0].content).toContain('前端组件必须使用等宽字体展示元数据');
  });

  it('当用户无核心画像且无相似情境记忆时应安全优雅降级', async () => {
    coreProfileRepoMock.findOne = jest.fn().mockResolvedValue(null);
    dailyMemoryRepoMock.find = jest.fn().mockResolvedValue([]);

    const result = await service.buildMemoryInjection('user_2', '任意查询');

    expect(result.hasCoreProfile).toBe(false);
    expect(result.promptAddition).toBe('');
    expect(result.recalledMemories.length).toBe(0);
  });
});
