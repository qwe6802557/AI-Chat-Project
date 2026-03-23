import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

const NEAR_BOTTOM_THRESHOLD_PX = 100

/**
 * 滚动管理 Hook
 *
 * @description
 * 用“是否贴底”的状态驱动自动滚动：
 * - 用户离开底部时停止自动跟随
 * - 用户回到底部或显式触发时恢复自动跟随
 * - 去掉 timeout / visibility hack，降低状态抖动
 */
export function useScrollManager(containerRef: Ref<HTMLElement | null>) {
  const distanceFromBottom = ref(0)
  const shouldAutoFollow = ref(true)
  const isAutoScrolling = ref(false)
  const trackingRafId = ref<number | null>(null)
  let activeElement: HTMLElement | null = null

  const isUserScrolling = computed(() => !shouldAutoFollow.value)
  const showScrollButton = computed(() => distanceFromBottom.value > 200)

  const stopTrackingAutoScroll = () => {
    if (trackingRafId.value !== null) {
      cancelAnimationFrame(trackingRafId.value)
      trackingRafId.value = null
    }
  }

  const syncMetrics = (): number => {
    const container = containerRef.value
    if (!container) {
      distanceFromBottom.value = 0
      return 0
    }

    const distance = container.scrollHeight - container.scrollTop - container.clientHeight
    distanceFromBottom.value = Math.max(distance, 0)
    return distanceFromBottom.value
  }

  const isNearBottom = (): boolean => {
    return syncMetrics() < NEAR_BOTTOM_THRESHOLD_PX
  }

  const finishAutoScroll = () => {
    stopTrackingAutoScroll()
    isAutoScrolling.value = false
    shouldAutoFollow.value = true
    syncMetrics()
  }

  const trackAutoScrollToBottom = () => {
    if (!containerRef.value) {
      finishAutoScroll()
      return
    }

    if (isNearBottom()) {
      finishAutoScroll()
      return
    }

    trackingRafId.value = requestAnimationFrame(trackAutoScrollToBottom)
  }

  const performScrollToBottom = (behavior: ScrollBehavior) => {
    const container = containerRef.value
    if (!container) return

    shouldAutoFollow.value = true
    isAutoScrolling.value = behavior === 'smooth'
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    })

    stopTrackingAutoScroll()
    if (behavior === 'smooth') {
      trackingRafId.value = requestAnimationFrame(trackAutoScrollToBottom)
      return
    }

    trackingRafId.value = requestAnimationFrame(() => {
      finishAutoScroll()
    })
  }

  const scrollToBottom = (smooth = true) => {
    nextTick(() => {
      performScrollToBottom(smooth ? 'smooth' : 'auto')
    })
  }

  const handleScroll = () => {
    syncMetrics()

    if (isAutoScrolling.value) {
      if (distanceFromBottom.value < NEAR_BOTTOM_THRESHOLD_PX) {
        finishAutoScroll()
      }
      return
    }

    shouldAutoFollow.value = distanceFromBottom.value < NEAR_BOTTOM_THRESHOLD_PX
  }

  const handleStreamingScroll = () => {
    if (!shouldAutoFollow.value) {
      syncMetrics()
      return
    }

    nextTick(() => {
      performScrollToBottom('auto')
    })
  }

  const resetUserScrolling = () => {
    shouldAutoFollow.value = true
  }

  watch(
    containerRef,
    (nextElement, prevElement) => {
      if (prevElement) {
        prevElement.removeEventListener('scroll', handleScroll)
      }

      activeElement = nextElement

      if (!nextElement) {
        stopTrackingAutoScroll()
        isAutoScrolling.value = false
        shouldAutoFollow.value = true
        distanceFromBottom.value = 0
        return
      }

      nextElement.addEventListener('scroll', handleScroll, { passive: true })
      requestAnimationFrame(() => {
        syncMetrics()
        shouldAutoFollow.value = distanceFromBottom.value < NEAR_BOTTOM_THRESHOLD_PX
      })
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    stopTrackingAutoScroll()
    if (activeElement) {
      activeElement.removeEventListener('scroll', handleScroll)
    }
  })

  return {
    isUserScrolling,
    showScrollButton,
    distanceFromBottom,
    scrollToBottom,
    handleStreamingScroll,
    isNearBottom,
    resetUserScrolling,
  }
}
