import { UserRole } from '../entities/user.entity';

/**
 * 创建用户 DTO
 */
export class CreateUserDto {
  /**
   * 用户名
   */
  username: string;

  /**
   * 密码
   */
  password: string;

  /**
   * 手机号
   */
  phone: string;

  /**
   * 邮箱（可选）
   */
  email?: string;

  /**
   * 用户角色（可选，默认为普通用户）
   */
  role?: UserRole;

  /**
   * 用户偏好（可选）
   */
  preferences?: {
    theme?: string;
    language?: string;
    defaultModel?: string;
    [key: string]: any;
  };
}
