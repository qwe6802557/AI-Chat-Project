import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export interface ChannelRagSourceItem {
  documentTitle: string;
  score: number;
  content: string;
  chunkIndex: number;
}

/**
 * 通道消息与审计实体 (记录外部联系人与通道实例交互历史)
 */
@Entity('channel_messages')
@Index('idx_channel_msg_user_instance', ['userId', 'instanceId'])
@Index('idx_channel_msg_instance_from', ['instanceId', 'fromId'])
@Index('idx_channel_msg_created_at', ['createdAt'])
export class ChannelMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  instanceId: string;

  @Column({ type: 'varchar', length: 50 })
  channelType: string;

  @Column({ type: 'varchar', length: 120 })
  fromId: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  senderName: string | null;

  @Column({ type: 'uuid', nullable: true })
  roleId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  roleName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  modelId: string | null;

  @Column({ type: 'varchar', length: 20 })
  senderType: 'user' | 'assistant' | 'system';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int', default: 0 })
  costCredits: number;

  @Column({ type: 'jsonb', nullable: true })
  ragSources: ChannelRagSourceItem[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
