import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * 创建聊天对话
   */
  @Post('create')
  async create(@Body() createChatDto: CreateChatDto) {
    return this.chatService.create(createChatDto);
  }

  /**
   * 获取用户聊天历史
   */
  @Get('history')
  async getHistory(
    @Query('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getUserChatHistory(userId, limit);
  }
}
