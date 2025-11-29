import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto';

@ApiTags('聊天消息')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * 创建聊天对话
   */
  @Post('create')
  @ApiOperation({
    summary: '发送聊天消息',
    description:
      '发送聊天消息给 AI。如果不提供 sessionId，系统会自动创建新会话。' +
      '系统会自动加载该会话的历史消息（最近 10 条）作为上下文。',
  })
  @ApiBody({ type: CreateChatDto })
  @ApiResponse({
    status: 200,
    description: '发送成功',
    schema: {
      example: {
        code: 0,
        data: {
          id: 'message-uuid',
          sessionId: 'session-uuid',
          message:
            'NestJS 是一个用于构建高效、可扩展的 Node.js 服务器端应用程序的框架...',
          model: 'gpt-4o',
          usage: {
            promptTokens: 15,
            completionTokens: 50,
            totalTokens: 65,
          },
          createdAt: '2025-11-16T21:10:53.000Z',
        },
        message: '操作成功',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '参数错误',
    schema: {
      example: {
        code: 1,
        data: null,
        message: '用户不存在',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'OpenAI API 错误',
    schema: {
      example: {
        code: 1,
        data: null,
        message: 'OpenAI API Error: 403 预扣费额度失败',
      },
    },
  })
  async create(@Body() createChatDto: CreateChatDto) {
    return this.chatService.create(createChatDto);
  }

  /**
   * 创建流式聊天对话
   */
  @Post('stream')
  @ApiOperation({
    summary: '发送流式聊天消息',
    description:
      '发送聊天消息给 AI，使用 SSE 返回流式响应。' +
      '适用于需要逐字显示 AI 回复的场景。',
  })
  @ApiBody({ type: CreateChatDto })
  @ApiResponse({
    status: 200,
    description: '流式传输成功',
    schema: {
      type: 'string',
      example:
        'data: {"delta":"你好","finish_reason":null}\n\ndata: {"delta":"！","finish_reason":null}\n\ndata: {"delta":"","finish_reason":"stop"}',
    },
  })
  async createStream(
    @Body() createChatDto: CreateChatDto,
    @Res() res: Response,
  ) {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

    try {
      // 获取流和上下文信息
      const { stream, sessionId, userId, userMessage, modelId } =
        await this.chatService.createStream(createChatDto);

      let fullMessage = '';

      // 遍历流式响应
      for await (const chunk of stream) {
        const delta = chunk.delta?.content || '';
        fullMessage += delta;

        // 发送 SSE 事件
        const sseData = JSON.stringify({
          delta,
          finish_reason: chunk.finish_reason,
          sessionId,
        });

        res.write(`data: ${sseData}\n\n`);

        // 如果流结束，保存完整消息
        if (chunk.finish_reason) {
          // 保存到数据库
          await this.chatService.saveStreamMessage(
            userId,
            sessionId,
            userMessage,
            fullMessage,
            modelId,
          );

          // 发送最终的完成事件
          const finalData = JSON.stringify({
            delta: '',
            finish_reason: chunk.finish_reason,
            sessionId,
            message: fullMessage,
            model: modelId,
          });

          res.write(`data: ${finalData}\n\n`);
          break;
        }
      }

      // 结束响应
      res.end();
    } catch (error) {
      // 发送错误事件
      const errorData = JSON.stringify({
        error: error.message || '流式请求失败',
      });

      res.write(`data: ${errorData}\n\n`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
    }
  }

  /**
   * 获取聊天历史
   */
  @Get('history')
  @ApiOperation({
    summary: '获取聊天历史',
    description: '获取指定会话或用户的聊天历史记录。优先使用 sessionId 查询。',
  })
  @ApiQuery({
    name: 'sessionId',
    required: false,
    description: '会话 ID（推荐使用）',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: '用户 ID（已废弃，建议使用 sessionId）',
    example: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '返回记录数量限制',
    example: 50,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      example: {
        code: 0,
        data: [
          {
            id: 'message-uuid-1',
            userId: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
            sessionId: 'session-uuid',
            userMessage: '你好',
            aiMessage: '你好！有什么可以帮助你的吗？',
            model: 'gpt-4o',
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
            },
            createdAt: '2025-11-16T21:10:53.000Z',
          },
        ],
        message: '操作成功',
      },
    },
  })
  async getHistory(
    @Query('userId') userId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('limit') limit?: number,
  ) {
    // 优先使用 sessionId 查询
    if (sessionId) {
      return this.chatService.getSessionHistory(sessionId, limit);
    }
    // 兼容旧接口-使用userId查询
    if (userId) {
      return this.chatService.getUserChatHistory(userId, limit);
    }
    return [];
  }
}
