import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/user/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * 角色守卫
 * 用于检查用户是否具有访问接口所需的角色权限
 * 必须配合 @Roles() 装饰器使用
 * 必须在 JwtAuthGuard 之后使用（需要先完成认证）
 *
 * @example
 * // 在Controller或方法上使用
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(UserRole.ADMIN)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 获取方法或类上定义的角色要求
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有定义角色要求，则允许访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 获取当前请求的用户信息
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 如果用户不存在（未登录），则拒绝访问
    if (!user) {
      throw new ForbiddenException('请先登录');
    }

    // 检查用户角色是否在允许的角色列表中
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException('无权限操作');
    }

    return true;
  }
}
