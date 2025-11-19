import { ApiProperty } from '@nestjs/swagger';

/**
 * 更新聊天会话请求 DTO（用于 API Body）
 */
export class UpdateSessionBodyDto {
  /**
   * 会话 ID
   */
  @ApiProperty({
    description: '会话 ID（UUID 格式）',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  /**
   * 会话标题
   */
  @ApiProperty({
    description: '会话标题',
    example: '关于 NestJS 的深入讨论',
    required: false,
    maxLength: 255,
  })
  title?: string;

  /**
   * 是否归档
   */
  @ApiProperty({
    description: '是否归档',
    example: false,
    required: false,
  })
  isArchived?: boolean;

  /**
   * 是否删除（软删除）
   */
  @ApiProperty({
    description: '是否删除（软删除）',
    example: false,
    required: false,
  })
  isDeleted?: boolean;
}

