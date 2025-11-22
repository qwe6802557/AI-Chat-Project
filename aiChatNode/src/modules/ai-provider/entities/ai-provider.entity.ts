import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AiModel } from './ai-model.entity';

/**
 * AI供应商实体
 */
@Entity('ai_providers')
export class AiProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 供应商名称
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  /**
   * 访问量统计
   */
  @Column({ type: 'bigint', default: 0 })
  accessCount: number;

  /**
   * 供应商描述（可选）
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * 供应商官网URL（可选）
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  website?: string;

  /**
   * 是否启用
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * 关联的AI模型列表
   */
  @OneToMany(() => AiModel, (aiModel) => aiModel.provider, {
    cascade: true, // 级联操作
  })
  models: AiModel[];

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
