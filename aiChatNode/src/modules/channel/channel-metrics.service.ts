import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

export interface ChannelMetrics {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  errorCount: number;
}

/**
 * 通道实例运行指标监控服务 (基于 Redis 24 小时滑动窗口统计)
 */
@Injectable()
export class ChannelMetricsService {
  private readonly logger = new Logger(ChannelMetricsService.name);
  private readonly ttlSeconds = 86400;

  constructor(private readonly redisService: RedisService) {}

  private getMetricKey(instanceId: string): string {
    return `channel:metrics:${instanceId}`;
  }

  /**
   * 记录消息处理成功与响应延迟
   */
  async recordSuccess(instanceId: string, latencyMs: number): Promise<void> {
    const key = this.getMetricKey(instanceId);
    try {
      await Promise.all([
        this.redisService.hIncrBy(key, 'totalRequests', 1),
        this.redisService.hIncrBy(key, 'successCount', 1),
        this.redisService.hIncrBy(key, 'totalLatencyMs', Math.max(0, Math.round(latencyMs))),
      ]);
      await this.redisService.expire(key, this.ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`记录通道指标异常: ${err.message}`);
    }
  }

  /**
   * 记录消息处理异常失败
   */
  async recordError(instanceId: string): Promise<void> {
    const key = this.getMetricKey(instanceId);
    try {
      await Promise.all([
        this.redisService.hIncrBy(key, 'totalRequests', 1),
        this.redisService.hIncrBy(key, 'errorCount', 1),
      ]);
      await this.redisService.expire(key, this.ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`记录通道错误指标异常: ${err.message}`);
    }
  }

  /**
   * 获取指定通道实例最近 24 小时汇总指标
   */
  async getMetrics(instanceId: string): Promise<ChannelMetrics> {
    const key = this.getMetricKey(instanceId);
    try {
      const data = await this.redisService.hGetAll(key);
      const totalRequests = Number.parseInt(data.totalRequests || '0', 10) || 0;
      const errorCount = Number.parseInt(data.errorCount || '0', 10) || 0;
      const successCount = Number.parseInt(data.successCount || '0', 10) || 0;
      const totalLatencyMs = Number.parseInt(data.totalLatencyMs || '0', 10) || 0;

      const successRate =
        totalRequests > 0
          ? Number(((successCount / totalRequests) * 100).toFixed(1))
          : 100;
      const avgLatencyMs =
        successCount > 0 ? Math.round(totalLatencyMs / successCount) : 0;

      return {
        totalRequests,
        successRate,
        avgLatencyMs,
        errorCount,
      };
    } catch (err: any) {
      this.logger.warn(`读取通道指标异常: ${err.message}`);
      return {
        totalRequests: 0,
        successRate: 100,
        avgLatencyMs: 0,
        errorCount: 0,
      };
    }
  }
}
