import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Logger,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ChatSessionService } from './chat-session.service';
import { ChatService } from './chat.service';
import { CreateSessionDto, GetSessionMessagesDto } from './dto';
import { UpdateSessionBodyDto } from './dto/update-session-body.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 聊天会话控制器
 */
@ApiTags('聊天会话')
@Controller('chat/session')
export class ChatSessionController {
  private readonly logger = new Logger(ChatSessionController.name);

  constructor(
    private readonly chatSessionService: ChatSessionService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * 创建新会话
   */
  @Post('create')
  @ApiOperation({
    summary: '创建新会话',
    description: '创建一个新的聊天会话',
  })
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({
    status: 200,
    description: '创建成功',
    schema: {
      example: {
        code: 0,
        data: {
          id: 'session-uuid',
          userId: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
          title: '新对话',
          isArchived: false,
          isDeleted: false,
          lastMessagePreview: null,
          lastActiveAt: null,
          createdAt: '2025-11-16T21:10:53.000Z',
          updatedAt: '2025-11-16T21:10:53.000Z',
        },
        message: '操作成功',
      },
    },
  })
  async create(@Body() createSessionDto: CreateSessionDto) {
    this.logger.log(
      `[create] 收到请求 Body: ${JSON.stringify(createSessionDto)}`,
    );
    this.logger.log(
      `[create] userId 值: ${createSessionDto.userId}, 类型: ${typeof createSessionDto.userId}`,
    );
    return this.chatSessionService.create(createSessionDto);
  }

  /**
   * 获取用户的所有会话列表
   */
  @Get('list')
  @ApiOperation({
    summary: '获取会话列表',
    description: '获取用户的所有会话列表，按最后活跃时间倒序排列',
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: '用户 ID',
    example: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    description: '是否包含已归档的会话',
    example: 'false',
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      example: {
        code: 0,
        data: [
          {
            id: 'session-uuid',
            userId: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
            title: '关于 xxxx 的讨论',
            isArchived: false,
            isDeleted: false,
            lastMessagePreview: '你好，请介绍一下你自己',
            lastActiveAt: '2025-11-16T21:10:53.000Z',
            messageCount: 5,
            createdAt: '2025-11-16T21:10:53.000Z',
            updatedAt: '2025-11-16T21:10:53.000Z',
          },
        ],
        message: '操作成功',
      },
    },
  })
  async getList(
    @Query('userId') userId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const includeArchivedBool = includeArchived === 'true';
    return this.chatSessionService.findByUserId(userId, includeArchivedBool);
  }

  /**
   * 分页获取会话消息
   */
  @Get('messages')
  @ApiOperation({
    summary: '获取会话消息',
    description: '分页获取指定会话的消息列表，按创建时间正序排列',
  })
  @ApiQuery({
    name: 'sessionId',
    required: true,
    description: '会话 ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '页码（从 1 开始）',
    example: '1',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: '每页数量（默认 20，最大 100）',
    example: '20',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    description: '排序方式：asc 正序，desc 倒序',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      example: {
        code: 0,
        data: {
          messages: [
            {
              id: 'message-uuid',
              userId: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
              sessionId: 'session-uuid',
              userMessage: '你好',
              aiMessage: '你好！有什么可以帮助你的吗？',
              model: 'claude-opus-4-5-20251101',
              usage: {
                promptTokens: 10,
                completionTokens: 20,
                totalTokens: 30,
              },
              createdAt: '2025-11-16T21:10:53.000Z',
              updatedAt: '2025-11-16T21:10:53.000Z',
            },
          ],
          total: 50,
          page: 1,
          pageSize: 20,
          totalPages: 3,
        },
        message: '操作成功',
      },
    },
  })
  async getMessages(
    @Query('sessionId') sessionId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    const orderValue = order === 'asc' ? 'asc' : 'desc'; // 默认 desc
    return this.chatService.getSessionMessages(
      sessionId,
      pageNum,
      pageSizeNum,
      orderValue,
    );
  }

  /**
   * 获取会话详情
   */
  @Get('detail')
  @ApiOperation({
    summary: '获取会话详情',
    description: '获取指定会话的详细信息',
  })
  @ApiQuery({
    name: 'id',
    required: true,
    description: '会话 ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getById(@Query('id') id: string) {
    return this.chatSessionService.findById(id);
  }

  /**
   * 更新会话
   */
  @Post('update')
  @ApiOperation({
    summary: '更新会话',
    description: '更新会话的标题、归档状态等信息',
  })
  @ApiBody({ type: UpdateSessionBodyDto })
  @ApiResponse({
    status: 200,
    description: '更新成功',
  })
  async update(@Body() updateSessionDto: UpdateSessionBodyDto) {
    const { id, ...updateData } = updateSessionDto;
    return this.chatSessionService.update(id, updateData);
  }

  /**
   * 删除会话-软删除
   */
  @Post('delete')
  @ApiOperation({
    summary: '删除会话',
    description: '软删除会话（标记为已删除，不会真正删除数据）',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '会话 ID',
          example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
      required: ['id'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '删除成功',
    schema: {
      example: {
        code: 0,
        data: { message: '会话已删除' },
        message: '操作成功',
      },
    },
  })
  async delete(@Body() body: { id: string }) {
    await this.chatSessionService.delete(body.id);
    return { message: '会话已删除' };
  }

  /**
   * 清空用户所有会话-批量软删除
   * 需要 JWT认证-且只能清空自己的会话
   */
  @Post('clear-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '清空所有会话',
    description: '批量软删除当前登录用户的所有会话',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: '用户 ID（必须与当前登录用户一致）',
          example: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
        },
      },
      required: ['userId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '清空成功',
    schema: {
      example: {
        code: 0,
        data: {
          message: '已清空所有会话',
          deletedCount: 5,
        },
        message: '操作成功',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '无权操作他人会话',
  })
  async clearAll(@Body() body: { userId: string }, @Req() req: Request) {
    // 获取当前登录用户 ID
    const currentUserId = (req.user as any)?.id as string | undefined;

    // 只能清空自己的会话
    if (!currentUserId || body.userId !== currentUserId) {
      this.logger.warn(
        `[清除对话] 用户身份不匹配: body.userId=${body.userId}, currentUserId=${currentUserId}`,
      );
      throw new ForbiddenException('无权清空他人的会话');
    }

    const result =
      await this.chatSessionService.clearAllByUserId(currentUserId);
    return {
      message: '已清空所有会话',
      deletedCount: result.deletedCount,
    };
  }

  /**
   * 归档会话
   */
  @Post('archive')
  @ApiOperation({
    summary: '归档会话',
    description: '将会话标记为已归档',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '会话 ID',
          example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
      required: ['id'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '归档成功',
  })
  async archive(@Body() body: { id: string }) {
    return this.chatSessionService.archive(body.id);
  }

  /**
   * 取消归档会话
   */
  @Post('unarchive')
  @ApiOperation({
    summary: '取消归档会话',
    description: '将会话从归档状态恢复',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '会话 ID',
          example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
      required: ['id'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '取消归档成功',
  })
  async unarchive(@Body() body: { id: string }) {
    return this.chatSessionService.unarchive(body.id);
  }
}
