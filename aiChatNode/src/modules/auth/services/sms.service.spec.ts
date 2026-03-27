import { BadRequestException } from '@nestjs/common';
import { SmsService } from './sms.service';
import type { RedisService } from '../../../common/redis/redis.service';

describe('SmsService', () => {
  const redisService: Pick<RedisService, 'set' | 'ttl' | 'getDel' | 'del'> = {
    set: jest.fn(),
    ttl: jest.fn(),
    getDel: jest.fn(),
    del: jest.fn(),
  };

  let service: SmsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SmsService(redisService as RedisService);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes rate-limit and code keys to redis', async () => {
    (redisService.set as jest.Mock)
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce('OK');

    const result = await service.sendSmsCode('13800138000');

    expect(redisService.set).toHaveBeenNthCalledWith(
      1,
      'auth:sms:rate:13800138000',
      '1',
      { NX: true, EX: 60 },
    );
    expect(redisService.set).toHaveBeenNthCalledWith(
      2,
      'auth:sms:code:13800138000',
      expect.any(String),
      { EX: 300 },
    );
    expect(result.message).toBe('验证码已发送');
  });

  it('rejects resend when rate limit key already exists', async () => {
    (redisService.set as jest.Mock).mockResolvedValueOnce(null);
    (redisService.ttl as jest.Mock).mockResolvedValueOnce(42);

    await expect(service.sendSmsCode('13800138000')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('consumes sms code on verify', async () => {
    (redisService.getDel as jest.Mock).mockResolvedValueOnce('123456');

    await expect(service.verifySmsCode('13800138000', '123456')).resolves.toBe(
      true,
    );
    expect(redisService.getDel).toHaveBeenCalledWith(
      'auth:sms:code:13800138000',
    );
  });
});
