import { ChannelManagerService } from './channel-manager.service';
import { ChannelConfig } from './entities/channel-config.entity';
import type { Repository } from 'typeorm';
import type { AIClientService } from '../chat/services/ai-client.service';
import type { AiModelService } from '../ai-provider/ai-model.service';
import type { CreditsService } from '../credits/credits.service';
import { CreditBusinessType } from '../credits/types/credits.types';

describe('ChannelManagerService (Multi-tenant & Credits)', () => {
  let service: ChannelManagerService;
  let mockChannelRepo: Partial<Repository<ChannelConfig>>;
  let mockAiClientService: Partial<AIClientService>;
  let mockAiModelService: Partial<AiModelService>;
  let mockCreditsService: Partial<CreditsService>;

  const mockUserId = 'user-uuid-1234';

  beforeEach(() => {
    mockChannelRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
      query: jest.fn().mockResolvedValue([]),
    };

    mockAiClientService = {
      createChatCompletion: jest.fn().mockResolvedValue({
        content: '您好，我是智能助理！',
        model: 'spark-x2.6',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      } as any),
    };

    mockAiModelService = {
      getDefaultModel: jest.fn().mockResolvedValue({ modelId: 'spark-x2.6', creditCost: 2 } as any),
      findByModelId: jest.fn().mockResolvedValue({ modelId: 'spark-x2.6', creditCost: 2 } as any),
    };

    mockCreditsService = {
      getSnapshotForUser: jest.fn(),
      deductDirectCredits: jest.fn().mockResolvedValue({} as any),
    };

    service = new ChannelManagerService(
      mockChannelRepo as Repository<ChannelConfig>,
      mockAiClientService as AIClientService,
      mockAiModelService as AiModelService,
      mockCreditsService as CreditsService,
    );
  });

  describe('handleInboundMessage (Credits Exhaustion & Deduction)', () => {
    it('should return "可用积分已耗尽, 请联系管理员" and abort when user credits are insufficient', async () => {
      (mockChannelRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'conf-1',
        userId: mockUserId,
        channelType: 'weixin',
        boundModelId: 'spark-x2.6',
        isEnabled: true,
      });

      // User has 1 credit, but model costs 2
      (mockCreditsService.getSnapshotForUser as jest.Mock).mockResolvedValue({
        remaining: 1,
        total: 100,
        used: 99,
      });

      const response = await (service as any).handleInboundMessage(
        mockUserId,
        'weixin',
        'wx_openid_123',
        '你好',
      );

      expect(response).toBe('可用积分已耗尽, 请联系管理员');
      expect(mockAiClientService.createChatCompletion).not.toHaveBeenCalled();
      expect(mockCreditsService.deductDirectCredits).not.toHaveBeenCalled();
    });

    it('should proceed and deduct credits when user has sufficient credits', async () => {
      (mockChannelRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'conf-1',
        userId: mockUserId,
        channelType: 'weixin',
        boundModelId: 'spark-x2.6',
        isEnabled: true,
      });

      // User has 10 credits, model costs 2
      (mockCreditsService.getSnapshotForUser as jest.Mock).mockResolvedValue({
        remaining: 10,
        total: 100,
        used: 90,
      });

      const response = await (service as any).handleInboundMessage(
        mockUserId,
        'weixin',
        'wx_openid_123',
        '你好',
      );

      expect(response).toBe('您好，我是智能助理！');
      expect(mockAiClientService.createChatCompletion).toHaveBeenCalledTimes(1);
      expect(mockCreditsService.deductDirectCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          amount: 2,
          businessType: CreditBusinessType.CHAT_MESSAGE,
        }),
      );
    });
  });

  describe('getAllChannels (Multi-tenant lazy init)', () => {
    it('should lazy-init default channel configs for user if none exist', async () => {
      (mockChannelRepo.find as jest.Mock)
        .mockResolvedValueOnce([]) // First call inside initUserConfigs
        .mockResolvedValueOnce([   // Second call in getAllChannels
          {
            id: 'conf-wx',
            userId: mockUserId,
            channelType: 'weixin',
            name: '微信扫码',
            isEnabled: false,
            status: 'disconnected',
          },
        ]);

      const channels = await service.getAllChannels(mockUserId);

      expect(mockChannelRepo.save).toHaveBeenCalled();
      expect(channels.length).toBeGreaterThan(0);
    });
  });
});
