import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type VoiceTaskType = 'tts' | 'stt';
export type VoiceTaskStatus = 'pending' | 'success' | 'failed';

/**
 * 语音创作与识别任务实体 (TTS / STT)
 */
@Entity('voice_tasks')
export class VoiceTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  type: VoiceTaskType;

  @Column({ type: 'varchar', length: 100, default: 'grok-voice-think-fast-1.0' })
  model: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  voiceId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'zh' })
  language: string;

  @Column({ type: 'float', default: 1.0 })
  speed: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'text', nullable: true })
  audioUrl?: string | null;

  @Column({ type: 'int', default: 20 })
  costCredits: number;

  @Column({ type: 'float', nullable: true })
  duration?: number | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: VoiceTaskStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
