import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseDto } from '../dto/response.dto';

/**
 * 统一响应拦截器
 * 成功的响应包装成统一格式：{ code: 0, data: ..., message: ... }
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseDto<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseDto<T>> {
    return next.handle().pipe(
      map((data) => {
        // 如果返回的数据已经是 ResponseDto 格式 直接返回
        if (data instanceof ResponseDto) {
          return data;
        }

        // 否则包装成统一格式
        return ResponseDto.success(data);
      }),
    );
  }
}
