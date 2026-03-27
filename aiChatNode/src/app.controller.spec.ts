import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const appService = {
    getHello: jest.fn(),
    getHealth: jest.fn(),
    getRedisHealth: jest.fn(),
    getDatabaseHealth: jest.fn(),
    getProvidersHealth: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    appService.getHello.mockReturnValue('欢迎访问');
    appService.getHealth.mockImplementation(
      (options?: { includeProviders?: boolean }) =>
        Promise.resolve({
          status: 'ok',
          timestamp: '2026-03-27T00:00:00.000Z',
          database: {
            status: 'up',
            driver: 'postgres',
            database: 'postgres',
          },
          redis: {
            status: 'up',
            mode: 'discrete',
            endpoint: '127.0.0.1:6379',
            database: 0,
            response: 'PONG',
          },
          ...(options?.includeProviders
            ? {
                providers: [
                  {
                    providerId: 'provider-1',
                    name: 'Zaiwen',
                    isActive: true,
                    isConfigured: true,
                    status: 'up',
                    cached: true,
                    checkedAt: '2026-03-27T15:00:00.000Z',
                    responseTimeMs: 120,
                    modelCount: 10,
                  },
                ],
              }
            : {}),
        }),
    );
    appService.getRedisHealth.mockResolvedValue({
      status: 'up',
      mode: 'discrete',
      endpoint: '127.0.0.1:6379',
      database: 0,
      response: 'PONG',
    });
    appService.getDatabaseHealth.mockResolvedValue({
      status: 'up',
      driver: 'postgres',
      database: 'postgres',
    });
    appService.getProvidersHealth.mockResolvedValue([
      {
        providerId: 'provider-1',
        name: 'Zaiwen',
        isActive: true,
        isConfigured: true,
        status: 'up',
        cached: true,
        checkedAt: '2026-03-27T15:00:00.000Z',
        responseTimeMs: 120,
        modelCount: 10,
      },
    ]);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: appService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "欢迎访问"', () => {
      expect(appController.getHello()).toBe('欢迎访问');
    });

    it('should return health payload', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        timestamp: '2026-03-27T00:00:00.000Z',
        database: {
          status: 'up',
          driver: 'postgres',
          database: 'postgres',
        },
        redis: {
          status: 'up',
          mode: 'discrete',
          endpoint: '127.0.0.1:6379',
          database: 0,
          response: 'PONG',
        },
      });
    });

    it('should pass provider probe options to health service', async () => {
      await appController.getHealth('true', '7000', '120', 'true');

      expect(appService.getHealth).toHaveBeenCalledWith({
        includeProviders: true,
        providerTimeoutMs: 7000,
        providerCacheTtlSeconds: 120,
        bypassProviderCache: true,
      });
    });

    it('should return redis health payload', async () => {
      await expect(appController.getRedisHealth()).resolves.toEqual({
        status: 'up',
        mode: 'discrete',
        endpoint: '127.0.0.1:6379',
        database: 0,
        response: 'PONG',
      });
    });

    it('should return database health payload', async () => {
      await expect(appController.getDatabaseHealth()).resolves.toEqual({
        status: 'up',
        driver: 'postgres',
        database: 'postgres',
      });
    });

    it('should return provider health payload', async () => {
      await expect(appController.getProvidersHealth('5000')).resolves.toEqual([
        {
          providerId: 'provider-1',
          name: 'Zaiwen',
          isActive: true,
          isConfigured: true,
          status: 'up',
          cached: true,
          checkedAt: '2026-03-27T15:00:00.000Z',
          responseTimeMs: 120,
          modelCount: 10,
        },
      ]);

      expect(appService.getProvidersHealth).toHaveBeenCalledWith({
        timeoutMs: 5000,
        cacheTtlSeconds: undefined,
        bypassCache: false,
      });
    });

    it('should pass cache options to provider health endpoint', async () => {
      await appController.getProvidersHealth('4000', '90', 'true');

      expect(appService.getProvidersHealth).toHaveBeenCalledWith({
        timeoutMs: 4000,
        cacheTtlSeconds: 90,
        bypassCache: true,
      });
    });
  });
});
