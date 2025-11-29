import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

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
  })
  @IsNotEmpty({ message: '用户 ID 不能为空' })
  @IsUUID('4', { message: '用户 ID 格式不正确' })
  userId: string;

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
}

