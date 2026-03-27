import { CaptchaService } from './captcha.service';
import type { RedisService } from '../../../common/redis/redis.service';

describe('CaptchaService', () => {
  const redisService: Pick<RedisService, 'set' | 'getDel'> = {
    set: jest.fn(),
    getDel: jest.fn(),
  };

  let service: CaptchaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CaptchaService(redisService as RedisService);
  });

  it('stores captcha code in redis with ttl', async () => {
    await service.generateCaptcha();

    expect(redisService.set).toHaveBeenCalledTimes(1);
    expect(redisService.set).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:captcha:code:/),
      expect.any(String),
      { EX: 300 },
    );
  });

  it('verifies captcha case-insensitively and consumes it once', async () => {
    (redisService.getDel as jest.Mock).mockResolvedValue('ab12');

    await expect(service.verifyCaptcha('captcha-id', 'AB12')).resolves.toBe(
      true,
    );
    expect(redisService.getDel).toHaveBeenCalledWith(
      'auth:captcha:code:captcha-id',
    );
  });
});
