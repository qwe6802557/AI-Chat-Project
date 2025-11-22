import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  MaxLength,
} from 'class-validator';

/**
 * 更新AI模型 DTO
 */
export class UpdateModelDto {
  /**
   * 模型名称
   */
  @ApiProperty({
    description: '模型名称',
    example: 'GPT-4 Turbo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '模型名称必须是字符串' })
  @MaxLength(100, { message: '模型名称不能超过100个字符' })
  modelName?: string;

  /**
   * 模型ID
   */
  @ApiProperty({
    description: '模型ID（用于API调用的唯一标识符）',
    example: 'gpt-4-turbo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '模型ID必须是字符串' })
  @MaxLength(100, { message: '模型ID不能超过100个字符' })
  modelId?: string;

  /**
   * 输入价格
   */
  @ApiProperty({
    description: '输入价格（每千个token的价格，单位：元）',
    example: 0.01,
    required: false,
  })
  @IsOptional()
  @Min(0, { message: '输入价格不能为负数' })
  @IsNumber({}, { message: '输入价格必须是数字' })
  inputPrice?: number;

  /**
   * 输出价格
   */
  @ApiProperty({
    description: '输出价格（每千个token的价格，单位：元）',
    example: 0.03,
    required: false,
  })
  @IsOptional()
  @Min(0, { message: '输出价格不能为负数' })
  @IsNumber({}, { message: '输出价格必须是数字' })
  outputPrice?: number;

  /**
   * 上下文长度
   */
  @ApiProperty({
    description: '上下文长度（支持的最大token数）',
    example: 128000,
    required: false,
  })
  @IsOptional()
  @Min(0, { message: '上下文长度不能为负数' })
  @IsNumber({}, { message: '上下文长度必须是数字' })
  contextLength?: number;

  /**
   * 最大输出
   */
  @ApiProperty({
    description: '最大输出token数',
    example: 4096,
    required: false,
  })
  @IsOptional()
  @Min(0, { message: '最大输出不能为负数' })
  @IsNumber({}, { message: '最大输出必须是数字' })
  maxOutput?: number;

  /**
   * 可用性百分比
   */
  @ApiProperty({
    description: '可用性百分比（0-100）',
    example: 99.9,
    required: false,
  })
  @IsOptional()
  @Min(0, { message: '可用性不能小于0' })
  @Max(100, { message: '可用性不能大于100' })
  @IsNumber({}, { message: '可用性必须是数字' })
  availability?: number;

  /**
   * TPS
   */
  @ApiProperty({
    description: 'TPS（每秒处理的token数）',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @Min(0, { message: 'TPS不能为负数' })
  @IsNumber({}, { message: 'TPS必须是数字' })
  tps?: number;

  /**
   * 模型描述
   */
  @ApiProperty({
    description: '模型描述',
    example: 'GPT-4 Turbo是OpenAI最新的大语言模型',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '描述必须是字符串' })
  description?: string;

  /**
   * 是否启用
   */
  @ApiProperty({
    description: '是否启用该模型',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: '启用状态必须是布尔值' })
  isActive?: boolean;

  /**
   * 供应商ID
   */
  @ApiProperty({
    description: '所属供应商的ID',
    example: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: '供应商ID必须是有效的UUID' })
  providerId?: string;
}
