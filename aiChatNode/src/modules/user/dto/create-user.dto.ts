import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

/**
 * 创建用户 DTO
 */
export class CreateUserDto {
  /**
   * 用户名
   */
  @ApiProperty({
    description: '用户名（唯一）',
    example: 'testuser',
    minLength: 3,
    maxLength: 20,
  })
  username: string;

  /**
   * 密码
   */
  @ApiProperty({
    description: '密码（将自动加密存储）',
    example: 'test123456',
    minLength: 6,
  })
  password: string;

  /**
   * 邮箱（必填）
   */
  @ApiProperty({
    description: '邮箱（必填，唯一）',
    example: 'test@example.com',
  })
  email: string;

  /**
   * 手机号（可选）
   */
  @ApiProperty({
    description: '手机号（可选，唯一）',
    example: '13900139000',
    pattern: '^1[3-9]\\d{9}$',
    required: false,
  })
  phone?: string;

  /**
   * 用户角色（可选，默认为普通用户）
   */
  @ApiProperty({
    description: '用户角色',
    enum: UserRole,
    example: UserRole.USER,
    required: false,
    default: UserRole.USER,
  })
  role?: UserRole;

  /**
   * 用户偏好（可选）
   */
  @ApiProperty({
    description: '用户偏好设置（JSON 对象）',
    example: {
      theme: 'light',
      language: 'zh-CN',
      defaultModel: 'gpt-4o',
    },
    required: false,
  })
  preferences?: {
    theme?: string;
    language?: string;
    defaultModel?: string;
    [key: string]: any;
  };
}
