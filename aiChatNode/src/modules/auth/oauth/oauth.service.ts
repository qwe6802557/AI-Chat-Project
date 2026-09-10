import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { UserOauth } from '../entities/user-oauth.entity';
import { User, UserRole } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { AuthService } from '../auth.service';
import { CreditsService } from '../../credits/credits.service';
import { RedisService } from '../../../common/redis/redis.service';
import {
  DEFAULT_REGISTER_CREDITS,
  CreditBusinessType,
} from '../../credits/types/credits.types';
import { toAuthenticatedUser } from '../authenticated-user';
import {
  IOAuthProvider,
  OAuthAuthorizeUrlResponse,
  OAuthCallbackDto,
  OAuthPlatform,
  OAuthUserProfile,
} from './oauth.types';
import { QQOAuthProvider } from './providers/qq-oauth.provider';
import { WechatOAuthProvider } from './providers/wechat-oauth.provider';
import { MockOAuthProvider } from './providers/mock-oauth.provider';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectRepository(UserOauth)
    private readonly oauthRepo: Repository<UserOauth>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly creditsService: CreditsService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly qqProvider: QQOAuthProvider,
    private readonly wechatProvider: WechatOAuthProvider,
    private readonly mockProvider: MockOAuthProvider,
    private readonly dataSource: DataSource,
  ) {}

  private isMockEnabled(): boolean {
    const envMock = this.configService.get<string>('OAUTH_MOCK_ENABLED');
    if (envMock === 'true') {
      return true;
    }
    // 未配置真实 QQ AppId 时自动回退至 Mock 模式保障联调
    return !this.qqProvider.isConfigured();
  }

  private resolveProvider(
    platform: string,
    isMock: boolean = false,
  ): IOAuthProvider {
    const normalized = platform.toLowerCase();
    if (normalized === OAuthPlatform.WECHAT) {
      return this.wechatProvider;
    }

    if (normalized === OAuthPlatform.QQ) {
      if (isMock || this.isMockEnabled()) {
        return this.mockProvider;
      }
      return this.qqProvider;
    }

    throw new BadRequestException(`不支持的 OAuth 平台: ${platform}`);
  }

  /**
   * 生成授权跳转 URL 及防伪 state
   */
  async getAuthorizeUrl(platform: string): Promise<OAuthAuthorizeUrlResponse> {
    const isMock = this.isMockEnabled();
    const provider = this.resolveProvider(platform, isMock);

    const state = randomUUID();
    // 写入 Redis 缓存 5 分钟，用于防范 CSRF
    try {
      await this.redisService.set(`oauth:state:${state}`, platform, {
        EX: 300,
      });
    } catch (err) {
      this.logger.warn(`Redis 保存 OAuth state 失败，降级处理: ${err}`);
    }

    const url = await provider.getAuthorizeUrl(state);
    return {
      platform,
      url,
      state,
      isMock,
    };
  }

  /**
   * 处理第三方回调授权并完成登录/静默注册
   */
  async handleCallback(dto: OAuthCallbackDto) {
    const { platform, code, state } = dto;
    const isMock = code.startsWith('mock_') || this.isMockEnabled();

    // 校验安全 state
    if (!isMock && !state.startsWith('mock_state')) {
      try {
        const storedPlatform = await this.redisService.getDel(
          `oauth:state:${state}`,
        );
        if (!storedPlatform || storedPlatform !== platform) {
          throw new BadRequestException('授权已过期或安全验证失败，请重新尝试登录');
        }
      } catch (err) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        this.logger.warn(`Redis 校验 state 异常: ${err}`);
      }
    }

    const provider = this.resolveProvider(platform, isMock);
    const profile = await provider.getUserProfile(code);

    // 查找是否已存在该平台的授权绑定
    let oauthRecord = await this.oauthRepo.findOne({
      where: { platform: profile.platform, openid: profile.openid },
      relations: ['user'],
    });

    let user: User;

    if (oauthRecord?.user) {
      user = oauthRecord.user;
      if (!user.isActive) {
        throw new ForbiddenException('该账号已被禁用，请联系管理员');
      }

      // 同步最新头像与昵称
      if (
        profile.nickname !== oauthRecord.nickname ||
        profile.avatarUrl !== oauthRecord.avatarUrl
      ) {
        oauthRecord.nickname = profile.nickname;
        oauthRecord.avatarUrl = profile.avatarUrl;
        oauthRecord.rawData = profile.rawData || oauthRecord.rawData;
        await this.oauthRepo.save(oauthRecord);
      }
    } else {
      // 首次第三方登录：一键静默建号并赠送 2000 积分
      user = await this.createOAuthUserWithTransaction(profile);
    }

    const token = this.authService.generateToken(user);
    const credits = await this.creditsService.getSnapshotForUser(user.id);

    return {
      token,
      user: {
        ...toAuthenticatedUser(user),
        credits,
        oauth: {
          platform: profile.platform,
          nickname: profile.nickname,
          avatarUrl: profile.avatarUrl,
        },
      },
    };
  }

  /**
   * 事务性创建新第三方用户、发放初始积分并绑定 OAuth 记录
   */
  private async createOAuthUserWithTransaction(
    profile: OAuthUserProfile,
  ): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      // 生成符合规范的唯一用户名
      const cleanOpenId = profile.openid.replace(/[^a-zA-Z0-9]/g, '');
      let baseUsername = `${profile.platform}_${cleanOpenId.slice(-6).toLowerCase()}`;
      if (baseUsername.length < 3) {
        baseUsername = `${profile.platform}_${randomBytes(4).toString('hex')}`;
      }

      let targetUsername = baseUsername.slice(0, 18);
      let attempts = 0;
      while (
        await manager.getRepository(User).findOne({ where: { username: targetUsername } })
      ) {
        attempts += 1;
        targetUsername = `${baseUsername.slice(0, 14)}_${randomBytes(2).toString('hex')}`;
        if (attempts > 10) break;
      }

      // 生成随机强密码（第三方用户主要走扫码登录，但亦可后续修改密码）
      const randomPassword = `${randomBytes(10).toString('hex')}Aa1!`;

      // 创建用户
      const userRepo = manager.getRepository(User);
      const newUser = userRepo.create({
        username: targetUsername,
        password: randomPassword,
        role: UserRole.USER,
        isActive: true,
      });
      const savedUser = await userRepo.save(newUser);

      // 为新用户注入 2000 初始积分
      await this.creditsService.ensureAccount(
        savedUser.id,
        {
          initialCredits: DEFAULT_REGISTER_CREDITS,
          businessType: CreditBusinessType.REGISTER_BONUS,
          remark: `${profile.platform.toUpperCase()} 快捷授权注册赠送新人积分`,
        },
        manager,
      );

      // 创建 user_oauth 关联
      const oauthRepo = manager.getRepository(UserOauth);
      const newOauth = oauthRepo.create({
        userId: savedUser.id,
        platform: profile.platform,
        openid: profile.openid,
        unionid: profile.unionid || null,
        nickname: profile.nickname || null,
        avatarUrl: profile.avatarUrl || null,
        rawData: profile.rawData || null,
      });
      await oauthRepo.save(newOauth);

      this.logger.log(
        `新第三方用户注册成功: ${savedUser.username} (${profile.platform}: ${profile.openid})`,
      );

      return savedUser;
    });
  }
}
