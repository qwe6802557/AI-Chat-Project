import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsObject,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
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
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString({ message: '用户名必须是字符串' })
  @MinLength(3, { message: '用户名至少3个字符' })
  @MaxLength(20, { message: '用户名最多20个字符' })
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: '用户名只能包含字母、数字、下划线',
  })
  username: string;

  /**
   * 密码
   */
  @ApiProperty({
    description: '密码（将自动加密存储）',
    example: 'test123456',
    minLength: 6,
    maxLength: 20,
  })
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(20, { message: '密码最多20个字符' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,20}$/, {
    message: '密码必须包含字母和数字',
  })
  password: string;

  /**
   * 邮箱（必填）
   */
  @ApiProperty({
    description: '邮箱（必填，唯一）',
    example: 'test@example.com',
  })
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
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
  @IsOptional()
  @IsString({ message: '手机号必须是字符串' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
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
  @IsOptional()
  @IsEnum(UserRole, { message: '角色必须是 admin 或 user' })
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
  @IsOptional()
  @IsObject({ message: '偏好设置必须是对象' })
  preferences?: {
    theme?: string;
    language?: string;
    defaultModel?: string;
    [key: string]: any;
  };
}
