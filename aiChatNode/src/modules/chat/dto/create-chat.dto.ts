import { ApiProperty } from '@nestjs/swagger';

export class CreateChatDto {
  /**
   * 用户 ID
   */
  @ApiProperty({
    description: '用户 ID（UUID 格式）',
    example: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
    format: 'uuid',
  })
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
  sessionId?: string;

  /**
   * 用户消息内容
   */
  @ApiProperty({
    description: '用户消息内容',
    example: '你好，请介绍一下 NestJS 框架',
    minLength: 1,
  })
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
  stream?: boolean;
}
