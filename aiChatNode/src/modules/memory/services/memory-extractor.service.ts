import { Injectable, Logger } from '@nestjs/common';
import type { MemoryCategory } from '../entities/agent-daily-memory.entity';
import { EmbeddingService } from '../../knowledge-base/services/embedding.service';
import { MemoryLlmService } from './memory-llm.service';
import { MemoryVectorStoreService } from './memory-vector-store.service';

interface ExtractedItem {
  category: MemoryCategory;
  content: string;
}

interface ExtractionResult extends Record<string, unknown> {
  items: ExtractedItem[];
}

/**
 * 跨会话日常工作记忆异步提取器（Layer 2）
 */
@Injectable()
export class MemoryExtractorService {
  private readonly logger = new Logger(MemoryExtractorService.name);

  constructor(
    private readonly memoryLlmService: MemoryLlmService,
    private readonly memoryVectorStore: MemoryVectorStoreService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * 从会话多轮对话中异步提取事实与情境记忆，并经语义去重后写入
   */
  async extractFromSession(
    userId: string,
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<number> {
    if (!messages || messages.length < 2) {
      return 0;
    }

    try {
      const contextSlice = messages
        .slice(-10)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n\n');

      const systemPrompt = `你是一个精准的记忆事实提取器。请分析以下对话，提取其中值得长期沉淀的关键信息。
提取规则：
1. category 仅支持以下 4 类：
   - "preference": 用户的显式偏好或习惯（如编程语言、代码规范、交付格式）。
   - "fact": 用户披露的客观事实、环境、项目名、技术栈或业务规则。
   - "decision": 本次会话达成的技术决策或设计共识。
   - "todo": 待办任务或下一步计划。
2. 过滤无意义问候、闲聊或过渡废话。若无值得记忆的信息，items 返回空数组 []。
3. 每条 content 必须保持简练、独立完整，不可出现人称模糊。
4. 必须输出严格合法的 JSON 对象，格式为：{"items": [{"category": "...", "content": "..."}]}`;

      const parsed = await this.memoryLlmService.completeJson<ExtractionResult>(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextSlice },
        ],
        {
          preferredModelEnvKey: 'MEMORY_EXTRACTOR_MODEL',
          temperature: 0.1,
        },
      );

      const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
      const validCategories: MemoryCategory[] = [
        'fact',
        'preference',
        'decision',
        'todo',
      ];
      const normalizedItems = rawItems
        .filter((item) => typeof item?.content === 'string')
        .map((item) => ({
          category: validCategories.includes(item.category)
            ? item.category
            : ('fact' as MemoryCategory),
          content: item.content.trim(),
        }))
        .filter((item) => item.content.length >= 2);

      if (normalizedItems.length === 0) return 0;

      const dateKey = new Date().toISOString().slice(0, 10);
      const embeddings = await this.embeddingService.embedDocuments(
        normalizedItems.map((i) => i.content),
      );

      let mergedCount = 0;
      let createdCount = 0;
      for (let idx = 0; idx < normalizedItems.length; idx++) {
        const item = normalizedItems[idx];
        const result = await this.memoryVectorStore.upsertDailyMemory(userId, {
          sessionId,
          dateKey,
          category: item.category,
          content: item.content,
          embedding: embeddings[idx] ?? null,
        });
        if (result.action === 'merged') {
          mergedCount += 1;
        } else {
          createdCount += 1;
        }
      }

      this.logger.log(
        `用户 ${userId} 日常记忆沉淀完成（新建 ${createdCount}，语义合并 ${mergedCount}）`,
      );
      return normalizedItems.length;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`记忆提取执行失败: ${errMsg}`, errStack);
      return 0;
    }
  }
}
