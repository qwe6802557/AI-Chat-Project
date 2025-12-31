import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    // 导入 ConfigModule
    ConfigModule,
    // 导入 UserModule 以使用 UserService
    UserModule,
    // 配置 Passport
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // 配置 JWT - 使用异步配置强制验证环境变量
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'JWT_SECRET 环境变量未配置，应用无法启动。请在 .env 文件中配置 JWT_SECRET',
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: '7d', // Token 有效期 7 天
          },
        };
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
