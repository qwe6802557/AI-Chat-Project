import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIClientService } from '../../chat/services/ai-client.service';
import type { ChatMessage } from '../../chat/types/completion.types';
import { extractJsonFromLlmOutput } from '../utils/memory-json.util';

export interface CompleteJsonOptions {
  preferredModelEnvKey?: string;
  temperature?: number;
}

/**
 * 记忆引擎统一大模型调度器（复用 AIClientService 熔断与故障转移）
 */
@Injectable()
export class MemoryLlmService {
  constructor(
    @Inject(forwardRef(() => AIClientService))
    private readonly aiClientService: AIClientService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 按环境变量优先级与线上可用模型状态动态路由，执行结构化 JSON 补全
   */
  async completeJson<T extends Record<string, unknown>>(
    messages: ChatMessage[],
    options?: CompleteJsonOptions,
  ): Promise<T> {
    const modelId = await this.resolveChatModelId(
      options?.preferredModelEnvKey,
    );
    const completion = await this.aiClientService.createChatCompletion(
      modelId,
      messages,
      {
        temperature: options?.temperature ?? 0.1,
      },
    );

    return extractJsonFromLlmOutput<T>(completion.content);
  }

  /**
   * 解析当前可用的最优对话模型 ID（避免死绑下线或停用模型）
   */
  async resolveChatModelId(preferredModelEnvKey?: string): Promise<string> {
    const activeModels = await this.aiClientService.getAvailableModels();
    const chatModels = activeModels.filter(
      (model) =>
        model.isActive &&
        model.category === 'chat' &&
        model.provider?.isActive !== false,
    );

    if (chatModels.length === 0) {
      throw new Error('当前无可用对话模型，无法执行记忆提取或画像蒸馏');
    }

    const activeIds = new Set(chatModels.map((model) => model.modelId));
    const candidateKeys = [
      preferredModelEnvKey,
      'MEMORY_LLM_MODEL',
      'DEFAULT_CHAT_MODEL',
    ].filter((key): key is string => Boolean(key));

    for (const envKey of candidateKeys) {
      const configured =
        this.configService.get<string>(envKey) || process.env[envKey];
      const trimmed = configured?.trim();
      if (trimmed && activeIds.has(trimmed)) {
        return trimmed;
      }
    }

    const sorted = [...chatModels].sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      return a.sortOrder - b.sortOrder;
    });

    return sorted[0].modelId;
  }
}
