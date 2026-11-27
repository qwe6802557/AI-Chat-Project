import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KnowledgeBase } from './knowledge-base.entity';
import { KnowledgeDocument } from './knowledge-document.entity';

export type KnowledgeAssetType = 'standalone_image' | 'pdf_page' | 'docx_image';

/**
 * 知识库视觉图像资产实体（与 knowledge_documents 级联删除）
 */
@Entity('knowledge_assets')
@Index('idx_knowledge_assets_doc_id', ['documentId'])
@Index('idx_knowledge_assets_kb_id', ['knowledgeBaseId'])
export class KnowledgeAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  knowledgeBaseId: string;

  @Column({ type: 'uuid' })
  documentId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  assetType: KnowledgeAssetType;

  @Column({ type: 'int', nullable: true })
  pageNumber: number | null;

  @Column({ type: 'varchar', length: 500 })
  storagePath: string;

  @Column({ type: 'varchar', length: 64, default: 'image/webp' })
  mimeType: string;

  @Column({ type: 'int', default: 0 })
  width: number;

  @Column({ type: 'int', default: 0 })
  height: number;

  @Column({ type: 'int', default: 0 })
  sizeBytes: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => KnowledgeBase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledgeBaseId' })
  knowledgeBase: KnowledgeBase;

  @ManyToOne(() => KnowledgeDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: KnowledgeDocument;
}
