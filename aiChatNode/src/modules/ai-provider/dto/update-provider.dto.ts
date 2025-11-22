import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

/**
 * 更新AI供应商 DTO
 */
export class UpdateProviderDto {
  /**
   * 供应商名称
   */
  @ApiProperty({
    description: '供应商名称',
    example: 'OpenAI',
    required: false,
  })
  @IsOptional()
  @MaxLength(100, { message: '供应商名称不能超过100个字符' })
  @IsString({ message: '供应商名称必须是字符串' })
  name?: string;

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
   * 访问量
   */
  @ApiProperty({
    description: '访问量统计',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @Min(0, { message: '访问量不能为负数' })
  @IsNumber({}, { message: '访问量必须是数字' })
  accessCount?: number;

  /**
   * 是否启用
   */
  @ApiProperty({
    description: '是否启用该供应商',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: '启用状态必须是布尔值' })
  isActive?: boolean;
}
