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
export function useScrollManager(
  containerRef: Ref<HTMLElement | null>,
  contentRef?: Ref<HTMLElement | null>
) {
  const distanceFromBottom = ref(0)
  const shouldAutoFollow = ref(true)
  const isAutoScrolling = ref(false)
  const trackingRafId = ref<number | null>(null)
  let settlingRafId: number | null = null
  let settlingDeadline = 0
  let activeElement: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null

  const isUserScrolling = computed(() => !shouldAutoFollow.value)
  const showScrollButton = computed(() => distanceFromBottom.value > 200)

  const stopTrackingAutoScroll = () => {
    if (trackingRafId.value !== null) {
      cancelAnimationFrame(trackingRafId.value)
      trackingRafId.value = null
    }
    if (settlingRafId !== null) {
      cancelAnimationFrame(settlingRafId)
      settlingRafId = null
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

  /**
   * 强制置底并在异步排版（如 Markdown 表格、公式、图片）展开期间多帧持续吸底
   */
  const forceScrollToBottom = (settleDurationMs = 350) => {
    const container = containerRef.value
    stopTrackingAutoScroll()
    shouldAutoFollow.value = true
    isAutoScrolling.value = true

    if (container) {
      container.scrollTop = container.scrollHeight
    }

    settlingDeadline = Date.now() + settleDurationMs
    let stableFrames = 0
    let lastHeight = container?.scrollHeight ?? 0

    const trackSettling = () => {
      const currentContainer = containerRef.value
      if (!currentContainer) {
        finishAutoScroll()
        return
      }

      const currentHeight = currentContainer.scrollHeight
      if (
        currentHeight !== lastHeight ||
        currentContainer.scrollTop < currentHeight - currentContainer.clientHeight
      ) {
        currentContainer.scrollTop = currentHeight
        lastHeight = currentHeight
        stableFrames = 0
      } else {
        stableFrames += 1
      }

      if (
        (stableFrames >= 5 && Date.now() > settlingDeadline - 150) ||
        Date.now() >= settlingDeadline
      ) {
        currentContainer.scrollTop = currentContainer.scrollHeight
        finishAutoScroll()
        return
      }

      settlingRafId = requestAnimationFrame(trackSettling)
    }

    settlingRafId = requestAnimationFrame(trackSettling)
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

  const setupResizeObserver = (el: HTMLElement | null) => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }

    if (!el || typeof ResizeObserver === 'undefined') return

    resizeObserver = new ResizeObserver(() => {
      if (shouldAutoFollow.value && !isUserScrolling.value) {
        const container = containerRef.value
        if (container) {
          container.scrollTop = container.scrollHeight
          syncMetrics()
        }
      }
    })

    resizeObserver.observe(el)
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
        if (resizeObserver) {
          resizeObserver.disconnect()
          resizeObserver = null
        }
        isAutoScrolling.value = false
        shouldAutoFollow.value = true
        distanceFromBottom.value = 0
        return
      }

      nextElement.addEventListener('scroll', handleScroll, { passive: true })
      if (!contentRef) {
        setupResizeObserver(nextElement)
      }

      requestAnimationFrame(() => {
        syncMetrics()
        shouldAutoFollow.value = distanceFromBottom.value < NEAR_BOTTOM_THRESHOLD_PX
      })
    },
    { immediate: true }
  )

  if (contentRef) {
    watch(
      contentRef,
      (newContentEl) => {
        setupResizeObserver(newContentEl)
      },
      { immediate: true }
    )
  }

  onBeforeUnmount(() => {
    stopTrackingAutoScroll()
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (activeElement) {
      activeElement.removeEventListener('scroll', handleScroll)
    }
  })

  return {
    isUserScrolling,
    showScrollButton,
    distanceFromBottom,
    scrollToBottom,
    forceScrollToBottom,
    handleStreamingScroll,
    isNearBottom,
    resetUserScrolling,
  }
}
