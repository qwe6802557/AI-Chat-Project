import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString, MaxLength, IsArray } from 'class-validator';

/**
 * 创建聊天会话 DTO
 */
export class CreateSessionDto {
  /**
   * 用户 ID
   */
  @ApiProperty({
    description: '用户 ID（UUID 格式）',
    example: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: '用户 ID 格式不正确' })
  userId?: string;

  /**
   * 会话标题（可选，默认为"新对话"）
   */
  @ApiProperty({
    description: '会话标题',
    example: '关于 NestJS 的讨论',
    required: false,
    default: '新对话',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '标题最多255个字符' })
  title?: string;

  /**
   * 关联挂载的知识库 ID 列表（可选）
   */
  @ApiProperty({
    description: '关联挂载的知识库 ID 列表',
    example: ['b94b0f90-1234-4567-89ab-cdef01234567'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'knowledgeBaseIds 必须是数组' })
  @IsUUID('4', { each: true, message: 'knowledgeBaseIds 元素必须是 UUID' })
  knowledgeBaseIds?: string[];
}
