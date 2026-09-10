import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IOAuthProvider, OAuthPlatform, OAuthUserProfile } from '../oauth.types';

/**
 * 本地开发与纯 IP 环境 Mock 沙盒授权提供者
 * 支持在没有正式备案域名和 QQ 密钥时，一键完成前后端完整闭环联调
 */
@Injectable()
export class MockOAuthProvider implements IOAuthProvider {
  readonly platform = OAuthPlatform.QQ;

  constructor(private readonly configService: ConfigService) {}

  async getAuthorizeUrl(state: string): Promise<string> {
    const frontendBaseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return `${frontendBaseUrl}/oauth/mock-auth?platform=qq&state=${state}`;
  }

  async getUserProfile(code: string): Promise<OAuthUserProfile> {
    const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'testuser';
    const openid = `mock_qq_${cleanCode.toLowerCase()}`;

    return {
      platform: OAuthPlatform.QQ,
      openid,
      unionid: null,
      nickname: `QQ体验用户_${cleanCode.slice(0, 4)}`,
      avatarUrl:
        'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
      rawData: {
        isMock: true,
        code,
        mockTimestamp: Date.now(),
      },
    };
  }
}
