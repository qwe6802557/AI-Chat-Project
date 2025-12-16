import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

/**
 * 统一成功响应装饰器
 */
export function ApiSuccessResponse(description: string, dataExample?: any) {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description,
      schema: {
        type: 'object',
        properties: {
          code: {
            type: 'number',
            example: 0,
            description: '状态码：0 表示成功',
          },
          data: {
            type: 'object',
            example: dataExample || {},
            description: '响应数据',
          },
          message: {
            type: 'string',
            example: '操作成功',
            description: '提示信息',
          },
        },
      },
    }),
  );
}

/**
 * 统一错误响应装饰器
 */
export function ApiErrorResponse(description: string, messageExample?: string) {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description,
      schema: {
        type: 'object',
        properties: {
          code: {
            type: 'number',
            example: 1,
            description: '状态码：非 0 表示失败',
          },
          data: {
            type: 'null',
            example: null,
            description: '响应数据',
          },
          message: {
            type: 'string',
            example: messageExample || '操作失败',
            description: '错误信息',
          },
        },
      },
    }),
  );
}
