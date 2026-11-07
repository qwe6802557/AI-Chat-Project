import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * 即时干预请求数据传输对象
 */
export class SteerChatDto {
  @ApiProperty({
    description: '用户即时干预指导文本',
    example: '不要查国内天气，改查东京的天气数据',
  })
  @IsNotEmpty({ message: '干预指令内容不能为空' })
  @IsString({ message: '干预指令必须是字符串' })
  message: string;

  @ApiPropertyOptional({
    description: '干预类型: guide (默认引导插队) 或 override (覆盖指令)',
    example: 'guide',
  })
  @IsOptional()
  @IsString({ message: '干预类型必须是字符串' })
  type?: string;
}
