import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AIClientService } from './services/ai-client.service';
import { CreateChatDto } from './dto';
import { ChatMessage } from './entities/chat.entity';
import { UserService } from '../user/user.service';
import { ChatSessionService } from './chat-session.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly aiClientService: AIClientService,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    private readonly userService: UserService,
    private readonly chatSessionService: ChatSessionService,
    private readonly configService: ConfigService,
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

    // 获取默认模型
    const defaultModel =
      this.configService.get<string>('CLAUDE_MODEL') ||
      'claude-sonnet-4-5-20250929';
    const modelId = createChatDto.model || defaultModel;

    // 调用 AI 客户端服务
    const completion = await this.aiClientService.createChatCompletion(
      modelId,
      messages,
      {
        temperature: createChatDto.temperature,
        maxTokens: createChatDto.maxTokens,
      },
    );

    // 提取回复内容
    const assistantMessage = completion.content;

    this.logger.log(`AI 回复: ${assistantMessage.substring(0, 50)}...`);

    // 保存聊天记录到数据库
    const chatMessage = this.chatMessageRepository.create({
      userId: createChatDto.userId,
      sessionId: sessionId,
      userMessage: createChatDto.message,
      aiMessage: assistantMessage,
      model: completion.model,
      usage: {
        promptTokens: completion.usage.promptTokens,
        completionTokens: completion.usage.completionTokens,
        totalTokens: completion.usage.totalTokens,
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
        promptTokens: completion.usage.promptTokens,
        completionTokens: completion.usage.completionTokens,
        totalTokens: completion.usage.totalTokens,
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

  /**
   * 创建流式聊天对话
   * @param createChatDto 聊天请求参数
   */
  async createStream(createChatDto: CreateChatDto) {
    this.logger.log(`收到流式聊天请求: ${createChatDto.message}`);

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

    // 获取默认模型（如果未指定）
    const defaultModel =
      this.configService.get<string>('CLAUDE_MODEL') ||
      'claude-sonnet-4-5-20250929';
    const modelId = createChatDto.model || defaultModel;

    // 调用 AI 客户端服务（流式）
    const stream = await this.aiClientService.createStreamChatCompletion(
      modelId,
      messages,
      {
        temperature: createChatDto.temperature,
        maxTokens: createChatDto.maxTokens,
      },
    );

    // 返回流和必要的上下文信息
    return {
      stream,
      sessionId,
      userId: createChatDto.userId,
      userMessage: createChatDto.message,
      modelId,
    };
  }

  /**
   * 保存流式对话的完整消息
   * （在流式传输结束后调用）
   */
  async saveStreamMessage(
    userId: string,
    sessionId: string,
    userMessage: string,
    aiMessage: string,
    model: string,
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
  ) {
    // 保存聊天记录到数据库
    const chatMessage = this.chatMessageRepository.create({
      userId,
      sessionId,
      userMessage,
      aiMessage,
      model,
      usage: usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    });

    const savedMessage = await this.chatMessageRepository.save(chatMessage);

    this.logger.log(`流式聊天记录已保存: ${savedMessage.id}`);

    // 更新会话的最后活跃时间和消息预览
    const preview =
      userMessage.length > 50
        ? userMessage.substring(0, 50) + '...'
        : userMessage;
    await this.chatSessionService.updateLastActivity(sessionId, preview);

    return savedMessage;
  }
}
