import { ref, type Ref } from 'vue'

export interface UseLocalStorageOptions<T> {
  /**
   * 自定义序列化（用于裁剪/脱敏/压缩等）
   */
  serialize?: (value: T) => unknown
  /**
   * 自定义反序列化（用于数据迁移/兼容旧结构等）
   */
  deserialize?: (raw: unknown) => T
}

/**
 * 通用 LocalStorage Hook
 *
 *
 * @param key - localStorage 的键名
 * @param defaultValue - 默认值
 * @returns
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: UseLocalStorageOptions<T> = {}
) {
  // 内部可写的 ref
  const data = ref<T>(defaultValue) as Ref<T>
  let saveTimer: number | null = null

  /**
   * 从 localStorage 加载数据
   */
  const load = (): void => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved) as unknown
        data.value = options.deserialize ? options.deserialize(parsed) : (parsed as T)
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
      const serialized = options.serialize ? options.serialize(data.value) : data.value
      localStorage.setItem(key, JSON.stringify(serialized))
    } catch (error) {
      console.error(`[useLocalStorage] 保存数据失败 (key: ${key}):`, error)
    }
  }

  /**
   * 节流/防抖保存
   */
  const saveDebounced = (delayMs: number = 300): void => {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = window.setTimeout(() => {
      saveTimer = null
      save()
    }, delayMs)
  }

  /**
   * 清除数据并重置为默认值
   */
  const clear = (): void => {
    try {
      localStorage.removeItem(key)
      data.value = defaultValue
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
    } catch (error) {
      console.error(`[useLocalStorage] 清除数据失败 (key: ${key}):`, error)
    }
  }

  // 加载数据
  load()

  // 返回可修改的 data
  return {
    data,
    load,
    save,
    saveDebounced,
    clear
  }
}
