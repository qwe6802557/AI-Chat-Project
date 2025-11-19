import { ApiProperty } from '@nestjs/swagger';

/**
 * 统一响应数据结构
 */
export class ResponseDto<T = any> {
  /**
   * 状态码：0 表示成功，非 0 表示失败
   */
  @ApiProperty({
    description: '状态码：0 表示成功，非 0 表示失败',
    example: 0,
    type: Number,
  })
  code: number;

  /**
   * 响应数据
   */
  @ApiProperty({
    description: '响应数据',
    example: {},
    required: false,
  })
  data?: T | null;

  /**
   * 提示信息
   */
  @ApiProperty({
    description: '提示信息',
    example: '操作成功',
    type: String,
  })
  message: string;

  constructor(code: number, data?: T, message?: string) {
    this.code = code;
    this.data = data || null;
    this.message = message || (code === 0 ? '操作成功' : '操作失败');
  }

  /**
   * 成功响应
   */
  static success<T>(data?: T, message?: string): ResponseDto<T> {
    return new ResponseDto(0, data, message || '操作成功');
  }

  /**
   * 失败响应
   */
  static error(message: string, code: number = 1, data?: any): ResponseDto {
    return new ResponseDto(code, data, message);
  }
}
