<template>
  <div class="chat-container">
    <!-- 侧边栏 -->
    <Sidebar
      :conversations="conversations"
      :current-conversation-id="currentConversationId"
      :is-clearing="isClearing"
      @new-chat="handleNewConversation"
      @select-conversation="handleSelectConversation"
      @rename-conversation="handleRenameConversation"
      @delete-conversation="handleDeleteConversation"
      @clear-conversations="handleClearConversations"
      @logout="handleLogout"
    />
    <ChatArea
      :messages="currentMessages"
      :loading="loading"
      :selected-model="selectedModel"
      :model-options="modelOptions"
      :models-loading="modelsLoading"
      :current-session-id="currentConversationId"
      :has-more-messages="hasMoreMessages"
      :load-more-messages="handleLoadMoreMessages"
      :selected-model-input-price="selectedModelInputPrice"
      :selected-model-output-price="selectedModelOutputPrice"
      :selected-model-reserve-credits="selectedModelReserveCredits"
      :selected-model-reasoning-capability="selectedModelReasoningCapability"
      :selected-model-reasoning-badge-label="selectedModelReasoningBadgeLabel"
      :current-credits-remaining="currentCreditsRemaining"
      :has-credit-snapshot="hasCreditSnapshot"
      @update:selected-model="handleModelChange"
      @send-message="handleSendMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import Sidebar from './components/Sidebar.vue'
import ChatArea from './components/ChatArea.vue'
import logger from '@/utils/logger'
import { useStreamChat } from './hooks/useStreamChat'
import { useAuthStore, useConversationStore } from '@/stores'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { getActiveModels } from '@/api/model'
import { isAuthFailureError } from '@/utils/request'

interface ChatModelOption {
  label: string
  value: string
  inputPrice: number
  outputPrice: number
  reserveCredits: number
  reasoningCapability?: 'none' | 'summary' | 'raw'
  reasoningStrategy?: 'provider_preferred' | 'summary_preferred'
  reasoningBadgeLabel?: string
}

// 定义组件名称
defineOptions({
  name: 'ChatPage'
})

// 认证状态
const router = useRouter()
const authStore = useAuthStore()

// 对话管理
const conversationStore = useConversationStore()
const {
  conversations,
  currentConversationId,
  currentMessages
} = storeToRefs(conversationStore)

// 流式聊天
const { loading, sendMessage, cancelCurrentStream } = useStreamChat()

// 模型选择
const { data: selectedModel, save: saveSelectedModel } = useLocalStorage<string>(
  'selectedChatModel',
  'GLM-5'
)
const modelOptions = ref<ChatModelOption[]>([
  { label: 'GLM-5', value: 'GLM-5', inputPrice: 1.83, outputPrice: 7.32, reserveCredits: 100 }
])
const modelsLoading = ref(false)
const hasCreditSnapshot = computed(() => !!authStore.userProfile?.credits)
const currentCreditsRemaining = computed(() => {
  return Number(authStore.userProfile?.credits?.remaining ?? 0)
})
const selectedModelOption = computed(() => {
  return modelOptions.value.find((model) => model.value === selectedModel.value) || modelOptions.value[0]
})
const selectedModelInputPrice = computed(() => {
  return Number(selectedModelOption.value?.inputPrice ?? 0)
})
const selectedModelOutputPrice = computed(() => {
  return Number(selectedModelOption.value?.outputPrice ?? 0)
})
const selectedModelReserveCredits = computed(() => {
  return Number(selectedModelOption.value?.reserveCredits ?? 100)
})
const selectedModelReasoningCapability = computed(() => {
  return selectedModelOption.value?.reasoningCapability || 'none'
})
const selectedModelReasoningBadgeLabel = computed(() => {
  return selectedModelOption.value?.reasoningBadgeLabel || ''
})

// 获取当前用户ID
const getUserId = (): string => {
  return authStore.getUserId()
}

// 分页状态
const hasMoreMessages = ref(true)
const isClearing = ref(false)

