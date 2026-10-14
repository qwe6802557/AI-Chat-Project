import { ApiProperty } from '@nestjs/swagger';

/**
 * 更新聊天会话 DTO（用于 Service 层）
 */
export class UpdateSessionDto {
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
   * 关联挂载的知识库 ID 列表
   */
  @ApiProperty({
    description: '关联挂载的知识库 ID 列表',
    example: ['b94b0f90-1234-4567-89ab-cdef01234567'],
    required: false,
    type: [String],
  })
  knowledgeBaseIds?: string[];
}
