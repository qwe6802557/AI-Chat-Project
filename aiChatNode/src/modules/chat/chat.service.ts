import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AIClientService } from './services/ai-client.service';
import { CreateChatDto, FileDataDto } from './dto';
import { ChatMessage as ChatRecord } from './entities/chat.entity';
import { ChatSession } from './entities/chat-session.entity';
import { UserService } from '../user/user.service';
import { ChatSessionService } from './chat-session.service';
import {
  ChatMessage,
  CompletionUsageStats,
  MultimodalContent,
} from './types/completion.types';
import { FilesService } from '../files/files.service';

export interface SessionMessageAttachmentDto {
  id: string;
  url: string;
  name: string;
  type: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
}

export type SessionMessageDto = Pick<
  ChatRecord,
  | 'id'
  | 'userId'
  | 'sessionId'
  | 'userMessage'
  | 'aiMessage'
  | 'model'
  | 'usage'
  | 'createdAt'
  | 'updatedAt'
> & {
  attachments: SessionMessageAttachmentDto[];
};

interface PersistedChatMessageResult {
  savedMessage: ChatRecord;
  sessionId: string;
}

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
    @InjectRepository(ChatRecord)
    private chatMessageRepository: Repository<ChatRecord>,
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly chatSessionService: ChatSessionService,
    private readonly configService: ConfigService,
    private readonly filesService: FilesService,
  ) {}

  private buildMessagePreview(message: string): string {
    return message.length > 50 ? `${message.substring(0, 50)}...` : message;
  }

  private async persistChatMessage(params: {
    userId: string;
    sessionId?: string;
    userMessage: string;
    aiMessage: string;
    model: string;
    usage: CompletionUsageStats;
    attachmentIds: string[];
  }): Promise<PersistedChatMessageResult> {
    return this.dataSource.transaction(async (manager) => {
      let targetSessionId = params.sessionId;
      if (!targetSessionId) {
        const chatSessionRepository = manager.getRepository(ChatSession);
        const session = chatSessionRepository.create({
          userId: params.userId,
          title: '新对话',
          lastActiveAt: new Date(),
        });
        const savedSession = await chatSessionRepository.save(session);
        targetSessionId = savedSession.id;
      }

      const chatMessageRepository = manager.getRepository(ChatRecord);
      const chatMessage = chatMessageRepository.create({
        userId: params.userId,
        sessionId: targetSessionId,
        userMessage: params.userMessage,
        aiMessage: params.aiMessage,
        model: params.model,
        usage: params.usage,
      });

      const savedMessage = await chatMessageRepository.save(chatMessage);

      if (params.attachmentIds.length > 0) {
        await this.filesService.bindAttachmentsToMessage(
          {
            userId: params.userId,
            sessionId: targetSessionId,
            messageId: savedMessage.id,
            attachmentIds: params.attachmentIds,
          },
          manager,
        );
      }

      await manager.getRepository(ChatSession).update(targetSessionId, {
        lastActiveAt: new Date(),
        lastMessagePreview: this.buildMessagePreview(params.userMessage),
      });

      return {
        savedMessage,
        sessionId: targetSessionId,
      };
    });
  }

  /**
   * 获取默认聊天模型
   */
  private getDefaultChatModel(): string {
    return (
      this.configService.get<string>('DEFAULT_CHAT_MODEL') ||
      this.configService.get<string>('ZAIWEN_MODEL') ||
      this.configService.get<string>('CLAUDE_MODEL') ||
      'GLM-5'
    );
  }

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
   * 主聊天链路已收敛为 fileIds 引用，不再接收 base64 内联文件。
   */
  private ensureNoInlineFiles(files?: FileDataDto[]): void {
    if (!files || files.length === 0) {
      return;
    }

    throw new BadRequestException(
      '聊天接口已不再接受 base64 文件，请先调用 /files/upload 上传文件，再通过 fileIds 引用附件',
    );
  }

  /**
   * 创建聊天对话
   * @param createChatDto 聊天请求参数
   */
  async create(createChatDto: CreateChatDto) {
    this.logger.log(`收到聊天请求: ${createChatDto.message}`);

    const userId = createChatDto.userId;
    if (!userId) {
      throw new BadRequestException('用户ID不能为空');
    }

    this.ensureNoInlineFiles(createChatDto.files);

    // 验证用户是否存在
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const sessionId = createChatDto.sessionId;
    if (sessionId) {
      // 验证会话是否存在
      await this.chatSessionService.findByIdForUser(sessionId, userId);
    }

    // 处理附件：统一处理 fileIds 和 files（base64）
    const { attachmentIds, fileDataForAI } =
      await this.filesService.prepareChatAttachments({
        userId,
        fileIds: createChatDto.fileIds,
      });

    // 构建消息数组
    const messages: ChatMessage[] = [];

    // 没有提供历史消息-从数据库加载该会话的历史消息
    if (
      sessionId &&
      (!createChatDto.history || createChatDto.history.length === 0)
    ) {
      const historyMessages = await this.getSessionHistory(
        userId,
        sessionId,
        10,
      );
      historyMessages.forEach((msg) => {
        messages.push(
          { role: 'user', content: msg.userMessage },
          { role: 'assistant', content: msg.aiMessage },
        );
      });
    } else if (createChatDto.history?.length) {
      messages.push(...createChatDto.history);
    }

    // 构建当前用户消息内容（支持多模态）
    const userContent = this.buildMultimodalContent(
      createChatDto.message,
      fileDataForAI.length > 0 ? fileDataForAI : undefined,
    );

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: userContent,
    });

    // 记录文件信息
    if (fileDataForAI.length > 0) {
      this.logger.log(
        `包含 ${fileDataForAI.length} 个附件: ${fileDataForAI.map((f) => f.name).join(', ')}`,
      );
    }

    // 获取默认模型
    const modelId = createChatDto.model || this.getDefaultChatModel();

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

    const { savedMessage, sessionId: persistedSessionId } =
      await this.persistChatMessage({
        userId,
        sessionId,
        userMessage: createChatDto.message,
        aiMessage: assistantMessage,
        model: completion.model,
        usage: completion.usage,
        attachmentIds,
      });

    this.logger.log(`聊天记录已保存: ${savedMessage.id}`);

    return {
      id: savedMessage.id,
      sessionId: persistedSessionId,
      message: assistantMessage,
      model: completion.model,
      usage: completion.usage,
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
    userId: string,
    sessionId: string,
    limit: number = 50,
  ): Promise<ChatRecord[]> {
    await this.chatSessionService.findByIdForUser(sessionId, userId);

    const messages = await this.chatMessageRepository.find({
      where: { sessionId, userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    // 转为正序-便于前端/Prompt直接使用
    return messages.reverse();
  }

  /**
   * 分页获取会话消息
   * @param sessionId 会话 ID
   * @param page 页码
   * @param pageSize 每页数量
   * @param order 排序方式：asc正序，desc倒序
   */
  async getSessionMessages(
    userId: string,
    sessionId: string,
    page: number = 1,
    pageSize: number = 20,
    order: 'asc' | 'desc' = 'desc',
  ): Promise<{
    messages: SessionMessageDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // 验证会话是否存在
    await this.chatSessionService.findByIdForUser(sessionId, userId);

    const skip = (page - 1) * pageSize;

    const [messages, total] = await this.chatMessageRepository.findAndCount({
      where: { sessionId, userId },
      order: { createdAt: order === 'desc' ? 'DESC' : 'ASC' },
      skip,
      take: pageSize,
      relations: ['attachments'], // 加载附件关联
    });

    // 如果是倒序查询-反转数组使消息按时间正序显示
    const orderedMessages = order === 'desc' ? messages.reverse() : messages;

    // 转换附件格式
    const messagesWithAttachments = orderedMessages.map((msg) => ({
      ...msg,
      attachments: (msg.attachments || []).map((att) => ({
        id: att.id,
        url: this.filesService.buildSignedFileUrl(att.id),
        name: att.originalName,
        type: att.storageMime,
        sizeBytes: att.sizeBytes,
        width: att.width,
        height: att.height,
      })),
    }));

    return {
      messages: messagesWithAttachments,
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
  async createStream(
    createChatDto: CreateChatDto,
    options?: { abortSignal?: AbortSignal },
  ) {
    this.logger.log(`收到流式聊天请求: ${createChatDto.message}`);

    const userId = createChatDto.userId;
    if (!userId) {
      throw new BadRequestException('用户ID不能为空');
    }

    this.ensureNoInlineFiles(createChatDto.files);

    // 验证用户是否存在
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 没有提供sessionId-则创建新会话
    let sessionId = createChatDto.sessionId;
    if (!sessionId) {
      this.logger.log('未提供会话ID，创建新会话');
      const newSession = await this.chatSessionService.create({
        userId,
        title: '新对话',
      });
      sessionId = newSession.id;
    } else {
      // 验证会话是否存在
      await this.chatSessionService.findByIdForUser(sessionId, userId);
    }

    // 处理附件：统一处理 fileIds 和 files（base64）
    const { attachmentIds, fileDataForAI } =
      await this.filesService.prepareChatAttachments({
        userId,
        fileIds: createChatDto.fileIds,
      });

    // 构建消息数组
    const messages: ChatMessage[] = [];

    // 没有提供历史消息-从数据库加载该会话的历史消息
    if (!createChatDto.history || createChatDto.history.length === 0) {
      const historyMessages = await this.getSessionHistory(
        userId,
        sessionId,
        10,
      );
      historyMessages.forEach((msg) => {
        messages.push(
          { role: 'user', content: msg.userMessage },
          { role: 'assistant', content: msg.aiMessage },
        );
      });
    } else if (createChatDto.history?.length) {
      messages.push(...createChatDto.history);
    }

    // 构建当前用户消息内容-支持多模态
    const userContent = this.buildMultimodalContent(
      createChatDto.message,
      fileDataForAI.length > 0 ? fileDataForAI : undefined,
    );

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: userContent,
    });

    // 记录文件信息
    if (fileDataForAI.length > 0) {
      this.logger.log(
        `包含 ${fileDataForAI.length} 个附件: ${fileDataForAI.map((f) => f.name).join(', ')}`,
      );
    }

    // 获取默认模型
    const modelId = createChatDto.model || this.getDefaultChatModel();

    // 调用 AI 客户端服务-流式
    const stream = await this.aiClientService.createStreamChatCompletion(
      modelId,
      messages,
      {
        temperature: createChatDto.temperature,
        maxTokens: createChatDto.maxTokens,
        abortSignal: options?.abortSignal,
      },
    );

    // 返回流和必要的上下文信息
    return {
      stream,
      sessionId,
      userId,
      userMessage: createChatDto.message,
      modelId,
      attachmentIds,
    };
  }

  /**
   * 保存流式对话的完整消息
   * （流式传输结束后调用）
   */
  async saveStreamMessage(
    userId: string,
    sessionId: string,
    userMessage: string,
    aiMessage: string,
    model: string,
    usage?: CompletionUsageStats,
    attachmentIds?: string[],
  ) {
    const { savedMessage } = await this.persistChatMessage({
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
      attachmentIds: attachmentIds || [],
    });

    this.logger.log(`流式聊天记录已保存: ${savedMessage.id}`);

    return savedMessage;
  }
}
