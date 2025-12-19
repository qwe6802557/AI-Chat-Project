import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ChatSession } from './chat-session.entity';
import { ChatMessage } from './chat.entity';

/**
 * 聊天附件实体（目前主要用于图片）
 *
 * 设计目标：
 * - 支持“先上传、后发送消息”的 fileId 引用方式（messageId/sessionId 可为空）
 * - 支持历史回看/跨设备同步（落盘 + DB 元数据）
 */
@Entity('chat_attachments')
export class ChatAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 归属用户
   */
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * 关联会话（上传阶段可能为空，发送消息后补齐）
   */
  @Column({ type: 'uuid', nullable: true })
  sessionId?: string | null;

  @ManyToOne(() => ChatSession, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'sessionId' })
  session?: ChatSession | null;

  /**
   * 关联消息（上传阶段为空，消息落库后补齐）
   */
  @Column({ type: 'uuid', nullable: true })
  messageId?: string | null;

  @ManyToOne(() => ChatMessage, (msg) => msg.attachments, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'messageId' })
  message?: ChatMessage | null;

  /**
   * 原始文件名与类型
   */
  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 100 })
  originalMime: string;

  /**
   * 实际存储的 MIME（可能经过重编码，如 image/webp）
   */
  @Column({ type: 'varchar', length: 100 })
  storageMime: string;

  /**
   * 磁盘存储路径（相对路径，便于迁移）
   * 例如：uploads/chat/2025/12/xxxx.webp
   */
  @Column({ type: 'varchar', length: 500 })
  storagePath: string;

  /**
   * 文件大小（字节，存储后）
   */
  @Column({ type: 'int' })
  sizeBytes: number;

  /**
   * 图片宽高（存储后，可选）
   */
  @Column({ type: 'int', nullable: true })
  width?: number | null;

  @Column({ type: 'int', nullable: true })
  height?: number | null;

  @CreateDateColumn()
  createdAt: Date;
}

