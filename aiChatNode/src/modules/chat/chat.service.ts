import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAIService } from './openai.service';
import { CreateChatDto } from './dto';
import { ChatMessage } from './entities/chat.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly openaiService: OpenAIService,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    private readonly userService: UserService,
  ) {}

  /**
   * 创建聊天对话
   * @param createChatDto 聊天请求参数
   */
  async create(createChatDto: CreateChatDto) {
    this.logger.log(`收到聊天请求: ${createChatDto.message}`);

    // 验证用户是否存在
    const user = await this.userService.findById(createChatDto.userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 构建消息数组
    const messages: any[] = [];

    // 添加历史消息（可选）
    if (createChatDto.history && createChatDto.history.length > 0) {
      messages.push(...createChatDto.history);
    }

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: createChatDto.message,
    });

    // 调用API
    const completion = await this.openaiService.createChatCompletion(messages, {
      model: createChatDto.model,
      temperature: createChatDto.temperature,
      maxTokens: createChatDto.maxTokens,
    });

    // 提取回复内容
    const assistantMessage = completion.choices[0]?.message?.content || '';

    this.logger.log(`AI 回复: ${assistantMessage.substring(0, 50)}...`);

    // 保存聊天记录到数据库
    const chatMessage = this.chatMessageRepository.create({
      userId: createChatDto.userId,
      userMessage: createChatDto.message,
      aiMessage: assistantMessage,
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
    });

    const savedMessage = await this.chatMessageRepository.save(chatMessage);

    this.logger.log(`聊天记录已保存: ${savedMessage.id}`);

    // 由拦截器处理封装返回值
    return {
      id: savedMessage.id,
      message: assistantMessage,
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
      createdAt: savedMessage.createdAt,
    };
  }

  /**
   * 获取用户的聊天历史
   */
  async getUserChatHistory(userId: string, limit: number = 50) {
    return this.chatMessageRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
