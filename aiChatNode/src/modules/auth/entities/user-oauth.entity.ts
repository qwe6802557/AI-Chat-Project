import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * 第三方 OAuth 授权绑定实体
 */
@Entity('user_oauth')
@Index(['platform', 'openid'], { unique: true })
export class UserOauth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 关联的本系统用户 ID
   */
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.oauthAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * OAuth 平台类型，如 'qq', 'wechat'
   */
  @Column({ type: 'varchar', length: 20 })
  platform: string;

  /**
   * 第三方平台的唯一用户标识 OpenID
   */
  @Column({ type: 'varchar', length: 128 })
  openid: string;

  /**
   * 跨应用统一标识 UnionID（微信等多应用互通时使用）
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  unionid?: string | null;

  /**
   * 第三方平台的用户昵称
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname?: string | null;

  /**
   * 第三方平台的用户头像链接
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null;

  /**
   * 授权时保存的原始响应回包
   */
  @Column({ type: 'jsonb', nullable: true })
  rawData?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
