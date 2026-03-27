import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../authenticated-user';

/**
 * JWT 认证守卫
 * 用于保护需要认证的接口
 * 使用方式：@UseGuards(JwtAuthGuard)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // 调用父类的 canActivate 方法
    return super.canActivate(context);
  }

  /**
   * 处理认证失败的情况
   */
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: AuthenticatedUser | false | null,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    void info;
    void context;
    void status;

    // 抛出未授权异常
    if (err || !user) {
      if (err instanceof Error) {
        throw err;
      }

      throw new UnauthorizedException('未授权，请先登录');
    }
    return user as TUser;
  }
}
