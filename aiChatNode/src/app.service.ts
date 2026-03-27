import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RedisService } from './common/redis/redis.service';
import {
  AIClientService,
  type ProviderHealthStatus,
} from './modules/chat/services/ai-client.service';

export interface DatabaseHealthStatus {
  status: 'up' | 'down';
  driver: string;
  host?: string;
  port?: number;
  database: string;
  responseTimeMs?: number;
  message?: string;
}

export interface AppHealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  database: DatabaseHealthStatus;
  redis: Awaited<ReturnType<RedisService['getHealthStatus']>>;
  providers?: ProviderHealthStatus[];
}

@Injectable()
export class AppService {
  constructor(
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly aiClientService: AIClientService,
  ) {}

  getHello(): string {
    return '欢迎访问';
  }

  async getHealth(options?: {
    includeProviders?: boolean;
    providerTimeoutMs?: number;
    providerCacheTtlSeconds?: number;
    bypassProviderCache?: boolean;
  }): Promise<AppHealthStatus> {
    const [database, redis] = await Promise.all([
      this.getDatabaseHealth(),
      this.redisService.getHealthStatus(),
    ]);

    let providers: ProviderHealthStatus[] | undefined;
    if (options?.includeProviders) {
      providers = await this.aiClientService.checkProvidersHealth({
        timeoutMs: options.providerTimeoutMs,
        cacheTtlSeconds: options.providerCacheTtlSeconds,
        bypassCache: options.bypassProviderCache,
      });
    }

    const hasProviderDown = !!providers?.some(
      (provider) => provider.status === 'down',
    );

    return {
      status:
        database.status === 'up' && redis.status === 'up' && !hasProviderDown
          ? 'ok'
          : 'error',
      timestamp: new Date().toISOString(),
      database,
      redis,
      ...(providers ? { providers } : {}),
    };
  }

  async getRedisHealth() {
    return this.redisService.getHealthStatus();
  }

  async getDatabaseHealth(): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();
    const driver = 'postgres';
    const host = this.configService.get<string>('DB_HOST') || 'localhost';
    const port = Number(this.configService.get<string>('DB_PORT') || 5432);
    const database =
      this.configService.get<string>('DB_DATABASE') || 'postgres';

    if (!this.dataSource.isInitialized) {
      return {
        status: 'down',
        driver,
        host,
        port,
        database,
        message: '数据库连接尚未初始化',
      };
    }

    try {
      await this.dataSource.query('SELECT 1');

      return {
        status: 'up',
        driver,
        host,
        port,
        database,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'down',
        driver,
        host,
        port,
        database,
        responseTimeMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getProvidersHealth(options?: {
    timeoutMs?: number;
    cacheTtlSeconds?: number;
    bypassCache?: boolean;
  }): Promise<ProviderHealthStatus[]> {
    return this.aiClientService.checkProvidersHealth({
      timeoutMs: options?.timeoutMs,
      cacheTtlSeconds: options?.cacheTtlSeconds,
      bypassCache: options?.bypassCache,
    });
  }
}
