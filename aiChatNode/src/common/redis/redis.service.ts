import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType, type SetOptions } from 'redis';

export interface RedisHealthStatus {
  status: 'up' | 'down';
  mode: 'url' | 'discrete';
  endpoint: string;
  database: number;
  response?: string;
  responseTimeMs?: number;
  message?: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClientType;
  private readonly redisUrl?: string;
  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisDb: number;
  private readonly connectionMode: 'url' | 'discrete';

  constructor(private readonly configService: ConfigService) {
    this.redisUrl = this.configService.get<string>('REDIS_URL') || undefined;
    this.redisHost =
      this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
    this.redisPort = this.parsePositiveInteger(
      'REDIS_PORT',
      this.configService.get<string>('REDIS_PORT'),
      6379,
    );
    this.redisDb = this.parseNonNegativeInteger(
      'REDIS_DB',
      this.configService.get<string>('REDIS_DB'),
      0,
    );
    this.connectionMode = this.redisUrl ? 'url' : 'discrete';

    this.validateRedisConfig();

    this.client = this.redisUrl
      ? createClient({
          url: this.redisUrl,
          socket: {
            connectTimeout: 5000,
            reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
          },
        })
      : createClient({
          socket: {
            host: this.redisHost,
            port: this.redisPort,
            connectTimeout: 5000,
            reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
          },
          username:
            this.configService.get<string>('REDIS_USERNAME') || undefined,
          password:
            this.configService.get<string>('REDIS_PASSWORD') || undefined,
          database: this.redisDb,
        });

    this.client.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Redis 客户端错误: ${message}`, stack);
    });
  }

  private parsePositiveInteger(
    key: string,
    rawValue: string | undefined,
    fallback: number,
  ): number {
    if (!rawValue) {
      return fallback;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      throw new Error(`${key} 必须是大于 0 的整数`);
    }

    return parsedValue;
  }

  private parseNonNegativeInteger(
    key: string,
    rawValue: string | undefined,
    fallback: number,
  ): number {
    if (!rawValue) {
      return fallback;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
      throw new Error(`${key} 必须是大于或等于 0 的整数`);
    }

    return parsedValue;
  }

  private validateRedisConfig(): void {
    if (this.redisUrl) {
      try {
        const parsedUrl = new URL(this.redisUrl);
        if (!['redis:', 'rediss:'].includes(parsedUrl.protocol)) {
          throw new Error('协议必须是 redis:// 或 rediss://');
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`REDIS_URL 配置无效: ${reason}`);
      }
      return;
    }

    if (!this.redisHost.trim()) {
      throw new Error('REDIS_HOST 不能为空');
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.client.isOpen) {
      return;
    }

    await this.client.connect();
    const response = await this.client.ping();
    if (response !== 'PONG') {
      throw new Error(`Redis 启动检查失败: ping=${response}`);
    }

    this.logger.log('Redis 连接成功');
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }

    await this.client.quit();
  }

  async set(
    key: string,
    value: string,
    options?: SetOptions,
  ): Promise<string | null> {
    return this.client.set(key, value, options);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async getDel(key: string): Promise<string | null> {
    return this.client.getDel(key);
  }

  async del(key: string | string[]): Promise<number> {
    return Array.isArray(key) ? this.client.del(key) : this.client.del(key);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async getHealthStatus(): Promise<RedisHealthStatus> {
    const startTime = Date.now();
    const endpoint = this.redisUrl
      ? this.describeRedisUrl(this.redisUrl)
      : `${this.redisHost}:${this.redisPort}`;

    try {
      const response = await this.ping();
      if (response !== 'PONG') {
        return {
          status: 'down',
          mode: this.connectionMode,
          endpoint,
          database: this.redisDb,
          response,
          responseTimeMs: Date.now() - startTime,
          message: `Redis 健康检查失败: ping=${response}`,
        };
      }

      return {
        status: 'up',
        mode: this.connectionMode,
        endpoint,
        database: this.redisDb,
        response,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'down',
        mode: this.connectionMode,
        endpoint,
        database: this.redisDb,
        responseTimeMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private describeRedisUrl(redisUrl: string): string {
    try {
      const parsedUrl = new URL(redisUrl);
      return `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
    } catch {
      return redisUrl;
    }
  }
}
