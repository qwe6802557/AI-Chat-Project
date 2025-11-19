import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ChatSession } from './chat-session.entity';

/**
 * 聊天记录实体
 */
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
}
