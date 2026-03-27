import { RedisService } from './redis.service';

interface MockRedisClient {
  on: jest.Mock<void, [string, (error: unknown) => void]>;
  connect: jest.Mock<Promise<void>, []>;
  ping: jest.Mock<Promise<string>, []>;
  quit: jest.Mock<Promise<void>, []>;
  set: jest.Mock;
  get: jest.Mock;
  getDel: jest.Mock;
  del: jest.Mock;
  ttl: jest.Mock;
  isOpen: boolean;
}

const mockRedisClient: MockRedisClient = {
  on: jest.fn(() => undefined),
  connect: jest.fn(() => Promise.resolve()),
  ping: jest.fn(() => Promise.resolve('PONG')),
  quit: jest.fn(() => Promise.resolve()),
  set: jest.fn(() => Promise.resolve('OK')),
  get: jest.fn(() => Promise.resolve(null)),
  getDel: jest.fn(() => Promise.resolve(null)),
  del: jest.fn(() => Promise.resolve(0)),
  ttl: jest.fn(() => Promise.resolve(0)),
  isOpen: false,
};

const createClientMock = jest.fn(() => mockRedisClient);

jest.mock('redis', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

describe('RedisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.isOpen = false;
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.ping.mockResolvedValue('PONG');
    mockRedisClient.quit.mockResolvedValue(undefined);
  });

  it('throws when REDIS_PORT is invalid', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'REDIS_PORT') return 'abc';
        return undefined;
      }),
    };

    expect(() => new RedisService(configService as never)).toThrow(
      'REDIS_PORT 必须是大于 0 的整数',
    );
  });

  it('throws when REDIS_URL protocol is invalid', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'REDIS_URL') return 'http://localhost:6379';
        return undefined;
      }),
    };

    expect(() => new RedisService(configService as never)).toThrow(
      'REDIS_URL 配置无效',
    );
  });

  it('connects and pings redis on module init', async () => {
    const configService = {
      get: jest.fn(() => undefined),
    };
    const service = new RedisService(configService as never);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.ping).toHaveBeenCalledTimes(1);
  });

  it('returns health status after ping', async () => {
    const configService = {
      get: jest.fn(() => undefined),
    };
    const service = new RedisService(configService as never);

    const health = await service.getHealthStatus();

    expect(health).toMatchObject({
      status: 'up',
      mode: 'discrete',
      endpoint: '127.0.0.1:6379',
      database: 0,
      response: 'PONG',
    });
    expect(typeof health.responseTimeMs).toBe('number');
  });

  it('returns detailed down status when ping fails', async () => {
    const configService = {
      get: jest.fn(() => undefined),
    };
    const service = new RedisService(configService as never);
    mockRedisClient.ping.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const health = await service.getHealthStatus();

    expect(health).toMatchObject({
      status: 'down',
      mode: 'discrete',
      endpoint: '127.0.0.1:6379',
      database: 0,
      message: 'connect ECONNREFUSED',
    });
    expect(typeof health.responseTimeMs).toBe('number');
  });
});
