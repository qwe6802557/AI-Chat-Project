import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { MemoryCategory } from '../entities/agent-daily-memory.entity';

/**
 * 手动录入日常情境记忆 DTO
 */
export class CreateDailyMemoryDto {
  @IsIn(['fact', 'preference', 'decision', 'todo'], {
    message: 'category 必须是 fact、preference、decision 或 todo',
  })
  category: MemoryCategory;

  @IsString({ message: 'content 必须是字符串' })
  @MinLength(2, { message: '记忆内容至少需要 2 个字符' })
  @MaxLength(1000, { message: '记忆内容不能超过 1000 个字符' })
  content: string;
}
