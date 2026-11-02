import request, { type ResponseData } from '@/utils/request'

export interface AgentRole {
  id: string
  userId?: string
  name: string
  description?: string | null
  avatar?: string | null
  boundModelId?: string | null
  systemPrompt?: string | null
  knowledgeBaseIds?: string[] | null
  enabledTools?: string[] | null
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateRoleDto {
  name: string
  description?: string | null
  avatar?: string | null
  boundModelId?: string | null
  systemPrompt?: string | null
  knowledgeBaseIds?: string[] | null
  enabledTools?: string[] | null
  isDefault?: boolean
}

export interface ChannelInfo {
  id?: string
  channelType: string
  name: string
  instanceName?: string | null
  roleId?: string | null
  roleName?: string | null
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

export interface ChannelMetrics {
  totalRequests: number
  successRate: number
  avgLatencyMs: number
  errorCount: number
}

// ================= 智能体角色管理 API =================

export function getRoleList() {
  return request.get<never, ResponseData<AgentRole[]>>('/channels/roles')
}

export function createRole(data: CreateRoleDto) {
  return request.post<never, ResponseData<AgentRole>>('/channels/roles', data)
}

export function updateRole(id: string, data: Partial<CreateRoleDto>) {
  return request.put<never, ResponseData<AgentRole>>(`/channels/roles/${id}`, data)
}

export function deleteRole(id: string) {
  return request.delete<never, ResponseData<{ success: boolean; message: string }>>(`/channels/roles/${id}`)
}

// ================= 通道多实例管理 API =================

export function getInstanceList() {
  return request.get<never, ResponseData<ChannelInfo[]>>('/channels/instances')
}

export function createInstance(data: {
  channelType: string
  instanceName?: string
  roleId?: string | null
  credentials?: Record<string, any>
}) {
  return request.post<never, ResponseData<ChannelInfo>>('/channels/instances', data)
}

export function deleteInstance(id: string) {
  return request.delete<never, ResponseData<{ success: boolean; message: string }>>(`/channels/instances/${id}`)
}

export function updateInstanceSettings(
  id: string,
  payload: {
    instanceName?: string
    roleId?: string | null
    boundModelId?: string | null
    systemPrompt?: string | null
    credentials?: Record<string, any>
  },
) {
  return request.patch<never, ResponseData<ChannelInfo>>(`/channels/instances/${id}/settings`, payload)
}

export function toggleInstance(id: string, enabled: boolean) {
  return request.post<never, ResponseData<ChannelInfo>>(`/channels/instances/${id}/toggle`, { enabled })
}

export function getInstanceMetrics(instanceId: string) {
  return request.get<never, ResponseData<ChannelMetrics>>(`/channels/instances/${instanceId}/metrics`)
}

// ================= 会话记忆与审计日志 API =================

export interface ChannelRagSourceItem {
  documentTitle: string
  score: number
  content: string
  chunkIndex: number
}

export interface AgentTrajectoryStep {
  loopIndex: number
  thought?: string
  actionName: string
  actionArgs: Record<string, any>
  observation: string
  durationMs: number
  status: 'success' | 'error'
}

export interface ChannelMessageItem {
  id: string
  userId: string
  instanceId: string
  channelType: string
  fromId: string
  senderName: string | null
  roleId: string | null
  roleName: string | null
  modelId: string | null
  senderType: 'user' | 'assistant' | 'system'
  content: string
  costCredits: number
  ragSources: ChannelRagSourceItem[] | null
  metadata: {
    trajectory?: AgentTrajectoryStep[]
    [key: string]: any
  } | null
  createdAt: string
}

export interface ChannelSessionSummary {
  fromId: string
  senderName: string | null
  totalMessages: number
  totalCredits: number
  lastMessageAt: string
  lastContent: string
  lastSenderType: string
}

export function getInstanceSessions(
  instanceId: string,
  params?: { search?: string; limit?: number },
) {
  return request.get<never, ResponseData<ChannelSessionSummary[]>>(
    `/channels/instances/${instanceId}/sessions`,
    { params },
  )
}

export function getSessionMessages(
  instanceId: string,
  fromId: string,
  params?: { page?: number; limit?: number },
) {
  return request.get<
    never,
    ResponseData<{ list: ChannelMessageItem[]; total: number }>
  >(`/channels/instances/${instanceId}/sessions/${encodeURIComponent(fromId)}/messages`, {
    params,
  })
}

export function clearSessionMemory(instanceId: string, fromId: string) {
  return request.delete<never, ResponseData<{ success: boolean; message: string }>>(
    `/channels/instances/${instanceId}/sessions/${encodeURIComponent(fromId)}/memory`,
  )
}

// ================= 向后兼容 API =================

export function getChannelList() {
  return request.get<never, ResponseData<ChannelInfo[]>>('/channels/list')
}

export function toggleChannel(channelType: string, enabled: boolean) {
  return request.post<never, ResponseData<ChannelInfo>>('/channels/toggle', { channelType, enabled })
}

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

export function getWeixinQrCode(instanceId?: string) {
  const url = instanceId ? `/channels/weixin/qrcode?instanceId=${instanceId}` : '/channels/weixin/qrcode'
  return request.get<never, ResponseData<{ qrCodeUrl: string; status: string }>>(url)
}
