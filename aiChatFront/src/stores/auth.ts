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
}

/**
 * localStorage 键名常量
 */
const STORAGE_KEYS = {
  TOKEN: 'token',
  USER_ID: 'userId',
  USERNAME: 'username',
  IS_AUTHENTICATED: 'isAuthenticated',
  REMEMBERED_USERNAME: 'rememberedUsername'
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

  return {
    // State
    token,
    userId,
    username,
    rememberedUsername,

    // Getters
    isAuthenticated,
    userInfo,

    // Actions
    initFromStorage,
    setAuthData,
    setRememberedUsername,
    clearAuth,
    getToken,
    getUserId
  }
})
