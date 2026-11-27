import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AiProviderService } from './ai-provider.service';
import type { AiModel } from './entities/ai-model.entity';
import { AiModelService } from './ai-model.service';

describe('AiModelService', () => {
  let service: AiModelService;
  let mockModelRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockProviderService: {
    findOne: jest.Mock;
  };

  beforeEach(() => {
    mockModelRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto: Record<string, unknown>) => ({
        id: 'm-new',
        ...dto,
      })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve(entity),
      ),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      createQueryBuilder: jest.fn(),
    };
    mockProviderService = {
      findOne: jest.fn(),
    };
    service = new AiModelService(
      mockModelRepo as unknown as Repository<AiModel>,
      mockProviderService as unknown as AiProviderService,
    );
  });

  it('禁止对不支持视觉的纯文本对话模型开启 supportsVision', async () => {
    mockProviderService.findOne.mockResolvedValue({
      id: 'p-iflytek',
      name: 'iFLYTEK',
    });

    await expect(
      service.create({
        providerId: 'p-iflytek',
        modelName: 'Spark-X2.6-4B',
        modelId: 'spark-x2.6-4b',
        supportsVision: true,
      } as never),
    ).rejects.toThrow(BadRequestException);

    const qb = {
      where: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'm-spark',
        modelId: 'spark-x2.6-4b',
        providerId: 'p-iflytek',
        category: 'chat',
        supportsVision: false,
        provider: { id: 'p-iflytek', name: 'iFLYTEK' },
      }),
    };
    mockModelRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.update('m-spark', { supportsVision: true }),
    ).rejects.toThrow(BadRequestException);
    expect(mockModelRepo.update).not.toHaveBeenCalled();
  });

  it('允许对客观支持视觉的模型切换 supportsVision 并返回带供应商信息的结果', async () => {
    const updatedModel = {
      id: 'm-glm4v',
      modelId: 'glm-4v-flash',
      providerId: 'p-zhipu',
      category: 'chat',
      supportsVision: false,
      provider: { id: 'p-zhipu', name: 'Zhipu' },
    };
    const qb = {
      where: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce({ ...updatedModel, supportsVision: true })
        .mockResolvedValueOnce(updatedModel),
    };
    mockModelRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.update('m-glm4v', { supportsVision: false });
    expect(mockModelRepo.update).toHaveBeenCalledWith('m-glm4v', {
      supportsVision: false,
    });
    expect(result.supportsVision).toBe(false);
    expect(result.provider?.name).toBe('Zhipu');
  });
});
