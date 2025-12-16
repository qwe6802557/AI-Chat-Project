import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaptchaService } from './services/captcha.service';
import { SmsService } from './services/sms.service';
import { EmailService } from './services/email.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';

/**
 * 认证模块
 */
@Module({
  imports: [
    // 导入 UserModule 以使用 UserService
    UserModule,
    // 配置 Passport
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // 配置 JWT
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: '7d', // Token 有效期 7 天
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CaptchaService,
    SmsService,
    EmailService,
    JwtStrategy,
  ],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
