import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AiProvider } from './ai-provider.entity';
import { DEFAULT_MODEL_BILLING_MODE } from '../../credits/types/credits.types';

/**
 * AI模型实体
 */
@Entity('ai_models')
export class AiModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 模型名称
   */
  @Column({ type: 'varchar', length: 100 })
  modelName: string;

  /**
   * 模型ID
   * 例如: gpt-4, gpt-3.5-turbo, claude-3-opus
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  modelId: string;

  /**
   * 输入价格
   * 兼容当前供应商侧的大倍率型数值，保留 6 位小数
   */
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  inputPrice: number;

  /**
   * 输出价格
   * 兼容当前供应商侧的大倍率型数值，保留 6 位小数
   */
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  outputPrice: number;

  /**
   * 上下文长度（token数量）
   */
  @Column({ type: 'int', default: 0 })
  contextLength: number;

  /**
   * 最大输出token数
   */
  @Column({ type: 'int', default: 0 })
  maxOutput: number;

  /**
   * 可用性百分比（0-100）
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100 })
  availability: number;

  /**
   * TPS（每秒处理的token数）
   */
  @Column({ type: 'int', default: 0 })
  tps: number;

  /**
   * 模型描述（可选）
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * 是否启用
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * 计费模式
   * - 当前使用“预占后按实际 token 结算”的模式
   */
  @Column({
    type: 'varchar',
    length: 50,
    default: DEFAULT_MODEL_BILLING_MODE,
  })
  billingMode: string;

  /**
   * 单次请求预占积分上限
   */
  @Column({ type: 'int', default: 100 })
  creditCost: number;

  /**
   * 关联的供应商ID
   */
  @Column({ type: 'uuid' })
  providerId: string;

  /**
   * 关联的供应商
   */
  @ManyToOne(() => AiProvider, (provider) => provider.models, {
    onDelete: 'CASCADE', // 级联删除
  })
  @JoinColumn({ name: 'providerId' })
  provider: AiProvider;

  /**
   * 创建时间
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * 更新时间
   */
  @UpdateDateColumn()
  updatedAt: Date;
}
