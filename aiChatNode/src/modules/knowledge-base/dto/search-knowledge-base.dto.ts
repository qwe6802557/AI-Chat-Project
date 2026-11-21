import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export type RetrievalMode = 'hybrid' | 'dense' | 'sparse';

export class SearchKnowledgeBaseDto {
  @ApiProperty({
    description: '检索查询关键词/语义问题',
    example: '系统使用的什么分块策略？',
  })
  @IsNotEmpty({ message: 'query 不能为空' })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: '限制检索的知识库 ID 列表，留空表示检索当前用户所有激活库',
    example: ['b94b0f90-1234-4567-89ab-cdef01234567'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeBaseIds?: string[];

  @ApiPropertyOptional({
    description: '限制检索的文档 ID 列表',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[];

  @ApiPropertyOptional({ description: '返回的最大切片数量', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;

  @ApiPropertyOptional({
    description: '检索模式：hybrid（双路RRF）/ dense（纯语义）/ sparse（纯关键词）',
    default: 'hybrid',
  })
  @IsOptional()
  @IsIn(['hybrid', 'dense', 'sparse'])
  mode?: RetrievalMode = 'hybrid';

  @ApiPropertyOptional({
    description: '最低置信度过滤阈值 (0 ~ 1)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;

  @ApiPropertyOptional({
    description: '是否启用 Cross-Encoder 精排',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enableRerank?: boolean = true;
}
