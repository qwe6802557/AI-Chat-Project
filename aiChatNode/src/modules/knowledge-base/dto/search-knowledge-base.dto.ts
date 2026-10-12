import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchKnowledgeBaseDto {
  @ApiProperty({ description: '检索查询关键词/语义问题', example: '系统使用的什么分块策略？' })
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

  @ApiPropertyOptional({ description: '返回的最大切片数量', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}
