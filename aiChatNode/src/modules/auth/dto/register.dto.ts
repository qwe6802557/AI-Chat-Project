import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

/**
 * 注册 DTO
 */
export class RegisterDto {
  /**
   * 用户名
   */
  @ApiProperty({
    description: '用户名（3-20个字符，只能包含字母、数字、下划线）',
    example: 'newuser',
    minLength: 3,
    maxLength: 20,
    pattern: '^[a-zA-Z0-9_]{3,20}$',
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
    description: '密码（6-20个字符，必须包含字母和数字）',
    example: 'test123456',
    minLength: 6,
    maxLength: 20,
    pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*#?&]{6,20}$',
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
    description: '邮箱地址',
    example: 'newuser@example.com',
  })
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  /**
   * 邮箱验证码
   */
  @ApiProperty({
    description: '邮箱验证码（6位数字）',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsNotEmpty({ message: '邮箱验证码不能为空' })
  @IsString({ message: '邮箱验证码必须是字符串' })
  @Matches(/^\d{6}$/, {
    message: '邮箱验证码必须是6位数字',
  })
  emailCode: string;

  /**
   * 手机号（可选）
   */
  @ApiProperty({
    description: '手机号（可选，11位数字，符合中国手机号格式）',
    example: '13900139001',
    required: false,
    pattern: '^1[3-9]\\d{9}$',
  })
  @IsOptional()
  @IsString({ message: '手机号必须是字符串' })
  @Matches(/^1[3-9]\d{9}$/, {
    message: '手机号格式不正确',
  })
  phone?: string;
}
