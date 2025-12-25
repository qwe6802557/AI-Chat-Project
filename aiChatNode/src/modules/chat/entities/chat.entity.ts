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
import { ChatSession } from './chat-session.entity';
import { ChatAttachment } from './chat-attachment.entity';

/**
 * 聊天记录实体
 */
@Index('idx_chat_messages_session_created_at', ['sessionId', 'createdAt'])
@Index('idx_chat_messages_user_created_at', ['userId', 'createdAt'])
@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 关联的用户
   */
  @ManyToOne(() => User, (user) => user.chatMessages, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * 用户 ID
   */
  @Column({ type: 'uuid' })
  userId: string;

  /**
   * 关联的会话
   */
  @ManyToOne(() => ChatSession, (session) => session.chatMessages, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'sessionId' })
  session: ChatSession;

  /**
   * 会话 ID
   */
  @Column({ type: 'uuid' })
  sessionId: string;

  /**
   * 用户消息
   */
  @Column({ type: 'text' })
  userMessage: string;

  /**
   * AI 回复
   */
  @Column({ type: 'text' })
  aiMessage: string;

  /**
   * 使用的模型
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string;

  /**
   * 使用的 token 数量
   */
  @Column({ type: 'jsonb', nullable: true })
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

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
   * 关联附件-用于用户消息的图片/文件
   */
  @OneToMany(() => ChatAttachment, (attachment) => attachment.message, {
    cascade: false,
  })
  attachments?: ChatAttachment[];
}
