/**
 * 聊天会话响应 DTO
 */
export class SessionResponseDto {
  /**
   * 会话 ID
   */
  id: string;

  /**
   * 会话标题
   */
  title: string;

  /**
   * 用户 ID
   */
  userId: string;

  /**
   * 是否归档
   */
  isArchived: boolean;

  /**
   * 最后一条消息预览
   */
  lastMessagePreview?: string;

  /**
   * 最后活跃时间
   */
  lastActiveAt?: Date;

  /**
   * 消息数量
   */
  messageCount?: number;

  /**
   * 创建时间
   */
  createdAt: Date;

  /**
   * 更新时间
   */
  updatedAt: Date;
}
