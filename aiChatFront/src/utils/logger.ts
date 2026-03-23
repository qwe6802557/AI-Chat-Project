/**
 * 轻量日志工具
 * 默认仅在开发环境输出
 */
const isDebugEnabled = import.meta.env.DEV && import.meta.env.MODE !== 'test'

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDebugEnabled) {
      console.debug(...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (isDebugEnabled) {
      console.warn(...args)
    }
  },
  error: (...args: unknown[]) => {
    if (isDebugEnabled) {
      console.error(...args)
    }
  },
}

export default logger
