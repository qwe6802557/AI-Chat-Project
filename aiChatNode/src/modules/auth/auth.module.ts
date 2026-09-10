import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaptchaService } from './services/captcha.service';
import { SmsService } from './services/sms.service';
import { EmailService } from './services/email.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RedisModule } from '../../common/redis/redis.module';
import { UserModule } from '../user/user.module';
import { CreditsModule } from '../credits/credits.module';
import { User } from '../user/entities/user.entity';
import { UserOauth } from './entities/user-oauth.entity';
import { OAuthController } from './oauth/oauth.controller';
import { OAuthService } from './oauth/oauth.service';
import { QQOAuthProvider } from './oauth/providers/qq-oauth.provider';
import { WechatOAuthProvider } from './oauth/providers/wechat-oauth.provider';
import { MockOAuthProvider } from './oauth/providers/mock-oauth.provider';

/**
 * 认证模块
 */
@Module({
  imports: [
    // 导入 ConfigModule
    ConfigModule,
    // 导入 UserModule 以使用 UserService
    UserModule,
    CreditsModule,
    RedisModule,
    TypeOrmModule.forFeature([UserOauth, User]),
    // 配置 Passport
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // 配置 JWT
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
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    CaptchaService,
    SmsService,
    EmailService,
    JwtStrategy,
    OAuthService,
    QQOAuthProvider,
    WechatOAuthProvider,
    MockOAuthProvider,
  ],
  exports: [AuthService, OAuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
