import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * 发送短信验证码 DTO
 */
export class SendSmsDto {
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
}

