import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 更新单条切片正文或启停状态 DTO
 */
export class UpdateKnowledgeChunkDto {
  @ApiPropertyOptional({ description: '更新后的切片正文（保存后将自动重算向量）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '是否启用该切片参与召回' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
