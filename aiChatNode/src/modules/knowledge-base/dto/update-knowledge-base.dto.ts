import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateKnowledgeBaseDto {
  @ApiPropertyOptional({ description: '知识库名称' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: '知识库描述' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: '知识库图标' })
  @IsOptional()
  @IsString()
  avatar?: string;
}
