import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AIClientService } from './services/ai-client.service';
import { CreateChatDto, FileDataDto } from './dto';
import { ChatMessage } from './entities/chat.entity';
import { UserService } from '../user/user.service';
import { ChatSessionService } from './chat-session.service';
import { MultimodalContent } from './types/completion.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  /**
   * 支持的图片 MIME 类型
   */
  private readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  constructor(
    private readonly aiClientService: AIClientService,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    private readonly userService: UserService,
    private readonly chatSessionService: ChatSessionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 构建多模态消息内容
   * @param textContent 文本内容
   * @param files 文件列表
   * @returns 纯文本或多模态内容数组
   */
  private buildMultimodalContent(
    textContent: string,
    files?: FileDataDto[],
  ): string | MultimodalContent[] {
    // 没有文件，返回纯文本
    if (!files || files.length === 0) {
      return textContent;
    }

    const contentParts: MultimodalContent[] = [];

    // 处理文件
    for (const file of files) {
      if (this.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        // 图片：使用 image_url 格式
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: file.base64, // Base64 数据 URL
            detail: 'auto', // 自动选择细节级别
          },
        });
        this.logger.debug(`添加图片: ${file.name} (${file.type})`);
      } else if (file.type === 'application/pdf') {
        // PDF：尝试作为图片发送（Claude 支持 PDF）
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: file.base64,
            detail: 'auto',
          },
        });
        this.logger.debug(`添加 PDF: ${file.name}`);
      } else {
        // 其他文档：作为文本描述添加
        contentParts.push({
          type: 'text',
          text: `[附件: ${file.name} (${file.type})]`,
        });
        this.logger.debug(`添加文档描述: ${file.name}`);
      }
    }

    // 添加文本内容
    if (textContent && textContent.trim()) {
      contentParts.push({
        type: 'text',
        text: textContent,
      });
    }

    // 如果只有文本-返回纯文本格式
    if (contentParts.length === 1 && contentParts[0].type === 'text') {
      return (contentParts[0] as { type: 'text'; text: string }).text;
    }

    return contentParts;
  }

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

    // 没有提供sessionId-则创建新会话
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

    // 没有提供历史消息-从数据库加载该会话的历史消息
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

    // 构建当前用户消息内容（支持多模态）
    const userContent = this.buildMultimodalContent(
      createChatDto.message,
      createChatDto.files,
    );

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: userContent,
    });

    // 记录文件信息
    if (createChatDto.files && createChatDto.files.length > 0) {
      this.logger.log(
        `包含 ${createChatDto.files.length} 个附件: ${createChatDto.files.map((f) => f.name).join(', ')}`,
      );
    }

    // 获取默认模型
    const defaultModel =
      this.configService.get<string>('CLAUDE_MODEL') ||
      'claude-opus-4-5-20251101';
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

    // 更新最后活跃时间和消息预览
    const preview =
      createChatDto.message.length > 50
        ? createChatDto.message.substring(0, 50) + '...'
        : createChatDto.message;
    await this.chatSessionService.updateLastActivity(sessionId, preview);

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
   * 获取用户的聊天历史-旧
   */
  async getUserChatHistory(userId: string, limit: number = 50) {
    return this.chatMessageRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 获取指定会话的聊天历史-新
   */
  async getSessionHistory(
    sessionId: string,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' }, // 时间正序
      take: limit,
    });
  }

  /**
   * 分页获取会话消息
   * @param sessionId 会话 ID
   * @param page 页码
   * @param pageSize 每页数量
   * @param order 排序方式：asc正序，desc倒序
   */
  async getSessionMessages(
    sessionId: string,
    page: number = 1,
    pageSize: number = 20,
    order: 'asc' | 'desc' = 'desc',
  ): Promise<{
    messages: ChatMessage[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // 验证会话是否存在
    await this.chatSessionService.findById(sessionId);

    const skip = (page - 1) * pageSize;

    const [messages, total] = await this.chatMessageRepository.findAndCount({
      where: { sessionId },
      order: { createdAt: order === 'desc' ? 'DESC' : 'ASC' },
      skip,
      take: pageSize,
    });

    // 如果是倒序查询-反转数组使消息按时间正序显示
    const orderedMessages = order === 'desc' ? messages.reverse() : messages;

    return {
      messages: orderedMessages,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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

    // 没有提供sessionId-则创建新会话
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

    // 没有提供历史消息-从数据库加载该会话的历史消息
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

    // 构建当前用户消息内容-支持多模态
    const userContent = this.buildMultimodalContent(
      createChatDto.message,
      createChatDto.files,
    );

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: userContent,
    });

    // 记录文件信息
    if (createChatDto.files && createChatDto.files.length > 0) {
      this.logger.log(
        `包含 ${createChatDto.files.length} 个附件: ${createChatDto.files.map((f) => f.name).join(', ')}`,
      );
    }

    // 获取默认模型
    const defaultModel =
      this.configService.get<string>('CLAUDE_MODEL') ||
      'claude-opus-4-5-20251101';
    const modelId = createChatDto.model || defaultModel;

    // 调用 AI 客户端服务-流式
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
