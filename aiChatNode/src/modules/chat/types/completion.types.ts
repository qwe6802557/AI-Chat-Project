/**
 * AI 对话相关的类型定义
 */

/**
 * 多模态内容部分 - 文本
 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/**
 * 多模态内容部分 - 图片 URL
 */
export interface ImageUrlContentPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * 多模态内容（支持文本和图片）
 */
export type MultimodalContent = TextContentPart | ImageUrlContentPart;

/**
 * 聊天消息内容类型（支持纯文本或多模态数组）
 */
export type ChatMessageContent = string | MultimodalContent[];

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: ChatMessageContent;
}

/**
 * 补全选项
 */
export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  abortSignal?: AbortSignal;
}

/**
 * 补全响应
 */
export interface CompletionResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 流式补全块
 */
export interface CompletionChunk {
  delta?: {
    content?: string;
    role?: string;
  };
  finish_reason?: string | null;
}
