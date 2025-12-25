import {
  Entity,
  Index,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ChatMessage } from './chat.entity';

/**
 * 聊天会话实体
 * 用于管理用户的多个聊天对话
 */
@Index('idx_chat_sessions_user_last_active_at', ['userId', 'lastActiveAt'])
@Index('idx_chat_sessions_user_deleted_archived', ['userId', 'isDeleted', 'isArchived'])
@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 会话标题
   * 可以根据第一条消息自动生成，或由用户自定义
   */
  @Column({ type: 'varchar', length: 255, default: '新对话' })
  title: string;

  /**
   * 用户 ID（外键）
   */
  @Column({ type: 'uuid' })
  userId: string;

  /**
   * 会话是否已归档
   */
  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  /**
   * 会话是否已删除（软删除）
   */
  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  /**
   * 最后一条消息的预览（用于列表显示）
   */
  @Column({ type: 'text', nullable: true })
  lastMessagePreview: string;

  /**
   * 最后活跃时间（用于排序）
   */
  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt: Date;

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

  /**
   * 关联用户（多对一）
   */
  @ManyToOne(() => User, (user) => user.chatSessions, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * 关联聊天消息（一对多）
   */
  @OneToMany(() => ChatMessage, (chatMessage) => chatMessage.session, {
    cascade: true,
  })
  chatMessages: ChatMessage[];

  /**
   * 消息数量（虚拟字段，通过查询计算）
   */
  messageCount?: number;
}
