import { ref, computed, nextTick, onMounted, onBeforeUnmount, type Ref } from 'vue'

/**
 * 滚动管理 Hook
 *
 * @description 管理滚动行为：自动滚动、滚动检测、回到底部按钮等
 */
export function useScrollManager(containerRef: Ref<HTMLElement | null>) {
  const isUserScrolling = ref(false) // 是否手动滚动
  const isProgrammaticScroll = ref(false) // 是否为程序化滚动（非手动）
  const scrollTimeout = ref<number | null>(null)
  const distanceFromBottom = ref(0) // 距离底部的距离
  const rafId = ref<number | null>(null) // requestAnimationFrameID

  // 是否显示按钮
  const showScrollButton = computed(() => distanceFromBottom.value > 200)

  /**
   * 检查是否在底部附近-阈值100px
   */
  const isNearBottom = (): boolean => {
    if (!containerRef.value) return true

    const { scrollTop, scrollHeight, clientHeight } = containerRef.value
    const distance = scrollHeight - scrollTop - clientHeight

    // 更新距离
    distanceFromBottom.value = distance

    return distance < 100
  }

  /**
   * 滚动到底部
   * @param smooth 是否平滑滚动。false时使用"隐藏-滚动-显示"策略隐藏滚动过程-为了优化用户体验
   */
  const scrollToBottom = (smooth = true) => {
    if (!containerRef.value) return

    // 标记为程序化滚动
    isProgrammaticScroll.value = true

    if (smooth) {
      // 平滑滚动-动画效果
      nextTick(() => {
        if (!containerRef.value) return
        containerRef.value.scrollTo({
          top: containerRef.value.scrollHeight,
          behavior: 'smooth'
        })
        setTimeout(() => {
          isProgrammaticScroll.value = false
        }, 500)
      })
    } else {
      // 即时滚动：使用"隐藏-滚动-显示"策略-直接看到在底部
      const container = containerRef.value
      // 隐藏容器
      container.style.visibility = 'hidden'
      // 禁用CSS平滑滚动（踩坑：CSS的scroll-behavior: smooth会覆盖JS设置）
      container.style.scrollBehavior = 'auto'

      // DOM更新后设置滚动位置
      nextTick(() => {
        if (!containerRef.value) return

        // 设置滚动位置到底部
        containerRef.value.scrollTop = containerRef.value.scrollHeight

        // 使用RAF确保滚动完成后再显示
        requestAnimationFrame(() => {
          if (containerRef.value) {
            containerRef.value.style.visibility = 'visible'
            // 恢复平滑滚动
            containerRef.value.style.scrollBehavior = 'smooth'
          }
          isProgrammaticScroll.value = false
        })
      })
    }
  }

  /**
   * 监听滚动事件-判断是否手动滚动
   */
  const handleScroll = () => {
    if (!containerRef.value) return

    // 程序化滚动则忽略
    if (isProgrammaticScroll.value) {
      return
    }

    // 清除定时器
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
    }

    // 是否在底部
    const atBottom = isNearBottom()

    // 不在底部-则为查看历史消息
    isUserScrolling.value = !atBottom

    // 重置标记
    scrollTimeout.value = window.setTimeout(() => {
      if (isNearBottom()) {
        isUserScrolling.value = false
      }
    }, 500)
  }

  /**
   * 处理流式输出时的滚动
   */
  const handleStreamingScroll = () => {
    // 取消RAF
    if (rafId.value !== null) {
      cancelAnimationFrame(rafId.value)
    }

    // 等待DOM更新完成后再滚动
    nextTick(() => {
      rafId.value = requestAnimationFrame(() => {
        if (!containerRef.value) {
          return
        }

        // 标记为程序化滚动
        isProgrammaticScroll.value = true

        // 直接滚动到底
        containerRef.value.scrollTop = containerRef.value.scrollHeight

        // 重置标记
        setTimeout(() => {
          isProgrammaticScroll.value = false
        }, 100)
      })
    })
  }

  /**
   * 初始化-挂载监听器
   */
  const initialize = () => {
    nextTick(() => {
      if (containerRef.value) {
        // 添加滚动监听
        containerRef.value.addEventListener('scroll', handleScroll)

        // 初始滚动到底部
        setTimeout(() => {
          scrollToBottom(false)
        }, 100)
      }
    })
  }

  /**
   * 清理-卸载监听器
   */
  const cleanup = () => {
    // 移除滚动监听
    if (containerRef.value) {
      containerRef.value.removeEventListener('scroll', handleScroll)
    }

    // 清理定时器
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
    }

    // 取消RAF
    if (rafId.value !== null) {
      cancelAnimationFrame(rafId.value)
      rafId.value = null
    }
  }

  /**
   * 重置用户滚动状态（发送消息后）
   */
  const resetUserScrolling = () => {
    isUserScrolling.value = false
  }

  // 挂载时初始化
  onMounted(() => {
    initialize()
  })

  // 卸载前清理
  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    // 状态
    isUserScrolling,
    showScrollButton,
    distanceFromBottom,

    // 方法
    scrollToBottom,
    handleStreamingScroll,
    isNearBottom,
    resetUserScrolling,
    initialize,
    cleanup
  }
}
