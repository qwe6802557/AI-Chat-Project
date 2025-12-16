import { ref, readonly, type Ref } from 'vue'

/**
 * 通用 LocalStorage Hook
 *
 *
 * @param key - localStorage 的键名
 * @param defaultValue - 默认值
 * @returns
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
  // 内部可写的 ref
  const data = ref<T>(defaultValue) as Ref<T>

  /**
   * 从 localStorage 加载数据
   */
  const load = (): void => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        data.value = JSON.parse(saved) as T
      } else {
        data.value = defaultValue
      }
    } catch (error) {
      console.log(`[useLocalStorage] 加载数据失败 (key: ${key}):`, error)
      data.value = defaultValue
    }
  }

  /**
   * 保存数据
   */
  const save = (): void => {
    try {
      localStorage.setItem(key, JSON.stringify(data.value))
    } catch (error) {
      console.error(`[useLocalStorage] 保存数据失败 (key: ${key}):`, error)
    }
  }

  /**
   * 清除数据并重置为默认值
   */
  const clear = (): void => {
    try {
      localStorage.removeItem(key)
      data.value = defaultValue
    } catch (error) {
      console.error(`[useLocalStorage] 清除数据失败 (key: ${key}):`, error)
    }
  }

  // 加载数据
  load()

  // 返回可修改的 data（不使用 readonly，因为需要修改对象属性）
  return {
    data,
    load,
    save,
    clear
  }
}