// 发送消息
const handleSendMessage = async (
  content: string,
  options?: {
    fileIds?: string[]
    serverFiles?: { id: string; url: string; name: string; type: string }[]
  }
) => {
  const userId = getUserId()
  if (!userId) {
    message.warning('未获取到用户信息，请重新登录')
    return
  }

  if (hasCreditSnapshot.value && currentCreditsRemaining.value < selectedModelReserveCredits.value) {
    message.warning(
      `当前模型发送前至少需预留 ${selectedModelReserveCredits.value} 积分，最终按实际 token 结算，剩余 ${currentCreditsRemaining.value} 积分`,
    )
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
        value: model.modelId,
        inputPrice: Number(model.inputPrice ?? 0),
        outputPrice: Number(model.outputPrice ?? 0),
        reserveCredits: Number(model.creditCost ?? 100),
        reasoningCapability: model.reasoningCapability || 'none',
        reasoningStrategy: model.reasoningStrategy,
        reasoningBadgeLabel: model.reasoningBadgeLabel,
      }))

    if (zaiwenModels.length > 0) {
      modelOptions.value = zaiwenModels
    }

    if (!modelOptions.value.some((model) => model.value === selectedModel.value)) {
      selectedModel.value = modelOptions.value.find((model) => model.value === 'GLM-5')?.value || modelOptions.value[0]?.value || 'GLM-5'
      saveSelectedModel()
    }
  } catch (error) {
    logger.error('加载模型列表失败:', error)
    if (isAuthFailureError(error)) {
      return
    }
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

/**
 * 新建对话
 */
const handleNewConversation = () => {
  cancelCurrentStream()
  conversationStore.createConversation()
  hasMoreMessages.value = false
}

/**
 * 选择对话
 */
const handleSelectConversation = async (conversationId: string) => {
  if (conversationId === currentConversationId.value) return

  cancelCurrentStream()
  const paginationInfo = await conversationStore.selectConversation(conversationId)

  if (paginationInfo) {
    hasMoreMessages.value = paginationInfo.hasMore
    return
  }

  const targetConversation = conversationStore.getConversationById(conversationId)
  if (!targetConversation?.sessionId) {
    hasMoreMessages.value = false
  }
}

/**
 * 重命名对话
 */
const handleRenameConversation = async (conversationId: string, title: string) => {
  const success = await conversationStore.updateConversationTitle(conversationId, title)
  if (success) {
    message.success('重命名成功')
  } else {
    message.error('重命名失败')
  }
}

/**
 * 删除对话
 */
const handleDeleteConversation = async (conversationId: string) => {
  const deletingCurrentConversation = conversationId === currentConversationId.value

  if (deletingCurrentConversation) {
    cancelCurrentStream()
  }

  await conversationStore.deleteConversation(conversationId)

  if (deletingCurrentConversation) {
    const nextConversationId = conversationStore.currentConversationId
    if (!nextConversationId) {
      hasMoreMessages.value = false
    } else {
      const nextConversation = conversationStore.getConversationById(nextConversationId)
      if (!nextConversation?.sessionId) {
        hasMoreMessages.value = false
      }
    }
  }

  message.success('对话已删除')
}

/**
 * 清空所有对话
 */
const handleClearConversations = async () => {
  const userId = getUserId()
  isClearing.value = true

  try {
    cancelCurrentStream()
    const result = await conversationStore.clearAllConversations(userId || undefined)
    if (result) {
      conversationStore.createConversation()
      hasMoreMessages.value = false
      message.success(`已清空 ${result.deletedCount} 个对话`)
    } else {
      message.error('清空对话失败')
    }
  } finally {
    isClearing.value = false
  }
}

/**
 * 退出登录
 */
const handleLogout = async () => {
  cancelCurrentStream()
  conversationStore.resetLocalState()
  authStore.clearAuth()
  message.success('已成功退出登录')
  await router.push('/login')
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
