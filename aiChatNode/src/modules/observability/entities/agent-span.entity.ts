import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AgentSpanType =
  | 'workflow'
  | 'dag_node'
  | 'llm'
  | 'tool'
  | 'rag'
  | 'memory'
  | 'swarm_handoff'
  | 'channel_dispatch';

export type AgentSpanStatus = 'running' | 'completed' | 'failed' | 'skipped';

const bigintTransformer = {
  to: (value: number | null | undefined) => value ?? 0,
  from: (value: string | number | null | undefined) => Number(value ?? 0),
};

const decimalTransformer = {
  to: (value: number | null | undefined) => value ?? 0,
  from: (value: string | number | null | undefined) => Number(value ?? 0),
};

/**
 * 分布式追踪链路子阶段节点记录表
 */
@Entity('agent_spans')
@Index('idx_agent_spans_trace_started', ['traceId', 'startedAt'])
export class AgentSpan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  traceId: string;

  @Column({ type: 'varchar', length: 64 })
  spanId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  parentSpanId: string | null;

  /**
   * 关联 DAG 节点 ID（供前端拓扑与瀑布流双向定位）
   */
  @Column({ type: 'varchar', length: 80, nullable: true })
  nodeId: string | null;

  @Column({ type: 'varchar', length: 32 })
  spanType: AgentSpanType;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  modelId: string | null;

  @Column({ type: 'varchar', length: 24, default: 'completed' })
  status: AgentSpanStatus;

  /**
   * 起始毫秒时间戳
   */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  startedAt: number;

  @Column({ type: 'int', default: 0 })
  durationMs: number;

  @Column({ type: 'int', default: 0 })
  promptTokens: number;

  @Column({ type: 'int', default: 0 })
  completionTokens: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    default: 0,
    transformer: decimalTransformer,
  })
  estimatedCredits: number;

  @Column({ type: 'text', nullable: true })
  inputSummary: string | null;

  @Column({ type: 'text', nullable: true })
  outputSummary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
