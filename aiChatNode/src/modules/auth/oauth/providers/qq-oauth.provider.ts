import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IOAuthProvider, OAuthPlatform, OAuthUserProfile } from '../oauth.types';

@Injectable()
export class QQOAuthProvider implements IOAuthProvider {
  private readonly logger = new Logger(QQOAuthProvider.name);
  readonly platform = OAuthPlatform.QQ;

  constructor(private readonly configService: ConfigService) {}

  private getAppId(): string {
    return this.configService.get<string>('QQ_OAUTH_APP_ID') || '';
  }

  private getAppKey(): string {
    return this.configService.get<string>('QQ_OAUTH_APP_KEY') || '';
  }

  private getRedirectUri(): string {
    return (
      this.configService.get<string>('QQ_OAUTH_REDIRECT_URI') ||
      'http://localhost:5173/oauth/callback?platform=qq'
    );
  }

  isConfigured(): boolean {
    const appId = this.getAppId();
    const appKey = this.getAppKey();
    return !!appId && !!appKey && appId !== 'mock_app_id';
  }

  async getAuthorizeUrl(state: string): Promise<string> {
    const appId = this.getAppId();
    const redirectUri = this.getRedirectUri();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: 'get_user_info',
    });

    return `https://graph.qq.com/oauth2.0/authorize?${params.toString()}`;
  }

  async getUserProfile(code: string): Promise<OAuthUserProfile> {
    const appId = this.getAppId();
    const appKey = this.getAppKey();
    const redirectUri = this.getRedirectUri();

    // 1. 获取 access_token
    const tokenUrl = new URL('https://graph.qq.com/oauth2.0/token');
    tokenUrl.searchParams.set('grant_type', 'authorization_code');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appKey);
    tokenUrl.searchParams.set('code', code);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('fmt', 'json');

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: number;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      this.logger.error('QQ 获取 access_token 失败:', tokenData);
      throw new BadRequestException(
        tokenData.error_description || 'QQ 授权失败，无法获取 access_token',
      );
    }

    const accessToken = tokenData.access_token;

    // 2. 获取 openid
    const meUrl = new URL('https://graph.qq.com/oauth2.0/me');
    meUrl.searchParams.set('access_token', accessToken);
    meUrl.searchParams.set('fmt', 'json');

    const meRes = await fetch(meUrl.toString());
    const meData = (await meRes.json()) as {
      openid?: string;
      unionid?: string;
      error?: number;
      error_description?: string;
    };

    if (!meData.openid) {
      this.logger.error('QQ 获取 openid 失败:', meData);
      throw new BadRequestException(
        meData.error_description || 'QQ 授权失败，无法获取用户唯一标识 openid',
      );
    }

    const openid = meData.openid;
    const unionid = meData.unionid || null;

    // 3. 获取用户基本信息
    const userUrl = new URL('https://graph.qq.com/user/get_user_info');
    userUrl.searchParams.set('access_token', accessToken);
    userUrl.searchParams.set('oauth_consumer_key', appId);
    userUrl.searchParams.set('openid', openid);

    const userRes = await fetch(userUrl.toString());
    const userInfo = (await userRes.json()) as {
      ret?: number;
      msg?: string;
      nickname?: string;
      figureurl_qq_2?: string;
      figureurl_qq_1?: string;
      figureurl_2?: string;
    };

    const nickname = userInfo.nickname || `QQ用户_${openid.slice(0, 6)}`;
    const avatarUrl =
      userInfo.figureurl_qq_2 ||
      userInfo.figureurl_qq_1 ||
      userInfo.figureurl_2 ||
      null;

    return {
      platform: OAuthPlatform.QQ,
      openid,
      unionid,
      nickname,
      avatarUrl,
      rawData: { ...tokenData, ...meData, ...userInfo },
    };
  }
}
