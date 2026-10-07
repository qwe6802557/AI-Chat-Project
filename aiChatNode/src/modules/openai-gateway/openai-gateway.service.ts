import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { AIClientService } from '../chat/services/ai-client.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { OpenAiChatCompletionDto } from './dto/openai-chat-completion.dto';
import type { ChatMessage } from '../chat/types/completion.types';
import { sanitizeAssistantContent } from '../chat/utils/assistant-content.util';

@Injectable()
export class OpenaiGatewayService {
  private readonly logger = new Logger(OpenaiGatewayService.name);
  private readonly defaultFallbackModel = 'glm-4-flash';

  constructor(
    private readonly aiClientService: AIClientService,
    private readonly aiModelService: AiModelService,
  ) {}

  /**
   * 智能解析并映射模型 ID（支持别名容错与平滑回退）
   */
  async resolveModelId(requestedModel?: string): Promise<string> {
    if (!requestedModel || typeof requestedModel !== 'string') {
      return this.defaultFallbackModel;
    }

    const trimmed = requestedModel.trim();
    const lower = trimmed.toLowerCase();

    // 1. 深度思考模型别名
    if (
      lower.includes('deepseek-reasoner') ||
      lower.includes('deepseek-r1') ||
      lower === 'r1'
    ) {
      return 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B';
    }

    // 2. 代码/通义模型别名
    if (
      lower.includes('qwen2.5-coder') ||
      lower.includes('qwen-coder') ||
      lower.includes('coder')
    ) {
      return 'Qwen/Qwen2.5-Coder-7B-Instruct';
    }

    // 3. 通用写作/极速免费模型别名
    if (
      lower === 'deepseek-chat' ||
      lower === 'gpt-3.5-turbo' ||
      lower === 'gpt-4o-mini' ||
      lower === 'default'
    ) {
      return this.defaultFallbackModel;
    }

    // 4. 尝试精确查找数据库已启用的模型
    try {
      const existing = await this.aiModelService.findByModelIdOrNull(trimmed, false);
      if (existing && existing.isActive) {
        return trimmed;
      }
    } catch {
      // 忽略未找到异常，继续后续回退
    }

    this.logger.warn(
      `未找到完全匹配的模型: "${trimmed}"，自动回退到默认高可用模型: "${this.defaultFallbackModel}"`,
    );
    return this.defaultFallbackModel;
  }

  /**
   * 获取兼容 OpenAI 的模型列表
   */
  async getModelsList() {
    const activeModels = await this.aiModelService.findActiveModels(true, 'chat');
    const now = Math.floor(Date.now() / 1000);

    const modelEntries = activeModels.map((m) => ({
      id: m.modelId,
      object: 'model',
      created: now,
      owned_by: m.provider?.name || 'system',
      permission: [],
      root: m.modelId,
      parent: null,
    }));

    // 补充常用别名模型，方便外部客户端直接选择
    const aliasEntries = [
      { id: 'deepseek-chat', owned_by: 'alias' },
      { id: 'deepseek-reasoner', owned_by: 'alias' },
      { id: 'gpt-3.5-turbo', owned_by: 'alias' },
    ].map((a) => ({
      id: a.id,
      object: 'model',
      created: now,
      owned_by: a.owned_by,
      permission: [],
      root: a.id,
      parent: null,
    }));

    return {
      object: 'list',
      data: [...modelEntries, ...aliasEntries],
    };
  }

  /**
   * 处理非流式请求 (stream: false)
   */
  async handleNonStream(dto: OpenAiChatCompletionDto) {
    const targetModel = await this.resolveModelId(dto.model);
    const messages: ChatMessage[] = dto.messages.map((m) => ({
      role: m.role as any,
      content: m.content,
    }));

    const completion = await this.aiClientService.createChatCompletion(
      targetModel,
      messages,
      {
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.max_tokens ?? 2048,
      },
    );

    return {
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: targetModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: sanitizeAssistantContent(completion.content || ''),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: completion.usage?.promptTokens || 0,
        completion_tokens: completion.usage?.completionTokens || 0,
        total_tokens: completion.usage?.totalTokens || 0,
      },
    };
  }

  /**
   * 处理 SSE 流式请求 (stream: true)
   */
  async handleStream(dto: OpenAiChatCompletionDto, res: Response) {
    const targetModel = await this.resolveModelId(dto.model);
    const messages: ChatMessage[] = dto.messages.map((m) => ({
      role: m.role as any,
      content: m.content,
    }));

    // 开启 SSE 响应头并禁用缓冲
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const chunkId = `chatcmpl-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);

    try {
      const stream = await this.aiClientService.createStreamChatCompletion(
        targetModel,
        messages,
        {
          temperature: dto.temperature ?? 0.7,
          maxTokens: dto.max_tokens ?? 2048,
        },
      );

      for await (const chunk of stream) {
        // 纯净写作模式：仅输出最终正文增量（过滤推理思考标签与 reasoning 块），保证云笔记内容纯净
        if (chunk.type === 'answer_delta' || (!chunk.type && chunk.delta?.content)) {
          const contentDelta = chunk.delta?.content;
          if (contentDelta) {
            const payload = {
              id: chunkId,
              object: 'chat.completion.chunk',
              created,
              model: targetModel,
              choices: [
                {
                  index: 0,
                  delta: {
                    content: contentDelta,
                  },
                  finish_reason: null,
                },
              ],
            };
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          }
        }
      }

      // 发送最终 stop 帧与 [DONE] 标识
      const finalPayload = {
        id: chunkId,
        object: 'chat.completion.chunk',
        created,
        model: targetModel,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      };
      res.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      this.logger.error(`OpenAI 网关流式生成异常: ${err.message}`, err.stack);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            message: err.message || 'Upstream LLM error',
            type: 'api_error',
            code: 'internal_error',
          },
        });
      } else {
        res.write(
          `data: ${JSON.stringify({
            error: { message: err.message || 'Stream generation failed' },
          })}\n\n`,
        );
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  }
}
