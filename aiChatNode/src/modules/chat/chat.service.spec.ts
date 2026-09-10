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
import { DEFAULT_CHAT_BILLING_MODE, DEFAULT_CHAT_MODEL_CREDIT_COST } from '../credits/types/credits.types';

describe('ChatService - Billing & Credits', () => {
  let service: ChatService;

  const mockAiClientService = {
    createChatCompletion: jest.fn(),
    createStreamChatCompletion: jest.fn(),
  };

  const mockChatRecordRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserService = {
    findById: jest.fn(),
  };

  const mockChatSessionService = {
    findByIdForUser: jest.fn(),
    create: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'DEFAULT_CHAT_MODEL') return 'grok-chat-fast';
      return null;
    }),
  };

  const mockFilesService = {
    prepareChatAttachments: jest.fn().mockResolvedValue({ attachmentIds: [], fileDataForAI: [] }),
    bindAttachmentsToMessage: jest.fn(),
    buildSignedFileUrl: jest.fn(),
  };

  const mockAiModelService = {
    findByModelId: jest.fn(),
  };

  const mockCreditsService = {
    reserveChatCharge: jest.fn(),
    captureChatCharge: jest.fn(),
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
        { provide: UserService, useValue: mockUserService },
        { provide: ChatSessionService, useValue: mockChatSessionService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: FilesService, useValue: mockFilesService },
        { provide: AiModelService, useValue: mockAiModelService },
        { provide: CreditsService, useValue: mockCreditsService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('estimateReserveCredits & estimateActualChargeCredits', () => {
    it('returns fixed 10 credits for flat_per_request chat model regardless of tokens', () => {
      const flatModel = {
        modelId: 'grok-chat-fast',
        billingMode: 'flat_per_request',
        reserveCredits: 10,
        inputPrice: 0,
        outputPrice: 0,
        maxOutput: 4096,
      };

      const reserve = (service as any).estimateReserveCredits({
        messages: [{ role: 'user', content: 'Hello' }],
        model: flatModel,
      });
      expect(reserve).toBe(10);

      const actualCredits = (service as any).estimateActualChargeCredits(
        { promptTokens: 0, completionTokens: 0 },
        flatModel,
      );
      expect(actualCredits).toBe(10);

      const actualCreditsWithTokens = (service as any).estimateActualChargeCredits(
        { promptTokens: 500, completionTokens: 1000 },
        flatModel,
      );
      expect(actualCreditsWithTokens).toBe(10);

      const actualCreditsWithoutUsage = (service as any).estimateActualChargeCredits(
        undefined,
        flatModel,
      );
      expect(actualCreditsWithoutUsage).toBe(10);
    });

    it('calculates token costs dynamically for token_usage_with_reserve billing mode', () => {
      const tokenModel = {
        modelId: 'token-model',
        billingMode: 'token_usage_with_reserve',
        reserveCredits: 50,
        inputPrice: 2,
        outputPrice: 5,
        maxOutput: 1000,
      };

      const reserve = (service as any).estimateReserveCredits({
        messages: [{ role: 'user', content: 'Test prompt' }],
        model: tokenModel,
      });
      expect(reserve).toBe(50);

      const actualCredits = (service as any).estimateActualChargeCredits(
        { promptTokens: 1000, completionTokens: 2000 },
        tokenModel,
      );
      expect(actualCredits).toBe(12);
    });
  });

  describe('resolveChatModelConfig', () => {
    it('preserves flat_per_request billing mode and 10 credits from database model', async () => {
      mockAiModelService.findByModelId.mockResolvedValueOnce({
        modelId: 'grok-chat-fast',
        billingMode: 'flat_per_request',
        creditCost: 10,
        inputPrice: 0,
        outputPrice: 0,
        maxOutput: 4096,
        provider: { name: 'Grok2API' },
      });

      const config = await (service as any).resolveChatModelConfig('grok-chat-fast');
      expect(config.billingMode).toBe(DEFAULT_CHAT_BILLING_MODE);
      expect(config.reserveCredits).toBe(DEFAULT_CHAT_MODEL_CREDIT_COST);
      expect(config.modelId).toBe('grok-chat-fast');
    });
  });
});
