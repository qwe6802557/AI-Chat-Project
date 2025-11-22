import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

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
  handleRequest(err: any, user: any, info: any) {
    // 抛出未授权异常
    if (err || !user) {
      throw err || new UnauthorizedException('未授权，请先登录');
    }
    return user;
  }
}
