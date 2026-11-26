import type { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';

function parsePositiveInt(
  key: string,
  rawValue: string | undefined,
  fallback: number,
): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} 必须是大于 0 的整数`);
  }
  return parsed;
}

function parseNonNegativeInt(
  key: string,
  rawValue: string | undefined,
  fallback: number,
): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} 必须是大于或等于 0 的整数`);
  }
  return parsed;
}

/**
 * 构造 BullMQ 使用的 Redis 连接配置（显式禁用请求重试上限以支持阻塞队列）
 */
export function buildBullRedisConnection(
  configService: ConfigService,
): ConnectionOptions {
  const redisUrl = configService.get<string>('REDIS_URL');
  if (redisUrl) {
    const parsedUrl = new URL(redisUrl);
    if (!['redis:', 'rediss:'].includes(parsedUrl.protocol)) {
      throw new Error('REDIS_URL 协议必须是 redis:// 或 rediss://');
    }
    const dbFromPath = parsedUrl.pathname.replace(/^\//, '');
    return {
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
      username: parsedUrl.username
        ? decodeURIComponent(parsedUrl.username)
        : undefined,
      password: parsedUrl.password
        ? decodeURIComponent(parsedUrl.password)
        : undefined,
      db: dbFromPath ? parseNonNegativeInt('REDIS_DB', dbFromPath, 0) : 0,
      tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: configService.get<string>('REDIS_HOST') || '127.0.0.1',
    port: parsePositiveInt(
      'REDIS_PORT',
      configService.get<string>('REDIS_PORT'),
      6379,
    ),
    username: configService.get<string>('REDIS_USERNAME') || undefined,
    password: configService.get<string>('REDIS_PASSWORD') || undefined,
    db: parseNonNegativeInt(
      'REDIS_DB',
      configService.get<string>('REDIS_DB'),
      0,
    ),
    maxRetriesPerRequest: null,
  };
}
