import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAIService } from './openai.service';
import { CreateChatDto } from './dto';
import { ChatMessage } from './entities/chat.entity';
import { UserService } from '../user/user.service';
import { ChatSessionService } from './chat-session.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly openaiService: OpenAIService,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    private readonly userService: UserService,
    private readonly chatSessionService: ChatSessionService,
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

    // 处理会话：如果没有提供 sessionId，则创建新会话
    let sessionId = createChatDto.sessionId;
    if (!sessionId) {
      this.logger.log('未提供会话ID，创建新会话');
      const newSession = await this.chatSessionService.create({
        userId: createChatDto.userId,
        title: '新对话',
      });
      sessionId = newSession.id;
    } else {
      // 验证会话是否存在
      await this.chatSessionService.findById(sessionId);
    }

    // 构建消息数组
    const messages: any[] = [];

    // 如果没有提供历史消息，从数据库加载该会话的历史消息
    if (!createChatDto.history || createChatDto.history.length === 0) {
      const historyMessages = await this.getSessionHistory(sessionId, 10);
      historyMessages.forEach((msg) => {
        messages.push(
          { role: 'user', content: msg.userMessage },
          { role: 'assistant', content: msg.aiMessage },
        );
      });
    } else {
      messages.push(...createChatDto.history);
    }

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: createChatDto.message,
    });

    // 调用 OpenAI API
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
      sessionId: sessionId,
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

    // 更新会话的最后活跃时间和消息预览
    const preview =
      createChatDto.message.length > 50
        ? createChatDto.message.substring(0, 50) + '...'
        : createChatDto.message;
    await this.chatSessionService.updateLastActivity(sessionId, preview);

    // 由拦截器统一包装返回值
    return {
      id: savedMessage.id,
      sessionId: sessionId,
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
   * 获取用户的聊天历史（已废弃，建议使用 getSessionHistory）
   */
  async getUserChatHistory(userId: string, limit: number = 50) {
    return this.chatMessageRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 获取指定会话的聊天历史
   */
  async getSessionHistory(
    sessionId: string,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' }, // 按时间正序，方便构建上下文
      take: limit,
    });
  }
}
