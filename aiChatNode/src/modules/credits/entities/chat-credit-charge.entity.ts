import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChatCreditChargeStatus } from '../types/credits.types';

/**
 * 聊天扣费单
 * - 记录一次聊天请求的积分状态流转
 * - 通过 userId + clientRequestId 保证幂等
 */
@Index('idx_chat_credit_charges_user_client_request_id', ['userId', 'clientRequestId'], {
  unique: true,
})
@Index('idx_chat_credit_charges_user_status', ['userId', 'status'])
@Entity('chat_credit_charges')
export class ChatCreditCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  clientRequestId: string;

  @Column({ type: 'uuid', nullable: true })
  sessionId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  messageId?: string | null;

  @Column({ type: 'varchar', length: 100 })
  modelId: string;

  @Column({ type: 'varchar', length: 50 })
  billingMode: string;

  @Column({ type: 'int', default: 0 })
  unitCredits: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  totalCredits: number;

  @Column({ type: 'varchar', length: 32 })
  status: ChatCreditChargeStatus;

  @Column({ type: 'jsonb', nullable: true })
  ruleSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
