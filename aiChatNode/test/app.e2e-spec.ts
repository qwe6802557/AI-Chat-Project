import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController smoke (e2e)', () => {
  let app: INestApplication<App>;

  const appService = {
    getHello: jest.fn(() => '欢迎访问'),
    getHealth: jest.fn((options?: { includeProviders?: boolean }) =>
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
                  responseTimeMs: 100,
                  modelCount: 3,
                },
              ],
            }
          : {}),
      }),
    ),
    getRedisHealth: jest.fn(() =>
      Promise.resolve({
        status: 'up',
        mode: 'discrete',
        endpoint: '127.0.0.1:6379',
        database: 0,
        response: 'PONG',
      }),
    ),
    getDatabaseHealth: jest.fn(() =>
      Promise.resolve({
        status: 'up',
        driver: 'postgres',
        database: 'postgres',
      }),
    ),
    getProvidersHealth: jest.fn(() =>
      Promise.resolve([
        {
          providerId: 'provider-1',
          name: 'Zaiwen',
          isActive: true,
          isConfigured: true,
          status: 'up',
          cached: true,
          checkedAt: '2026-03-27T15:00:00.000Z',
          responseTimeMs: 100,
          modelCount: 3,
        },
      ]),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: appService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('欢迎访问');
  });

  it('/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    const body = response.body as {
      status: string;
      redis?: { response?: string };
    };
    expect(body.status).toBe('ok');
    expect(body.redis?.response).toBe('PONG');
  });

  it('/health/providers (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/providers?timeoutMs=5000&cacheTtlSeconds=60')
      .expect(200);

    const body = response.body as Array<{ name: string; cached: boolean }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]?.name).toBe('Zaiwen');
    expect(body[0]?.cached).toBe(true);
  });

  it('/health?includeProviders=true (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health?includeProviders=true&providerCacheTtlSeconds=60')
      .expect(200);

    const body = response.body as {
      status: string;
      providers?: Array<{ name: string }>;
    };
    expect(body.status).toBe('ok');
    expect(body.providers?.[0]?.name).toBe('Zaiwen');
  });
});
