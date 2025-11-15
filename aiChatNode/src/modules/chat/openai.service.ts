import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    // 从 ConfigService 读取环境变量
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY未定义');
    }

    // 初始化 OpenAI 客户端
    this.openai = new OpenAI({
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1',
    });

    this.logger.log('OpenAI服务已加载');
    this.logger.log(`目标URL: ${baseURL || 'https://api.openai.com/v1'}`);
  }

  /**
   * 创建聊天补全（非流式）
   * @param messages 消息数组
   * @param options 可选配置
   */
  async createChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ) {
    try {
      const defaultModel = this.configService.get<string>('OPENAI_MODEL') || 'gpt-3.5-turbo';
      const completion = await this.openai.chat.completions.create({
        model: options?.model || defaultModel,
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000,
      });

      return completion;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 创建流式聊天补全
   * @param messages 消息数组
   * @param options 可选配置
   */
  async createStreamChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ) {
    try {
      const defaultModel = this.configService.get<string>('OPENAI_MODEL') || 'gpt-3.5-turbo';
      const stream = await this.openai.chat.completions.create({
        model: options?.model || defaultModel,
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000,
        stream: true,
      });

      return stream;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 创建文本嵌入向量
   * @param input 输入文本
   */
  async createEmbedding(input: string) {
    try {
      const embedding = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input,
      });

      return embedding;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 错误处理
   * @param error 错误对象
   */
  private handleError(error: any): never {
    if (error instanceof OpenAI.APIError) {
      this.logger.error(
        `OpenAI API Error: ${error.status} - ${error.message}`,
      );
      throw new Error(`OpenAI API Error: ${error.message}`);
    }

    this.logger.error(`Unexpected error: ${error.message}`);
    throw error;
  }
}

