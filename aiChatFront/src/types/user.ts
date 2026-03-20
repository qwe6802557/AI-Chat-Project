/**
 * 用户相关类型定义
 */

/**
 * 用户基础信息接口
 */
export interface UserInfo {
  id: string
  username: string
  phone?: string
  email?: string
  avatar?: string           // 头像 URL
  role?: 'admin' | 'user'
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * 用户完整信息接口
 */
export interface UserProfile extends UserInfo {
  role: 'admin' | 'user'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 用户积分信息
 */
export interface UserCredits {
  total: number         // 总积分
  consumed: number      // 已消耗
  remaining: number     // 剩余积分
}

/**
 * 完整用户账户信息
 */
export interface UserAccount extends UserInfo {
  credits: UserCredits
}

/**
 * 角色显示名称映射
 */
export const ROLE_DISPLAY_MAP: Record<string, string> = {
  admin: '管理员',
  user: '普通用户'
}
