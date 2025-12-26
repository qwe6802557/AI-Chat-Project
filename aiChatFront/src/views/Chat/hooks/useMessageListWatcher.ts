import { watch, type Ref } from 'vue'
import type { Message } from '@/stores'

/**
 * 滚动管理器接口
 */
interface ScrollManager {
  isUserScrolling: Ref<boolean>
  scrollToBottom: (smooth?: boolean) => void
  handleStreamingScroll: () => void
  resetUserScrolling?: () => void
}

/**
 * 消息列表监听 Hook
 *
 * @description 监听消息列表和加载状态变化-自动协调滚动行为
 */
export function useMessageListWatcher(
  messages: Ref<Message[]>,
  loading: Ref<boolean>,
  scrollManager: ScrollManager
) {
  const { isUserScrolling, scrollToBottom, handleStreamingScroll, resetUserScrolling } = scrollManager

  /**
   * 监听长度/首尾ID自动滚动
   * 使用 flush: 'post' 确保在 DOM 更新后执行（v-if 切换时需要等待 DOM 渲染完成）
   */
  watch(
    () => {
      const list = messages.value
      const len = list.length
      const firstId = len > 0 ? list[0]?.id : undefined
      const lastId = len > 0 ? list[len - 1]?.id : undefined
      return { len, firstId, lastId }
    },
    (next, prev) => {
      const oldLen = prev?.len || 0
      const newLen = next.len

      const oldFirstId = prev?.firstId
      const newFirstId = next.firstId
      const oldLastId = prev?.lastId
      const newLastId = next.lastId

      const isInitialLoad = oldLen === 0 && newLen > 0
      const isSwitchToEmpty = oldLen > 0 && newLen === 0
      const isSwitchToLoaded =
        oldLen > 0 &&
        newLen > 0 &&
        oldFirstId !== newFirstId &&
        oldLastId !== newLastId

      // 初次加载或会话切换-重置滚动状态并滚动到底部
      if (isInitialLoad || isSwitchToLoaded) {
        resetUserScrolling?.()
        scrollToBottom(false) // 不平滑，直接跳转到底部
        return
      }

      // 切换到空会话-只重置滚动状态，等待消息加载后再滚动
      if (isSwitchToEmpty) {
        resetUserScrolling?.()
        return
      }

      // 检测是否是向前插入历史消息（第一条消息ID变化，最后一条消息ID不变）
      const isLoadingHistory =
        oldLen > 0 &&
        newLen > oldLen &&
        oldFirstId !== newFirstId &&
        oldLastId === newLastId

      if (isLoadingHistory) {
        // 加载历史消息时-不做任何滚动操作并保持当前位置
        // useInfiniteScroll 恢复滚动位置
        return
      }

      // 只有在不是用户手动滚动时才自动滚动
      if (!isUserScrolling.value) {
        // 新增消息时滚动
        if (newLen > oldLen) {
          scrollToBottom(true)
        }
      }
    },
    { flush: 'post' }
  )

  /**
   * 监听最后一条消息内容变化（流式输出）
   * 避免 deep watch 遍历整个消息数组
   */
  watch(
    () => {
      const list = messages.value
      const last = list[list.length - 1]
      return last ? `${last.id}:${last.content}` : ''
    },
    () => {
      if (!isUserScrolling.value) {
        handleStreamingScroll()
      }
    },
    { flush: 'post' }
  )

  /**
   * 监听 loading 状态变化
   */
  watch(
    loading,
    (newLoading) => {
      // loading 时滚动到底部
      if (newLoading && !isUserScrolling.value) {
        scrollToBottom(true)
      }
    }
  )
}
