import { IsOptional, IsObject, IsString } from 'class-validator';

/**
 * 更新用户核心画像与偏好 DTO
 */
export class UpdateCoreProfileDto {
  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  @IsOptional()
  @IsObject()
  facts?: Record<string, any>;

  @IsOptional()
  @IsString()
  rawSummary?: string;
}
