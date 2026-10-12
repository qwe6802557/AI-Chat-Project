import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KnowledgeBase } from './knowledge-base.entity';
import { KnowledgeDocument } from './knowledge-document.entity';

/**
 * 知识库切片实体
 */
@Entity('knowledge_chunks')
@Index('idx_knowledge_chunks_kb_id', ['knowledgeBaseId'])
@Index('idx_knowledge_chunks_doc_id', ['documentId'])
@Index('idx_knowledge_chunks_user_id', ['userId'])
export class KnowledgeChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  knowledgeBaseId: string;

  @Column({ type: 'uuid' })
  documentId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int', default: 0 })
  charCount: number;

  @Column({ type: 'real', array: true, nullable: true })
  embedding: number[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => KnowledgeBase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledgeBaseId' })
  knowledgeBase: KnowledgeBase;

  @ManyToOne(() => KnowledgeDocument, (doc) => doc.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'documentId' })
  document: KnowledgeDocument;
}
