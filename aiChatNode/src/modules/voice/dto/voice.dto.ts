import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 提交 TTS 文本转语音 DTO
 */
export class CreateTtsDto {
  @ApiProperty({
    description: '待合成的文本内容',
    example: '您好，欢迎使用 ERJ 智能语音创作平台。',
  })
  @IsString({ message: '文本必须是字符串' })
  @IsNotEmpty({ message: '待合成文本不能为空' })
  @MaxLength(2000, { message: '单次合成文本不能超过 2000 字符' })
  text: string;

  @ApiPropertyOptional({
    description: '语音模型 ID',
    example: 'grok-voice-think-fast-1.0',
    default: 'grok-voice-think-fast-1.0',
  })
  @IsOptional()
  @IsString({ message: '模型名称必须是字符串' })
  model?: string;

  @ApiProperty({
    description: '音色 ID，如 eve、ara',
    example: 'eve',
  })
  @IsString({ message: '音色 ID 必须是字符串' })
  @IsNotEmpty({ message: '音色 ID 不能为空' })
  voiceId: string;

  @ApiPropertyOptional({
    description: '合成语言代码 (zh, en)',
    example: 'zh',
    default: 'zh',
  })
  @IsOptional()
  @IsString({ message: '语言代码必须是字符串' })
  language?: string;

  @ApiPropertyOptional({
    description: '语速倍率 (0.5 ~ 2.0)',
    example: 1.0,
    default: 1.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '语速必须是数字' })
  @Min(0.5, { message: '语速不能低于 0.5' })
  @Max(2.0, { message: '语速不能高于 2.0' })
  speed?: number;
}

/**
 * 提交 STT 语音转文字可选参数 DTO
 */
export class CreateSttDto {
  @ApiPropertyOptional({
    description: '语音识别模型',
    example: 'grok-stt',
    default: 'grok-stt',
  })
  @IsOptional()
  @IsString({ message: '模型名称必须是字符串' })
  model?: string;

  @ApiPropertyOptional({
    description: '语言代码 (zh, en)',
    example: 'zh',
    default: 'zh',
  })
  @IsOptional()
  @IsString({ message: '语言代码必须是字符串' })
  language?: string;
}

/**
 * 查询历史记录 DTO
 */
export class QueryVoiceHistoryDto {
  @ApiPropertyOptional({
    description: '页码',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '每页条数',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description: '任务类型筛选 (all, tts, stt)',
    example: 'all',
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'tts', 'stt'], { message: '筛选类型必须为 all, tts 或 stt' })
  type?: 'all' | 'tts' | 'stt' = 'all';
}
