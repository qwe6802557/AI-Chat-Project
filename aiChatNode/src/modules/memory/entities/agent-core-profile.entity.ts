import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 长期核心用户画像与规则实体（Layer 3）
 */
@Entity('agent_core_profiles')
@Index('idx_agent_core_profiles_user_id', ['userId'], { unique: true })
export class AgentCoreProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'jsonb', default: {} })
  preferences: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  facts: Record<string, any>;

  @Column({ type: 'text', default: '' })
  rawSummary: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
