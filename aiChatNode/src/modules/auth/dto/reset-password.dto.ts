import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

/**
 * 重置密码 DTO
 */
export class ResetPasswordDto {
  /**
   * 手机号
   */
  @ApiProperty({
    description: '手机号（11位数字，符合中国手机号格式）',
    example: '13900139001',
    pattern: '^1[3-9]\\d{9}$',
  })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsString({ message: '手机号必须是字符串' })
  @Matches(/^1[3-9]\d{9}$/, {
    message: '手机号格式不正确',
  })
  phone: string;

  /**
   * 短信验证码
   */
  @ApiProperty({
    description: '短信验证码（6位数字）',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString({ message: '验证码必须是字符串' })
  @Matches(/^\d{6}$/, {
    message: '验证码格式不正确，必须是6位数字',
  })
  smsCode: string;

  /**
   * 新密码
   */
  @ApiProperty({
    description: '新密码（至少6位）',
    example: 'newPassword123',
    minLength: 6,
  })
  @IsNotEmpty({ message: '新密码不能为空' })
  @IsString({ message: '新密码必须是字符串' })
  @MinLength(6, { message: '新密码长度不能少于6位' })
  newPassword: string;
}
