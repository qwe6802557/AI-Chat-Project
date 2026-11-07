import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { AgentCoreProfile } from '../entities/agent-core-profile.entity';
import { AgentDailyMemory } from '../entities/agent-daily-memory.entity';

interface DistilledProfilePayload {
  preferences: Record<string, any>;
  facts: Record<string, any>;
  rawSummary: string;
}

/**
 * 长期核心画像深度蒸馏引擎（Layer 3）
 */
@Injectable()
export class MemoryDistillerService {
  private readonly logger = new Logger(MemoryDistillerService.name);
  private openaiClient: OpenAI | null = null;
  private readonly modelName: string;

  constructor(
    @InjectRepository(AgentCoreProfile)
    private readonly coreProfileRepo: Repository<AgentCoreProfile>,
    @InjectRepository(AgentDailyMemory)
    private readonly dailyMemoryRepo: Repository<AgentDailyMemory>,
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
      'MEMORY_DISTILLER_MODEL',
      'gemini-3.8-flash-low',
    );
  }

  /**
   * 触发用户日常记忆向核心画像的深度蒸馏
   */
  async distillCoreProfile(userId: string, force = false): Promise<AgentCoreProfile | null> {
    const unarchived = await this.dailyMemoryRepo.find({
      where: { userId, isArchived: false },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    if (unarchived.length === 0 && !force) {
      return null;
    }

    // 获取或初始化 CoreProfile
    let profile = await this.coreProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.coreProfileRepo.create({
        userId,
        preferences: {},
        facts: {},
        rawSummary: '',
        version: 1,
      });
      profile = await this.coreProfileRepo.save(profile);
    }

    if (unarchived.length === 0) {
      return profile;
    }

    if (!this.openaiClient) {
      this.logger.warn('Gemini 客户端未配置，跳过画像蒸馏');
      return profile;
    }

    try {
      const memoryItemsText = unarchived
        .map((m) => `[${m.category}] ${m.content} (${m.dateKey})`)
        .join('\n');

      const systemPrompt = `你是一个高级用户画像蒸馏引擎。请根据用户已有的核心画像以及最新收集的未归档日常记忆，提炼、合并并更新为一份长期稳定的用户画像。
要求：
1. 冲突消解：若最新记忆与历史画像冲突，以最新记忆为准（如习惯或约定的更新）。
2. 去粗取精：剥离临时待办与一次性细节，只提炼长效偏好（preferences）与长期关键事实（facts）。
3. 严格生成一个精炼的 Markdown 格式摘要（rawSummary，200~300 字以内），将直接注入 System Prompt。
4. 输出严格合法的 JSON 对象，格式规范为：
{
  "preferences": { "key": "value" },
  "facts": { "key": "value" },
  "rawSummary": "### 用户核心偏好与规则\\n- 偏好..."
}`;

      const userPrompt = `【当前核心画像】
Preferences: ${JSON.stringify(profile.preferences)}
Facts: ${JSON.stringify(profile.facts)}
Existing Raw Summary: ${profile.rawSummary || '暂无'}

【待蒸馏的新记忆碎片】
${memoryItemsText}`;

      const response = await this.openaiClient.chat.completions.create({
        model: this.modelName,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const rawJson = response.choices[0]?.message?.content?.trim();
      if (!rawJson) return profile;

      const distilled: DistilledProfilePayload = JSON.parse(rawJson);

      profile.preferences = distilled.preferences || profile.preferences;
      profile.facts = distilled.facts || profile.facts;
      profile.rawSummary = distilled.rawSummary || profile.rawSummary;
      profile.version += 1;

      const saved = await this.coreProfileRepo.save(profile);

      // 批量将处理过的 daily memories 标记为已归档
      const ids = unarchived.map((m) => m.id);
      await this.dailyMemoryRepo
        .createQueryBuilder()
        .update(AgentDailyMemory)
        .set({ isArchived: true })
        .whereInIds(ids)
        .execute();

      this.logger.log(`成功为用户 ${userId} 完成核心画像蒸馏 (版本: v${saved.version})`);
      return saved;
    } catch (err: any) {
      this.logger.error(`记忆蒸馏失败: ${err.message}`, err.stack);
      return profile;
    }
  }
}
