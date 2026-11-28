import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { AgentRole } from '../channel/entities/agent-role.entity';
import {
  SwarmOrchestratorService,
  type SwarmTimelineEvent,
} from './services/swarm-orchestrator.service';
import { TraceContextService } from '../observability/services/trace-context.service';
import { WorkflowService } from '../workflow/services/workflow.service';
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
  CompletionOptions,
  CompletionChunk,
  MultimodalContent,
} from './types/completion.types';
import { FilesService } from '../files/files.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { CreditsService } from '../credits/credits.service';
import { ChatCreditCharge } from '../credits/entities/chat-credit-charge.entity';
import {
  type ChatCreditChargeSummary,
  type UserCreditsSnapshot,
  DEFAULT_MODEL_BILLING_MODE,
  DEFAULT_CHAT_BILLING_MODE,
  DEFAULT_CHAT_MODEL_CREDIT_COST,
} from '../credits/types/credits.types';
import {
  extractAssistantContent,
  type ExtractedAssistantReasoning,
} from './utils/assistant-content.util';
import { resolveEffectiveSupportsVision } from './utils/vision-profile.util';
import { WebSearchService } from '../web-search/web-search.service';
import type { SearchSource, WebSearchResult } from '../web-search/types/web-search.types';
import { ToolRegistryService } from '../tools/tools.registry.service';
import { ApprovalManagerService } from './services/approval-manager.service';
import { AgentStreamExecutorService } from './services/agent-stream-executor.service';
import type { ToolExecutionRecord } from '../tools/types/tools.types';
import { HybridRagService, type RagSearchResult } from '../knowledge-base/services/hybrid-rag.service';
import { KnowledgeAssetService } from '../knowledge-base/services/knowledge-asset.service';

