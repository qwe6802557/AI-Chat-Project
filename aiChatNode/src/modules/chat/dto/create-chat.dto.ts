export class CreateChatDto {
  /**
   * 用户 ID
   */
  userId: string;

  /**
   * 用户消息内容
   */
  message: string;

  /**
   * 对话历史（可选）
   */
  history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;

  /**
   * 模型名称（可选）
   */
  model?: string;

  /**
   * 温度参数（可选，0-2）
   */
  temperature?: number;

  /**
   * 最大 token 数（可选）
   */
  maxTokens?: number;

  /**
   * 是否使用流式响应（可选）
   */
  stream?: boolean;
}
