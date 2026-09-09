import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ImageGenerationStatus = 'pending' | 'success' | 'failed';

/**
 * AI生图任务与生成记录实体
 */
@Entity('image_generations')
export class ImageGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'varchar', length: 100 })
  modelId: string;

  @Column({ type: 'varchar', length: 20, default: '1:1' })
  aspectRatio: string;

  @Column({ type: 'varchar', length: 20, default: '1k' })
  resolution: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  quality: string;

  @Column({ type: 'int', default: 1 })
  numGenerations: number;

  @Column({ type: 'simple-array', default: '' })
  imageUrls: string[];

  @Column({ type: 'int', default: 100 })
  costCredits: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ImageGenerationStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
