import { BadRequestException } from '@nestjs/common';
import { ImagesService } from './images.service';
import { ImageGeneration } from './entities/image-generation.entity';
import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { CreditsService } from '../credits/credits.service';
import type { AiModelService } from '../ai-provider/ai-model.service';
import type { UserService } from '../user/user.service';
import { CreditBusinessType } from '../credits/types/credits.types';

describe('ImagesService', () => {
  let service: ImagesService;
  let imageRepoMock: jest.Mocked<Partial<Repository<ImageGeneration>>>;
  let configServiceMock: jest.Mocked<Partial<ConfigService>>;
  let creditsServiceMock: jest.Mocked<Partial<CreditsService>>;
  let aiModelServiceMock: jest.Mocked<Partial<AiModelService>>;
  let userServiceMock: jest.Mocked<Partial<UserService>>;

  beforeEach(() => {
    imageRepoMock = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'mock-task-id', ...dto })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'IMAGE_API_BASE_URL' || key === 'GROK2API_BASE_URL') return 'http://1.15.171.111:8000/v1';
        if (key === 'IMAGE_API_KEY' || key === 'GROK2API_KEY') return 'test-api-key';
        if (key === 'DEFAULT_IMAGE_MODEL') return 'grok-imagine-image-2.0';
        return null;
      }),
    };

    creditsServiceMock = {
      getSnapshotForUser: jest.fn().mockResolvedValue({ remaining: 50, total: 100, consumed: 50, reserved: 0 }),
      deductDirectCredits: jest.fn().mockResolvedValue({ remaining: 0, total: 100, consumed: 100, reserved: 0 }),
      refundDirectCredits: jest.fn().mockResolvedValue({ remaining: 100, total: 100, consumed: 0, reserved: 0 }),
    };

    aiModelServiceMock = {
      findByModelIdOrNull: jest.fn().mockResolvedValue({
        id: 'model-uuid',
        modelId: 'grok-imagine-image-2.0',
        creditCost: 100,
        category: 'image',
      } as any),
    };

    userServiceMock = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        role: 'user',
      } as any),
    };

    service = new ImagesService(
      imageRepoMock as Repository<ImageGeneration>,
      configServiceMock as ConfigService,
      creditsServiceMock as CreditsService,
      aiModelServiceMock as AiModelService,
      userServiceMock as UserService,
    );
  });

  it('非管理员余额不足时应抛出 BadRequestException 拦截', async () => {
    await expect(
      service.generateImages('user-1', {
        prompt: '测试图片',
        n: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(creditsServiceMock.deductDirectCredits).not.toHaveBeenCalled();
  });

  it('余额充足时应正确预扣费并调用上游接口', async () => {
    creditsServiceMock.getSnapshotForUser = jest.fn().mockResolvedValue({ remaining: 500, total: 500, consumed: 0, reserved: 0 });

    const globalFetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        created: 12345,
        data: [{ url: 'http://1.15.171.111:8000/v1/media/images/sample.png' }],
      }),
    });
    global.fetch = globalFetchMock;

    // Mock 图片转存
    jest.spyOn(service as any, 'downloadAndSaveImage').mockResolvedValue('/images/media/saved.png');

    const result = await service.generateImages('user-1', {
      prompt: '极简红椅',
      n: 1,
    });

    expect(creditsServiceMock.deductDirectCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 100,
        businessType: CreditBusinessType.IMAGE_GENERATION,
      }),
    );
    expect(result.status).toBe('success');
    expect(result.imageUrls).toContain('/images/media/saved.png');
  });

  it('上游生图调用失败时应全额退还扣除积分', async () => {
    creditsServiceMock.getSnapshotForUser = jest.fn().mockResolvedValue({ remaining: 500, total: 500, consumed: 0, reserved: 0 });

    const globalFetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Upstream Error',
    });
    global.fetch = globalFetchMock;

    await expect(
      service.generateImages('user-1', {
        prompt: '失败测试',
        n: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(creditsServiceMock.refundDirectCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 100,
        businessType: CreditBusinessType.IMAGE_GENERATION,
      }),
    );
  });
});
