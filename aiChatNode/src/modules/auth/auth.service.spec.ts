import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { EmailVerificationPurpose } from './dto';

describe('AuthService', () => {
  const userService = {
    findByUsername: jest.fn(),
    findByEmail: jest.fn(),
    updatePassword: jest.fn(),
    create: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn(),
  };
  const captchaService = {
    verifyCaptcha: jest.fn(),
    generateCaptcha: jest.fn(),
  };
  const smsService = {
    sendSmsCode: jest.fn(),
  };
  const emailService = {
    verifyEmailCode: jest.fn(),
    sendEmailCode: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      userService as never,
      jwtService as never,
      captchaService as never,
      smsService as never,
      emailService as never,
    );
  });

  it('returns the same login error when user does not exist', async () => {
    captchaService.verifyCaptcha.mockResolvedValue(true);
    userService.findByUsername.mockResolvedValue(null);

    await expect(
      service.login({
        username: 'missing-user',
        password: 'Password123',
        captcha: 'ABCD',
        captchaId: 'captcha-id',
      }),
    ).rejects.toEqual(new UnauthorizedException('用户名或密码错误'));
  });

  it('returns the same login error when password is invalid', async () => {
    captchaService.verifyCaptcha.mockResolvedValue(true);
    userService.findByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'demo',
      password: bcrypt.hashSync('Correct123', 10),
      role: 'user',
      isActive: true,
    });

    await expect(
      service.login({
        username: 'demo',
        password: 'Wrong123',
        captcha: 'ABCD',
        captchaId: 'captcha-id',
      }),
    ).rejects.toEqual(new UnauthorizedException('用户名或密码错误'));
  });

  it('returns the same reset-password error when code is invalid', async () => {
    emailService.verifyEmailCode.mockResolvedValue(false);

    await expect(
      service.resetPassword({
        email: 'demo@example.com',
        emailCode: '123456',
        newPassword: 'NewPassword123',
      }),
    ).rejects.toEqual(
      new BadRequestException('重置密码失败，请确认邮箱和验证码'),
    );
  });

  it('returns the same reset-password error when email is not registered', async () => {
    emailService.verifyEmailCode.mockResolvedValue(true);
    userService.findByEmail.mockResolvedValue(null);

    await expect(
      service.resetPassword({
        email: 'demo@example.com',
        emailCode: '123456',
        newPassword: 'NewPassword123',
      }),
    ).rejects.toEqual(
      new BadRequestException('重置密码失败，请确认邮箱和验证码'),
    );
  });

  it('rejects sending register email code when email already exists', async () => {
    userService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'demo@example.com',
    });

    await expect(
      service.sendEmailCode(
        'demo@example.com',
        EmailVerificationPurpose.REGISTER,
      ),
    ).rejects.toEqual(new BadRequestException('该邮箱已注册'));
  });

  it('rejects sending reset-password email code when email does not exist', async () => {
    userService.findByEmail.mockResolvedValue(null);

    await expect(
      service.sendEmailCode(
        'demo@example.com',
        EmailVerificationPurpose.RESET_PASSWORD,
      ),
    ).rejects.toEqual(new BadRequestException('该邮箱未注册'));
  });
});
