import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalManagerService } from './approval-manager.service';
import { RedisService } from '../../../common/redis/redis.service';

describe('ApprovalManagerService', () => {
  let service: ApprovalManagerService;

  const mockRedisService = {
    isReady: jest.fn().mockReturnValue(true),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalManagerService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ApprovalManagerService>(ApprovalManagerService);
    jest.clearAllMocks();
    mockRedisService.isReady.mockReturnValue(true);
    mockRedisService.set.mockResolvedValue('OK');
    mockRedisService.get.mockResolvedValue(null);
  });

  it('createPendingApproval 能够成功创建处于 pending 状态的审批单', async () => {
    const record = await service.createPendingApproval({
      sessionId: 'test-session',
      userId: 'test-user',
      toolCallId: 'call_123',
      toolName: 'code_interpreter',
      args: { code: 'console.log("hello")' },
      riskEvaluation: {
        level: 'high',
        requiresApproval: true,
        reason: '动态代码执行风险',
      },
    });

    expect(record.approvalId).toBeDefined();
    expect(record.status).toBe('pending');
    expect(record.toolName).toBe('code_interpreter');
    expect(mockRedisService.set).toHaveBeenCalledTimes(1);
  });

  it('waitForDecision 与 resolveApproval 协同：决断 approved 时立即唤醒', async () => {
    const record = await service.createPendingApproval({
      sessionId: 'test-session',
      userId: 'test-user',
      toolCallId: 'call_456',
      toolName: 'code_interpreter',
      args: { code: '1 + 1' },
      riskEvaluation: {
        level: 'high',
        requiresApproval: true,
      },
    });

    const waitPromise = service.waitForDecision(record.approvalId, 5000);

    const resolved = await service.resolveApproval(
      record.approvalId,
      'approved',
      'test-user',
      '允许运行测试计算',
    );
    expect(resolved.status).toBe('approved');

    const decisionResult = await waitPromise;
    expect(decisionResult.decision).toBe('approved');
    expect(decisionResult.reason).toBe('允许运行测试计算');
  });

  it('waitForDecision 与 resolveApproval 协同：决断 rejected 时立即拒绝', async () => {
    const record = await service.createPendingApproval({
      sessionId: 'test-session',
      userId: 'test-user',
      toolCallId: 'call_789',
      toolName: 'code_interpreter',
      args: { code: 'rmdir /s /q' },
      riskEvaluation: {
        level: 'high',
        requiresApproval: true,
      },
    });

    const waitPromise = service.waitForDecision(record.approvalId, 5000);

    await service.resolveApproval(
      record.approvalId,
      'rejected',
      'test-user',
      '拒绝高危系统操作',
    );

    const decisionResult = await waitPromise;
    expect(decisionResult.decision).toBe('rejected');
    expect(decisionResult.reason).toBe('拒绝高危系统操作');
  });

  it('对不存在的 approvalId 进行 resolveApproval 应该抛出 NotFoundException', async () => {
    await expect(
      service.resolveApproval('non_existent_id', 'approved'),
    ).rejects.toThrow('审批任务不存在');
  });
});
