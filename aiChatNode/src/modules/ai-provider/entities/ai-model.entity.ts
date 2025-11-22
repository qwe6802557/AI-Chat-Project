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
   * 输入价格（每千个token的价格，单位：元）
   */
  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  inputPrice: number;

  /**
   * 输出价格（每千个token的价格，单位：元）
   */
  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
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
