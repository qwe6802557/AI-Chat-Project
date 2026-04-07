import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { EmailVerificationPurpose } from './dto';
import { CreditBusinessType } from '../credits/types/credits.types';

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
  const creditsService = {
    ensureAccount: jest.fn(),
    getSnapshotForUser: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation(
      async (handler: (manager: Record<string, never>) => Promise<unknown>) =>
        handler({}),
    );
    service = new AuthService(
      userService as never,
      jwtService as never,
      captchaService as never,
      smsService as never,
      emailService as never,
      creditsService as never,
      dataSource as never,
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

  it('returns credits snapshot when login succeeds', async () => {
    captchaService.verifyCaptcha.mockResolvedValue(true);
    userService.findByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'demo',
      email: 'demo@example.com',
      password: bcrypt.hashSync('Correct123', 10),
      role: 'user',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    jwtService.sign.mockReturnValue('token-123');
    creditsService.getSnapshotForUser.mockResolvedValue({
      total: 2000,
      consumed: 0,
      remaining: 2000,
      reserved: 0,
    });

    const result = await service.login({
      username: 'demo',
      password: 'Correct123',
      captcha: 'ABCD',
      captchaId: 'captcha-id',
    });

    expect(creditsService.getSnapshotForUser).toHaveBeenCalledWith('user-1');
    expect(result.user.credits).toEqual({
      total: 2000,
      consumed: 0,
      remaining: 2000,
      reserved: 0,
    });
  });

  it('grants register bonus credits when registration succeeds', async () => {
    emailService.verifyEmailCode.mockResolvedValue(true);
    userService.findByUsername.mockResolvedValue(null);
    userService.findByEmail.mockResolvedValue(null);
    userService.create.mockResolvedValue({
      id: 'user-2',
      username: 'new-user',
      email: 'new@example.com',
      role: 'user',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    jwtService.sign.mockReturnValue('token-456');
    creditsService.getSnapshotForUser.mockResolvedValue({
      total: 2000,
      consumed: 0,
      remaining: 2000,
      reserved: 0,
    });

    const result = await service.register({
      username: 'new-user',
      password: 'Password123',
      email: 'new@example.com',
      emailCode: '123456',
    });

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(creditsService.ensureAccount).toHaveBeenCalledWith(
      'user-2',
      {
        initialCredits: 2000,
        businessType: CreditBusinessType.REGISTER_BONUS,
        remark: '新用户注册赠送积分',
      },
      {},
    );
    expect(result.user.credits.remaining).toBe(2000);
  });
});
