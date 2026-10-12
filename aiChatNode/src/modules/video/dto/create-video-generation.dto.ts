import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVideoGenerationDto {
  @ApiProperty({
    description: '视频画面生成提示词',
    example: 'A cinematic drone shot of misty mountain peaks at golden hour, 4k ultra realistic',
  })
  @IsNotEmpty({ message: '提示词不能为空' })
  @IsString({ message: '提示词必须是字符串' })
  prompt: string;

  @ApiPropertyOptional({
    description: '视频模型ID',
    example: 'Wan-AI/Wan2.2-T2V-A14B',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: '图生视频的参考图URL或base64（附带时自动流转为图生视频模式）',
    example: 'https://example.com/source.jpg',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: '视频宽高比 (16:9, 9:16, 1:1)',
    default: '16:9',
    example: '16:9',
  })
  @IsOptional()
  @IsString()
  aspect_ratio?: string;
}
