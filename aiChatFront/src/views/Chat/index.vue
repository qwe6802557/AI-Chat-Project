<template>
  <div class="chat-container">
    <Sidebar
      :conversations="conversations"
      :currentConversationId="currentConversationId"
      @new-chat="handleNewChat"
      @select-conversation="handleSelectConversation"
      @clear-conversations="handleClearConversations"
    />
    <ChatArea
      :messages="currentMessages"
      :loading="loading"
      @send-message="handleSendMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import Sidebar from './components/Sidebar.vue'
import ChatArea from './components/ChatArea.vue'

// 定义组件名称
defineOptions({
  name: 'ChatPage'
})

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

const conversations = ref<Conversation[]>([])
const currentConversationId = ref('')
const loading = ref(false)

// 当前对话的消息
const currentMessages = computed(() => {
  const conversation = conversations.value.find(c => c.id === currentConversationId.value)
  return conversation?.messages || []
})

// 从 localStorage 加载对话
const loadConversations = () => {
  const saved = localStorage.getItem('chatConversations')
  if (saved) {
    try {
      conversations.value = JSON.parse(saved)
    } catch (e) {
      console.error('加载对话消息失败:', e)
    }
  }
}

// 保存对话到 localStorage
const saveConversations = () => {
  localStorage.setItem('chatConversations', JSON.stringify(conversations.value))
}

// 新建对话
const handleNewChat = () => {
  // 当前对话已存在且消息列表为空则不创建新对话
  if (currentConversationId.value) {
    const currentConversation = conversations.value.find(c => c.id === currentConversationId.value)
    if (currentConversation && currentConversation.messages.length === 0) {
      return
    }
  }

  const newConversation: Conversation = {
    id: Date.now().toString(),
    title: '新对话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  conversations.value.unshift(newConversation)
  currentConversationId.value = newConversation.id
  saveConversations()
}

// 选择对话
const handleSelectConversation = (id: string) => {
  currentConversationId.value = id
}

// 清空所有对话
const handleClearConversations = () => {
  conversations.value = []
  currentConversationId.value = ''
  saveConversations()
  message.success('已清空所有对话')
}

// 发送消息
const handleSendMessage = async (content: string) => {
  // 没有当前对话则创建一个
  if (!currentConversationId.value) {
    handleNewChat()
  }

  const conversation = conversations.value.find(c => c.id === currentConversationId.value)
  if (!conversation) return

  // 添加用户消息
  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content,
    timestamp: Date.now()
  }
  conversation.messages.push(userMessage)

  // 更新对话标题（使用第一条消息的前30个字符）
  if (conversation.messages.length === 1) {
    conversation.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
  }

  conversation.updatedAt = Date.now()
  saveConversations()

  // 模拟 AI 回复
  loading.value = true
  setTimeout(() => {
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '这是一个模拟回复。请集成您的 AI 后端 API 以获得真实的 AI 响应。',
      timestamp: Date.now()
    }
    conversation.messages.push(assistantMessage)
    conversation.updatedAt = Date.now()
    saveConversations()
    loading.value = false
  }, 1500)
}

onMounted(() => {
  loadConversations()
  // 如果没有对话，创建一个新的
  if (conversations.value.length === 0) {
    handleNewChat()
  } else {
    // 选择最新的对话
    currentConversationId.value = conversations.value[0].id
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

