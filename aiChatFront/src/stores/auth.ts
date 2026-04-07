/**
 * 认证状态管理 Store
 *
 * 统一管理用户认证相关的状态：token、用户信息、登录状态等
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { UserInfo, UserCredits } from '@/types/user'
import logger from '@/utils/logger'

/**
 * localStorage 键名常量
 */
const STORAGE_KEYS = {
  TOKEN: 'token',
  USER_ID: 'userId',
  USERNAME: 'username',
  IS_AUTHENTICATED: 'isAuthenticated',
  REMEMBERED_USERNAME: 'rememberedUsername',
  USER_PROFILE: 'userProfile',
  USER_AVATAR: 'userAvatar'
} as const

const EMPTY_USER_CREDITS: UserCredits = {
  total: 0,
  consumed: 0,
  remaining: 0,
  reserved: 0,
}

const normalizeCredits = (
  credits?: Partial<UserCredits> | null,
): UserCredits => {
  return {
    total: Number(credits?.total ?? 0),
    consumed: Number(credits?.consumed ?? 0),
    remaining: Number(credits?.remaining ?? 0),
    reserved: Number(credits?.reserved ?? 0),
  }
}

const normalizeUserProfile = (profile: UserInfo): UserInfo => {
  return {
    ...profile,
    credits: normalizeCredits(profile.credits),
  }
}

interface JwtPayload {
  exp?: number
}

const decodeBase64Url = (value: string): string | null => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(
      normalized.length + ((4 - normalized.length % 4) % 4),
      '=',
    )
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

const parseJwtPayload = (rawToken?: string | null): JwtPayload | null => {
  if (!rawToken) return null

  const segments = rawToken.split('.')
  if (segments.length < 2) {
    return null
  }

  const payloadJson = decodeBase64Url(segments[1] || '')
  if (!payloadJson) {
    return null
  }

  try {
    return JSON.parse(payloadJson) as JwtPayload
  } catch {
    return null
  }
}

const isJwtExpired = (rawToken?: string | null): boolean => {
  const payload = parseJwtPayload(rawToken)
  if (!payload || typeof payload.exp !== 'number') {
    return true
  }

  return payload.exp * 1000 <= Date.now()
}

/**
 * 认证 Store
 */
