import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ChannelType = 'weixin' | 'qq' | 'feishu' | 'dingtalk' | 'wecom_bot';
export type ChannelStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

@Entity('channel_config')
export class ChannelConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  channelType: ChannelType;

  @Column({ type: 'varchar', length: 100 })
  name: string;

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
