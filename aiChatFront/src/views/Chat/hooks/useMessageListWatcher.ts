import { watch, type Ref } from 'vue'
import type { Message } from './useConversationManager'

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
 * @description 监听消息列表和加载状态变化，自动协调滚动行为
 */
export function useMessageListWatcher(
  messages: Ref<Message[]>,
  loading: Ref<boolean>,
  scrollManager: ScrollManager
) {
  const { isUserScrolling, scrollToBottom, handleStreamingScroll, resetUserScrolling } = scrollManager

  /**
   * 监听消息变化自动滚动
   * 使用 flush: 'post' 确保在 DOM 更新后执行（重要：v-if 切换时需要等待 DOM 渲染完成）
   */
  watch(
    messages,
    (newMessages, oldMessages) => {
      const oldLen = oldMessages?.length || 0
      const newLen = newMessages.length

      // 检测三种需要滚动到底部的情况：
      // 1. 初次加载：从空数组变为有消息（页面刷新后首次加载）
      // 2. 会话切换（从有到空）：切换到未加载消息的新会话
      // 3. 会话切换（有到有）：消息列表首条 ID 变化
      const oldFirstId = oldMessages?.[0]?.id
      const newFirstId = newMessages[0]?.id
      const oldLastId = oldMessages?.[oldLen - 1]?.id
      const newLastId = newMessages[newLen - 1]?.id

      const isInitialLoad = oldLen === 0 && newLen > 0
      const isSwitchToEmpty = oldLen > 0 && newLen === 0
      const isSwitchToLoaded = oldLen > 0 && newLen > 0 && oldFirstId !== newFirstId && oldLastId !== newLastId

      // 初次加载或会话切换：重置滚动状态并滚动到底部
      if (isInitialLoad || isSwitchToLoaded) {
        resetUserScrolling?.()
        scrollToBottom(false) // 不平滑，直接跳转到底部
        return
      }

      // 切换到空会话：只重置滚动状态，等待消息加载后再滚动
      if (isSwitchToEmpty) {
        resetUserScrolling?.()
        return
      }

      // 检测是否是向前插入历史消息（第一条消息ID变化，但最后一条消息ID不变）
      const isLoadingHistory = oldLen > 0 && newLen > oldLen && oldFirstId !== newFirstId && oldLastId === newLastId

      if (isLoadingHistory) {
        // 加载历史消息时，不做任何滚动操作，保持当前位置
        // useInfiniteScroll 会负责恢复滚动位置
        return
      }

      // 只有在不是用户手动滚动时才自动滚动
      if (!isUserScrolling.value) {
        // 新增消息时滚动（向后追加消息）
        if (newLen > oldLen) {
          scrollToBottom(true)
        }
        // 消息内容更新（流式输出）
        else if (newLen === oldLen && newLen > 0) {
          handleStreamingScroll()
        }
      }
    },
    { deep: true, flush: 'post' }
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
