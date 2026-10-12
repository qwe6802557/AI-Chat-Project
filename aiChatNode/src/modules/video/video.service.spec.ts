import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoGeneration } from './entities/video-generation.entity';
import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { CreditsService } from '../credits/credits.service';
import type { UserService } from '../user/user.service';
import { CreditBusinessType } from '../credits/types/credits.types';

describe('VideoService', () => {
  let service: VideoService;
  let videoRepoMock: jest.Mocked<Partial<Repository<VideoGeneration>>>;
  let configServiceMock: jest.Mocked<Partial<ConfigService>>;
  let creditsServiceMock: jest.Mocked<Partial<CreditsService>>;
  let userServiceMock: jest.Mocked<Partial<UserService>>;

  beforeEach(() => {
    videoRepoMock = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'mock-video-id', ...dto })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 } as any),
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'SILICONFLOW_API_KEY') return 'test-siliconflow-key';
        if (key === 'SILICONFLOW_BASE_URL') return 'https://api.siliconflow.cn/v1';
        return null;
      }),
    };

    creditsServiceMock = {
      getSnapshotForUser: jest.fn().mockResolvedValue({ remaining: 500, total: 1000, consumed: 500, reserved: 0 }),
      deductDirectCredits: jest.fn().mockResolvedValue({ remaining: 300, total: 1000, consumed: 700, reserved: 0 }),
      refundDirectCredits: jest.fn().mockResolvedValue({ remaining: 500, total: 1000, consumed: 500, reserved: 0 }),
    };

    userServiceMock = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        role: 'user',
      } as any),
    };

    service = new VideoService(
      videoRepoMock as Repository<VideoGeneration>,
      configServiceMock as ConfigService,
      creditsServiceMock as CreditsService,
      userServiceMock as UserService,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('throws BadRequestException if SILICONFLOW_API_KEY is missing', async () => {
    configServiceMock.get = jest.fn().mockReturnValue('');
    delete process.env.SILICONFLOW_API_KEY;

    await expect(
      service.generateVideo('user-1', { prompt: 'A soaring eagle' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects video generation if credits are insufficient for non-admin', async () => {
    creditsServiceMock.getSnapshotForUser = jest.fn().mockResolvedValue({
      remaining: 50,
      total: 100,
      consumed: 50,
      reserved: 0,
    });

    await expect(
      service.generateVideo('user-1', { prompt: 'A soaring eagle' }),
    ).rejects.toThrow(/积分不足/);
  });

  it('submits text-to-video task successfully with 200 credits deduction', async () => {
    jest.spyOn(service, 'trackTaskProgress').mockImplementation(async () => {});

    // 模拟 fetch 成功返回 requestId
    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ requestId: 'sf-task-999' }),
    } as any);

    const task = await service.generateVideo('user-1', {
      prompt: 'A cinematic drone shot of mountains',
      aspect_ratio: '16:9',
    });

    expect(creditsServiceMock.deductDirectCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 200,
        businessType: CreditBusinessType.VIDEO_GENERATION,
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.siliconflow.cn/v1/video/submit',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-siliconflow-key',
        }),
        body: expect.stringContaining('"model":"Wan-AI/Wan2.2-T2V-A14B"'),
      }),
    );
    expect(task.status).toBe('processing');
    expect(task.upstreamTaskId).toBe('sf-task-999');
  });

  it('switches to image-to-video model Wan2.2-I2V when reference image is provided', async () => {
    jest.spyOn(service, 'trackTaskProgress').mockImplementation(async () => {});

    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ requestId: 'sf-i2v-task-888' }),
    } as any);

    const task = await service.generateVideo('user-1', {
      prompt: 'Animate this character',
      image: 'https://example.com/character.jpg',
      aspect_ratio: '9:16',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.siliconflow.cn/v1/video/submit',
      expect.objectContaining({
        body: expect.stringContaining('"model":"Wan-AI/Wan2.2-I2V-A14B"'),
      }),
    );
    expect(task.imageUrl).toBe('https://example.com/character.jpg');
    expect(task.upstreamTaskId).toBe('sf-i2v-task-888');
  });

  it('refunds 200 credits when upstream submission fails', async () => {
    jest.spyOn(service, 'trackTaskProgress').mockImplementation(async () => {});

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Quota exceeded',
    } as any);

    await expect(
      service.generateVideo('user-1', { prompt: 'A futuristic city' }),
    ).rejects.toThrow(BadRequestException);

    expect(creditsServiceMock.refundDirectCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 200,
        businessType: CreditBusinessType.VIDEO_GENERATION,
      }),
    );
  });

  it('paginates history records correctly', async () => {
    videoRepoMock.findAndCount = jest.fn().mockResolvedValue([
      [{ id: 'task-1', prompt: 'test video' } as VideoGeneration],
      1,
    ]);

    const res = await service.getHistory('user-1', 1, 10);
    expect(res.total).toBe(1);
    expect(res.list).toHaveLength(1);
  });

  it('prevents non-owner and non-admin from deleting video tasks', async () => {
    videoRepoMock.findOne = jest.fn().mockResolvedValue({
      id: 'task-1',
      userId: 'user-other',
    } as VideoGeneration);

    await expect(service.deleteVideoTask('user-1', 'task-1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
