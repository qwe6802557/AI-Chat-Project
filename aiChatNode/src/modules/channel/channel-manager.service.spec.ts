import { ChannelManagerService } from './channel-manager.service';
import { ChannelConfig } from './entities/channel-config.entity';
import { AgentRole } from './entities/agent-role.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import type { Repository } from 'typeorm';
import type { AIClientService } from '../chat/services/ai-client.service';
import type { AiModelService } from '../ai-provider/ai-model.service';
import type { CreditsService } from '../credits/credits.service';
import { CreditBusinessType } from '../credits/types/credits.types';
import type { HybridRagService } from '../knowledge-base/services/hybrid-rag.service';
import type { RedisService } from '../../common/redis/redis.service';
import type { ChannelMetricsService } from './channel-metrics.service';
import type { AgentExecutorService } from '../chat/services/agent-executor.service';

describe('ChannelManagerService (Multi-tenant & Credits)', () => {
  let service: ChannelManagerService;
  let mockChannelRepo: Partial<Repository<ChannelConfig>>;
  let mockRoleRepo: Partial<Repository<AgentRole>>;
  let mockMessageRepo: Partial<Repository<ChannelMessage>>;
  let mockAiClientService: Partial<AIClientService>;
  let mockAiModelService: Partial<AiModelService>;
  let mockCreditsService: Partial<CreditsService>;
  let mockRagService: Partial<HybridRagService>;
  let mockRedisService: Partial<RedisService>;
  let mockChannelMetricsService: Partial<ChannelMetricsService>;
  let mockAgentExecutorService: Partial<AgentExecutorService>;

  const mockUserId = 'user-uuid-1234';

  beforeEach(() => {
    mockChannelRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
      query: jest.fn().mockResolvedValue([]),
    };

    mockRoleRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
    };

    mockMessageRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({} as any),
      create: jest.fn().mockImplementation((val) => val),
    };

    mockAiClientService = {
      createChatCompletion: jest.fn().mockResolvedValue({
        content: '您好，我是智能助理！',
        model: 'spark-x2.6',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      } as any),
    };

    mockAiModelService = {
      findAll: jest.fn().mockResolvedValue([{ modelId: 'spark-x2.6', isDefault: true, isActive: true }]),
      findByModelId: jest.fn().mockResolvedValue({ modelId: 'spark-x2.6', creditCost: 2 } as any),
    };

    mockCreditsService = {
      getSnapshotForUser: jest.fn(),
      deductDirectCredits: jest.fn().mockResolvedValue({} as any),
    };

    mockRagService = {
      search: jest.fn().mockResolvedValue([]),
    };

    mockRedisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockChannelMetricsService = {
      recordSuccess: jest.fn().mockResolvedValue(undefined),
      recordError: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockResolvedValue({ totalRequests: 0, successRate: 100, avgLatencyMs: 0, errorCount: 0 }),
    };

    mockAgentExecutorService = {
      execute: jest.fn().mockResolvedValue({
        content: '您好，我是智能助理！',
        trajectory: [],
        totalUsage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        totalDurationMs: 150,
      }),
    };

    service = new ChannelManagerService(
      mockChannelRepo as Repository<ChannelConfig>,
      mockRoleRepo as Repository<AgentRole>,
      mockMessageRepo as Repository<ChannelMessage>,
      mockAiClientService as AIClientService,
      mockAiModelService as AiModelService,
      mockCreditsService as CreditsService,
      mockRagService as HybridRagService,
      mockRedisService as RedisService,
      mockChannelMetricsService as ChannelMetricsService,
      mockAgentExecutorService as AgentExecutorService,
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

      (mockCreditsService.getSnapshotForUser as jest.Mock).mockResolvedValue({
        remaining: 1,
        total: 100,
        used: 99,
      });

      const response = await (service as any).handleInboundMessage(
        'conf-1',
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

      (mockCreditsService.getSnapshotForUser as jest.Mock).mockResolvedValue({
        remaining: 10,
        total: 100,
        used: 90,
      });

      const response = await (service as any).handleInboundMessage(
        'conf-1',
        'weixin',
        'wx_openid_123',
        '你好',
      );

      expect(response).toBe('您好，我是智能助理！');
      expect(mockAgentExecutorService.execute).toHaveBeenCalledTimes(1);
      expect(mockCreditsService.deductDirectCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          amount: 2,
          businessType: CreditBusinessType.CHAT_MESSAGE,
        }),
      );
      expect(mockChannelMetricsService.recordSuccess).toHaveBeenCalled();
    });
  });

  describe('AgentRole Team Management', () => {
    it('should create and update a multi-agent team role with teamConfig', async () => {
      const created = await service.createRole(mockUserId, {
        name: '研发专家协同团队',
        isTeam: true,
        teamConfig: {
          subAgentRoleIds: ['role-code-1', 'role-review-2'],
          routerStrategy: 'supervisor',
          maxHandoffs: 3,
        },
      });

      expect(created.isTeam).toBe(true);
      expect(created.teamConfig?.subAgentRoleIds).toHaveLength(2);

      (mockRoleRepo.findOne as jest.Mock).mockResolvedValueOnce({
        id: 'team-role-1',
        userId: mockUserId,
        name: '研发专家协同团队',
        isTeam: true,
        teamConfig: { subAgentRoleIds: ['role-code-1'] },
      });

      const updated = await service.updateRole(mockUserId, 'team-role-1', {
        name: '更新后的协同团队',
        teamConfig: { subAgentRoleIds: ['role-code-1', 'role-review-2', 'role-qa-3'] },
      });

      expect(updated.name).toBe('更新后的协同团队');
      expect(updated.teamConfig?.subAgentRoleIds).toHaveLength(3);
    });
  });

  describe('getAllChannels (Multi-tenant lazy init)', () => {
    it('should lazy-init default channel configs for user if none exist', async () => {
      (mockChannelRepo.find as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'conf-wx',
            userId: mockUserId,
            channelType: 'weixin',
            name: '微信扫码',
            isEnabled: false,
            status: 'disconnected',
            credentials: {},
          },
        ]);

      const channels = await service.getAllChannels(mockUserId);

      expect(mockChannelRepo.save).toHaveBeenCalled();
      expect(channels.length).toBeGreaterThan(0);
    });
  });
});
