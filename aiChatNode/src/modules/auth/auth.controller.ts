import { Controller, Post, Get, Body, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  SendSmsDto,
  SendEmailDto,
  ResetPasswordDto,
} from './dto';

/**
 * 认证控制器
 */
@ApiTags('用户认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 获取图片验证码
   */
  @Get('captcha')
  @ApiOperation({
    summary: '获取图片验证码',
    description: '生成图片验证码，返回验证码图片（base64）和验证码 ID',
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      example: {
        code: 0,
        data: {
          captchaId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          captchaImage:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNDAiPi4uLjwvc3ZnPg==',
        },
        message: '操作成功',
      },
    },
  })
  async getCaptcha() {
    return this.authService.generateCaptcha();
  }

  /**
   * 发送短信验证码
   */
  @Post('sms/send')
  @ApiOperation({
    summary: '发送短信验证码',
    description: '发送短信验证码到指定手机号，同一手机号1分钟内只能发送一次',
  })
  @ApiBody({ type: SendSmsDto })
  @ApiResponse({
    status: 200,
    description: '发送成功',
    schema: {
      example: {
        code: 0,
        data: {
          message: '验证码已发送',
          code: '123456', // 仅开发环境返回
        },
        message: '操作成功',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '发送失败',
    schema: {
      example: {
        code: 1,
        data: null,
        message: '请60秒后再试',
      },
    },
  })
  async sendSmsCode(@Body(ValidationPipe) sendSmsDto: SendSmsDto) {
    return this.authService.sendSmsCode(sendSmsDto.phone);
  }

  /**
   * 发送邮件验证码
   */
  @Post('email/send')
  @ApiOperation({
    summary: '发送邮件验证码',
    description: '发送邮件验证码到指定邮箱，同一邮箱1分钟内只能发送一次',
  })
  @ApiBody({ type: SendEmailDto })
  @ApiResponse({
    status: 200,
    description: '发送成功',
    schema: {
      example: {
        code: 0,
        data: {
          message: '验证码已发送到您的邮箱',
          code: '123456', // 开发环境返回
        },
        message: '操作成功',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '发送失败',
    schema: {
      example: {
        code: 1,
        data: null,
        message: '请60秒后再试',
      },
    },
  })
  async sendEmailCode(@Body(ValidationPipe) sendEmailDto: SendEmailDto) {
    return this.authService.sendEmailCode(sendEmailDto.email);
  }

  /**
   * 用户登录
   */
  @Post('login')
  @ApiOperation({
    summary: '用户登录',
    description:
      '用户登录，验证用户名、密码和图片验证码，登录成功返回 JWT token',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: '登录成功',
    schema: {
      example: {
        code: 0,
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
            username: 'admin',
            phone: '13800138000',
            email: 'admin@example.com',
            role: 'admin',
            isActive: true,
            createdAt: '2025-11-16T21:10:53.000Z',
            updatedAt: '2025-11-16T21:10:53.000Z',
          },
        },
        message: '登录成功',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '验证码错误',
    schema: {
      example: {
        code: 1,
        data: null,
        message: '验证码错误或已过期',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '用户名或密码错误',
    schema: {
      example: {
        code: 1,
        data: null,
        message: '用户名或密码错误',
      },
    },
  })
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * 用户注册
   */
  @Post('register')
  @ApiOperation({
    summary: '用户注册',
    description: '用户注册，验证短信验证码，注册成功后自动登录并返回 JWT token',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 200,
    description: '注册成功',
    schema: {
      example: {
        code: 0,
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: 'new-user-uuid',
            username: 'newuser',
            phone: '13900139001',
            email: 'newuser@example.com',
            role: 'user',
            isActive: true,
            createdAt: '2025-11-16T21:10:53.000Z',
            updatedAt: '2025-11-16T21:10:53.000Z',
          },
        },
        message: '注册成功',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '注册失败',
    schema: {
      example: {
        code: 1,
        data: null,
        message: '用户名已存在',
      },
    },
  })
  async register(@Body(ValidationPipe) registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * 重置密码（忘记密码）
   */
  @Post('reset-password')
  @ApiOperation({
    summary: '重置密码',
    description: '通过短信验证码重置密码，用于忘记密码场景',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: '密码重置成功',
    schema: {
      example: {
        code: 0,
        data: {
          message: '密码重置成功',
        },
        message: '操作成功',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '重置失败',
    schema: {
      example: {
        code: 1,
        data: null,
        message: '短信验证码错误或已过期',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '用户不存在',
    schema: {
      example: {
        code: 1,
        data: null,
        message: '该手机号未注册',
      },
    },
  })
  async resetPassword(
    @Body(ValidationPipe) resetPasswordDto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
