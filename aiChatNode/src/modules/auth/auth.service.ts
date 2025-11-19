import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { CaptchaService } from './services/captcha.service';
import { SmsService } from './services/sms.service';
import { LoginDto, RegisterDto, ResetPasswordDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

/**
 * 认证服务
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly captchaService: CaptchaService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto) {
    const { username, password, captcha, captchaId } = loginDto;

    // 1. 验证图片验证码
    const isCaptchaValid = this.captchaService.verifyCaptcha(captchaId, captcha);
    if (!isCaptchaValid) {
      throw new BadRequestException('验证码错误或已过期');
    }

    // 2. 查找用户
    const user = await this.userService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 3. 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 4. 检查用户是否被禁用
    if (!user.isActive) {
      throw new UnauthorizedException('用户已被禁用');
    }

    // 5. 生成 JWT token
    const token = this.generateToken(user);

    // 6. 返回用户信息（排除密码）
    const { password: _, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
    };
  }

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto) {
    const { username, password, phone, smsCode, email } = registerDto;

    // 1. 验证短信验证码
    const isSmsCodeValid = this.smsService.verifySmsCode(phone, smsCode);
    if (!isSmsCodeValid) {
      throw new BadRequestException('短信验证码错误或已过期');
    }

    // 2. 检查用户名是否已存在
    const existingUserByUsername = await this.userService.findByUsername(username);
    if (existingUserByUsername) {
      throw new BadRequestException('用户名已存在');
    }

    // 3. 检查手机号是否已存在
    const existingUserByPhone = await this.userService.findByPhone(phone);
    if (existingUserByPhone) {
      throw new BadRequestException('手机号已被注册');
    }

    // 4. 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const existingUserByEmail = await this.userService.findByEmail(email);
      if (existingUserByEmail) {
        throw new BadRequestException('邮箱已被注册');
      }
    }

    // 5. 创建用户（密码会在 UserService 中自动加密）
    const user = await this.userService.create({
      username,
      password,
      phone,
      email,
      role: 'user', // 默认角色为普通用户
    });

    // 6. 自动登录：生成 JWT token
    const token = this.generateToken(user);

    // 7. 返回用户信息（排除密码）
    const { password: _, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
    };
  }

  /**
   * 生成 JWT token
   */
  private generateToken(user: any): string {
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * 生成图片验证码
   */
  generateCaptcha() {
    return this.captchaService.generateCaptcha();
  }

  /**
   * 发送短信验证码
   */
  async sendSmsCode(phone: string) {
    return this.smsService.sendSmsCode(phone);
  }

  /**
   * 重置密码（忘记密码）
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { phone, smsCode, newPassword } = resetPasswordDto;

    // 1. 验证短信验证码
    const isSmsCodeValid = this.smsService.verifySmsCode(phone, smsCode);
    if (!isSmsCodeValid) {
      throw new BadRequestException('短信验证码错误或已过期');
    }

    // 2. 查找用户
    const user = await this.userService.findByPhone(phone);
    if (!user) {
      throw new NotFoundException('该手机号未注册');
    }

    // 3. 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4. 更新密码
    await this.userService.updatePassword(user.id, hashedPassword);

    return {
      message: '密码重置成功',
    };
  }
}

