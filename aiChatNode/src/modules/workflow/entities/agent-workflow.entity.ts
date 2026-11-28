import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type DagNodeType =
  | 'start'
  | 'agent'
  | 'rag'
  | 'tool'
  | 'condition'
  | 'end';

export interface DagConditionRule {
  id: string;
  label: string;
  variable: string;
  operator:
    | 'contains'
    | 'not_contains'
    | 'equals'
    | 'not_equals'
    | 'regex'
    | 'gt'
    | 'lt'
    | 'not_empty';
  value?: string;
}

export interface DagNodeData {
  label: string;
  description?: string;
  /** Start 节点预设示例入参 */
  defaultInput?: string;
  /** Agent 节点配置 */
  roleId?: string | null;
  modelId?: string | null;
  systemPrompt?: string;
  promptTemplate?: string;
  knowledgeBaseIds?: string[];
  enabledTools?: string[];
  maxLoops?: number;
  /** RAG 节点配置 */
  queryTemplate?: string;
  topK?: number;
  /** Tool 节点配置 */
  toolName?: string;
  argsTemplate?: Record<string, string>;
  /** Condition 节点分支规则 */
  rules?: DagConditionRule[];
  /** End 节点输出组装模板 */
  responseTemplate?: string;
}

export interface DagWorkflowNode {
  id: string;
  type: DagNodeType;
  position: { x: number; y: number };
  data: DagNodeData;
}

export interface DagWorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}

export interface DagWorkflowGraph {
  nodes: DagWorkflowNode[];
  edges: DagWorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export type WorkflowStatus = 'draft' | 'published';

/**
 * 智能体可视化 DAG 工作流实体（草稿与发布快照双态隔离）
 */
@Entity('agent_workflows')
@Index('idx_agent_workflows_user_updated', ['userId', 'updatedAt'])
export class AgentWorkflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status: WorkflowStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({
    type: 'jsonb',
    default: () =>
      `'{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'`,
  })
  draftGraph: DagWorkflowGraph;

  @Column({ type: 'jsonb', nullable: true })
  publishedGraph: DagWorkflowGraph | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
