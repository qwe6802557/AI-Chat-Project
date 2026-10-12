import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type VideoGenerationStatus = 'pending' | 'processing' | 'success' | 'failed';

/**
 * AI 视频生成任务与记录实体
 */
@Entity('video_generations')
export class VideoGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'varchar', length: 100, default: 'Wan-AI/Wan2.2-T2V-A14B' })
  modelId: string;

  @Column({ type: 'text', nullable: true })
  imageUrl?: string | null;

  @Column({ type: 'varchar', length: 20, default: '16:9' })
  aspectRatio: string;

  @Column({ type: 'int', default: 5 })
  duration: number;

  @Column({ type: 'text', nullable: true })
  videoUrl?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  upstreamTaskId?: string | null;

  @Column({ type: 'int', default: 200 })
  costCredits: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: VideoGenerationStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
