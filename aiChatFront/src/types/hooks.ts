import type { Ref } from 'vue'

export interface UseLocalStorageOptions<T> {
  serialize?: (value: T) => unknown
  deserialize?: (raw: unknown) => T
}

export interface UseInfiniteScrollOptions {
  threshold?: number
  throttleDelay?: number
  disabled?: Ref<boolean>
  onLoadMore: () => Promise<void>
  hasMore?: Ref<boolean>
}

export interface UseAvatarUploadOptions {
  maxSize?: number
  quality?: number
  outputSize?: number
}