export const useAuthStore = defineStore('auth', () => {
  // State

  /** 认证令牌 */
  const token = ref<string | null>(null)

  /** 用户 ID */
  const userId = ref<string | null>(null)

  /** 用户名 */
  const username = ref<string | null>(null)

  /** 记住的用户名（用于登录页自动填充） */
  const rememberedUsername = ref<string | null>(null)

  /** 用户完整资料 */
  const userProfile = ref<UserInfo | null>(null)

  /** 用户头像 URL */
  const userAvatar = ref<string | null>(null)

  // Getters

  /** 是否已认证 */
  const isAuthenticated = computed(() => {
    return !!token.value && !!userId.value && !isJwtExpired(token.value)
  })

  /** 用户信息 */
  const userInfo = computed<UserInfo | null>(() => {
    if (!userId.value || !username.value) return null
    return {
      id: userId.value,
      username: username.value
    }
  })

  // Actions

  /**
   * 从 localStorage 初始化状态
   * 应用启动时调用
   */
  const initFromStorage = () => {
    token.value = localStorage.getItem(STORAGE_KEYS.TOKEN)
    userId.value = localStorage.getItem(STORAGE_KEYS.USER_ID)
    username.value = localStorage.getItem(STORAGE_KEYS.USERNAME)
    rememberedUsername.value = localStorage.getItem(STORAGE_KEYS.REMEMBERED_USERNAME)

    if (token.value && isJwtExpired(token.value)) {
      logger.warn('检测到本地登录态已过期，自动清理认证信息')
      clearAuth()
      return
    }

    // 加载用户资料
    const storedProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE)
    if (storedProfile) {
      try {
        userProfile.value = normalizeUserProfile(JSON.parse(storedProfile) as UserInfo)
      } catch (e) {
        logger.warn('解析用户资料失败:', e)
      }
    }

    // 加载头像
    userAvatar.value = localStorage.getItem(STORAGE_KEYS.USER_AVATAR)
  }

  /**
   * 设置认证数据
   */
  const setAuthData = (data: {
    token: string
    userId: string
    username: string
  }) => {
    // 更新状态
    token.value = data.token
    userId.value = data.userId
    username.value = data.username

    // 持久化到localStorage
    localStorage.setItem(STORAGE_KEYS.TOKEN, data.token)
    localStorage.setItem(STORAGE_KEYS.USER_ID, data.userId)
    localStorage.setItem(STORAGE_KEYS.USERNAME, data.username)
    localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, 'true')
  }

  /**
   * 设置记住的用户名
   */
  const setRememberedUsername = (name: string | null) => {
    rememberedUsername.value = name
    if (name) {
      localStorage.setItem(STORAGE_KEYS.REMEMBERED_USERNAME, name)
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USERNAME)
    }
  }

  /**
   * 清除认证数据
   */
  const clearAuth = () => {
    // 清除状态
    token.value = null
    userId.value = null
    username.value = null
    userProfile.value = null
    userAvatar.value = null

    // 清除 localStorage-保留 rememberedUsername
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER_ID)
    localStorage.removeItem(STORAGE_KEYS.USERNAME)
    localStorage.removeItem(STORAGE_KEYS.IS_AUTHENTICATED)
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE)
    localStorage.removeItem(STORAGE_KEYS.USER_AVATAR)
  }

  /**
   * 检查并清理已过期的会话
   */
  const purgeExpiredSession = (): boolean => {
    if (!token.value) {
      return false
    }

    if (!isJwtExpired(token.value)) {
      return false
    }

    logger.warn('检测到运行中会话已过期，自动清理认证信息')
    clearAuth()
    return true
  }

  /**
   * 获取 token
   */
  const getToken = () => {
    if (purgeExpiredSession()) {
      return null
    }

    return token.value
  }

  /**
   * 获取用户 ID
   */
  const getUserId = () => userId.value || ''

  /**
   * 设置完整用户资料
   */
  const setUserProfile = (profile: UserInfo) => {
    const normalizedProfile = normalizeUserProfile(profile)
    userProfile.value = normalizedProfile
    userAvatar.value = normalizedProfile.avatar || null
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(normalizedProfile))
    if (normalizedProfile.avatar) {
      localStorage.setItem(STORAGE_KEYS.USER_AVATAR, normalizedProfile.avatar)
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_AVATAR)
    }
  }

  /**
   * 更新用户积分
   */
  const setUserCredits = (credits: UserCredits) => {
    const normalizedCredits = normalizeCredits(credits)

    if (userProfile.value) {
      userProfile.value = {
        ...userProfile.value,
        credits: normalizedCredits,
      }
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userProfile.value))
    }
  }

  /**
   * 统一设置认证会话
   */
  const setAuthSession = (data: {
    token: string
    user: UserInfo
  }) => {
    setAuthData({
      token: data.token,
      userId: data.user.id,
      username: data.user.username,
    })
    setUserProfile(data.user)
  }

  /**
   * 更新用户头像
   */
  const setUserAvatar = (avatarUrl: string) => {
    userAvatar.value = avatarUrl
    if (userProfile.value) {
      userProfile.value.avatar = avatarUrl
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userProfile.value))
    }
    localStorage.setItem(STORAGE_KEYS.USER_AVATAR, avatarUrl)
  }

  /**
   * 更新手机号
   */
  const updatePhone = (phone: string) => {
    if (userProfile.value) {
      userProfile.value.phone = phone
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userProfile.value))
    }
  }

  /**
   * 获取当前完整用户账户信息
   */
  const getUserAccount = () => {
    return {
      id: userId.value || 'mock-user-id',
      username: username.value || '测试用户',
      phone: userProfile.value?.phone || '138****8888',
      email: userProfile.value?.email || 'user@example.com',
      avatar: userAvatar.value || null,
      role: (userProfile.value?.role || 'user') as 'admin' | 'user',
      isActive: userProfile.value?.isActive ?? true,
      createdAt: userProfile.value?.createdAt || '2024-01-15T08:30:00Z',
      updatedAt: userProfile.value?.updatedAt || new Date().toISOString(),
      credits: normalizeCredits(userProfile.value?.credits || EMPTY_USER_CREDITS),
    }
  }

  return {
    // State
    token,
    userId,
    username,
    rememberedUsername,
    userProfile,
    userAvatar,

    // Getters
    isAuthenticated,
    userInfo,

    // Actions
    initFromStorage,
    setAuthData,
    setAuthSession,
    setRememberedUsername,
    clearAuth,
    purgeExpiredSession,
    getToken,
    getUserId,
    setUserProfile,
    setUserCredits,
    setUserAvatar,
    updatePhone,
    getUserAccount
  }
})
