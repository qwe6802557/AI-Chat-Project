/**
 * 公共工具函数
 */
import { useAuthStore } from "@/stores";

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

  window.location.href = '/login'
}
