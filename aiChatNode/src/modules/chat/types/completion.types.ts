/**
 * AI 对话相关的类型定义
 */

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 补全选项
 */
export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
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
