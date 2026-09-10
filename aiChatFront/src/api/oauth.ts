import service, { type ResponseData } from '@/utils/request'
import type { LoginResponse } from '@/interface/auth'

export interface OAuthAuthorizeUrlData {
  platform: string
  url: string
  state: string
  isMock: boolean
}

export interface OAuthCallbackParams {
  platform: string
  code: string
  state: string
}

/**
 * 获取第三方平台登录授权跳转链接
 */
export const getOAuthAuthorizeUrl = (platform: string) => {
  return service.get<never, ResponseData<OAuthAuthorizeUrlData>>(`/auth/oauth/${platform}/authorize-url`)
}

/**
 * 第三方登录授权回调校验换票
 */
export const handleOAuthCallback = (payload: OAuthCallbackParams) => {
  return service.post<never, ResponseData<LoginResponse>>('/auth/oauth/callback', payload)
}
