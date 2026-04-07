import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CreditsService } from '../credits/credits.service';

describe('UserController', () => {
  let controller: UserController;

  const userService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  const creditsService = {
    getSnapshotForUser: jest.fn(),
    getRecentLedgerForUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: userService,
        },
        {
          provide: CreditsService,
          useValue: creditsService,
        },
      ],
    }).compile();

    controller = module.get(UserController);
  });

  it('rejects account query when current user is missing', async () => {
    await expect(controller.getAccount(undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns current account detail with recent ledger', async () => {
    userService.findById.mockResolvedValue({
      id: 'user-1',
      username: 'tester',
      email: 'tester@example.com',
      role: 'user',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    creditsService.getSnapshotForUser.mockResolvedValue({
      total: 2000,
      consumed: 100,
      remaining: 1900,
      reserved: 0,
    });
    creditsService.getRecentLedgerForUser.mockResolvedValue({
      items: [
        {
          id: 'ledger-1',
          type: 'grant',
          title: '注册赠送积分',
          description: '新用户注册赠送积分',
          amount: 2000,
          balanceAfter: 2000,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5,
      hasMore: false,
    });

    const result = await controller.getAccount('user-1', '1', '5');

    expect(creditsService.getSnapshotForUser).toHaveBeenCalledWith('user-1');
    expect(creditsService.getRecentLedgerForUser).toHaveBeenCalledWith(
      'user-1',
      1,
      5,
    );
    expect(result.user.credits.remaining).toBe(1900);
    expect(result.recentLedger.items).toHaveLength(1);
  });
});
