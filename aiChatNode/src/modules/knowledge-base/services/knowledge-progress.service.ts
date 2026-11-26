import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { RedisService } from '../../../common/redis/redis.service';
import type { DocumentProgressEvent } from '../constants/knowledge-queue.constants';

export type DocumentProgressListener = (event: DocumentProgressEvent) => void;

/**
 * 知识库文档解析进度 Pub/Sub 广播与多连接共享订阅器
 */
@Injectable()
export class KnowledgeProgressService implements OnModuleDestroy {
  private readonly logger = new Logger(KnowledgeProgressService.name);
  private readonly listeners = new Map<string, Set<DocumentProgressListener>>();
  private subscriberPromise: Promise<RedisClientType> | null = null;
  private subscriberClient: RedisClientType | null = null;

  constructor(private readonly redisService: RedisService) {}

  getChannel(userId: string, knowledgeBaseId: string): string {
    return `kb:progress:${userId}:${knowledgeBaseId}`;
  }

  /**
   * 广播单篇文档解析状态与百分比到对应知识库频道
   */
  async publish(event: DocumentProgressEvent): Promise<void> {
    const channel = this.getChannel(event.userId, event.knowledgeBaseId);
    try {
      await this.redisService.publish(channel, JSON.stringify(event));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`发布文档进度事件失败 [${channel}]: ${msg}`);
    }
  }

  /**
   * 订阅指定知识库的文档进度事件（共享单条 Redis 订阅连接）
   */
  async subscribe(
    userId: string,
    knowledgeBaseId: string,
    listener: DocumentProgressListener,
  ): Promise<() => Promise<void>> {
    const channel = this.getChannel(userId, knowledgeBaseId);
    const subscriber = await this.ensureSubscriber();

    let channelSet = this.listeners.get(channel);
    const isFirstListener = !channelSet;
    if (!channelSet) {
      channelSet = new Set<DocumentProgressListener>();
      this.listeners.set(channel, channelSet);
    }
    channelSet.add(listener);

    if (isFirstListener) {
      await subscriber.subscribe(channel, (rawPayload) => {
        this.dispatchMessage(channel, rawPayload);
      });
    }

    return async () => {
      const activeSet = this.listeners.get(channel);
      if (!activeSet) return;
      activeSet.delete(listener);
      if (activeSet.size === 0) {
        this.listeners.delete(channel);
        if (this.subscriberClient?.isOpen) {
          await this.subscriberClient.unsubscribe(channel);
        }
      }
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.listeners.clear();
    if (this.subscriberClient?.isOpen) {
      await this.subscriberClient.quit();
    }
    this.subscriberClient = null;
    this.subscriberPromise = null;
  }

  private async ensureSubscriber(): Promise<RedisClientType> {
    if (this.subscriberClient?.isOpen) {
      return this.subscriberClient;
    }
    if (!this.subscriberPromise) {
      this.subscriberPromise = this.redisService
        .createSubscriberClient()
        .then((client) => {
          this.subscriberClient = client;
          return client;
        })
        .catch((err) => {
          this.subscriberPromise = null;
          throw err;
        });
    }
    return this.subscriberPromise;
  }

  private dispatchMessage(channel: string, rawPayload: string): void {
    const activeSet = this.listeners.get(channel);
    if (!activeSet || activeSet.size === 0) return;

    let parsed: DocumentProgressEvent;
    try {
      parsed = JSON.parse(rawPayload) as DocumentProgressEvent;
    } catch {
      return;
    }

    for (const listener of activeSet) {
      try {
        listener(parsed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`SSE 监听器分发异常: ${msg}`);
      }
    }
  }
}
