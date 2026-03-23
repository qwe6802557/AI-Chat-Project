/**
 * 轻量日志工具
 * 默认仅在开发环境输出，避免生产环境控制台噪音
 */
const isDev = import.meta.env.DEV

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args)
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args)
    }
  },
}

export default logger
