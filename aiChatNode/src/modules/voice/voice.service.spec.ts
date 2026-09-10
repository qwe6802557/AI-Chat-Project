import { BadRequestException } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { VoiceTask } from './entities/voice-task.entity';
import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { CreditsService } from '../credits/credits.service';
import { CreditBusinessType } from '../credits/types/credits.types';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockImplementation(async (filePath: string) => {
    if (filePath.includes('not-found')) {
      throw new Error('ENOENT');
    }
    return undefined;
  }),
}));

describe('VoiceService', () => {
  let service: VoiceService;
  let voiceTaskRepoMock: jest.Mocked<Partial<Repository<VoiceTask>>>;
  let configServiceMock: jest.Mocked<Partial<ConfigService>>;
  let creditsServiceMock: jest.Mocked<Partial<CreditsService>>;

  beforeEach(() => {
    voiceTaskRepoMock = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'mock-voice-task-id', ...dto })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [{ id: 'task-1', type: 'tts', text: 'Hello', status: 'success' }],
          1,
        ]),
      }),
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'GROK2API_BASE_URL') return 'http://1.15.171.111:8000/v1';
        if (key === 'GROK2API_KEY') return 'test-voice-key';
        return null;
      }),
    };

    creditsServiceMock = {
      deductDirectCredits: jest.fn().mockResolvedValue({ remaining: 480, total: 500, consumed: 20, reserved: 0 }),
      refundDirectCredits: jest.fn().mockResolvedValue({ remaining: 500, total: 500, consumed: 0, reserved: 0 }),
    };

    service = new VoiceService(
      voiceTaskRepoMock as Repository<VoiceTask>,
      creditsServiceMock as CreditsService,
      configServiceMock as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getVoices', () => {
    it('上游成功时应返回音色列表', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          voices: [{ voice_id: 'eve', name: 'Eve', language: 'multilingual' }],
        }),
      });

      const res = await service.getVoices();
      expect(res.voices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ voice_id: 'eve', name: 'Eve' }),
        ]),
      );
    });

    it('上游报错时应优雅回退内置音色列表', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const res = await service.getVoices();
      expect(res.voices.length).toBeGreaterThan(0);
      expect(res.voices.some((v) => v.voice_id === 'eve')).toBe(true);
    });
  });

  describe('createTts', () => {
    it('成功合成时应扣除 20 积分并保存音频', async () => {
      const mockAudioBuffer = Buffer.from('mock-audio-stream');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockAudioBuffer.buffer,
      });

      const task = await service.createTts('user-1', {
        text: '测试文本合成',
        voiceId: 'eve',
        language: 'zh',
        speed: 1.0,
      });

      expect(creditsServiceMock.deductDirectCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: 20,
          businessType: CreditBusinessType.VOICE_TTS,
        }),
      );
      expect(task.status).toBe('success');
      expect(task.audioUrl).toBe('/voice/media/tts_mock-voice-task-id.mp3');
    });

    it('上游异常时应触发全额退款并抛出 BadRequestException', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        service.createTts('user-1', {
          text: '失败测试',
          voiceId: 'eve',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(creditsServiceMock.refundDirectCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: 20,
          businessType: CreditBusinessType.VOICE_TTS,
        }),
      );
    });
  });

  describe('createStt', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.mp3',
      encoding: '7bit',
      mimetype: 'audio/mpeg',
      size: 1024,
      buffer: Buffer.from('fake-audio-content'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('成功识别时应扣除 20 积分并回填识别文本与时长', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          text: '你好世界',
          duration: 1.5,
        }),
      });

      const task = await service.createStt('user-1', mockFile, 'zh');

      expect(creditsServiceMock.deductDirectCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: 20,
          businessType: CreditBusinessType.VOICE_STT,
        }),
      );
      expect(task.status).toBe('success');
      expect(task.text).toBe('你好世界');
      expect(task.duration).toBe(1.5);
      expect(task.audioUrl).toBe('/voice/media/stt_mock-voice-task-id.mp3');
    });

    it('文件为空时应直接拒绝', async () => {
      await expect(
        service.createStt('user-1', null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('识别异常时应全额退款并抛出异常', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => 'Gateway timeout',
      });

      await expect(
        service.createStt('user-1', mockFile),
      ).rejects.toThrow(BadRequestException);

      expect(creditsServiceMock.refundDirectCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: 20,
          businessType: CreditBusinessType.VOICE_STT,
        }),
      );
    });
  });

  describe('getHistory', () => {
    it('能够正确分页拉取任务历史', async () => {
      const result = await service.getHistory('user-1', { page: 1, pageSize: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getMediaFilePath', () => {
    it('非法文件名应拦截路径穿越', async () => {
      await expect(service.getMediaFilePath('../../../etc/passwd')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
