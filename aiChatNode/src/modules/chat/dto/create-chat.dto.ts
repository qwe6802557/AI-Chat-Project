import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 文件数据 DTO（用于多模态输入）
 */
export class FileDataDto {
  @ApiProperty({
    description: '文件 Base64 数据（包含 data:xxx;base64, 前缀）',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  })
  @IsNotEmpty({ message: '文件数据不能为空' })
  @IsString({ message: '文件数据必须是字符串' })
  base64: string;

  @ApiProperty({
    description: '文件 MIME 类型',
    example: 'image/jpeg',
  })
  @IsNotEmpty({ message: '文件类型不能为空' })
  @IsString({ message: '文件类型必须是字符串' })
  type: string;

  @ApiProperty({
    description: '文件名',
    example: 'photo.jpg',
  })
  @IsNotEmpty({ message: '文件名不能为空' })
  @IsString({ message: '文件名必须是字符串' })
  name: string;
}

export class CreateChatDto {
  /**
   * 用户 ID
   */
  @ApiProperty({
    description: '用户 ID（UUID 格式）',
    example: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
    format: 'uuid',
  })
  @IsNotEmpty({ message: '用户ID不能为空' })
  @IsString({ message: '用户ID必须是字符串' })
  userId: string;

  /**
   * 会话 ID（可选，如果不提供则自动创建新会话）
   */
  @ApiProperty({
    description: '会话 ID（可选，不提供则自动创建新会话）',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
    format: 'uuid',
  })
  @IsOptional()
  @IsString({ message: '会话ID必须是字符串' })
  sessionId?: string;

  /**
   * 用户消息内容
   */
  @ApiProperty({
    description: '用户消息内容',
    example: '你好，请介绍一下 NestJS 框架',
    minLength: 1,
  })
  @IsNotEmpty({ message: '消息内容不能为空' })
  @IsString({ message: '消息内容必须是字符串' })
  message: string;

  /**
   * 对话历史（可选）
   */
  @ApiProperty({
    description: '对话历史（可选，用于提供上下文）',
    example: [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！有什么可以帮助你的吗？' },
    ],
    required: false,
    type: 'array',
    items: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['user', 'assistant', 'system'] },
        content: { type: 'string' },
      },
    },
  })
  @IsOptional()
  @IsArray({ message: '对话历史必须是数组' })
  history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;

  /**
   * 模型名称（可选）
   */
  @ApiProperty({
    description: '模型名称',
    example: 'gpt-4o',
    required: false,
    default: 'gpt-4o',
  })
  @IsOptional()
  @IsString({ message: '模型名称必须是字符串' })
  model?: string;

  /**
   * 温度参数（可选，0-2）
   */
  @ApiProperty({
    description: '温度参数（控制随机性，0-2 之间）',
    example: 0.7,
    required: false,
    minimum: 0,
    maximum: 2,
    default: 0.7,
  })
  @IsOptional()
  @IsNumber({}, { message: '温度参数必须是数字' })
  @Min(0, { message: '温度参数最小值为0' })
  @Max(2, { message: '温度参数最大值为2' })
  temperature?: number;

  /**
   * 最大 token 数（可选）
   */
  @ApiProperty({
    description: '最大 token 数',
    example: 1000,
    required: false,
    minimum: 1,
    default: 1000,
  })
  @IsOptional()
  @IsNumber({}, { message: '最大token数必须是数字' })
  @Min(1, { message: '最大token数最小值为1' })
  maxTokens?: number;

  /**
   * 是否使用流式响应（可选）
   */
  @ApiProperty({
    description: '是否使用流式响应',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: '流式响应标志必须是布尔值' })
  stream?: boolean;

  /**
   * 附件文件列表（可选，用于多模态输入）
   */
  @ApiProperty({
    description: '附件文件列表（图片、PDF、文档等）',
    example: [
      {
        base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        type: 'image/jpeg',
        name: 'photo.jpg',
      },
    ],
    required: false,
    type: [FileDataDto],
  })
  @IsOptional()
  @IsArray({ message: '文件列表必须是数组' })
  @ValidateNested({ each: true })
  @Type(() => FileDataDto)
  files?: FileDataDto[];

  /**
   * 已上传的附件 ID
   */
  @ApiProperty({
    description: '已上传的附件ID列表',
    example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'fileIds必须是数组' })
  @IsUUID('4', { each: true, message: 'fileIds 中包含非法 UUID' })
  fileIds?: string[];
}
