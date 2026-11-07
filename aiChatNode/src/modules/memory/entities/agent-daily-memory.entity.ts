import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type MemoryCategory = 'fact' | 'preference' | 'decision' | 'todo';

/**
 * 跨会话日常工作情境记忆实体（Layer 2）
 */
@Entity('agent_daily_memories')
@Index('idx_agent_daily_memories_user_id', ['userId'])
@Index('idx_agent_daily_memories_date_key', ['dateKey'])
@Index('idx_agent_daily_memories_category', ['category'])
@Index('idx_agent_daily_memories_session_id', ['sessionId'])
export class AgentDailyMemory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 16 })
  dateKey: string;

  @Column({ type: 'varchar', length: 32, default: 'fact' })
  category: MemoryCategory;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'real', array: true, nullable: true })
  embedding: number[] | null;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