export interface SessionMessageAttachmentDto {
  id: string;
  url: string;
  name: string;
  type: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  category?: 'image' | 'pdf' | 'document';
  charCount?: number | null;
  extractedText?: string | null;
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
  | 'sources'
  | 'toolCalls'
  | 'traceId'
  | 'agentTimeline'
  | 'createdAt'
  | 'updatedAt'
> & {
  attachments: SessionMessageAttachmentDto[];
  charge?: ChatCreditChargeSummary | null;
  sources?: SearchSource[] | null;
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
  supportsVision: boolean;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
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
    'image/bmp',
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
    private readonly webSearchService: WebSearchService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly ragService: HybridRagService,
    private readonly approvalManagerService: ApprovalManagerService,
    private readonly agentStreamExecutorService: AgentStreamExecutorService,
    @Optional()
    private readonly knowledgeAssetService?: KnowledgeAssetService,
    @Optional()
    private readonly swarmOrchestratorService?: SwarmOrchestratorService,
    @Optional()
    @InjectRepository(AgentRole)
    private readonly agentRoleRepo?: Repository<AgentRole>,
    @Optional()
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService?: WorkflowService,
    @Optional()
    private readonly traceContext?: TraceContextService,
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
      billingMode: model.billingMode || DEFAULT_CHAT_BILLING_MODE,
      reserveCredits: model.creditCost ?? DEFAULT_CHAT_MODEL_CREDIT_COST,
      inputPrice: Number(model.inputPrice || 0),
      outputPrice: Number(model.outputPrice || 0),
      maxOutput: Number(model.maxOutput || 0),
      providerName: model.provider?.name || null,
      supportsVision: resolveEffectiveSupportsVision({
        providerName: model.provider?.name,
        modelId: model.modelId,
        category: model.category,
        supportsVision: model.supportsVision,
      }),
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
    if (params.model.billingMode === 'flat_per_request') {
      return params.model.reserveCredits || DEFAULT_CHAT_MODEL_CREDIT_COST;
    }

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
    model: Pick<
      ResolvedChatModelConfig,
      'inputPrice' | 'outputPrice' | 'billingMode' | 'reserveCredits'
    >,
  ): number | undefined {
    if (model.billingMode === 'flat_per_request') {
      return model.reserveCredits ?? DEFAULT_CHAT_MODEL_CREDIT_COST;
    }

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
    durationMs?: number | null;
    sources?: SearchSource[] | null;
    toolCalls?: ToolExecutionRecord[] | null;
    traceId?: string | null;
    agentTimeline?: SwarmTimelineEvent[] | null;
    knowledgeBaseIds?: string[];
  }): Promise<PersistedChatMessageResult> {
    return this.dataSource.transaction(async (manager) => {
      let targetSessionId = params.sessionId;
      if (!targetSessionId) {
        const chatSessionRepository = manager.getRepository(ChatSession);
        const session = chatSessionRepository.create({
          userId: params.userId,
          title: '新对话',
          lastActiveAt: new Date(),
          knowledgeBaseIds: params.knowledgeBaseIds || [],
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
        durationMs: params.durationMs || null,
        sources: this.sanitizeSourcesForStorage(params.sources),
        toolCalls: params.toolCalls || null,
        traceId: params.traceId ?? null,
        agentTimeline: params.agentTimeline ?? null,
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
   * 构建多模态与文档增强消息内容
   */
  private buildMultimodalContent(
    textContent: string,
    files?: FileDataDto[],
  ): string | MultimodalContent[] {
    if (!files || files.length === 0) {
      return textContent;
    }

    const imageParts: MultimodalContent[] = [];
    const documentBlocks: string[] = [];

    for (const file of files) {
      if (this.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        imageParts.push({
          type: 'image_url',
          image_url: {
            url: file.base64,
            detail: 'auto',
          },
        });
        this.logger.debug(`添加图片附件: ${file.name} (${file.type})`);
      } else if (file.extractedText && file.extractedText.trim()) {
        const charCount = file.charCount ?? file.extractedText.length;
        documentBlocks.push(
          `【附件文档：${file.name}（共 ${charCount} 字符）】\n\`\`\`\n${file.extractedText}\n\`\`\``,
        );
        this.logger.debug(
          `注入文档内容: ${file.name} (${charCount} 字符)`,
        );
      }
    }

    const userPrompt = textContent?.trim() || '请分析上述附件内容';
    const combinedText =
      documentBlocks.length > 0
        ? `${documentBlocks.join('\n\n')}\n\n【用户提问】：\n${userPrompt}`
        : textContent;

    if (imageParts.length === 0) {
      return combinedText;
    }

    const contentParts: MultimodalContent[] = [...imageParts];
    if (combinedText && combinedText.trim()) {
      contentParts.push({
        type: 'text',
        text: combinedText,
      });
    }

    return contentParts;
  }

  /**
   * 将历史消息中关联的已解析文档内容挂载至历史用户提问，支持同会话多轮追问
   */
  private formatHistoryUserMessage(msg: ChatRecord): string {
    const docBlocks = (msg.attachments || [])
      .filter((att) => Boolean(att.extractedText?.trim()))
      .map((att) => {
        const count = att.charCount ?? att.extractedText!.length;
        return `【附件文档：${att.originalName}（共 ${count} 字符）】\n\`\`\`\n${att.extractedText}\n\`\`\``;
      });

    if (docBlocks.length === 0) {
      return msg.userMessage;
    }

    return `${docBlocks.join('\n\n')}\n\n【用户提问】：\n${msg.userMessage}`;
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

    const createInternal = async (activeTraceId: string | null) => {
      this.ensureNoInlineFiles(createChatDto.files);

      const user = await this.userService.findById(userId);
      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      const sessionId = createChatDto.sessionId;
      let boundSession: ChatSession | null = null;
      if (sessionId) {
        boundSession = await this.chatSessionService.findByIdForUser(sessionId, userId);
        const sessionPatch: Partial<ChatSession> = {};
        if (createChatDto.knowledgeBaseIds !== undefined) {
          sessionPatch.knowledgeBaseIds = createChatDto.knowledgeBaseIds;
        }
        if (createChatDto.workflowId !== undefined) {
          sessionPatch.activeWorkflowId = createChatDto.workflowId || null;
          if (createChatDto.workflowId) sessionPatch.activeRoleId = null;
        }
        if (createChatDto.roleId !== undefined) {
          sessionPatch.activeRoleId = createChatDto.roleId || null;
          if (createChatDto.roleId) sessionPatch.activeWorkflowId = null;
        }
        if (Object.keys(sessionPatch).length > 0) {
          await this.chatSessionService.update(sessionId, sessionPatch as any);
        }
      }

      const effectiveWorkflowId =
        createChatDto.workflowId !== undefined
          ? createChatDto.workflowId || null
          : boundSession?.activeWorkflowId || null;
      const effectiveRoleId =
        !effectiveWorkflowId &&
        (createChatDto.roleId !== undefined
          ? createChatDto.roleId || null
          : boundSession?.activeRoleId || null);
      const selectedRole =
        effectiveRoleId && this.agentRoleRepo
          ? await this.agentRoleRepo.findOne({ where: { id: effectiveRoleId, userId } })
          : null;

      const mergedKbIds = Array.from(
        new Set([
          ...(createChatDto.knowledgeBaseIds?.length
            ? createChatDto.knowledgeBaseIds
            : boundSession?.knowledgeBaseIds || []),
          ...(selectedRole?.knowledgeBaseIds || []),
        ]),
      );
      const effectiveKnowledgeBaseIds = mergedKbIds;

      const clientRequestId = this.createClientRequestId(
        createChatDto.clientRequestId,
      );

      const { attachmentIds, fileDataForAI } =
        await this.filesService.prepareChatAttachments({
          userId,
          fileIds: createChatDto.fileIds,
        });

      const messages: ChatMessage[] = [];
      if (selectedRole?.systemPrompt && !selectedRole.isTeam) {
        messages.push({ role: 'system', content: selectedRole.systemPrompt });
      }

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
            { role: 'user', content: this.formatHistoryUserMessage(msg) },
            { role: 'assistant', content: assistantAnswer },
          );
        });
      } else if (createChatDto.history?.length) {
        messages.push(...createChatDto.history);
      }

      const mergedTools = Array.from(
        new Set([
          ...(createChatDto.enabledTools || []),
          ...(selectedRole?.enabledTools || []),
        ]),
      );
      const openAiTools = mergedTools.length
        ? this.toolRegistryService.toOpenAITools(mergedTools)
        : [];

      let toolExecutionRecords: ToolExecutionRecord[] = [];
      let searchResult: WebSearchResult | null = null;
      if (createChatDto.webSearch && !mergedTools.includes('web_search_v2')) {
        searchResult = await this.webSearchService.search(createChatDto.message);
      }

      const chargeModel = await this.resolveChatModelConfig(
        createChatDto.model || selectedRole?.boundModelId || undefined,
      );
      const existingImageCount = fileDataForAI.filter((f) =>
        this.SUPPORTED_IMAGE_TYPES.includes(f.type),
      ).length;

      const ragContext = await this.resolveKnowledgeBaseContext({
        userId,
        message: createChatDto.message,
        knowledgeBaseIds: effectiveKnowledgeBaseIds,
        supportsVision: chargeModel.supportsVision,
        existingImageCount,
      });

      if (ragContext.sources.length > 0) {
        if (!searchResult) {
          searchResult = {
            query: createChatDto.message,
            sources: ragContext.sources,
            contextPrompt: '',
          };
        } else {
          searchResult.sources.unshift(...ragContext.sources);
        }
      }

      const userContent = this.buildMultimodalContent(
        createChatDto.message,
        fileDataForAI.length > 0 ? fileDataForAI : undefined,
      );

      const finalUserContent = this.assembleFinalUserContent({
        userContent,
        ragContext,
        webSearchContextPrompt: searchResult?.contextPrompt,
      });

      messages.push({
        role: 'user',
        content: finalUserContent,
      });

      if (fileDataForAI.length > 0) {
        this.logger.log(
          `包含 ${fileDataForAI.length} 个附件: ${fileDataForAI.map((f) => f.name).join(', ')}`,
        );
      }

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

        const requestStartTime = Date.now();
        let lastCompletion: CompletionResponse | null = null;
        let accumulatedUsage: CompletionUsageStats = {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        };
        let collectedTimeline: SwarmTimelineEvent[] | null = null;

        if (effectiveWorkflowId && this.workflowService) {
          const wfRes = await this.workflowService.executePublishedWorkflow({
            userId,
            workflowId: effectiveWorkflowId,
            input: createChatDto.message,
            sessionId,
            defaultModelId: chargeModel.modelId,
          });
          if (wfRes.status !== 'completed') {
            throw new BadRequestException(wfRes.error || '工作流执行失败');
          }
          lastCompletion = {
            content: wfRes.content,
            model: chargeModel.modelId,
            usage: wfRes.usage,
          };
          accumulatedUsage = wfRes.usage;
          collectedTimeline = wfRes.timeline.length > 0 ? wfRes.timeline : null;
        } else if (
          selectedRole?.isTeam &&
          selectedRole.teamConfig?.subAgentRoleIds?.length &&
          this.swarmOrchestratorService &&
          this.agentRoleRepo
        ) {
          const subRoles = await this.agentRoleRepo.find({
            where: { id: In(selectedRole.teamConfig.subAgentRoleIds), userId },
          });
          if (subRoles.length > 0) {
            const swarmRes = await this.swarmOrchestratorService.execute({
              teamRole: selectedRole,
              subAgentRoles: subRoles,
              userMessage: createChatDto.message,
              messages,
              defaultModelId: chargeModel.modelId,
              context: { userId, sessionId, userMessage: createChatDto.message },
            });
            lastCompletion = {
              content: swarmRes.content,
              model: chargeModel.modelId,
              usage: swarmRes.usage,
            };
            accumulatedUsage = swarmRes.usage;
            collectedTimeline =
              swarmRes.timeline.length > 0 ? swarmRes.timeline : null;
          }
        }

        if (!lastCompletion) {
          let loopCount = 0;
          const MAX_REACT_LOOPS = 3;

          while (loopCount <= MAX_REACT_LOOPS) {
            const roundTools =
              loopCount < MAX_REACT_LOOPS && openAiTools.length > 0
                ? openAiTools
                : undefined;
            const completion = await this.aiClientService.createChatCompletion(
              chargeModel.modelId,
              messages,
              {
                temperature: createChatDto.temperature,
                maxTokens: createChatDto.maxTokens,
                tools: roundTools,
              },
            );

            lastCompletion = completion;
            accumulatedUsage.promptTokens += completion.usage?.promptTokens || 0;
            accumulatedUsage.completionTokens +=
              completion.usage?.completionTokens || 0;
            accumulatedUsage.totalTokens =
              accumulatedUsage.promptTokens + accumulatedUsage.completionTokens;

            if (!completion.toolCalls || completion.toolCalls.length === 0) {
              break;
            }

            messages.push({
              role: 'assistant',
              content: completion.content || '',
              tool_calls: completion.toolCalls,
            });

            for (const tc of completion.toolCalls) {
              const fnName = tc.function?.name || '';
              let parsedArgs: Record<string, any> = {};
              try {
                parsedArgs = tc.function?.arguments
                  ? JSON.parse(tc.function.arguments)
                  : {};
              } catch {
                parsedArgs = { raw: tc.function?.arguments };
              }

              const execRecord = await this.toolRegistryService.executeTool(
                fnName,
                parsedArgs,
                { userId, sessionId, userMessage: createChatDto.message },
              );
              execRecord.id = tc.id || execRecord.id;
              execRecord.callType = 'model_function_call';
              toolExecutionRecords.push(execRecord);

              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: fnName,
                content:
                  execRecord.result.status === 'success'
                    ? typeof execRecord.result.output === 'string'
                      ? execRecord.result.output
                      : JSON.stringify(execRecord.result.output)
                    : `工具执行失败: ${execRecord.result.error}`,
              });
            }

            loopCount++;
          }
        }

        const durationMs = Date.now() - requestStartTime;
        const finalizedAssistant = this.finalizeAssistantPayload(lastCompletion!);
        const assistantMessage = finalizedAssistant.content;
        const actualCredits = this.resolveTraceOrModelCredits({
          usage: accumulatedUsage,
          chargeModel,
          isOrchestrated: Boolean(effectiveWorkflowId || selectedRole?.isTeam),
        });

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
          model: lastCompletion!.model,
          usage: accumulatedUsage,
          actualCredits,
          attachmentIds,
          durationMs,
          sources: searchResult?.sources || null,
          toolCalls: toolExecutionRecords.length > 0 ? toolExecutionRecords : null,
          traceId: activeTraceId,
          agentTimeline: collectedTimeline,
          knowledgeBaseIds: effectiveKnowledgeBaseIds,
        });

        reservedSessionId = persistedSessionId;
        this.logger.log(`聊天记录已保存: ${savedMessage.id}`);

        return {
          id: savedMessage.id,
          sessionId: persistedSessionId,
          traceId: activeTraceId,
          message: assistantMessage,
          reasoning: finalizedAssistant.reasoning,
          model: lastCompletion!.model,
          usage: accumulatedUsage,
          durationMs,
          charge,
          creditsSnapshot,
          toolCalls: toolExecutionRecords.length > 0 ? toolExecutionRecords : null,
          agentTimeline: collectedTimeline,
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
    };

    if (this.traceContext) {
      return this.traceContext.runWithTrace(
        {
          userId,
          source: createChatDto.workflowId ? 'workflow_chat' : 'web_chat',
          workflowId: createChatDto.workflowId || null,
          roleId: createChatDto.roleId || null,
          sessionId: createChatDto.sessionId || null,
          title: createChatDto.message?.slice(0, 80) || 'Web 对话',
        },
        async (traceId) => createInternal(traceId),
      );
    }

    return createInternal(null);
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
   * 获取指定会话的聊天历史（包含关联附件以支持文档多轮追问）
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
      relations: ['attachments'],
    });

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
    await this.chatSessionService.findByIdForUser(sessionId, userId);

    const skip = (page - 1) * pageSize;

    const [messages, total] = await this.chatMessageRepository.findAndCount({
      where: { sessionId, userId },
      order: { createdAt: order === 'desc' ? 'DESC' : 'ASC' },
      skip,
      take: pageSize,
      relations: ['attachments'],
    });

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
      sources: this.hydrateSourcesWithSignedUrls(msg.sources),
      toolCalls: msg.toolCalls || null,
      attachments: (msg.attachments || []).map((att) => ({
        id: att.id,
        url: this.filesService.buildSignedFileUrl(att.id),
        name: att.originalName,
        type: att.storageMime,
        sizeBytes: att.sizeBytes,
        width: att.width,
        height: att.height,
        category: FilesService.resolveAttachmentCategory(
          att.storageMime,
          att.originalName,
        ),
        charCount: att.charCount ?? null,
        extractedText: att.extractedText ?? null,
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

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    let sessionId = createChatDto.sessionId;
    let boundSession: ChatSession | null = null;
    if (!sessionId) {
      this.logger.log('未提供会话ID，创建新会话');
      const newSession = await this.chatSessionService.create({
        userId,
        title: '新对话',
        knowledgeBaseIds: createChatDto.knowledgeBaseIds || [],
        activeRoleId: createChatDto.roleId || null,
        activeWorkflowId: createChatDto.workflowId || null,
      } as any);
      sessionId = newSession.id;
      boundSession = newSession;
    } else {
      boundSession = await this.chatSessionService.findByIdForUser(sessionId, userId);
      const sessionPatch: Partial<ChatSession> = {};
      if (createChatDto.knowledgeBaseIds !== undefined) {
        sessionPatch.knowledgeBaseIds = createChatDto.knowledgeBaseIds;
      }
      if (createChatDto.workflowId !== undefined) {
        sessionPatch.activeWorkflowId = createChatDto.workflowId || null;
        if (createChatDto.workflowId) sessionPatch.activeRoleId = null;
      }
      if (createChatDto.roleId !== undefined) {
        sessionPatch.activeRoleId = createChatDto.roleId || null;
        if (createChatDto.roleId) sessionPatch.activeWorkflowId = null;
      }
      if (Object.keys(sessionPatch).length > 0) {
        await this.chatSessionService.update(sessionId, sessionPatch as any);
      }
    }

    const effectiveWorkflowId =
      createChatDto.workflowId !== undefined
        ? createChatDto.workflowId || null
        : boundSession?.activeWorkflowId || null;
    const effectiveRoleId =
      !effectiveWorkflowId &&
      (createChatDto.roleId !== undefined
        ? createChatDto.roleId || null
        : boundSession?.activeRoleId || null);
    const selectedRole =
      effectiveRoleId && this.agentRoleRepo
        ? await this.agentRoleRepo.findOne({ where: { id: effectiveRoleId, userId } })
        : null;

    const effectiveKnowledgeBaseIds = Array.from(
      new Set([
        ...(createChatDto.knowledgeBaseIds?.length
          ? createChatDto.knowledgeBaseIds
          : boundSession?.knowledgeBaseIds || []),
        ...(selectedRole?.knowledgeBaseIds || []),
      ]),
    );

    const clientRequestId = this.createClientRequestId(
      createChatDto.clientRequestId,
    );

    const { attachmentIds, fileDataForAI } =
      await this.filesService.prepareChatAttachments({
        userId,
        fileIds: createChatDto.fileIds,
      });

    const messages: ChatMessage[] = [];
    if (selectedRole?.systemPrompt && !selectedRole.isTeam) {
      messages.push({ role: 'system', content: selectedRole.systemPrompt });
    }

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
          { role: 'user', content: this.formatHistoryUserMessage(msg) },
          { role: 'assistant', content: assistantAnswer },
        );
      });
    } else if (createChatDto.history?.length) {
      messages.push(...createChatDto.history);
    }

    const mergedTools = Array.from(
      new Set([
        ...(createChatDto.enabledTools || []),
        ...(selectedRole?.enabledTools || []),
      ]),
    );
    const openAiTools = mergedTools.length
      ? this.toolRegistryService.toOpenAITools(mergedTools)
      : [];

    let toolExecutionRecords: ToolExecutionRecord[] = [];
    let searchResult: WebSearchResult | null = null;
    if (createChatDto.webSearch && !mergedTools.includes('web_search_v2')) {
      searchResult = await this.webSearchService.search(createChatDto.message);
    }

    const chargeModel = await this.resolveChatModelConfig(
      createChatDto.model || selectedRole?.boundModelId || undefined,
    );
    const existingImageCount = fileDataForAI.filter((f) =>
      this.SUPPORTED_IMAGE_TYPES.includes(f.type),
    ).length;

    const ragContext = await this.resolveKnowledgeBaseContext({
      userId,
      message: createChatDto.message,
      knowledgeBaseIds: effectiveKnowledgeBaseIds,
      supportsVision: chargeModel.supportsVision,
      existingImageCount,
    });

    if (ragContext.sources.length > 0) {
      if (!searchResult) {
        searchResult = {
          query: createChatDto.message,
          sources: ragContext.sources,
          contextPrompt: '',
        };
      } else {
        searchResult.sources.unshift(...ragContext.sources);
      }
    }

    const userContent = this.buildMultimodalContent(
      createChatDto.message,
      fileDataForAI.length > 0 ? fileDataForAI : undefined,
    );

    const finalUserContent = this.assembleFinalUserContent({
      userContent,
      ragContext,
      webSearchContextPrompt: searchResult?.contextPrompt,
    });

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: finalUserContent,
    });

    // 记录文件信息
    if (fileDataForAI.length > 0) {
      this.logger.log(
        `包含 ${fileDataForAI.length} 个附件: ${fileDataForAI.map((f) => f.name).join(', ')}`,
      );
    }

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

      let stream: AsyncIterable<CompletionChunk>;

      if (effectiveWorkflowId && this.workflowService) {
        const wfService = this.workflowService;
        stream = this.createOrchestratedStream(async (emitTimeline) => {
          const res = await wfService.executePublishedWorkflow({
            userId,
            workflowId: effectiveWorkflowId,
            input: createChatDto.message,
            sessionId,
            defaultModelId: chargeModel.modelId,
            abortSignal: options?.abortSignal,
            onEvent: (evt) => {
              if (evt.type === 'timeline') {
                emitTimeline(evt.timelineEvent);
              }
            },
          });
          if (res.status !== 'completed') {
            throw new BadRequestException(res.error || '工作流执行失败');
          }
          return { content: res.content, usage: res.usage };
        });
      } else if (
        selectedRole?.isTeam &&
        selectedRole.teamConfig?.subAgentRoleIds?.length &&
        this.swarmOrchestratorService &&
        this.agentRoleRepo
      ) {
        const subRoles = await this.agentRoleRepo.find({
          where: { id: In(selectedRole.teamConfig.subAgentRoleIds), userId },
        });
        if (subRoles.length > 0) {
          const swarmSvc = this.swarmOrchestratorService;
          stream = this.createOrchestratedStream(async (emitTimeline) => {
            const res = await swarmSvc.execute({
              teamRole: selectedRole,
              subAgentRoles: subRoles,
              userMessage: createChatDto.message,
              messages,
              defaultModelId: chargeModel.modelId,
              context: { userId, sessionId, userMessage: createChatDto.message },
              onTimelineEvent: emitTimeline,
            });
            return { content: res.content, usage: res.usage };
          });
        } else {
          stream = this.agentStreamExecutorService.executeStream({
            modelId: chargeModel.modelId,
            initialMessages: messages,
            tools: openAiTools.length > 0 ? openAiTools : undefined,
            options: {
              temperature: createChatDto.temperature,
              maxTokens: createChatDto.maxTokens,
              abortSignal: options?.abortSignal,
            },
            context: { userId, sessionId, userMessage: createChatDto.message },
            toolExecutionRecords,
          });
        }
      } else {
        stream = this.agentStreamExecutorService.executeStream({
          modelId: chargeModel.modelId,
          initialMessages: messages,
          tools: openAiTools.length > 0 ? openAiTools : undefined,
          options: {
            temperature: createChatDto.temperature,
            maxTokens: createChatDto.maxTokens,
            abortSignal: options?.abortSignal,
          },
          context: { userId, sessionId, userMessage: createChatDto.message },
          toolExecutionRecords,
        });
      }

      return {
        stream,
        sessionId,
        userId,
        userMessage: createChatDto.message,
        modelId: chargeModel.modelId,
        clientRequestId,
        attachmentIds,
        searchResult,
        toolExecutions: toolExecutionRecords,
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
   * 执行具备 ReAct 闭环调度的流式补全
   */
  /**
   * 执行具备 ReAct 闭环调度的流式补全 (向后兼容委托至 AgentStreamExecutorService)
   */
  private executeReActStream(params: {
    modelId: string;
    initialMessages: ChatMessage[];
    tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: any } }>;
    options?: CompletionOptions;
    context: { userId: string; sessionId: string; userMessage: string };
    toolExecutionRecords: ToolExecutionRecord[];
  }): AsyncIterable<CompletionChunk> {
    return this.agentStreamExecutorService.executeStream(params);
  }

  /**
   * 保存流式对话的完整消息
   * （流式传输结束后调用）
   */
