import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/user/entities/user.entity';

/**
 * 角色元数据Key
 */
export const ROLES_KEY = 'roles';

/**
 * 角色装饰器
 * 用于标记接口需要的角色权限
 * @param roles 允许访问的角色列表
 *
 * @example
 * // 只允许管理员访问
 * @Roles(UserRole.ADMIN)
 *
 * @example
 * // 允许管理员和普通用户访问
 * @Roles(UserRole.ADMIN, UserRole.USER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
