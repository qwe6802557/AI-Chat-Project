import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';

/**
 * 提交生图任务 DTO
 */
export class CreateImageGenerationDto {
  @ApiProperty({
    description: '生图提示词',
    example: 'A minimal red chair in a bright studio',
  })
  @IsString({ message: '提示词必须是字符串' })
  @IsNotEmpty({ message: '提示词不能为空' })
  prompt: string;

  @ApiProperty({
    description: '生图模型',
    example: 'grok-imagine-image-2.0',
    default: 'grok-imagine-image-2.0',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '模型名称必须是字符串' })
  model?: string;

  @ApiProperty({
    description: '生成图片数量（1-4）',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: '生成数量必须是整数' })
  @Min(1, { message: '生成数量最少为 1' })
  @Max(4, { message: '生成数量最多为 4' })
  n?: number;

  @ApiProperty({
    description: '输出媒体宽高比',
    example: '1:1',
    default: '1:1',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '宽高比必须是字符串' })
  @IsIn(['1:1', '16:9', '9:16', '2:3', '3:2', '4:3', '3:4'], {
    message: '不支持的宽高比格式',
  })
  aspect_ratio?: string;

  @ApiProperty({
    description: '分辨率（1k 或 2k）',
    example: '1k',
    default: '1k',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '分辨率必须是字符串' })
  @IsIn(['1k', '2k'], { message: '分辨率仅支持 1k 或 2k' })
  resolution?: string;

  @ApiProperty({
    description: '生成质量（medium 或 low）',
    example: 'medium',
    default: 'medium',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '质量必须是字符串' })
  @IsIn(['medium', 'low'], { message: '质量仅支持 medium 或 low' })
  quality?: string;
}
