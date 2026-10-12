import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { KnowledgeDocument } from './knowledge-document.entity';

/**
 * 知识库主体实体
 */
@Entity('knowledge_bases')
@Index('idx_knowledge_bases_user_id', ['userId'])
export class KnowledgeBase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string | null;

  @Column({ type: 'int', default: 0 })
  documentCount: number;

  @Column({ type: 'int', default: 0 })
  chunkCount: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => KnowledgeDocument, (doc) => doc.knowledgeBase)
  documents: KnowledgeDocument[];
}
