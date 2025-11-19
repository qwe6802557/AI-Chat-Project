import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength, MaxLength } from 'class-validator';

/**
 * 登录 DTO
 */
export class LoginDto {
  /**
   * 用户名
   */
  @ApiProperty({
    description: '用户名（3-20个字符，只能包含字母、数字、下划线）',
    example: 'admin',
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
    example: 'admin666',
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
   * 图片验证码
   */
  @ApiProperty({
    description: '图片验证码（不区分大小写）',
    example: 'abc123',
    minLength: 4,
    maxLength: 6,
  })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString({ message: '验证码必须是字符串' })
  @MinLength(4, { message: '验证码至少4个字符' })
  @MaxLength(6, { message: '验证码最多6个字符' })
  captcha: string;

  /**
   * 验证码 ID
   */
  @ApiProperty({
    description: '验证码 ID（用于验证）',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsNotEmpty({ message: '验证码ID不能为空' })
  @IsString({ message: '验证码ID必须是字符串' })
  captchaId: string;
}

