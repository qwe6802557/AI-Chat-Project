<template>
  <div class="chat-container">
    <!-- 侧边栏 -->
    <Sidebar />
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
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import Sidebar from './components/Sidebar.vue'
import ChatArea from './components/ChatArea.vue'
import { useStreamChat } from './hooks/useStreamChat'
import { useAuthStore, useConversationStore } from '@/stores'

// 定义组件名称
defineOptions({
  name: 'ChatPage'
})

// 认证状态
const authStore = useAuthStore()

// 对话管理
const conversationStore = useConversationStore()
const {
  currentConversationId,
  currentMessages
} = storeToRefs(conversationStore)

// 流式聊天
const { loading, sendMessage } = useStreamChat()

// 获取当前用户ID
const getUserId = (): string => {
  return authStore.getUserId()
}

// 分页状态
const hasMoreMessages = ref(true)

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
    conversationStore.createConversation()
  }

  // 流式聊天
  await sendMessage(userId, content, options)
}

// 加载更多消息
const handleLoadMoreMessages = async (sessionId: string, page: number) => {
  // desc倒序：page 获取的更早的消息-历史消息
  const paginationInfo = await conversationStore.loadMessagesForSession(sessionId, page, 5, 'desc')

  // 更新是否还有更多消息的状态
  hasMoreMessages.value = paginationInfo.hasMore
}

onMounted(async () => {
  // 加载会话列表
  const userId = getUserId()
  if (userId) {
    const paginationInfo = await conversationStore.initializeFromServer(userId)

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
