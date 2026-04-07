import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 用户积分账户
 * - remaining: 可用积分
 * - reserved: 预占积分（第二阶段聊天扣费会使用）
 * - consumed: 已消耗积分
 */
@Entity('user_credit_accounts')
export class UserCreditAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'int', default: 0 })
  availableCredits: number;

  @Column({ type: 'int', default: 0 })
  reservedCredits: number;

  @Column({ type: 'int', default: 0 })
  consumedCredits: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

