import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatSessionService } from './chat-session.service';
import { CreateSessionDto } from './dto';
import { UpdateSessionBodyDto } from './dto/update-session-body.dto';

/**
 * 聊天会话控制器
 */
@ApiTags('聊天会话')
@Controller('chat/session')
export class ChatSessionController {
  constructor(private readonly chatSessionService: ChatSessionService) {}

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
   * 删除会话（软删除）
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
