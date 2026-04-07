import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import {
  CreditBusinessType,
  CreditLedgerType,
} from '../types/credits.types';

/**
 * 积分流水
 * - 采用不可变流水，便于审计、补偿与后续退款
 */
@Entity('credit_ledger')
export class CreditLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  accountId: string;

  @Column({ type: 'varchar', length: 32 })
  type: CreditLedgerType;

  @Column({ type: 'int', default: 0 })
  deltaAvailable: number;

  @Column({ type: 'int', default: 0 })
  deltaReserved: number;

  @Column({ type: 'int', default: 0 })
  availableAfter: number;

  @Column({ type: 'int', default: 0 })
  reservedAfter: number;

  @Column({ type: 'varchar', length: 64 })
  businessType: CreditBusinessType | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  businessId?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  modelId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  sessionId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  messageId?: string | null;

  @Column({ type: 'text', nullable: true })
  remark?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

