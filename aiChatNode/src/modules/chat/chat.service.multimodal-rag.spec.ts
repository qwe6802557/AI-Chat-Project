import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { AIClientService } from './services/ai-client.service';
import { ChatMessage as ChatRecord } from './entities/chat.entity';
import { UserService } from '../user/user.service';
import { ChatSessionService } from './chat-session.service';
import { FilesService } from '../files/files.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { CreditsService } from '../credits/credits.service';
import { WebSearchService } from '../web-search/web-search.service';
import { ToolRegistryService } from '../tools/tools.registry.service';
import { ApprovalManagerService } from './services/approval-manager.service';
import { AgentStreamExecutorService } from './services/agent-stream-executor.service';
import { HybridRagService } from '../knowledge-base/services/hybrid-rag.service';
import { KnowledgeAssetService } from '../knowledge-base/services/knowledge-asset.service';

describe('ChatService - Multimodal RAG Context Injection', () => {
  let service: ChatService;

  const mockHybridRagService = {
    search: jest.fn(),
  };

  const mockKnowledgeAssetService = {
    readAssetAsDataUrl: jest.fn(),
    buildSignedAssetUrl: jest.fn(
      (id: string) => `/knowledge-bases/assets/${id}?expires=9999&signature=sig`,
    ),
  };

  const mockChatRecordRepo = {
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) =>
      Promise.resolve({ ...v, id: 'msg-1', createdAt: new Date() }),
    ),
    findAndCount: jest.fn(),
  };

  const mockSessionUpdate = jest.fn();
  const mockDataSource = {
    transaction: jest.fn((cb: (m: any) => Promise<any>) =>
      cb({
        getRepository: jest.fn((entity: any) => {
          if (entity === ChatRecord) return mockChatRecordRepo;
          return {
            create: jest.fn((v: any) => v),
            save: jest.fn((v: any) => Promise.resolve({ ...v, id: 'sess-1' })),
            update: mockSessionUpdate,
          };
        }),
      }),
    ),
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    }),
  };

  const mockAiClientService = {
    createChatCompletion: jest.fn(),
    createStreamChatCompletion: jest.fn(),
  };

  const mockAgentStreamExecutorService = {
    executeStream: jest.fn().mockReturnValue(
      (async function* () {
        await Promise.resolve();
        yield { type: 'answer_delta', delta: { content: 'ok' } };
      })(),
    ),
  };

  const mockAiModelService = {
    findByModelId: jest.fn(),
  };

  const mockCreditsService = {
    reserveChatCharge: jest.fn().mockResolvedValue({
      charge: { id: 'chg-1', credits: 10 },
    }),
    captureChatCharge: jest.fn().mockResolvedValue({
      charge: { id: 'chg-1', credits: 10 },
      creditsSnapshot: { total: 100, consumed: 10, remaining: 90, reserved: 0 },
    }),
    releaseChatCharge: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: AIClientService, useValue: mockAiClientService },
        { provide: getRepositoryToken(ChatRecord), useValue: mockChatRecordRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: UserService, useValue: { findById: jest.fn().mockResolvedValue({ id: 'u1' }) } },
        {
          provide: ChatSessionService,
          useValue: {
            findByIdForUser: jest.fn().mockResolvedValue({ id: 'sess-1', knowledgeBaseIds: ['kb-1'] }),
            create: jest.fn().mockResolvedValue({ id: 'sess-1', knowledgeBaseIds: ['kb-1'] }),
            update: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'KNOWLEDGE_CHAT_MAX_IMAGES' ? '3' : undefined,
            ),
          },
        },
        {
          provide: FilesService,
          useValue: {
            prepareChatAttachments: jest.fn().mockResolvedValue({ attachmentIds: [], fileDataForAI: [] }),
            bindAttachmentsToMessage: jest.fn(),
            buildSignedFileUrl: jest.fn(),
          },
        },
        { provide: AiModelService, useValue: mockAiModelService },
        { provide: CreditsService, useValue: mockCreditsService },
        {
          provide: WebSearchService,
          useValue: { search: jest.fn() },
        },
        {
          provide: ToolRegistryService,
          useValue: { toOpenAITools: jest.fn().mockReturnValue([]) },
        },
        { provide: ApprovalManagerService, useValue: {} },
        { provide: AgentStreamExecutorService, useValue: mockAgentStreamExecutorService },
        { provide: HybridRagService, useValue: mockHybridRagService },
        { provide: KnowledgeAssetService, useValue: mockKnowledgeAssetService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  const sampleRagHits = [
    {
      chunkId: 'chk-v1',
      documentId: 'doc-1',
      knowledgeBaseId: 'kb-1',
      documentTitle: '2026 架构报告',
      content: '[第 2 页 · 视觉内容(chart)] 吞吐量提升 3 倍',
      chunkIndex: 1,
      score: 0.94,
      charCount: 32,
      hitSource: 'hybrid' as const,
      matchedTerms: ['吞吐量'],
      highlights: [],
      chunkType: 'visual' as const,
      assetId: 'asset-1',
      assetType: 'pdf_page',
      visualType: 'chart',
      pageNumber: 2,
      visualAssetUrl: '/knowledge-bases/assets/asset-1?expires=123&signature=abc',
    },
    {
      chunkId: 'chk-v1-dup',
      documentId: 'doc-1',
      knowledgeBaseId: 'kb-1',
      documentTitle: '2026 架构报告',
      content: '同页视觉延展切片',
      chunkIndex: 2,
      score: 0.88,
      charCount: 8,
      hitSource: 'dense' as const,
      matchedTerms: [],
      highlights: [],
      chunkType: 'visual' as const,
      assetId: 'asset-1',
      assetType: 'pdf_page',
      visualType: 'chart',
      pageNumber: 2,
      visualAssetUrl: '/knowledge-bases/assets/asset-1?expires=123&signature=abc',
    },
  ];

  it('当前对话模型 supportsVision=true 时，应去重注入真实 ImageUrlContentPart 并标记 visualInjected=true', async () => {
    mockAiModelService.findByModelId.mockResolvedValue({
      modelId: 'glm-4v-flash',
      supportsVision: true,
      billingMode: 'flat_per_request',
      creditCost: 0,
      provider: { name: 'Zhipu' },
    });
    mockHybridRagService.search.mockResolvedValue(sampleRagHits);
    mockKnowledgeAssetService.readAssetAsDataUrl.mockResolvedValue(
      'data:image/webp;base64,MOCKWEBP',
    );
    jest.spyOn(service as any, 'getSessionHistory').mockResolvedValue([]);

    const result = await service.createStream({
      userId: 'u1',
      sessionId: 'sess-1',
      message: '图表中吞吐量提升了多少？',
      model: 'glm-4v-flash',
      knowledgeBaseIds: ['kb-1'],
    });

    const streamCallArgs = mockAgentStreamExecutorService.executeStream.mock.calls[0][0];
    const userMsg = streamCallArgs.initialMessages.at(-1);
    expect(Array.isArray(userMsg.content)).toBe(true);
    const imageParts = userMsg.content.filter((p: any) => p.type === 'image_url');
    expect(imageParts).toHaveLength(1);
    expect(imageParts[0].image_url.url).toBe('data:image/webp;base64,MOCKWEBP');
    expect(mockKnowledgeAssetService.readAssetAsDataUrl).toHaveBeenCalledTimes(1);
    expect(result.searchResult?.sources[0].visualInjected).toBe(true);
  });

  it('当前对话模型 supportsVision=false 时，仅注入结构化文本且不发送 image_url', async () => {
    mockAiModelService.findByModelId.mockResolvedValue({
      modelId: 'spark-x2.6-4b',
      supportsVision: false,
      billingMode: 'flat_per_request',
      creditCost: 0,
      provider: { name: 'iFLYTEK' },
    });
    mockHybridRagService.search.mockResolvedValue(sampleRagHits);
    jest.spyOn(service as any, 'getSessionHistory').mockResolvedValue([]);

    const result = await service.createStream({
      userId: 'u1',
      sessionId: 'sess-1',
      message: '图表中吞吐量提升了多少？',
      model: 'spark-x2.6-4b',
      knowledgeBaseIds: ['kb-1'],
    });

    const streamCallArgs = mockAgentStreamExecutorService.executeStream.mock.calls[0][0];
    const userMsg = streamCallArgs.initialMessages.at(-1);
    expect(typeof userMsg.content).toBe('string');
    expect(userMsg.content).toContain('吞吐量提升 3 倍');
    expect(mockKnowledgeAssetService.readAssetAsDataUrl).not.toHaveBeenCalled();
    expect(result.searchResult?.sources[0].visualInjected).toBe(false);
    expect(result.searchResult?.sources[0].visualAssetUrl).toContain(
      '/knowledge-bases/assets/asset-1',
    );
  });

  it('持久化 sources 前应剥离临时签名 URL，历史加载时按 assetId 动态重签', async () => {
    mockAiModelService.findByModelId.mockResolvedValue({
      modelId: 'spark-x2.6-4b',
      supportsVision: false,
      billingMode: 'flat_per_request',
      creditCost: 0,
      provider: { name: 'iFLYTEK' },
    });

    await service.saveStreamMessage(
      'u1',
      'sess-1',
      'req-1',
      '提问',
      '回答',
      null,
      'spark-x2.6-4b',
      undefined,
      [],
      100,
      [
        {
          id: 1,
          title: '图表页',
          url: '',
          snippet: '描述',
          isKnowledgeBase: true,
          assetId: 'asset-9',
          visualAssetUrl: '/knowledge-bases/assets/asset-9?expires=1&signature=stale',
        },
      ],
    );

    const savedPayload = mockChatRecordRepo.create.mock.calls[0][0];
    expect(savedPayload.sources[0].assetId).toBe('asset-9');
    expect(savedPayload.sources[0].visualAssetUrl).toBeUndefined();

    mockChatRecordRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 'msg-1',
          userId: 'u1',
          sessionId: 'sess-1',
          userMessage: '提问',
          aiMessage: '回答',
          reasoning: null,
          model: 'spark-x2.6-4b',
          usage: null,
          sources: savedPayload.sources,
          toolCalls: null,
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      1,
    ]);

    const historyPage = await service.getSessionMessages('u1', 'sess-1', 1, 20);
    expect(historyPage.messages[0].sources?.[0].visualAssetUrl).toBe(
      '/knowledge-bases/assets/asset-9?expires=9999&signature=sig',
    );
  });
});
