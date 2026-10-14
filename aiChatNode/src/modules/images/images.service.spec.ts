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

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllMocks();
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

  describe('deleteImageTask', () => {
    it('任务不存在时应抛出 NotFoundException', async () => {
      imageRepoMock.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.deleteImageTask('user-1', 'non-existent-task'),
      ).rejects.toThrow('未找到该生图记录');
    });

    it('非所属人且非管理员尝试删除应抛出 ForbiddenException', async () => {
      imageRepoMock.findOne = jest.fn().mockResolvedValue({
        id: 'task-123',
        userId: 'other-user',
        imageUrls: ['/images/media/task-123_0.png'],
      } as ImageGeneration);
      userServiceMock.findById = jest.fn().mockResolvedValue({
        id: 'user-1',
        role: 'user',
      } as any);

      await expect(
        service.deleteImageTask('user-1', 'task-123'),
      ).rejects.toThrow('无权删除该生图记录');
    });

    it('所属人删除成功应清理实体并返回成功信息', async () => {
      const mockTask = {
        id: 'task-123',
        userId: 'user-1',
        imageUrls: ['/images/media/task-123_0.png'],
      } as ImageGeneration;
      imageRepoMock.findOne = jest.fn().mockResolvedValue(mockTask);
      imageRepoMock.remove = jest.fn().mockResolvedValue(mockTask);

      const res = await service.deleteImageTask('user-1', 'task-123');
      expect(imageRepoMock.remove).toHaveBeenCalledWith(mockTask);
      expect(res.success).toBe(true);
    });
  });

  describe('超时自愈与积分回滚', () => {
    it('对超过 3 分钟仍处于 pending 的生图任务自动标记失败并全额退还积分', async () => {
      const expiredCreatedAt = new Date(Date.now() - 4 * 60 * 1000);
      const pendingTask = {
        id: 'image-task-timeout',
        userId: 'user-1',
        modelId: 'grok-imagine-image-2.0',
        status: 'pending',
        costCredits: 100,
        createdAt: expiredCreatedAt,
      } as ImageGeneration;

      imageRepoMock.save = jest.fn().mockImplementation(async (entity) => entity);

      const healed = await service.healTimeoutTask(pendingTask);

      expect(healed.status).toBe('failed');
      expect(healed.errorMessage).toContain('生图任务超时');
      expect(creditsServiceMock.refundDirectCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: 100,
          businessType: CreditBusinessType.IMAGE_GENERATION,
          businessId: 'image-task-timeout',
        }),
      );
    });

    it('getHistory 分页拉取时对超时的 pending 记录触发惰性自愈', async () => {
      const expiredCreatedAt = new Date(Date.now() - 5 * 60 * 1000);
      const expiredTask = {
        id: 'image-task-history',
        userId: 'user-1',
        modelId: 'grok-imagine-image-2.0',
        status: 'pending',
        costCredits: 100,
        createdAt: expiredCreatedAt,
      } as ImageGeneration;

      imageRepoMock.findAndCount = jest.fn().mockResolvedValue([[expiredTask], 1]);
      imageRepoMock.save = jest.fn().mockImplementation(async (entity) => entity);

      const result = await service.getHistory('user-1', 1, 10);

      expect(result.items[0].status).toBe('failed');
      expect(creditsServiceMock.refundDirectCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'image-task-history',
          amount: 100,
        }),
      );
    });
  });
});
