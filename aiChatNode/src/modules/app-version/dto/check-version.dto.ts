import { IsOptional, IsString } from 'class-validator';

/**
 * 版本检查请求参数 DTO
 */
export class CheckVersionDto {
  /**
   * 客户端当前版本号，如 1.0.0
   */
  @IsOptional()
  @IsString()
  version?: string;

  /**
   * 客户端平台类型 (android | ios | windows | web)
   */
  @IsOptional()
  @IsString()
  platform?: string;
}
