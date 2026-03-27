import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEmail, IsEnum } from 'class-validator';

export enum EmailVerificationPurpose {
  REGISTER = 'register',
  RESET_PASSWORD = 'reset-password',
}

/**
 * 发送邮件验证码 DTO
 */
export class SendEmailDto {
  /**
   * 邮箱地址
   */
  @ApiProperty({
    description: '邮箱地址',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  /**
   * 发送用途
   */
  @ApiProperty({
    description: '发送用途',
    enum: EmailVerificationPurpose,
    example: EmailVerificationPurpose.REGISTER,
  })
  @IsNotEmpty({ message: '发送用途不能为空' })
  @IsEnum(EmailVerificationPurpose, { message: '发送用途不合法' })
  purpose: EmailVerificationPurpose;
}
