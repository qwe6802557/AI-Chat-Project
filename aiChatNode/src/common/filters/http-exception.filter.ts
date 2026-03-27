import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ResponseDto } from '../dto/response.dto';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

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
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = '服务器内部错误';

    // 处理 HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (isRecord(exceptionResponse)) {
        const errorMessage = exceptionResponse.message;
        const errorType = exceptionResponse.error;

        if (Array.isArray(errorMessage)) {
          message = errorMessage;
        } else if (typeof errorMessage === 'string') {
          message = errorMessage;
        } else if (typeof errorType === 'string') {
          message = errorType;
        }
      }
    }
    // 处理普通 Error
    else if (exception instanceof Error) {
      message = exception.message;
    }

    if (Array.isArray(message)) {
      message = message[0] || '服务器内部错误';
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
