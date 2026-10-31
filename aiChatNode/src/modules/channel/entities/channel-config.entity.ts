import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { AgentRole } from './agent-role.entity';

export type ChannelType = 'weixin' | 'qq' | 'feishu' | 'dingtalk' | 'wecom_bot';
export type ChannelStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * 智能助理通道配置实体 (支持多实例与角色解耦)
 */
@Entity('channel_config')
@Index('idx_channel_config_user_id', ['userId'])
export class ChannelConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 50 })
  channelType: ChannelType;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  instanceName: string | null;

  @Column({ type: 'uuid', nullable: true })
  roleId: string | null;

  @ManyToOne(() => AgentRole, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'roleId' })
  role?: AgentRole | null;

  @Column({ type: 'boolean', default: false })
  isEnabled: boolean;

  @Column({ type: 'varchar', length: 50, default: 'disconnected' })
  status: ChannelStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  boundModelId: string | null;

  @Column({ type: 'text', nullable: true })
  systemPrompt: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  credentials: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
