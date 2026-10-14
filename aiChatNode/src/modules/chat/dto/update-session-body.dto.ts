import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
  IsArray,
} from 'class-validator';

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
  @IsNotEmpty({ message: '会话 ID 不能为空' })
  @IsUUID('4', { message: '会话 ID 格式不正确' })
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
  @IsOptional()
  @IsString({ message: '标题必须是字符串' })
  @MaxLength(255, { message: '标题最多255个字符' })
  title?: string;

  /**
   * 是否归档
   */
  @ApiProperty({
    description: '是否归档',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isArchived 必须是布尔值' })
  isArchived?: boolean;

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
