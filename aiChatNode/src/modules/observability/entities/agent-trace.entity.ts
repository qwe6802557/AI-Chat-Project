import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AgentTraceSource =
  | 'web_chat'
  | 'workflow_debug'
  | 'workflow_chat'
  | 'channel';

export type AgentTraceStatus = 'running' | 'completed' | 'failed' | 'aborted';

const numericTransformer = {
  to: (value: number | null | undefined) => value ?? 0,
  from: (value: string | number | null | undefined) => Number(value ?? 0),
};

/**
 * 分布式全链路执行追踪主记录表
 */
@Entity('agent_traces')
@Index('idx_agent_traces_user_created', ['userId', 'createdAt'])
@Index('idx_agent_traces_workflow_created', ['workflowId', 'createdAt'])
@Index('idx_agent_traces_channel_created', ['channelInstanceId', 'createdAt'])
export class AgentTrace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 唯一分布式追踪标识
   */
  @Column({ type: 'varchar', length: 64, unique: true })
  traceId: string;

  @Column({ type: 'uuid' })
  userId: string;

  /**
   * 触发来源：web_chat / workflow_debug / workflow_chat / channel
   */
  @Column({ type: 'varchar', length: 32, default: 'web_chat' })
  source: AgentTraceSource;

  @Column({ type: 'uuid', nullable: true })
  workflowId: string | null;

  @Column({ type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  channelInstanceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  roleId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 24, default: 'running' })
  status: AgentTraceStatus;

  @Column({ type: 'int', default: 0 })
  durationMs: number;

  @Column({ type: 'int', default: 0 })
  totalPromptTokens: number;

  @Column({ type: 'int', default: 0 })
  totalCompletionTokens: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    default: 0,
    transformer: numericTransformer,
  })
  totalCredits: number;

  @Column({ type: 'text', nullable: true })
  errorSummary: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
