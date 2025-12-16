import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEmail } from 'class-validator';

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
}
