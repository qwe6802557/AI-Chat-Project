import { ApiProperty } from '@nestjs/swagger';

/**
 * 业务错误码常量
 */
export enum BusinessCode {
  /** 成功 */
  SUCCESS = 0,
  /** 权限相关错误（未登录、无权限） */
  AUTH_ERROR = 1,
  /** 业务错误、参数错误、系统错误 */
  BUSINESS_ERROR = 500,
}

/**
 * 统一响应数据结构
 */
export class ResponseDto<T = any> {
  /**
   * 状态码：
   * - 0: 成功
   * - 1: 权限相关错误（未登录、无权限）
   * - 500: 业务错误、参数错误、系统错误
   */
  @ApiProperty({
    description:
      '状态码：0=成功, 1=权限错误(未登录/无权限), 500=业务/参数/系统错误',
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
    return new ResponseDto(BusinessCode.SUCCESS, data, message || '操作成功');
  }

  /**
   * 权限错误响应（401未登录、403无权限）
   */
  static authError(message: string, data?: any): ResponseDto {
    return new ResponseDto(BusinessCode.AUTH_ERROR, data, message);
  }

  /**
   * 业务错误响应（参数错误、业务逻辑错误、系统错误）
   */
  static businessError(message: string, data?: any): ResponseDto {
    return new ResponseDto(BusinessCode.BUSINESS_ERROR, data, message);
  }

  /**
   * 通用错误响应（根据 HTTP 状态码自动判断）
   * @param httpStatus HTTP状态码
   * @param message 错误消息
   * @param data 附加数据
   */
  static errorByStatus(
    httpStatus: number,
    message: string,
    data?: any,
  ): ResponseDto {
    // 401 未授权 和 403 禁止访问 返回 code: 1
    if (httpStatus === 401 || httpStatus === 403) {
      return ResponseDto.authError(message, data);
    }
    // 其他所有错误返回 code: 500
    return ResponseDto.businessError(message, data);
  }
}
