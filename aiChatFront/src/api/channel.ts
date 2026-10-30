import request, { type ResponseData } from '@/utils/request'

export interface ChannelInfo {
  channelType: string
  name: string
  isEnabled: boolean
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  loginStatus?: 'idle' | 'waiting_scan' | 'scanned' | 'logged_in' | 'error'
  qrCodeUrl?: string | null
  boundModelId?: string | null
  systemPrompt?: string | null
  credentialsMasked?: Record<string, string>
  lastError?: string | null
  connectedAt?: string | null
}

/**
 * 获取全量通道状态与配置列表
 */
export function getChannelList() {
  return request.get<never, ResponseData<ChannelInfo[]>>('/channels/list')
}

/**
 * 启用或关闭指定外部通道
 */
export function toggleChannel(channelType: string, enabled: boolean) {
  return request.post<never, ResponseData<ChannelInfo>>('/channels/toggle', { channelType, enabled })
}

/**
 * 更新通道关联的底座模型与角色设定
 */
export function updateChannelSettings(
  channelType: string,
  payload: {
    boundModelId?: string | null
    systemPrompt?: string | null
    credentials?: Record<string, any>
  },
) {
  return request.patch<never, ResponseData<any>>(`/channels/${channelType}/settings`, payload)
}

/**
 * 请求微信官方 iLink Bot 授权登录二维码
 */
export function getWeixinQrCode() {
  return request.get<never, ResponseData<{ qrCodeUrl: string; status: string }>>('/channels/weixin/qrcode')
}
