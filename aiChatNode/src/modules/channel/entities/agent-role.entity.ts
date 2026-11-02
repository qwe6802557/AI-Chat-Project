import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * 智能体角色实体 (用户专属人设库)
 */
@Entity('agent_roles')
@Index('idx_agent_roles_user_id', ['userId'])
export class AgentRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  boundModelId: string | null;

  @Column({ type: 'text', nullable: true })
  systemPrompt: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'knowledge_base_ids', type: 'jsonb', nullable: true, default: () => "'[]'" })
  knowledgeBaseIds: string[] | null;

  @Column({ name: 'enabled_tools', type: 'jsonb', nullable: true, default: () => "'[]'" })
  enabledTools: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
