import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentCoreProfile } from '../entities/agent-core-profile.entity';
import { AgentDailyMemory } from '../entities/agent-daily-memory.entity';
import { MemoryExtractorService } from './memory-extractor.service';
import { MemoryDistillerService } from './memory-distiller.service';
import { MemoryVectorStoreService } from './memory-vector-store.service';

export interface RecalledMemoryItem {
  id: string;
  category: string;
  content: string;
  dateKey: string;
  score: number;
}

export interface MemoryInjectionResult {
  promptAddition: string;
  recalledMemories: RecalledMemoryItem[];
  hasCoreProfile: boolean;
}

/**
 * 分层记忆召回与上下文动态注入服务
 */
@Injectable()
export class MemoryContextService {
  private readonly logger = new Logger(MemoryContextService.name);
  private readonly idleTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(AgentCoreProfile)
    private readonly coreProfileRepo: Repository<AgentCoreProfile>,
    @InjectRepository(AgentDailyMemory)
    private readonly dailyMemoryRepo: Repository<AgentDailyMemory>,
    private readonly extractorService: MemoryExtractorService,
    private readonly distillerService: MemoryDistillerService,
    private readonly memoryVectorStore: MemoryVectorStoreService,
  ) {}

  /**
   * 构建分层记忆 Prompt 注入内容 (Layer 3 核心画像常驻 + Layer 2 pgvector+pg_trgm Top-3 召回)
   */
  async buildMemoryInjection(
    userId: string,
    currentQuery?: string,
  ): Promise<MemoryInjectionResult> {
    const parts: string[] = [];
    const recalledMemories: RecalledMemoryItem[] = [];
    let hasCoreProfile = false;

    try {
      const profile = await this.coreProfileRepo.findOne({ where: { userId } });
      if (profile && profile.rawSummary.trim()) {
        hasCoreProfile = true;
        parts.push(
          `<user_core_profile>\n# 用户核心长期画像与工作规则（永久生效）：\n${profile.rawSummary.trim()}\n</user_core_profile>`,
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`获取核心画像失败: ${errMsg}`);
    }

    if (currentQuery && currentQuery.trim().length >= 2) {
      try {
        const searchResult = await this.memoryVectorStore.searchDailyMemories(
          userId,
          currentQuery.trim(),
          {
            limit: 3,
            forAutoRecall: true,
          },
        );

        if (searchResult.items.length > 0) {
          for (const item of searchResult.items) {
            recalledMemories.push({
              id: item.id,
              category: item.category,
              content: item.content,
              dateKey: item.dateKey,
              score: item.score ?? 0,
            });
          }

          const memoryListStr = recalledMemories
            .map((m) => `- [${m.dateKey} · ${m.category}] ${m.content}`)
            .join('\n');
          parts.push(
            `<relevant_past_memory>\n# 检索到的相关历史工作与事实记忆（按需参考）：\n${memoryListStr}\n</relevant_past_memory>`,
          );
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`日常情境记忆召回异常: ${errMsg}`);
      }
    }

    return {
      promptAddition: parts.join('\n\n'),
      recalledMemories,
      hasCoreProfile,
    };
  }

  /**
   * 记录会话活动并重置空闲防抖定时器（空闲 3 分钟后静默触发提取与增量蒸馏）
   */
  recordSessionActivity(
    userId: string,
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
  ): void {
    const key = `${userId}:${sessionId}`;
    const existing = this.idleTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // 3 分钟空闲防抖，避免对话高频往返期间反复触发模型提取
    const timer = setTimeout(() => {
      this.idleTimers.delete(key);
      void this.runIdleExtraction(userId, sessionId, messages);
    }, 180000);

    this.idleTimers.set(key, timer);
  }

  private async runIdleExtraction(
    userId: string,
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    try {
      const extractedCount = await this.extractorService.extractFromSession(
        userId,
        sessionId,
        messages,
      );
      if (extractedCount > 0) {
        const unarchivedCount = await this.dailyMemoryRepo.count({
          where: { userId, isArchived: false },
        });
        if (unarchivedCount >= 8) {
          await this.distillerService.distillCoreProfile(userId);
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`异步会话记忆提取失败: ${errMsg}`);
    }
  }

  /**
   * 手动立即可靠触发某会话的记忆提取
   */
  async triggerImmediateSessionExtract(
    userId: string,
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<number> {
    const count = await this.extractorService.extractFromSession(
      userId,
      sessionId,
      messages,
    );
    if (count > 0) {
      await this.distillerService.distillCoreProfile(userId);
    }
    return count;
  }
}
