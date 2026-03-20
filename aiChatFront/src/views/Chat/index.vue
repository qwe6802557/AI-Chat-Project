<template>
  <div class="chat-container">
    <!-- 侧边栏 -->
    <Sidebar />
    <ChatArea
      :messages="currentMessages"
      :loading="loading"
      :selected-model="selectedModel"
      :model-options="modelOptions"
      :models-loading="modelsLoading"
      :current-session-id="currentConversationId"
      :has-more-messages="hasMoreMessages"
      :load-more-messages="handleLoadMoreMessages"
      @update:selected-model="handleModelChange"
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
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { getActiveModels } from '@/api/model'

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

// 模型选择
const { data: selectedModel, save: saveSelectedModel } = useLocalStorage<string>(
  'selectedChatModel',
  'GLM-5'
)
const modelOptions = ref<Array<{ label: string; value: string }>>([
  { label: 'GLM-5', value: 'GLM-5' }
])
const modelsLoading = ref(false)

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
  await sendMessage(userId, content, {
    ...options,
    model: selectedModel.value
  })
}

// 加载更多消息
const handleLoadMoreMessages = async (sessionId: string, page: number) => {
  // desc倒序：page 获取的更早的消息-历史消息
  const paginationInfo = await conversationStore.loadMessagesForSession(sessionId, page, 5, 'desc')

  // 更新是否还有更多消息的状态
  hasMoreMessages.value = paginationInfo.hasMore
}

/**
 * 加载可用模型列表
 */
const loadModelOptions = async () => {
  modelsLoading.value = true
  try {
    const response = await getActiveModels({ includeProvider: true })
    const zaiwenModels = response.data
      .filter((model) => model.provider?.name === 'Zaiwen')
      .sort((a, b) => a.modelId.localeCompare(b.modelId, 'en'))
      .map((model) => ({
        label: model.modelId,
        value: model.modelId
      }))

    if (zaiwenModels.length > 0) {
      modelOptions.value = zaiwenModels
    }

    if (!modelOptions.value.some((model) => model.value === selectedModel.value)) {
      selectedModel.value = modelOptions.value.find((model) => model.value === 'GLM-5')?.value || modelOptions.value[0]?.value || 'GLM-5'
      saveSelectedModel()
    }
  } catch (error) {
    console.error('加载模型列表失败:', error)
    message.warning('模型列表加载失败，已使用默认模型 GLM-5')
    selectedModel.value = 'GLM-5'
    saveSelectedModel()
  } finally {
    modelsLoading.value = false
  }
}

/**
 * 切换模型
 */
const handleModelChange = (modelId: string) => {
  selectedModel.value = modelId
  saveSelectedModel()
}

onMounted(async () => {
  // 加载会话列表
  const userId = getUserId()
  if (userId) {
    const [paginationInfo] = await Promise.all([
      conversationStore.initializeFromServer(userId),
      loadModelOptions()
    ])

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
