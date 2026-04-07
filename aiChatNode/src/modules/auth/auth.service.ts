import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import type { User } from '../user/entities/user.entity';
import { UserRole } from '../user/entities/user.entity';
import { toAuthenticatedUser } from './authenticated-user';
import { CaptchaService } from './services/captcha.service';
import { SmsService } from './services/sms.service';
import { EmailService } from './services/email.service';
import {
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  EmailVerificationPurpose,
} from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { CreditsService } from '../credits/credits.service';
import {
  CreditBusinessType,
  DEFAULT_REGISTER_CREDITS,
} from '../credits/types/credits.types';
import { DataSource } from 'typeorm';

/**
 * 认证服务
 */
@Injectable()
export class AuthService {
  private readonly invalidCredentialsMessage = '用户名或密码错误';
  private readonly resetPasswordFailedMessage =
    '重置密码失败，请确认邮箱和验证码';

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly captchaService: CaptchaService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto) {
    const { username, password, captcha, captchaId } = loginDto;

    // 验证图片验证码
    const isCaptchaValid = await this.captchaService.verifyCaptcha(
      captchaId,
      captcha,
    );
    if (!isCaptchaValid) {
      throw new BadRequestException('验证码错误或已过期');
    }

    // 查找用户
    const user = await this.userService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    // 检查用户是否被禁用
    if (!user.isActive) {
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    // 生成 JWT token
    const token = this.generateToken(user);
    const credits = await this.creditsService.getSnapshotForUser(user.id);

    return {
      token,
      user: {
        ...toAuthenticatedUser(user),
        credits,
      },
    };
  }

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto) {
    const { username, password, email, emailCode, phone } = registerDto;

    // 验证邮箱验证码
    const isEmailCodeValid = await this.emailService.verifyEmailCode(
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

    const user = await this.dataSource.transaction(async (manager) => {
      const createdUser = await this.userService.create(
        {
          username,
          password,
          email,
          phone,
          role: UserRole.USER, // 默认角色为普通用户
        },
        manager,
      );

      await this.creditsService.ensureAccount(
        createdUser.id,
        {
          initialCredits: DEFAULT_REGISTER_CREDITS,
          businessType: CreditBusinessType.REGISTER_BONUS,
          remark: '新用户注册赠送积分',
        },
        manager,
      );

      return createdUser;
    });

    // 生成token
    const token = this.generateToken(user);
    const credits = await this.creditsService.getSnapshotForUser(user.id);

    return {
      token,
      user: {
        ...toAuthenticatedUser(user),
        credits,
      },
    };
  }

  /**
   * 生成 JWT token
   */
  private generateToken(user: Pick<User, 'id' | 'username' | 'role'>): string {
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
  sendSmsCode(phone: string) {
    return this.smsService.sendSmsCode(phone);
  }

  /**
   * 发送邮件验证码
   */
  async sendEmailCode(email: string, purpose: EmailVerificationPurpose) {
    const existingUser = await this.userService.findByEmail(email);

    if (purpose === EmailVerificationPurpose.REGISTER && existingUser) {
      throw new BadRequestException('该邮箱已注册');
    }

    if (purpose === EmailVerificationPurpose.RESET_PASSWORD && !existingUser) {
      throw new BadRequestException('该邮箱未注册');
    }

    return this.emailService.sendEmailCode(email);
  }

  /**
   * 重置密码
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, emailCode, newPassword } = resetPasswordDto;

    // 验证邮箱验证码
    const isEmailCodeValid = await this.emailService.verifyEmailCode(
      email,
      emailCode,
    );
    if (!isEmailCodeValid) {
      throw new BadRequestException(this.resetPasswordFailedMessage);
    }

    // 查找用户
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException(this.resetPasswordFailedMessage);
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
