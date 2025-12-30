/**
 * 认证状态管理 Store
 *
 * 统一管理用户认证相关的状态：token、用户信息、登录状态等
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

/**
 * 用户信息接口
 */
export interface UserInfo {
  id: string
  username: string
  phone?: string
  email?: string
  avatar?: string
  role?: 'admin' | 'user'
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * 用户积分信息
 */
export interface UserCredits {
  total: number
  consumed: number
  remaining: number
}

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

  /** 模拟积分数据 */
  const userCredits = ref<UserCredits>({
    total: 10000,
    consumed: 3500,
    remaining: 6500
  })

  // Getters

  /** 是否已认证 */
  const isAuthenticated = computed(() => !!token.value && !!userId.value)

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

    // 加载用户资料
    const storedProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE)
    if (storedProfile) {
      try {
        userProfile.value = JSON.parse(storedProfile)
      } catch (e) {
        console.error('解析用户资料失败:', e)
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

    // 清除 localStorage（保留 rememberedUsername）
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER_ID)
    localStorage.removeItem(STORAGE_KEYS.USERNAME)
    localStorage.removeItem(STORAGE_KEYS.IS_AUTHENTICATED)
  }

  /**
   * 获取 token
   */
  const getToken = () => token.value

  /**
   * 获取用户 ID
   */
  const getUserId = () => userId.value || ''

  /**
   * 设置完整用户资料（登录时调用）
   */
  const setUserProfile = (profile: UserInfo) => {
    userProfile.value = profile
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile))
  }

  /**
   * 更新用户头像
   */
  const setUserAvatar = (avatarUrl: string) => {
    userAvatar.value = avatarUrl
    if (userProfile.value) {
      userProfile.value.avatar = avatarUrl
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
   * 获取模拟的完整用户信息
   * 用于纯前端开发阶段
   */
  const getMockUserAccount = () => {
    return {
      id: userId.value || 'mock-user-id',
      username: username.value || '测试用户',
      phone: userProfile.value?.phone || '138****8888',
      email: userProfile.value?.email || 'user@example.com',
      avatar: userAvatar.value || null,
      role: (userProfile.value?.role || 'user') as 'admin' | 'user',
      isActive: true,
      createdAt: userProfile.value?.createdAt || '2024-01-15T08:30:00Z',
      updatedAt: new Date().toISOString(),
      credits: userCredits.value
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
    userCredits,

    // Getters
    isAuthenticated,
    userInfo,

    // Actions
    initFromStorage,
    setAuthData,
    setRememberedUsername,
    clearAuth,
    getToken,
    getUserId,
    setUserProfile,
    setUserAvatar,
    updatePhone,
    getMockUserAccount
  }
})
