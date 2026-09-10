import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IOAuthProvider, OAuthPlatform, OAuthUserProfile } from '../oauth.types';

/**
 * 微信开放平台登录适配器（插槽）
 * 微信官方 PC 扫码要求企业认证资质，个人开发者可通过未来小程序扫码通道中转
 */
@Injectable()
export class WechatOAuthProvider implements IOAuthProvider {
  readonly platform = OAuthPlatform.WECHAT;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const appId = this.configService.get<string>('WECHAT_OAUTH_APP_ID');
    return !!appId && appId !== 'mock_app_id';
  }

  async getAuthorizeUrl(_state: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        '微信开放平台网站应用需企业资质认证，小程序扫码通道正在适配中，敬请期待！',
      );
    }
    // 预留标准微信开放平台扫码地址
    const appId = this.configService.get<string>('WECHAT_OAUTH_APP_ID');
    const redirectUri =
      this.configService.get<string>('WECHAT_OAUTH_REDIRECT_URI') || '';
    return `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=${_state}#wechat_redirect`;
  }

  async getUserProfile(_code: string): Promise<OAuthUserProfile> {
    throw new BadRequestException(
      '微信开放平台网站应用需企业资质认证，小程序扫码通道正在适配中，敬请期待！',
    );
  }
}
