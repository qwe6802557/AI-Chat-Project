import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 查询日常记忆列表 DTO
 */
export class QueryDailyMemoryDto {
  @IsOptional()
  @IsString()
  dateKey?: string;

  @IsOptional()
  @IsIn(['fact', 'preference', 'decision', 'todo'])
  category?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
