<template>
  <div class="chat-container">
    <Sidebar
      :conversations="conversations"
      :currentConversationId="currentConversationId"
      :isClearing="isClearing"
      @new-chat="handleNewChat"
      @select-conversation="handleSelectConversation"
      @clear-conversations="handleClearConversations"
      @rename-conversation="handleRenameConversation"
      @delete-conversation="handleDeleteConversation"
    />
    <ChatArea
      :messages="currentMessages"
      :loading="loading"
      :current-session-id="currentConversationId"
      :has-more-messages="hasMoreMessages"
      :load-more-messages="handleLoadMoreMessages"
      @send-message="handleSendMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import Sidebar from './components/Sidebar.vue'
import ChatArea from './components/ChatArea.vue'
import { useConversationManager } from './hooks/useConversationManager'
import { useStreamChat } from './hooks/useStreamChat'

// 定义组件名称
defineOptions({
  name: 'ChatPage'
})

// 对话管理
const {
  conversations,
  currentConversationId,
  currentMessages,
  createConversation,
  selectConversation,
  clearAllConversations,
  deleteConversation,
  updateConversationTitle,
  addMessage,
  updateMessageContent,
  deleteMessageByIndex,
  updateSessionId,
  saveConversations,
  ensureServerSession,
  initializeFromServer,
  loadMessagesForSession
} = useConversationManager()

// 流式聊天
const { loading, sendMessage } = useStreamChat(
  {
    addMessage,
    updateMessageContent,
    deleteMessageByIndex,
    updateSessionId,
    saveConversations,
    ensureServerSession
  },
  () => currentMessages.value
)

// 获取当前用户 ID
const getUserId = (): string => {
  const userId = localStorage.getItem('userId')

  if (!userId || userId === 'null' || userId === 'undefined') {
    return ''
  }
  return userId
}

// 分页状态
const hasMoreMessages = ref(true)

// 新建对话
const handleNewChat = () => {
  createConversation()
}

// 选择对话
const handleSelectConversation = async (id: string) => {
  const paginationInfo = await selectConversation(id)

  // 更新分页状态
  if (paginationInfo) {
    hasMoreMessages.value = paginationInfo.hasMore
  } else {
    // 没有返回分页信息-默认为true
    hasMoreMessages.value = true
  }
}

// 清空状态
const isClearing = ref(false)

// 清空所有对话
const handleClearConversations = async () => {
  const userId = getUserId()

  // 开始清空-显示加载状态
  isClearing.value = true

  try {
    const result = await clearAllConversations(userId)

    if (result) {
      // 清空成功-自动创建新对话
      createConversation()
      message.success(`已清空 ${result.deletedCount} 个对话`)
    } else {
      // 清空失败
      message.error('清空对话失败，请稍后重试')
    }
  } catch (error) {
    console.error('清空对话出错:', error)
    message.error('清空对话失败，请稍后重试')
  } finally {
    isClearing.value = false
  }
}

// 重命名对话
const handleRenameConversation = async (id: string, title: string, callback: (success: boolean) => void) => {
  const success = await updateConversationTitle(id, title)
  callback(success)
}

// 删除对话
const handleDeleteConversation = async (id: string) => {
  await deleteConversation(id)
}

// 发送消息
const handleSendMessage = async (
  content: string,
  options?: {
    fileIds?: string[]
    serverFiles?: { id: string; url: string; name: string; type: string }[]
    files?: { base64: string; type: string; name: string }[]
  }
) => {
  const userId = getUserId()
  if (!userId) {
    message.warning('未获取到用户信息，请重新登录')
    return
  }

  // 若没有当前对话-创建一个本地临时对话
  if (!currentConversationId.value) {
    createConversation()
  }

  // 流式聊天
  await sendMessage(userId, content, options)
}

// 加载更多消息
const handleLoadMoreMessages = async (sessionId: string, page: number) => {
  // 调用 loadMessagesForSession 加载历史消息
  const paginationInfo = await loadMessagesForSession(sessionId, page, 5, 'asc')

  // 更新是否还有更多消息的状态
  hasMoreMessages.value = paginationInfo.hasMore
}

onMounted(async () => {
  // 从后端加载会话列表
  const userId = getUserId()
  if (userId) {
    const paginationInfo = await initializeFromServer(userId)

    // 初始化 hasMoreMessages 状态
    if (paginationInfo) {
      hasMoreMessages.value = paginationInfo.hasMore
    }
  } else {
    message.warning('未获取到用户信息，请重新登录')
  }
})
</script>

<style scoped lang="scss">
.chat-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  background: #FFFFFF;
  overflow: hidden;
}
</style>

