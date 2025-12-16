export class ChatResponseDto {
  /**
   * 是否成功
   */
  success: boolean;

  /**
   * AI 回复内容
   */
  message?: string;

  /**
   * 使用的模型
   */
  model?: string;

  /**
   * 使用的 token 数量
   */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /**
   * 错误信息（可选）
   */
  error?: string;
}

