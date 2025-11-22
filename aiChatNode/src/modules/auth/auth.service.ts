import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/entities/user.entity';
import { CaptchaService } from './services/captcha.service';
import { SmsService } from './services/sms.service';
import { EmailService } from './services/email.service';
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
    private readonly emailService: EmailService,
  ) {}

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto) {
    const { username, password, captcha, captchaId } = loginDto;

    // 验证图片验证码
    const isCaptchaValid = this.captchaService.verifyCaptcha(
      captchaId,
      captcha,
    );
    if (!isCaptchaValid) {
      throw new BadRequestException('验证码错误或已过期');
    }

    // 查找用户
    const user = await this.userService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('用户名不存在');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查用户是否被禁用
    if (!user.isActive) {
      throw new UnauthorizedException('用户已被禁用');
    }

    // 生成 JWT token
    const token = this.generateToken(user);

    // 返回用户信息）
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
    const { username, password, email, emailCode, phone } = registerDto;

    // 验证邮箱验证码
    const isEmailCodeValid = this.emailService.verifyEmailCode(
      email,
      emailCode,
    );
    if (!isEmailCodeValid) {
      throw new BadRequestException('邮箱验证码错误或已过期');
    }

    // 检查用户名是否已存在
    const existingUserByUsername =
      await this.userService.findByUsername(username);
    if (existingUserByUsername) {
      throw new BadRequestException('用户名已存在');
    }

    // 检查邮箱是否已存在
    const existingUserByEmail = await this.userService.findByEmail(email);
    if (existingUserByEmail) {
      throw new BadRequestException('邮箱已被注册');
    }

    // 检查手机号是否已存在（可选-留作后期发短信验证码注册）
    // if (phone) {
    //   const existingUserByPhone = await this.userService.findByPhone(phone);
    //   if (existingUserByPhone) {
    //     throw new BadRequestException('手机号已被注册');
    //   }
    // }

    // 创建用户
    const user = await this.userService.create({
      username,
      password,
      email,
      phone,
      role: UserRole.USER, // 默认角色为普通用户
    });

    // 生成token
    const token = this.generateToken(user);

    // 返回用户信息（排除密码）
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
   * 发送邮件验证码
   */
  async sendEmailCode(email: string) {
    return this.emailService.sendEmailCode(email);
  }

  /**
   * 重置密码
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, emailCode, newPassword } = resetPasswordDto;

    // 验证邮箱验证码
    const isEmailCodeValid = this.emailService.verifyEmailCode(
      email,
      emailCode,
    );
    if (!isEmailCodeValid) {
      throw new BadRequestException('邮箱验证码错误或已过期');
    }

    // 查找用户
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('该邮箱未注册');
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await this.userService.updatePassword(user.id, hashedPassword);

    return {
      message: '密码重置成功',
    };
  }
}
