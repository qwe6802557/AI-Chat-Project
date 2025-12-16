import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';

/**
 * JWT Token Payload 接口
 */
export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

/**
 * JWT 认证策略
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      // 提取 Bearer token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 不忽略过期时间
      ignoreExpiration: false,
      // JWT 密钥（从环境变量获取，如果没有则使用默认值）
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  /**
   * 验证 JWT payload
   * 此方法会在 JWT 验证通过后自动调用
   * @param payload JWT payload
   * @returns 用户信息（会被注入到 request.user）
   */
  async validate(payload: JwtPayload) {
    // 验证用户是否存在且处于激活状态
    const user = await this.userService.findById(payload.userId);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('用户已被禁用');
    }

    // 返回用户信息（会被注入到 request.user）
    // 排除密码字段
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
