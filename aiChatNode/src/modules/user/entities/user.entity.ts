import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ChatMessage } from '../../chat/entities/chat.entity';
import { ChatSession } from '../../chat/entities/chat-session.entity';

/**
 * 用户角色枚举
 */
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

/**
 * 用户实体
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 用户名
   */
  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  /**
   * 密码
   */
  @Column({ type: 'varchar', length: 255 })
  password: string;

  /**
   * 手机号（可选）
   */
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone?: string;

  /**
   * 邮箱（必填）
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  /**
   *角色
   */
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  /**
   * 用户偏好设置（JSON 格式）
   */
  @Column({ type: 'jsonb', nullable: true })
  preferences?: {
    theme?: string; // 主题：light/dark
    language?: string; // 语言：zh-CN/en-US
    defaultModel?: string; // 默认 AI 模型
    [key: string]: any; // 其他自定义偏好
  };

  /**
   * 是否激活
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * 关联的聊天记录
   */
  @OneToMany(() => ChatMessage, (chatMessage) => chatMessage.user)
  chatMessages: ChatMessage[];

  /**
   * 关联的聊天会话
   */
  @OneToMany(() => ChatSession, (chatSession) => chatSession.user)
  chatSessions: ChatSession[];

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
   * 插入前自动加密
   */
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      // 非加密的格式才加密
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  /**
   * 验证密码
   */
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}
