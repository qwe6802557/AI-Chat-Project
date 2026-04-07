import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
  CompletionResponse,
  MultimodalContent,
} from './types/completion.types';
import { FilesService } from '../files/files.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { CreditsService } from '../credits/credits.service';
import { ChatCreditCharge } from '../credits/entities/chat-credit-charge.entity';
import type {
  ChatCreditChargeSummary,
  UserCreditsSnapshot,
} from '../credits/types/credits.types';
import { DEFAULT_MODEL_BILLING_MODE } from '../credits/types/credits.types';
import {
  extractAssistantContent,
  type ExtractedAssistantReasoning,
} from './utils/assistant-content.util';

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
  | 'reasoning'
  | 'createdAt'
  | 'updatedAt'
> & {
  attachments: SessionMessageAttachmentDto[];
  charge?: ChatCreditChargeSummary | null;
};

interface PersistedChatMessageResult {
  savedMessage: ChatRecord;
  sessionId: string;
  charge: ChatCreditChargeSummary;
  creditsSnapshot: UserCreditsSnapshot;
}

interface FinalizedAssistantPayload {
  content: string;
  reasoning: ExtractedAssistantReasoning | null;
}

interface ResolvedChatModelConfig {
  modelId: string;
  billingMode: string;
  reserveCredits: number;
  inputPrice: number;
  outputPrice: number;
  maxOutput: number;
  providerName?: string | null;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  // 预占阶段只能做启发式估算；图片输入额外留出保守的 token 预算，避免低估。
  private readonly IMAGE_INPUT_TOKEN_BUDGET = 1500;
  private readonly DEFAULT_OUTPUT_TOKEN_BUDGET = 4096;

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
    private readonly aiModelService: AiModelService,
    private readonly creditsService: CreditsService,
  ) {}

  private buildMessagePreview(message: string): string {
    return message.length > 50 ? `${message.substring(0, 50)}...` : message;
  }

  private createClientRequestId(clientRequestId?: string): string {
    return clientRequestId?.trim() || randomUUID();
  }

  private async resolveChatModelConfig(
    requestedModel?: string,
  ): Promise<ResolvedChatModelConfig> {
    const modelId = requestedModel || this.getDefaultChatModel();
    const model = await this.aiModelService.findByModelId(modelId, true);

    return {
      modelId: model.modelId,
      billingMode:
        model.billingMode === 'flat_per_request'
          ? DEFAULT_MODEL_BILLING_MODE
          : model.billingMode,
      reserveCredits: model.creditCost,
      inputPrice: Number(model.inputPrice || 0),
      outputPrice: Number(model.outputPrice || 0),
      maxOutput: Number(model.maxOutput || 0),
      providerName: model.provider?.name || null,
    };
  }

  private estimateTextTokens(text: string): number {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return 0;
    }

    let asciiChars = 0;
    let nonAsciiChars = 0;
    for (const char of normalizedText) {
      if ((char.codePointAt(0) || 0) <= 0x7f) {
        asciiChars += 1;
      } else {
        nonAsciiChars += 1;
      }
    }

    return Math.max(1, Math.ceil(asciiChars / 4) + nonAsciiChars);
  }

  private estimateContentTokens(content: ChatMessage['content']): number {
    if (typeof content === 'string') {
      return this.estimateTextTokens(content);
    }

    return content.reduce((sum, part) => {
      if (part.type === 'text') {
        return sum + this.estimateTextTokens(part.text);
      }

      if (part.type === 'image_url') {
        return sum + this.IMAGE_INPUT_TOKEN_BUDGET;
      }

      return sum;
    }, 0);
  }

  private estimatePromptTokens(messages: ChatMessage[]): number {
    const contentTokens = messages.reduce((sum, message) => {
      return sum + this.estimateContentTokens(message.content);
    }, 0);

    return contentTokens + Math.max(8, messages.length * 6);
  }

  private estimateReserveCredits(params: {
    messages: ChatMessage[];
    model: ResolvedChatModelConfig;
    maxTokens?: number;
  }): number {
    const promptTokens = this.estimatePromptTokens(params.messages);
    const outputTokenBudget =
      params.maxTokens ||
      params.model.maxOutput ||
      this.DEFAULT_OUTPUT_TOKEN_BUDGET;
    const estimatedPromptCost =
      (promptTokens / 1000) * Number(params.model.inputPrice || 0);
    const estimatedOutputCost =
      (outputTokenBudget / 1000) * Number(params.model.outputPrice || 0);
    const estimatedCredits = Math.ceil(
      estimatedPromptCost + estimatedOutputCost,
    );

    return Math.max(params.model.reserveCredits, estimatedCredits);
  }

  private estimateActualChargeCredits(
    usage: CompletionUsageStats | null | undefined,
    model: Pick<ResolvedChatModelConfig, 'inputPrice' | 'outputPrice'>,
  ): number | undefined {
    if (!usage) {
      return undefined;
    }

    const promptTokens = Number(usage.promptTokens || 0);
    const completionTokens = Number(usage.completionTokens || 0);
    if (promptTokens <= 0 && completionTokens <= 0) {
      return 0;
    }

    const estimatedTotalCost =
      usage.estimatedTotalCost ??
      (promptTokens / 1000) * Number(model.inputPrice || 0) +
        (completionTokens / 1000) * Number(model.outputPrice || 0);

    if (estimatedTotalCost <= 0) {
      return 0;
    }

    return Math.max(1, Math.ceil(estimatedTotalCost));
  }

  private async reserveChatCharge(params: {
    userId: string;
    clientRequestId: string;
    sessionId?: string;
    model: ResolvedChatModelConfig;
    reserveCredits: number;
  }): Promise<{
    charge: ChatCreditChargeSummary;
    creditsSnapshot: UserCreditsSnapshot;
  }> {
    return this.creditsService.reserveChatCharge({
      userId: params.userId,
      clientRequestId: params.clientRequestId,
      sessionId: params.sessionId,
      modelId: params.model.modelId,
      billingMode: params.model.billingMode,
      creditCost: params.reserveCredits,
      ruleSnapshot: {
        modelId: params.model.modelId,
        billingMode: params.model.billingMode,
        reserveCredits: params.reserveCredits,
        inputPrice: params.model.inputPrice,
        outputPrice: params.model.outputPrice,
        providerName: params.model.providerName || null,
      },
    });
  }

  private async persistChatMessage(params: {
    userId: string;
    sessionId?: string;
    clientRequestId: string;
    userMessage: string;
    aiMessage: string;
    reasoning?: ExtractedAssistantReasoning | null;
    model: string;
    usage?: CompletionUsageStats | null;
    actualCredits?: number;
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
        reasoning: params.reasoning || null,
        model: params.model,
        usage: params.usage || null,
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

      const captureResult = await this.creditsService.captureChatCharge(
        {
          userId: params.userId,
          clientRequestId: params.clientRequestId,
          sessionId: targetSessionId,
          messageId: savedMessage.id,
          totalCredits: params.actualCredits,
        },
        manager,
      );

      return {
        savedMessage,
        sessionId: targetSessionId,
        charge: captureResult.charge,
        creditsSnapshot: captureResult.creditsSnapshot,
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

  async releaseReservedChatCharge(params: {
    userId: string;
    clientRequestId: string;
    sessionId?: string;
    failureReason?: string;
  }) {
    return this.creditsService.releaseChatCharge({
      userId: params.userId,
      clientRequestId: params.clientRequestId,
      sessionId: params.sessionId,
      failureReason: params.failureReason,
    });
  }

  async releaseReservedChatChargeSafely(params: {
    userId: string;
    clientRequestId: string;
    sessionId?: string;
    failureReason?: string;
  }): Promise<void> {
    try {
      await this.releaseReservedChatCharge(params);
    } catch (releaseError) {
      this.logger.error('释放预占积分失败:', releaseError);
    }
  }

  private finalizeAssistantPayload(
    completion: Pick<CompletionResponse, 'content' | 'reasoning'>,
  ): FinalizedAssistantPayload {
    if (completion.reasoning) {
      return {
        content: completion.content,
        reasoning: completion.reasoning,
      };
    }

    const extracted = extractAssistantContent(completion.content);
    return {
      content: extracted.answer,
      reasoning: extracted.reasoning,
    };
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

    const clientRequestId = this.createClientRequestId(
      createChatDto.clientRequestId,
    );

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
        const assistantAnswer = msg.reasoning
          ? msg.aiMessage
          : extractAssistantContent(msg.aiMessage || '').answer;
        messages.push(
          { role: 'user', content: msg.userMessage },
          { role: 'assistant', content: assistantAnswer },
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

    const chargeModel = await this.resolveChatModelConfig(createChatDto.model);
    const reserveCredits = this.estimateReserveCredits({
      messages,
      model: chargeModel,
      maxTokens: createChatDto.maxTokens,
    });
    let reservedSessionId = sessionId;
    let reservedCharge: ChatCreditChargeSummary | null = null;

    try {
      const reserveResult = await this.reserveChatCharge({
        userId,
        clientRequestId,
        sessionId,
        model: chargeModel,
        reserveCredits,
      });
      reservedCharge = reserveResult.charge;

      const completion = await this.aiClientService.createChatCompletion(
        chargeModel.modelId,
        messages,
        {
          temperature: createChatDto.temperature,
          maxTokens: createChatDto.maxTokens,
        },
      );

      const finalizedAssistant = this.finalizeAssistantPayload(completion);
      const assistantMessage = finalizedAssistant.content;
      const actualCredits = this.estimateActualChargeCredits(
        completion.usage,
        chargeModel,
      );

      this.logger.log(`AI 回复: ${assistantMessage.substring(0, 50)}...`);

      const {
        savedMessage,
        sessionId: persistedSessionId,
        charge,
        creditsSnapshot,
      } = await this.persistChatMessage({
        userId,
        sessionId,
        clientRequestId,
        userMessage: createChatDto.message,
        aiMessage: assistantMessage,
        reasoning: finalizedAssistant.reasoning,
        model: completion.model,
        usage: completion.usage,
        actualCredits,
        attachmentIds,
      });

      reservedSessionId = persistedSessionId;
      this.logger.log(`聊天记录已保存: ${savedMessage.id}`);

      return {
        id: savedMessage.id,
        sessionId: persistedSessionId,
        message: assistantMessage,
        reasoning: finalizedAssistant.reasoning,
        model: completion.model,
        usage: completion.usage,
        charge,
        creditsSnapshot,
        createdAt: savedMessage.createdAt,
      };
    } catch (error) {
      if (reservedCharge) {
        await this.releaseReservedChatChargeSafely({
          userId,
          clientRequestId,
          sessionId: reservedSessionId,
          failureReason:
            error instanceof Error
              ? error.message
              : '聊天请求失败，释放预占积分',
        });
      }
      throw error;
    }
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

    const messageIds = orderedMessages.map((message) => message.id);
    const chargeMap = new Map<string, ChatCreditChargeSummary>();

    if (messageIds.length > 0) {
      const charges = await this.dataSource
        .getRepository(ChatCreditCharge)
        .createQueryBuilder('charge')
        .where('charge.userId = :userId', { userId })
        .andWhere('charge.messageId IN (:...messageIds)', { messageIds })
        .andWhere('charge.status = :status', { status: 'captured' })
        .getMany();

      charges.forEach((charge) => {
        if (!charge.messageId) {
          return;
        }

        chargeMap.set(charge.messageId, {
          id: charge.id,
          clientRequestId: charge.clientRequestId,
          modelId: charge.modelId,
          billingMode: charge.billingMode,
          credits: charge.totalCredits,
          status: charge.status,
        });
      });
    }

    // 转换附件格式
    const messagesWithAttachments = orderedMessages.map((msg) => ({
      ...(() => {
        if (msg.reasoning) {
          return msg;
        }

        const extracted = extractAssistantContent(msg.aiMessage || '');
        if (!extracted.reasoning) {
          return msg;
        }

        return {
          ...msg,
          aiMessage: extracted.answer,
          reasoning: extracted.reasoning,
        };
      })(),
      charge: chargeMap.get(msg.id) || null,
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

    const clientRequestId = this.createClientRequestId(
      createChatDto.clientRequestId,
    );

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
        const assistantAnswer = msg.reasoning
          ? msg.aiMessage
          : extractAssistantContent(msg.aiMessage || '').answer;
        messages.push(
          { role: 'user', content: msg.userMessage },
          { role: 'assistant', content: assistantAnswer },
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

    const chargeModel = await this.resolveChatModelConfig(createChatDto.model);
    const reserveCredits = this.estimateReserveCredits({
      messages,
      model: chargeModel,
      maxTokens: createChatDto.maxTokens,
    });
    let hasReservedCharge = false;

    try {
      await this.reserveChatCharge({
        userId,
        clientRequestId,
        sessionId,
        model: chargeModel,
        reserveCredits,
      });
      hasReservedCharge = true;

      const stream = await this.aiClientService.createStreamChatCompletion(
        chargeModel.modelId,
        messages,
        {
          temperature: createChatDto.temperature,
          maxTokens: createChatDto.maxTokens,
          abortSignal: options?.abortSignal,
        },
      );

      return {
        stream,
        sessionId,
        userId,
        userMessage: createChatDto.message,
        modelId: chargeModel.modelId,
        clientRequestId,
        attachmentIds,
      };
    } catch (error) {
      if (hasReservedCharge) {
        await this.releaseReservedChatChargeSafely({
          userId,
          clientRequestId,
          sessionId,
          failureReason:
            error instanceof Error
              ? error.message
              : '流式聊天初始化失败，释放预占积分',
        });
      }
      throw error;
    }
  }

  /**
   * 保存流式对话的完整消息
   * （流式传输结束后调用）
   */
  async saveStreamMessage(
    userId: string,
    sessionId: string,
    clientRequestId: string,
    userMessage: string,
    aiMessage: string,
    reasoning: ExtractedAssistantReasoning | null,
    model: string,
    usage?: CompletionUsageStats,
    attachmentIds?: string[],
  ) {
    const chargeModel = await this.resolveChatModelConfig(model);
    const actualCredits = this.estimateActualChargeCredits(usage, chargeModel);
    const { savedMessage, charge, creditsSnapshot } = await this.persistChatMessage({
      userId,
      sessionId,
      clientRequestId,
      userMessage,
      aiMessage,
      reasoning,
      model,
      usage: usage || null,
      actualCredits,
      attachmentIds: attachmentIds || [],
    });

    this.logger.log(`流式聊天记录已保存: ${savedMessage.id}`);

    return {
      savedMessage,
      charge,
      creditsSnapshot,
    };
  }
}
