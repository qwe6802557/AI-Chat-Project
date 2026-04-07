import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { ChatCreditCharge } from './entities/chat-credit-charge.entity';
import { CreditLedger } from './entities/credit-ledger.entity';
import { UserCreditAccount } from './entities/user-credit-account.entity';
import {
  CreditBusinessType,
  CreditLedgerType,
  ChatCreditChargeStatus,
  type ChatCreditChargeSummary,
  type RecentCreditLedgerPage,
  type RecentCreditLedgerItem,
  type UserCreditsSnapshot,
} from './types/credits.types';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserCreditAccount)
    private readonly userCreditAccountRepository: Repository<UserCreditAccount>,
    @InjectRepository(CreditLedger)
    private readonly creditLedgerRepository: Repository<CreditLedger>,
    @InjectRepository(ChatCreditCharge)
    private readonly chatCreditChargeRepository: Repository<ChatCreditCharge>,
  ) {}

  private getAccountRepository(
    manager?: EntityManager,
  ): Repository<UserCreditAccount> {
    return manager
      ? manager.getRepository(UserCreditAccount)
      : this.userCreditAccountRepository;
  }

  private getLedgerRepository(
    manager?: EntityManager,
  ): Repository<CreditLedger> {
    return manager
      ? manager.getRepository(CreditLedger)
      : this.creditLedgerRepository;
  }

  private getChargeRepository(
    manager?: EntityManager,
  ): Repository<ChatCreditCharge> {
    return manager
      ? manager.getRepository(ChatCreditCharge)
      : this.chatCreditChargeRepository;
  }

  private toSnapshot(account: UserCreditAccount): UserCreditsSnapshot {
    return {
      total:
        account.availableCredits +
        account.reservedCredits +
        account.consumedCredits,
      consumed: account.consumedCredits,
      remaining: account.availableCredits,
      reserved: account.reservedCredits,
    };
  }

  private toChargeSummary(
    charge: ChatCreditCharge,
  ): ChatCreditChargeSummary {
    return {
      id: charge.id,
      clientRequestId: charge.clientRequestId,
      modelId: charge.modelId,
      billingMode: charge.billingMode,
      credits: charge.totalCredits,
      status: charge.status,
    };
  }

  private toRecentLedgerItem(
    ledger: CreditLedger,
  ): RecentCreditLedgerItem | null {
    if (ledger.type === CreditLedgerType.RESERVE) {
      return null;
    }

    const defaultDescription = ledger.modelId
      ? `模型：${ledger.modelId}`
      : ledger.remark || null;

    const createItem = (
      title: string,
      amount: number,
      description: string | null = defaultDescription,
    ): RecentCreditLedgerItem => ({
      id: ledger.id,
      type: ledger.type,
      title,
      description,
      amount,
      balanceAfter: ledger.availableAfter,
      createdAt: ledger.createdAt,
    });

    switch (ledger.type) {
      case CreditLedgerType.GRANT:
        if (ledger.businessType === CreditBusinessType.REGISTER_BONUS) {
          return createItem('注册赠送积分', Math.abs(ledger.deltaAvailable));
        }
        return createItem('积分发放', ledger.deltaAvailable);
      case CreditLedgerType.CAPTURE:
        if (ledger.businessType === CreditBusinessType.CHAT_MESSAGE) {
          const settledAmount = ledger.deltaAvailable + ledger.deltaReserved;
          return createItem(
            '模型消息扣费',
            settledAmount,
            ledger.modelId ? `模型：${ledger.modelId}` : '聊天消息扣费',
          );
        }
        return createItem(
          '积分结算',
          ledger.deltaAvailable + ledger.deltaReserved,
        );
      case CreditLedgerType.RELEASE:
        if (ledger.businessType === CreditBusinessType.CHAT_MESSAGE) {
          return createItem(
            '失败释放积分',
            ledger.deltaAvailable,
            ledger.remark || '聊天请求失败，返还预占积分',
          );
        }
        return createItem('释放预占积分', ledger.deltaAvailable);
      case CreditLedgerType.REFUND:
        return createItem('积分退款', ledger.deltaAvailable);
      case CreditLedgerType.ADJUST:
        return createItem('积分调整', ledger.deltaAvailable);
      default:
        return createItem('积分变动', ledger.deltaAvailable);
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }

  private async runInTransaction<T>(
    manager: EntityManager | undefined,
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (manager) {
      return callback(manager);
    }

    return this.dataSource.transaction(callback);
  }

  private async lockAccountByUserId(
    userId: string,
    manager: EntityManager,
  ): Promise<UserCreditAccount> {
    await this.ensureAccount(userId, undefined, manager);

    const account = await manager
      .getRepository(UserCreditAccount)
      .createQueryBuilder('account')
      .setLock('pessimistic_write')
      .where('account.userId = :userId', { userId })
      .getOne();

    if (!account) {
      throw new BadRequestException('用户积分账户不存在');
    }

    return account;
  }

  /**
   * 确保用户积分账户存在。
   * - 首次创建时可附带初始赠送积分，并同时写入 grant 流水
   */
  async ensureAccount(
    userId: string,
    options?: {
      initialCredits?: number;
      businessType?: CreditBusinessType | string;
      businessId?: string;
      remark?: string;
    },
    manager?: EntityManager,
  ): Promise<UserCreditAccount> {
    const accountRepository = this.getAccountRepository(manager);
    const ledgerRepository = this.getLedgerRepository(manager);

    const existingAccount = await accountRepository.findOne({ where: { userId } });
    if (existingAccount) {
      return existingAccount;
    }

    const initialCredits = Math.max(0, options?.initialCredits ?? 0);
    const account = accountRepository.create({
      userId,
      availableCredits: initialCredits,
      reservedCredits: 0,
      consumedCredits: 0,
    });

    try {
      const savedAccount = await accountRepository.save(account);

      if (initialCredits > 0) {
        await ledgerRepository.save(
          ledgerRepository.create({
            userId,
            accountId: savedAccount.id,
            type: CreditLedgerType.GRANT,
            deltaAvailable: initialCredits,
            deltaReserved: 0,
            availableAfter: savedAccount.availableCredits,
            reservedAfter: savedAccount.reservedCredits,
            businessType: options?.businessType || CreditBusinessType.SYSTEM,
            businessId: options?.businessId || null,
            remark: options?.remark || null,
          }),
        );
      }

      return savedAccount;
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const fallbackAccount = await accountRepository.findOne({ where: { userId } });
      if (fallbackAccount) {
        return fallbackAccount;
      }

      throw error;
    }
  }

  /**
   * 获取用户当前积分快照。
   * - 若旧用户尚未初始化账户，则自动补齐零余额账户
   */
  async getSnapshotForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<UserCreditsSnapshot> {
    const account = await this.ensureAccount(userId, undefined, manager);
    return this.toSnapshot(account);
  }

  /**
   * 显式赠送积分。
   * - 第一阶段主要用于注册赠送，后续也可复用于运营补偿
   */
  async grantCredits(
    params: {
      userId: string;
      amount: number;
      businessType: CreditBusinessType | string;
      businessId?: string;
      remark?: string;
    },
    manager?: EntityManager,
  ): Promise<UserCreditsSnapshot> {
    const amount = Math.max(0, Math.trunc(params.amount));
    const accountRepository = this.getAccountRepository(manager);
    const ledgerRepository = this.getLedgerRepository(manager);

    const account = await this.ensureAccount(params.userId, undefined, manager);
    if (amount === 0) {
      return this.toSnapshot(account);
    }

    account.availableCredits += amount;
    const savedAccount = await accountRepository.save(account);

    await ledgerRepository.save(
      ledgerRepository.create({
        userId: params.userId,
        accountId: savedAccount.id,
        type: CreditLedgerType.GRANT,
        deltaAvailable: amount,
        deltaReserved: 0,
        availableAfter: savedAccount.availableCredits,
        reservedAfter: savedAccount.reservedCredits,
        businessType: params.businessType,
        businessId: params.businessId || null,
        remark: params.remark || null,
      }),
    );

    this.logger.log(
      `积分赠送成功: userId=${params.userId}, amount=${amount}, businessType=${params.businessType}`,
    );

    return this.toSnapshot(savedAccount);
  }

  async reserveChatCharge(
    params: {
      userId: string;
      clientRequestId: string;
      sessionId?: string;
      modelId: string;
      billingMode: string;
      creditCost: number;
      ruleSnapshot?: Record<string, unknown>;
    },
    manager?: EntityManager,
  ): Promise<{
    charge: ChatCreditChargeSummary;
    creditsSnapshot: UserCreditsSnapshot;
  }> {
    return this.runInTransaction(manager, async (transactionManager) => {
      const chargeRepository = this.getChargeRepository(transactionManager);
      const ledgerRepository = this.getLedgerRepository(transactionManager);
      const accountRepository = this.getAccountRepository(transactionManager);

      const existingCharge = await chargeRepository.findOne({
        where: {
          userId: params.userId,
          clientRequestId: params.clientRequestId,
        },
      });

      if (existingCharge) {
        if (existingCharge.status === ChatCreditChargeStatus.CAPTURED) {
          throw new BadRequestException('该请求已完成，请勿重复提交');
        }

        if (existingCharge.status === ChatCreditChargeStatus.RESERVED) {
          throw new BadRequestException('该请求正在处理中，请勿重复提交');
        }

        throw new BadRequestException('该请求已结束，请重新发起');
      }

      const account = await this.lockAccountByUserId(
        params.userId,
        transactionManager,
      );
      const amount = Math.max(0, Math.trunc(params.creditCost));

      if (account.availableCredits < amount) {
        throw new BadRequestException(
          `积分不足，当前模型需要 ${amount} 积分，剩余 ${account.availableCredits} 积分`,
        );
      }

      account.availableCredits -= amount;
      account.reservedCredits += amount;
      const savedAccount = await accountRepository.save(account);

      const savedCharge = await chargeRepository.save(
        chargeRepository.create({
          userId: params.userId,
          clientRequestId: params.clientRequestId,
          sessionId: params.sessionId || null,
          modelId: params.modelId,
          billingMode: params.billingMode,
          unitCredits: amount,
          quantity: 1,
          totalCredits: amount,
          status: ChatCreditChargeStatus.RESERVED,
          ruleSnapshot: params.ruleSnapshot || null,
        }),
      );

      await ledgerRepository.save(
        ledgerRepository.create({
          userId: params.userId,
          accountId: savedAccount.id,
          type: CreditLedgerType.RESERVE,
          deltaAvailable: -amount,
          deltaReserved: amount,
          availableAfter: savedAccount.availableCredits,
          reservedAfter: savedAccount.reservedCredits,
          businessType: CreditBusinessType.CHAT_MESSAGE,
          businessId: savedCharge.id,
          modelId: params.modelId,
          sessionId: params.sessionId || null,
          remark: '聊天请求预占积分',
        }),
      );

      return {
        charge: this.toChargeSummary(savedCharge),
        creditsSnapshot: this.toSnapshot(savedAccount),
      };
    });
  }

  async captureChatCharge(
    params: {
      userId: string;
      clientRequestId: string;
      sessionId?: string;
      messageId?: string;
      totalCredits?: number;
    },
    manager?: EntityManager,
  ): Promise<{
    charge: ChatCreditChargeSummary;
    creditsSnapshot: UserCreditsSnapshot;
  }> {
    return this.runInTransaction(manager, async (transactionManager) => {
      const chargeRepository = this.getChargeRepository(transactionManager);
      const ledgerRepository = this.getLedgerRepository(transactionManager);
      const accountRepository = this.getAccountRepository(transactionManager);

      const charge = await chargeRepository.findOne({
        where: {
          userId: params.userId,
          clientRequestId: params.clientRequestId,
        },
      });

      if (!charge) {
        throw new BadRequestException('未找到待结算的积分记录');
      }

      if (charge.status === ChatCreditChargeStatus.CAPTURED) {
        const account = await this.ensureAccount(
          params.userId,
          undefined,
          transactionManager,
        );
        return {
          charge: this.toChargeSummary(charge),
          creditsSnapshot: this.toSnapshot(account),
        };
      }

      if (charge.status !== ChatCreditChargeStatus.RESERVED) {
        throw new BadRequestException('当前积分记录不可结算');
      }

      const account = await this.lockAccountByUserId(
        params.userId,
        transactionManager,
      );

      const reservedCredits = charge.totalCredits;
      const actualCredits = Math.max(
        0,
        Math.trunc(params.totalCredits ?? reservedCredits),
      );

      if (account.reservedCredits < reservedCredits) {
        throw new BadRequestException('预占积分状态异常，无法完成结算');
      }

      const deltaAvailable = reservedCredits - actualCredits;
      account.reservedCredits -= reservedCredits;
      account.availableCredits += deltaAvailable;
      account.consumedCredits += actualCredits;
      const savedAccount = await accountRepository.save(account);

      charge.status = ChatCreditChargeStatus.CAPTURED;
      charge.unitCredits = actualCredits;
      charge.quantity = 1;
      charge.totalCredits = actualCredits;
      charge.sessionId = params.sessionId || charge.sessionId || null;
      charge.messageId = params.messageId || charge.messageId || null;
      charge.failureReason = null;
      const savedCharge = await chargeRepository.save(charge);

      const captureRemark =
        deltaAvailable > 0
          ? '按实际 token 结算，返还预占差额'
          : deltaAvailable < 0
            ? '按实际 token 结算，补扣预占差额'
            : '聊天请求积分结算';

      await ledgerRepository.save(
        ledgerRepository.create({
          userId: params.userId,
          accountId: savedAccount.id,
          type: CreditLedgerType.CAPTURE,
          deltaAvailable,
          deltaReserved: -reservedCredits,
          availableAfter: savedAccount.availableCredits,
          reservedAfter: savedAccount.reservedCredits,
          businessType: CreditBusinessType.CHAT_MESSAGE,
          businessId: savedCharge.id,
          modelId: savedCharge.modelId,
          sessionId: savedCharge.sessionId || null,
          messageId: savedCharge.messageId || null,
          remark: captureRemark,
        }),
      );

      return {
        charge: this.toChargeSummary(savedCharge),
        creditsSnapshot: this.toSnapshot(savedAccount),
      };
    });
  }

  async releaseChatCharge(
    params: {
      userId: string;
      clientRequestId: string;
      sessionId?: string;
      failureReason?: string;
    },
    manager?: EntityManager,
  ): Promise<{
    charge: ChatCreditChargeSummary;
    creditsSnapshot: UserCreditsSnapshot;
  }> {
    return this.runInTransaction(manager, async (transactionManager) => {
      const chargeRepository = this.getChargeRepository(transactionManager);
      const ledgerRepository = this.getLedgerRepository(transactionManager);
      const accountRepository = this.getAccountRepository(transactionManager);

      const charge = await chargeRepository.findOne({
        where: {
          userId: params.userId,
          clientRequestId: params.clientRequestId,
        },
      });

      if (!charge) {
        throw new BadRequestException('未找到待释放的积分记录');
      }

      if (charge.status === ChatCreditChargeStatus.RELEASED) {
        const account = await this.ensureAccount(
          params.userId,
          undefined,
          transactionManager,
        );
        return {
          charge: this.toChargeSummary(charge),
          creditsSnapshot: this.toSnapshot(account),
        };
      }

      if (charge.status === ChatCreditChargeStatus.CAPTURED) {
        const account = await this.ensureAccount(
          params.userId,
          undefined,
          transactionManager,
        );
        return {
          charge: this.toChargeSummary(charge),
          creditsSnapshot: this.toSnapshot(account),
        };
      }

      if (charge.status !== ChatCreditChargeStatus.RESERVED) {
        throw new BadRequestException('当前积分记录不可释放');
      }

      const account = await this.lockAccountByUserId(
        params.userId,
        transactionManager,
      );

      if (account.reservedCredits < charge.totalCredits) {
        throw new BadRequestException('预占积分状态异常，无法释放');
      }

      account.reservedCredits -= charge.totalCredits;
      account.availableCredits += charge.totalCredits;
      const savedAccount = await accountRepository.save(account);

      charge.status = ChatCreditChargeStatus.RELEASED;
      charge.sessionId = params.sessionId || charge.sessionId || null;
      charge.failureReason =
        params.failureReason || charge.failureReason || '聊天请求失败，释放预占积分';
      const savedCharge = await chargeRepository.save(charge);

      await ledgerRepository.save(
        ledgerRepository.create({
          userId: params.userId,
          accountId: savedAccount.id,
          type: CreditLedgerType.RELEASE,
          deltaAvailable: savedCharge.totalCredits,
          deltaReserved: -savedCharge.totalCredits,
          availableAfter: savedAccount.availableCredits,
          reservedAfter: savedAccount.reservedCredits,
          businessType: CreditBusinessType.CHAT_MESSAGE,
          businessId: savedCharge.id,
          modelId: savedCharge.modelId,
          sessionId: savedCharge.sessionId || null,
          remark: savedCharge.failureReason || '聊天请求失败，释放预占积分',
        }),
      );

      return {
        charge: this.toChargeSummary(savedCharge),
        creditsSnapshot: this.toSnapshot(savedAccount),
      };
    });
  }

  async getRecentLedgerForUser(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<RecentCreditLedgerPage> {
    const effectivePage = Math.max(1, Math.trunc(page));
    const effectivePageSize = Math.min(Math.max(1, Math.trunc(pageSize)), 20);
    await this.ensureAccount(userId);

    const [ledgers, total] = await this.creditLedgerRepository.findAndCount({
      where: {
        userId,
        type: Not(CreditLedgerType.RESERVE),
      },
      order: { createdAt: 'DESC' },
      skip: (effectivePage - 1) * effectivePageSize,
      take: effectivePageSize,
    });

    const items = ledgers
      .map((ledger) => this.toRecentLedgerItem(ledger))
      .filter((item): item is RecentCreditLedgerItem => !!item);

    return {
      items,
      total,
      page: effectivePage,
      pageSize: effectivePageSize,
      hasMore: effectivePage * effectivePageSize < total,
    };
  }
}
