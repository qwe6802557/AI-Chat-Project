import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKnowledgeBaseDto {
  @ApiProperty({ description: '知识库名称', example: '产品架构技术方案' })
  @IsNotEmpty({ message: '知识库名称不能为空' })
  @IsString({ message: '知识库名称必须为字符串' })
  @MaxLength(120, { message: '知识库名称长度不能超过 120 个字符' })
  name: string;

  @ApiPropertyOptional({ description: '知识库描述说明', example: '包含核心业务设计' })
  @IsOptional()
  @IsString({ message: '知识库描述必须为字符串' })
  @MaxLength(1000, { message: '知识库描述长度不能超过 1000 个字符' })
  description?: string;

  @ApiPropertyOptional({ description: '知识库封面图标', example: 'auto_stories' })
  @IsOptional()
  @IsString()
  avatar?: string;
}
