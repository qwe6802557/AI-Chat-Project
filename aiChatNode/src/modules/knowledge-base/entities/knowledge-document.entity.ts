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
import { KnowledgeBase } from './knowledge-base.entity';
import { KnowledgeChunk } from './knowledge-chunk.entity';

export type DocumentParseStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * 知识库文档记录实体
 */
@Entity('knowledge_documents')
@Index('idx_knowledge_documents_kb_id', ['knowledgeBaseId'])
@Index('idx_knowledge_documents_user_id', ['userId'])
export class KnowledgeDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  knowledgeBaseId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 50 })
  fileType: string;

  @Column({ type: 'int', default: 0 })
  fileSize: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  filePath: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  status: DocumentParseStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0 })
  chunkCount: number;

  @Column({ type: 'int', default: 0 })
  charCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => KnowledgeBase, (kb) => kb.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledgeBaseId' })
  knowledgeBase: KnowledgeBase;

  @OneToMany(() => KnowledgeChunk, (chunk) => chunk.document)
  chunks: KnowledgeChunk[];
}
