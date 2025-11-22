import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsUrl,
  IsBoolean,
} from 'class-validator';

/**
 * 创建AI供应商 DTO
 */
export class CreateProviderDto {
  /**
   * 供应商名称
   */
  @ApiProperty({
    description: '供应商名称（唯一）',
    example: 'OpenAI',
    maxLength: 100,
  })
  @MaxLength(100, { message: '供应商名称不能超过100个字符' })
  @IsString({ message: '供应商名称必须是字符串' })
  @IsNotEmpty({ message: '供应商名称不能为空' })
  name: string;

  /**
   * 供应商描述
   */
  @ApiProperty({
    description: '供应商描述',
    example: '智能研究公司',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '描述必须是字符串' })
  description?: string;

  /**
   * 供应商官网
   */
  @ApiProperty({
    description: '供应商官网URL',
    example: 'https://openai.com',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: '请输入有效的URL地址' })
  website?: string;

  /**
   * 是否启用
   */
  @ApiProperty({
    description: '是否启用该供应商',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: '启用状态必须是布尔值' })
  isActive?: boolean;
}
