import type { Repository } from 'typeorm';
import type { AgentCoreProfile } from '../entities/agent-core-profile.entity';
import type { AgentDailyMemory } from '../entities/agent-daily-memory.entity';
import type { MemoryLlmService } from './memory-llm.service';
import { MemoryDistillerService } from './memory-distiller.service';

describe('MemoryDistillerService', () => {
  let coreProfileRepoMock: jest.Mocked<Partial<Repository<AgentCoreProfile>>>;
  let dailyMemoryRepoMock: jest.Mocked<Partial<Repository<AgentDailyMemory>>>;
  let executeMock: jest.Mock;
  let memoryLlmMock: jest.Mocked<Partial<MemoryLlmService>>;
  let service: MemoryDistillerService;

  beforeEach(() => {
    const profileObj = {
      id: 'cp-1',
      userId: 'u-1',
      preferences: { theme: 'light' },
      facts: {},
      rawSummary: '旧摘要',
      version: 1,
    } as unknown as AgentCoreProfile;

    coreProfileRepoMock = {
      findOne: jest.fn().mockResolvedValue(profileObj),
      save: jest.fn((entity: AgentCoreProfile) => Promise.resolve(entity)),
    };

    executeMock = jest.fn().mockResolvedValue(undefined);
    const qbMock = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      whereInIds: jest.fn().mockReturnThis(),
      execute: executeMock,
    };

    dailyMemoryRepoMock = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'dm-1',
          userId: 'u-1',
          category: 'preference',
          content: '偏好使用 TS 严格类型',
          dateKey: '2026-11-26',
          isArchived: false,
        } as AgentDailyMemory,
      ]),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    memoryLlmMock = {
      completeJson: jest.fn().mockResolvedValue({
        preferences: { theme: 'light', language: 'TypeScript' },
        facts: { role: 'Fullstack' },
        rawSummary: '### 核心偏好\n- 严格类型检查',
      }),
    };

    service = new MemoryDistillerService(
      coreProfileRepoMock as Repository<AgentCoreProfile>,
      dailyMemoryRepoMock as Repository<AgentDailyMemory>,
      memoryLlmMock as MemoryLlmService,
    );
  });

  it('使用 MemoryLlmService 完成画像蒸馏升级并批量标记已归档', async () => {
    const updated = await service.distillCoreProfile('u-1', true);

    expect(memoryLlmMock.completeJson).toHaveBeenCalledWith(expect.any(Array), {
      preferredModelEnvKey: 'MEMORY_DISTILLER_MODEL',
      temperature: 0.1,
    });
    expect(updated?.version).toBe(2);
    expect(updated?.rawSummary).toContain('严格类型检查');
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('无未归档记忆且非强制触发时直接返回 null', async () => {
    dailyMemoryRepoMock.find = jest.fn().mockResolvedValue([]);
    const res = await service.distillCoreProfile('u-1', false);
    expect(res).toBeNull();
    expect(memoryLlmMock.completeJson).not.toHaveBeenCalled();
  });
});
