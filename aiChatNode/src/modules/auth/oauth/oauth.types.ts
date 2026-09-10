import { IsNotEmpty, IsString } from 'class-validator';

export enum OAuthPlatform {
  QQ = 'qq',
  WECHAT = 'wechat',
}

export interface OAuthUserProfile {
  platform: string;
  openid: string;
  unionid?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  rawData?: Record<string, any>;
}

export interface IOAuthProvider {
  readonly platform: string;
  getAuthorizeUrl(state: string): Promise<string>;
  getUserProfile(code: string): Promise<OAuthUserProfile>;
}

export interface OAuthAuthorizeUrlResponse {
  platform: string;
  url: string;
  state: string;
  isMock: boolean;
}

export class OAuthCallbackDto {
  @IsNotEmpty({ message: '平台标识不能为空' })
  @IsString({ message: '平台标识必须为字符串' })
  platform: string;

  @IsNotEmpty({ message: '授权码 code 不能为空' })
  @IsString({ message: '授权码 code 必须为字符串' })
  code: string;

  @IsNotEmpty({ message: '安全 state 标识不能为空' })
  @IsString({ message: '安全 state 标识必须为字符串' })
  state: string;
}
