import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { FileDataDto } from './dto';

/**
 * 多模态内容类型
 */
type MultimodalContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI;

  /**
   * 支持的图片 MIME 类型
   */
  private readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  /**
   * 支持的文档 MIME 类型（将作为文本处理）
   */
  private readonly SUPPORTED_DOC_TYPES = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

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

  /**
   * 检查文件是否为支持的图片类型
   */
  isImageFile(mimeType: string): boolean {
    return this.SUPPORTED_IMAGE_TYPES.includes(mimeType);
  }

  /**
   * 检查文件是否为支持的文档类型
   */
  isDocumentFile(mimeType: string): boolean {
    return this.SUPPORTED_DOC_TYPES.includes(mimeType);
  }

  /**
   * 构建多模态消息内容
   * @param textContent 文本内容
   * @param files 文件列表
   * @returns OpenAI Vision API 格式的内容数组
   */
  buildMultimodalContent(
    textContent: string,
    files?: FileDataDto[],
  ): string | MultimodalContent[] {
    // 没有文件，返回纯文本
    if (!files || files.length === 0) {
      return textContent;
    }

    const contentParts: MultimodalContent[] = [];

    // 处理文件
    for (const file of files) {
      if (this.isImageFile(file.type)) {
        // 图片：使用 image_url 格式
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: file.base64, // Base64 数据 URL
            detail: 'auto',   // 自动选择细节级别
          },
        });
        this.logger.debug(`添加图片: ${file.name} (${file.type})`);
      } else if (this.isDocumentFile(file.type)) {
        // 文档：提取文本或作为附件描述
        // 注意：PDF 和文档在 Vision API 中需要特殊处理
        // 这里我们将文件信息作为文本添加到提示中
        const docInfo = `[附件: ${file.name} (${file.type})]`;
        contentParts.push({
          type: 'text',
          text: docInfo,
        });
        this.logger.debug(`添加文档描述: ${file.name}`);

        // 如果是 PDF，也可以尝试作为图片发送（某些模型支持）
        if (file.type === 'application/pdf') {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: file.base64,
              detail: 'auto',
            },
          });
          this.logger.debug(`添加 PDF 作为图片: ${file.name}`);
        }
      } else {
        this.logger.warn(`不支持的文件类型: ${file.type} (${file.name})`);
      }
    }

    // 添加文本内容
    if (textContent && textContent.trim()) {
      contentParts.push({
        type: 'text',
        text: textContent,
      });
    }

    // 如果只有文本，返回纯文本格式
    if (contentParts.length === 1 && contentParts[0].type === 'text') {
      return textContent;
    }

    return contentParts;
  }

  /**
   * 构建多模态消息对象
   * @param role 角色
   * @param textContent 文本内容
   * @param files 文件列表
   */
  buildMultimodalMessage(
    role: 'user' | 'assistant' | 'system',
    textContent: string,
    files?: FileDataDto[],
  ): OpenAI.Chat.ChatCompletionMessageParam {
    const content = this.buildMultimodalContent(textContent, files);

    return {
      role,
      content: content as any, // OpenAI 类型兼容
    };
  }
}