/**
   * 提交高危工具审批裁决
   */
  async decideApproval(
    approvalId: string,
    decision: 'approved' | 'rejected',
    userId: string,
    reason?: string,
  ) {
    const approval = await this.approvalManagerService.getPendingApproval(approvalId);
    if (!approval) {
      throw new NotFoundException('未找到对应待审批任务或已过期');
    }

    if (approval.userId && approval.userId !== userId) {
      throw new ForbiddenException('无权对此审批任务进行裁决');
    }

    const resolved = await this.approvalManagerService.resolveApproval(
      approvalId,
      decision,
      userId,
      reason,
    );

    return {
      approvalId: resolved.approvalId,
      status: resolved.status,
      decisionReason: resolved.decisionReason,
      decidedAt: resolved.decidedAt,
    };
  }

  private resolveTraceOrModelCredits(params: {
    usage?: CompletionUsageStats | null;
    chargeModel: Pick<
      ResolvedChatModelConfig,
      'inputPrice' | 'outputPrice' | 'billingMode' | 'reserveCredits'
    >;
    isOrchestrated: boolean;
  }): number | undefined {
    if (params.isOrchestrated && this.traceContext) {
      const traceUsage = this.traceContext.getCurrentUsageSummary();
      if (traceUsage.estimatedCredits > 0) {
        return Math.max(1, Math.ceil(traceUsage.estimatedCredits));
      }
    }
    return this.estimateActualChargeCredits(params.usage, params.chargeModel);
  }

  private createOrchestratedStream(
    runner: (
      emitTimeline: (evt: SwarmTimelineEvent) => void,
    ) => Promise<{ content: string; usage?: CompletionUsageStats }>,
  ): AsyncIterable<CompletionChunk> {
    return {
      async *[Symbol.asyncIterator]() {
        const queue: CompletionChunk[] = [];
        let wake: (() => void) | null = null;
        let finished = false;
        let runError: unknown = null;
        let finalOutcome: { content: string; usage?: CompletionUsageStats } | null =
          null;

        const enqueue = (chunk: CompletionChunk) => {
          queue.push(chunk);
          if (wake) {
            const fn = wake;
            wake = null;
            fn();
          }
        };

        const outcomeHolder: {
          value: { content: string; usage?: CompletionUsageStats } | null;
        } = { value: finalOutcome };

        void runner((timelineEvent) => {
          enqueue({ type: 'agent_timeline_event', timelineEvent });
        })
          .then((outcome) => {
            outcomeHolder.value = outcome;
          })
          .catch((err) => {
            runError = err;
          })
          .finally(() => {
            finished = true;
            if (wake) {
              const fn = wake;
              wake = null;
              fn();
            }
          });

        while (!finished || queue.length > 0) {
          if (queue.length > 0) {
            yield queue.shift()!;
            continue;
          }
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }

        if (runError) {
          throw runError;
        }

        const resolvedOutcome = outcomeHolder.value;
        if (resolvedOutcome?.content) {
          yield {
            type: 'answer_delta',
            delta: { content: resolvedOutcome.content },
          };
        }

        yield {
          delta: { content: '' },
          finish_reason: 'stop',
          usage: resolvedOutcome?.usage || null,
        };
      },
    };
  }

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
    durationMs?: number | null,
    sources?: SearchSource[] | null,
    toolCalls?: ToolExecutionRecord[] | null,
    traceId?: string | null,
    agentTimeline?: SwarmTimelineEvent[] | null,
  ) {
    const chargeModel = await this.resolveChatModelConfig(model);
    const actualCredits = this.resolveTraceOrModelCredits({
      usage,
      chargeModel,
      isOrchestrated: Boolean(agentTimeline && agentTimeline.length > 0),
    });
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
      durationMs: durationMs || null,
      sources: sources || null,
      toolCalls: toolCalls || null,
      traceId: traceId ?? null,
      agentTimeline: agentTimeline ?? null,
    });

    this.logger.log(`流式聊天记录已保存: ${savedMessage.id}`);

    return {
      savedMessage,
      charge,
      creditsSnapshot,
    };
  }

  private sanitizeSourcesForStorage(
    sources?: SearchSource[] | null,
  ): SearchSource[] | null {
    if (!sources || sources.length === 0) return null;
    // 剥离带过期时间的短期签名 URL，历史回放时基于稳定的 assetId 重新签发
    return sources.map((source) => {
      if (!source.visualAssetUrl) return source;
      const cloned = { ...source };
      delete cloned.visualAssetUrl;
      return cloned;
    });
  }

  private hydrateSourcesWithSignedUrls(
    sources?: SearchSource[] | null,
  ): SearchSource[] | null {
    const assetService = this.knowledgeAssetService;
    if (!sources || sources.length === 0) return sources ?? null;
    if (!assetService) return sources;

    return sources.map((source) => {
      if (!source.assetId) return source;
      return {
        ...source,
        visualAssetUrl: assetService.buildSignedAssetUrl(source.assetId),
      };
    });
  }

  private resolveRagChatImageLimit(): number {
    const raw =
      this.configService.get<string>('KNOWLEDGE_CHAT_MAX_IMAGES') ||
      process.env.KNOWLEDGE_CHAT_MAX_IMAGES;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.min(6, Math.floor(parsed));
    }
    return 3;
  }

  private assembleFinalUserContent(params: {
    userContent: string | MultimodalContent[];
    ragContext: {
      promptText: string;
      visualParts: MultimodalContent[];
    };
    webSearchContextPrompt?: string;
  }): string | MultimodalContent[] {
    const { userContent, ragContext, webSearchContextPrompt } = params;
    const hasRagVisuals = ragContext.visualParts.length > 0;

    if (!hasRagVisuals && typeof userContent === 'string') {
      let text = userContent;
      if (ragContext.promptText) {
        text = `${ragContext.promptText}\n\n${text}`;
      }
      if (webSearchContextPrompt) {
        text = `${webSearchContextPrompt}\n\n【用户提问】：\n${text}`;
      }
      return text;
    }

    const parts: MultimodalContent[] = [];
    if (webSearchContextPrompt) {
      parts.push({
        type: 'text',
        text: `${webSearchContextPrompt}\n\n【用户提问】：`,
      });
    }
    if (ragContext.promptText) {
      parts.push({ type: 'text', text: `${ragContext.promptText}\n\n` });
    }
    if (hasRagVisuals) {
      parts.push(...ragContext.visualParts);
    }
    if (typeof userContent === 'string') {
      if (userContent) {
        parts.push({ type: 'text', text: userContent });
      }
    } else {
      parts.push(...userContent);
    }

    return parts;
  }

  /**
   * 检索知识库并生成 RAG 增强提示词、多模态附图与证据溯源
   */
  private async resolveKnowledgeBaseContext(params: {
    userId: string;
    message: string;
    knowledgeBaseIds?: string[];
    supportsVision?: boolean;
    existingImageCount?: number;
  }): Promise<{
    promptText: string;
    sources: SearchSource[];
    visualParts: MultimodalContent[];
  }> {
    if (!params.knowledgeBaseIds?.length) {
      return { promptText: '', sources: [], visualParts: [] };
    }

    try {
      const ragResults = await this.ragService.search({
        userId: params.userId,
        query: params.message,
        knowledgeBaseIds: params.knowledgeBaseIds,
        limit: 5,
      });

      if (ragResults.length === 0) {
        return { promptText: '', sources: [], visualParts: [] };
      }

      const maxRagImages = this.resolveRagChatImageLimit();
      const maxSlots = params.supportsVision
        ? Math.max(0, Math.min(maxRagImages, 6 - (params.existingImageCount ?? 0)))
        : 0;

      const visualParts: MultimodalContent[] = [];
      const injectedAssetIds = new Set<string>();
      const injectedSourceIndexes = new Set<number>();

      if (maxSlots > 0 && this.knowledgeAssetService) {
        for (let idx = 0; idx < ragResults.length; idx++) {
          if (injectedAssetIds.size >= maxSlots) break;
          const item = ragResults[idx];
          if (!item.assetId || injectedAssetIds.has(item.assetId)) {
            continue;
          }

          const dataUrl = await this.knowledgeAssetService.readAssetAsDataUrl(
            item.assetId,
            params.userId,
          );
          if (!dataUrl) {
            continue;
          }

          injectedAssetIds.add(item.assetId);
          injectedSourceIndexes.add(idx);
          const figureOrder = injectedAssetIds.size;
          const pageSuffix = item.pageNumber ? ` 第 ${item.pageNumber} 页` : '';

          visualParts.push({
            type: 'text',
            text: `[知识库参考附图 ${figureOrder}，对应引用 [${idx + 1}] 《${item.documentTitle}》${pageSuffix}]`,
          });
          visualParts.push({
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'auto' },
          });
        }
      }

      const sources: SearchSource[] = ragResults.map((r, idx) => ({
        id: idx + 1,
        title: r.documentTitle,
        url: '',
        snippet: r.content,
        score: r.score,
        isKnowledgeBase: true,
        knowledgeBaseId: r.knowledgeBaseId,
        documentId: r.documentId,
        chunkId: r.chunkId,
        chunkIndex: r.chunkIndex,
        hitSource: r.hitSource,
        denseScore: r.denseScore,
        rerankScore: r.rerankScore,
        matchedTerms: r.matchedTerms,
        highlights: r.highlights,
        chunkType: r.chunkType,
        assetId: r.assetId,
        assetType: r.assetType as SearchSource['assetType'],
        visualType: r.visualType as SearchSource['visualType'],
        pageNumber: r.pageNumber,
        visualAssetUrl: r.visualAssetUrl,
        visualInjected: Boolean(
          r.assetId &&
            (injectedSourceIndexes.has(idx) || injectedAssetIds.has(r.assetId)),
        ),
      }));

      const promptText = this.buildRagContextPrompt(
        ragResults,
        visualParts.length > 0,
      );
      return { promptText, sources, visualParts };
    } catch (err: any) {
      this.logger.warn(`知识库检索执行失败: ${err.message}`);
      return { promptText: '', sources: [], visualParts: [] };
    }
  }

  /**
   * 构造 RAG 结构化上下文与防幻觉指令
   */
  private buildRagContextPrompt(
    results: RagSearchResult[],
    hasVisualAttachments = false,
  ): string {
    const docChunks = results
      .map(
        (r, i) =>
          `[${i + 1}] 《${r.documentTitle}》（匹配度 ${(r.score * 100).toFixed(0)}%）:\n${r.content}`,
      )
      .join('\n\n');

    const visualGuideline = hasVisualAttachments
      ? '\n3. 随附的知识库参考附图已按引用编号标注，请结合原图细节与文字切片中的精确数值综合分析作答。'
      : '';

    return `【关联知识库资料】：
以下是从您关联的知识库中检索出的真实参考切片：
${docChunks}

【回答指引】：
1. 优先依据上述知识库资料回答问题，并在引用的论断或信息末尾使用引用角标标注来源，如 [1] 或 [2]；
2. 若参考资料未包含回答所需的内容，请明确指出“在当前知识库中未检索到相关内容”，切勿编造虚假信息。${visualGuideline}`;
  }
}
