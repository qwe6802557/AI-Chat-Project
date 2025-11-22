import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ResponseDto } from '../dto/response.dto';

/**
 * 统一异常过滤器
 * 捕获所有异常并返回统一格式：{ code: 非0, data: null, message: 错误信息 }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    // 处理 HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message =
          (exceptionResponse as any).message ||
          (exceptionResponse as any).error ||
          message;

        // 如果 message 是数组（如验证错误），取第一个
        if (Array.isArray(message)) {
          message = message[0];
        }
      }
    }
    // 处理普通 Error
    else if (exception instanceof Error) {
      message = exception.message;
    }

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    // 根据 HTTP 状态码返回对应的业务错误码
    // 401/403 → code: 1 (权限错误)
    // 其他 → code: 500 (业务/参数/系统错误)
    const errorResponse = ResponseDto.errorByStatus(status, message);

    // HTTP 状态码仍然使用 200，让前端通过 code 字段判断成功或失败
    response.status(HttpStatus.OK).json(errorResponse);
  }
}
