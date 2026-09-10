/**
 * 公共工具函数
 */
import { useAuthStore } from "@/stores";
import router from "@/router";

/**
 * 格式化手机号-中间四位加星号
 * @param phone 手机号
 * @returns 格式化后的手机号，如 138****8888
 */
export function formatPhone(phone?: string): string {
  if (!phone) return '未设置'
  if (phone.includes('*')) return phone
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}****${phone.slice(7)}`
  }
  return phone
}

/**
 * 格式化日期为中文格式
 * @param dateStr ISO 日期字符串
 * @returns 格式化后的日期，如 2024年1月15日
 */
export function formatDate(dateStr?: string): string {
  if (!dateStr) return '未知'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return dateStr
  }
}

/**
 * 清除用户信息
 */
export function clearUserInfo(): void {
  // 清除认证状态
  const authStore = useAuthStore()
  authStore.clearAuth()

  if (router.currentRoute.value.name !== 'login') {
    void router.replace({ name: 'login' })
  }
}

/**
 * 获取 API 基础路径
 * 若配置了 VITE_API_BASE_URL（如生产环境相对路径 "" 或特定地址），优先使用；未配置时回退到 http://localhost:3000
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (typeof envUrl === 'string') {
    return envUrl
  }
  return 'http://localhost:3000'
}

/**
 * 生成符合 RFC4122 v4 标准的 UUID
 * - 优先使用浏览器原生 crypto.randomUUID()（安全上下文）
 * - 在非安全上下文（如纯 HTTP IP 访问）下，使用 Math.random 回退生成标准 v4 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

