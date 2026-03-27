import { InternalServerErrorException } from '@nestjs/common';
import { EmailService } from './email.service';
import type { ConfigService } from '@nestjs/config';
import type { RedisService } from '../../../common/redis/redis.service';

describe('EmailService', () => {
  const configValues: Record<string, string> = {
    ALIYUN_ACCESS_KEY_ID: 'ak',
    ALIYUN_ACCESS_KEY_SECRET: 'sk',
    ALIYUN_REGION: 'cn-hangzhou',
    ALIYUN_FROM_EMAIL: 'noreply@example.com',
    ALIYUN_FROM_NAME: 'ERJCHAT',
    ALIYUN_REPLY_EMAIL: 'support@example.com',
    ALIYUN_DM_CONNECT_TIMEOUT_MS: '5000',
    ALIYUN_DM_READ_TIMEOUT_MS: '15000',
    ALIYUN_DM_MAX_ATTEMPTS: '2',
  };

  const configService: Pick<ConfigService, 'get'> = {
    get: jest.fn((key: string) => configValues[key]),
  };

  const redisService: Pick<RedisService, 'set' | 'ttl' | 'del' | 'getDel'> = {
    set: jest.fn(),
    ttl: jest.fn(),
    del: jest.fn(),
    getDel: jest.fn(),
  };

  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailService(
      configService as ConfigService,
      redisService as RedisService,
    );
  });

  it('maps timeout errors to a clearer user-facing message', async () => {
    (redisService.set as jest.Mock)
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce('OK');
    (redisService.del as jest.Mock).mockResolvedValue(2);

    const timeoutError = new Error(
      'ReadTimeout(3000). POST https://dm.aliyuncs.com/ failed.',
    );
    timeoutError.name = 'RequestTimeoutError';
    jest
      .spyOn(
        service as unknown as {
          sendVerificationEmail: (email: string, code: string) => Promise<void>;
        },
        'sendVerificationEmail',
      )
      .mockRejectedValue(timeoutError);

    await expect(service.sendEmailCode('demo@example.com')).rejects.toEqual(
      new InternalServerErrorException(
        '邮件服务请求超时，请稍后重试（connect=5000ms, read=15000ms）',
      ),
    );
  });

  it('maps invalid sender address errors to a clearer configuration message', async () => {
    (redisService.set as jest.Mock)
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce('OK');
    (redisService.del as jest.Mock).mockResolvedValue(2);

    const invalidSenderError = Object.assign(
      new Error('The specified mail address is not found.'),
      {
        code: 'InvalidMailAddress.NotFound',
      },
    );

    jest
      .spyOn(
        service as unknown as {
          sendVerificationEmail: (email: string, code: string) => Promise<void>;
        },
        'sendVerificationEmail',
      )
      .mockRejectedValue(invalidSenderError);

    await expect(service.sendEmailCode('demo@example.com')).rejects.toEqual(
      new InternalServerErrorException(
        '邮件发信地址不存在或未验证，请检查 ALIYUN_FROM_EMAIL 与阿里云邮件推送发信地址配置',
      ),
    );
  });
});
