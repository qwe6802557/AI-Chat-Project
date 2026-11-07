import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { AgentDailyMemory, MemoryCategory } from '../entities/agent-daily-memory.entity';
import { EmbeddingService } from '../../knowledge-base/services/embedding.service';

interface ExtractedItem {
  category: MemoryCategory;
  content: string;
}

interface ExtractionResult {
  items: ExtractedItem[];
}

/**
 * 跨会话日常工作记忆异步提取器（Layer 2）
 */
@Injectable()
export class MemoryExtractorService {
  private readonly logger = new Logger(MemoryExtractorService.name);
  private openaiClient: OpenAI | null = null;
  private readonly modelName: string;

  constructor(
    @InjectRepository(AgentDailyMemory)
    private readonly dailyMemoryRepo: Repository<AgentDailyMemory>,
    private readonly embeddingService: EmbeddingService,
    private readonly configService: ConfigService,
  ) {
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      process.env.GEMINI_API_KEY ||
      '';
    const baseURL =
      this.configService.get<string>('GEMINI_BASE_URL') ||
      process.env.GEMINI_BASE_URL ||
      '';

    if (apiKey && baseURL) {
      this.openaiClient = new OpenAI({ apiKey, baseURL });
    }
    this.modelName = this.configService.get<string>(
      'MEMORY_EXTRACTOR_MODEL',
      'gemini-3.8-flash-low',
    );
  }

  /**
   * 从会话多轮对话中异步提取事实与情境记忆
   */
  async extractFromSession(
    userId: string,
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<number> {
    if (!messages || messages.length < 2) {
      return 0;
    }

    if (!this.openaiClient) {
      this.logger.warn('Gemini 客户端未配置，跳过记忆异步抽取');
      return 0;
    }

    try {
      // 提取对话关键内容（至多最近 10 条）
      const contextSlice = messages.slice(-10).map((m) => `${m.role}: ${m.content}`).join('\n\n');

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

      const response = await this.openaiClient.chat.completions.create({
        model: this.modelName,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextSlice },
        ],
      });

      const rawJson = response.choices[0]?.message?.content?.trim();
      if (!rawJson) return 0;

      const parsed: ExtractionResult = JSON.parse(rawJson);
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      if (items.length === 0) return 0;

      // 计算今天日期键 (YYYY-MM-DD)
      const now = new Date();
      const dateKey = now.toISOString().slice(0, 10);

      // 批量计算向量
      const contents = items.map((i) => i.content.trim()).filter(Boolean);
      let embeddings: number[][] = [];
      try {
        embeddings = await this.embeddingService.embedDocuments(contents);
      } catch (embErr: any) {
        this.logger.warn(`向量生成失败，将以无向量模式入库: ${embErr.message}`);
      }

      // 存入每日记忆表
      const entitiesToSave: AgentDailyMemory[] = [];
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const validCategories: MemoryCategory[] = ['fact', 'preference', 'decision', 'todo'];
        const category: MemoryCategory = validCategories.includes(item.category)
          ? item.category
          : 'fact';

        const entity = this.dailyMemoryRepo.create({
          userId,
          sessionId,
          dateKey,
          category,
          content: item.content,
          embedding: embeddings[idx] ?? null,
          isArchived: false,
        });
        entitiesToSave.push(entity);
      }

      if (entitiesToSave.length > 0) {
        await this.dailyMemoryRepo.save(entitiesToSave);
        this.logger.log(`成功为用户 ${userId} 沉淀 ${entitiesToSave.length} 条每日情境记忆`);
      }

      return entitiesToSave.length;
    } catch (err: any) {
      this.logger.error(`记忆提取执行失败: ${err.message}`, err.stack);
      return 0;
    }
  }
}
