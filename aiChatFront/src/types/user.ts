/**
 * 用户相关类型定义
 */

/**
 * 用户完整信息接口
 * 基于后端 User 实体扩展
 */
export interface UserProfile {
  id: string
  username: string
  phone?: string
  email?: string
  avatar?: string           // 头像 URL
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
export interface UserAccount extends UserProfile {
  credits: UserCredits
}

/**
 * 角色显示名称映射
 */
export const ROLE_DISPLAY_MAP: Record<string, string> = {
  admin: '管理员',
  user: '普通用户'
}
