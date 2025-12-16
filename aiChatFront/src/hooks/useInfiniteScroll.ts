import { ref, watch, onBeforeUnmount, type Ref } from 'vue'

/**
 * 节流函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 */
function throttle(fn: () => void, delay: number): () => void {
  let lastTime = 0
  return () => {
    const now = Date.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn()
    }
  }
}

export interface UseInfiniteScrollOptions {
  /**
   * 触发加载的阈值
   * 默认: 100
   */
  threshold?: number

  /**
   * 节流延迟时间
   * 默认: 200
   */
  throttleDelay?: number

  /**
   * 是否禁用无限滚动
   * 默认: false
   */
  disabled?: Ref<boolean>

  /**
   * 加载更多数据的回调函数
   * 返回 Promise，resolve 时表示加载完成
   */
  onLoadMore: () => Promise<void>

  /**
   * 是否还有更多数据
   * 默认: true
   */
  hasMore?: Ref<boolean>
}

/**
 * 向上滚动加载历史消息
 */
export function useInfiniteScroll(
  scrollElement: Ref<HTMLElement | null>,
  options: UseInfiniteScrollOptions
) {
  const {
    threshold = 100,
    throttleDelay = 200,
    disabled = ref(false),
    onLoadMore,
    hasMore = ref(true)
  } = options

  // 加载状态
  const isLoading = ref(false)

  /**
   * 滚动事件处理
   */
  const handleScroll = throttle(() => {
    if (!scrollElement.value || disabled.value || isLoading.value || !hasMore.value) {
      return
    }

    const { scrollTop } = scrollElement.value

    // 检查是否接近顶部
    if (scrollTop <= threshold) {
      // 记录当前滚动位置和内容高度-用于恢复滚动位置
      const oldScrollHeight = scrollElement.value.scrollHeight
      const oldScrollTop = scrollElement.value.scrollTop

      // 开始加载
      isLoading.value = true

      // 异步加载数据
      onLoadMore()
        .then(() => {
          // 恢复滚动位置
          requestAnimationFrame(() => {
            if (scrollElement.value) {
              // 临时禁用平滑滚动
              const originalScrollBehavior = scrollElement.value.style.scrollBehavior
              scrollElement.value.style.scrollBehavior = 'auto'

              const newScrollHeight = scrollElement.value.scrollHeight
              const heightDifference = newScrollHeight - oldScrollHeight
              scrollElement.value.scrollTop = oldScrollTop + heightDifference

              // 恢复原来的滚动行为
              requestAnimationFrame(() => {
                if (scrollElement.value) {
                  scrollElement.value.style.scrollBehavior = originalScrollBehavior
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('加载历史消息失败:', error)
        })
        .finally(() => {
          isLoading.value = false
        })
    }
  }, throttleDelay)

  /**
   * 挂载和卸载监听器
   */
  let cleanupFn: (() => void) | null = null

  // 使用watch监听scrollElement的变化-确保元素存在后再添加监听器
  const stopWatch = watch(
    scrollElement,
    (newElement, oldElement) => {

      // 移除旧元素的监听器
      if (oldElement && cleanupFn) {
        cleanupFn()
        cleanupFn = null
      }

      // 为新元素添加监听器
      if (newElement) {
        newElement.addEventListener('scroll', handleScroll, { passive: true })

        cleanupFn = () => {
          newElement.removeEventListener('scroll', handleScroll)
        }
      }
    },
    { immediate: true } // 立即执行一次
  )

  onBeforeUnmount(() => {
    stopWatch()
    if (cleanupFn) {
      cleanupFn()
      cleanupFn = null
    }
  })

  return {
    isLoading,
    hasMore
  }
}
