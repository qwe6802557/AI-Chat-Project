import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

/**
 * 兼容 OpenAI 格式的消息体
 */
export class OpenAiChatMessageDto {
  @ApiProperty({ description: '角色 (system, user, assistant)', example: 'user' })
  @IsString()
  role: 'system' | 'user' | 'assistant' | string;

  @ApiProperty({ description: '消息正文', example: '你好' })
  @IsString()
  content: string;
}

/**
 * 兼容 OpenAI 的 chat.completions 请求体 DTO
 */
export class OpenAiChatCompletionDto {
  @ApiProperty({
    description: '模型名称或别名（如 glm-4-flash、deepseek-r1、qwen2.5 等）',
    example: 'glm-4-flash',
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    description: '上下文消息列表',
    type: [OpenAiChatMessageDto],
  })
  @IsArray()
  messages: OpenAiChatMessageDto[];

  @ApiProperty({
    description: '是否启用 SSE 流式推流',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @ApiProperty({
    description: '随机性采样温度 (0-2)',
    example: 0.7,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiProperty({
    description: '最大 Token 限制',
    example: 2048,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;

  @ApiProperty({
    description: '核采样概率阈值',
    example: 1.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  top_p?: number;
}
