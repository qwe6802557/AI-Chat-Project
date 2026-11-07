import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentCoreProfile } from '../entities/agent-core-profile.entity';
import { AgentDailyMemory } from '../entities/agent-daily-memory.entity';
import { EmbeddingService } from '../../knowledge-base/services/embedding.service';
import { MemoryExtractorService } from './memory-extractor.service';
import { MemoryDistillerService } from './memory-distiller.service';

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
    private readonly embeddingService: EmbeddingService,
    private readonly extractorService: MemoryExtractorService,
    private readonly distillerService: MemoryDistillerService,
  ) {}

  /**
   * 构建分层记忆 Prompt 注入内容 (Layer 3 核心画像常驻 + Layer 2 语义 Top-3 召回)
   */
  async buildMemoryInjection(
    userId: string,
    currentQuery?: string,
  ): Promise<MemoryInjectionResult> {
    const parts: string[] = [];
    const recalledMemories: RecalledMemoryItem[] = [];
    let hasCoreProfile = false;

    // 1. Layer 3 核心画像注入
    try {
      const profile = await this.coreProfileRepo.findOne({ where: { userId } });
      if (profile && profile.rawSummary.trim()) {
        hasCoreProfile = true;
        parts.push(
          `<user_core_profile>\n# 用户核心长期画像与工作规则（永久生效）：\n${profile.rawSummary.trim()}\n</user_core_profile>`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`获取核心画像失败: ${err.message}`);
    }

    // 2. Layer 2 动态情境记忆向量召回
    if (currentQuery && currentQuery.trim().length >= 2) {
      try {
        const queryVector = await this.embeddingService.embedQuery(currentQuery.trim());
        if (queryVector && queryVector.length > 0) {
          const candidates = await this.dailyMemoryRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: 60,
          });

          const scored = candidates
            .filter((c) => c.embedding && c.embedding.length === queryVector.length)
            .map((c) => ({
              id: c.id,
              category: c.category,
              content: c.content,
              dateKey: c.dateKey,
              score: this.cosineSimilarity(queryVector, c.embedding!),
            }))
            .filter((item) => item.score >= 0.45)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

          if (scored.length > 0) {
            recalledMemories.push(...scored);
            const memoryListStr = scored
              .map((m) => `- [${m.dateKey} · ${m.category}] ${m.content}`)
              .join('\n');
            parts.push(
              `<relevant_past_memory>\n# 检索到的相关历史工作与事实记忆（按需参考）：\n${memoryListStr}\n</relevant_past_memory>`,
            );
          }
        }
      } catch (err: any) {
        this.logger.warn(`日常情境记忆召回降级: ${err.message}`);
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

    // 设置 3 分钟 (180,000ms) 空闲防抖
    const timer = setTimeout(async () => {
      this.idleTimers.delete(key);
      try {
        const extractedCount = await this.extractorService.extractFromSession(
          userId,
          sessionId,
          messages,
        );
        if (extractedCount > 0) {
          // 检查未归档数量，若超阈值触发长期核心画像蒸馏
          const unarchivedCount = await this.dailyMemoryRepo.count({
            where: { userId, isArchived: false },
          });
          if (unarchivedCount >= 8) {
            await this.distillerService.distillCoreProfile(userId);
          }
        }
      } catch (err: any) {
        this.logger.error(`异步会话记忆提取失败: ${err.message}`);
      }
    }, 180000);

    this.idleTimers.set(key, timer);
  }

  /**
   * 手动立即可靠触发某会话的记忆提取
   */
  async triggerImmediateSessionExtract(
    userId: string,
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<number> {
    const count = await this.extractorService.extractFromSession(userId, sessionId, messages);
    if (count > 0) {
      await this.distillerService.distillCoreProfile(userId);
    }
    return count;
  }

  /**
   * 向量余弦相似度计算
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
