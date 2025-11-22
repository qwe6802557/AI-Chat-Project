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
import { sendStreamMessage } from '@/api/chat'

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
  sessionId?: string // 后端会话 ID
}

const conversations = ref<Conversation[]>([])
const currentConversationId = ref('')
const loading = ref(false)

// 获取当前用户 ID
const getUserId = () => {
  return localStorage.getItem('userId') || ''
}

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

// 发送消息（流式 API）
const handleSendMessage = async (content: string) => {
  const userId = getUserId()
  if (!userId) {
    message.error('请先登录')
    return
  }

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

  // 更新对话标题（第一条消息的前30个字符）
  if (conversation.messages.length === 1) {
    conversation.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
  }

  conversation.updatedAt = Date.now()
  saveConversations()

  // 设置 loading 状态
  loading.value = true

  // AI 消息索引（第一次收到数据时创建）
  let messageIndex = -1
  let updateCount = 0 // 用于节流

  try {
    sendStreamMessage(
      {
        userId,
        sessionId: conversation.sessionId, // 后端会话 ID（第一次为 undefined）
        message: content,
        model: 'claude-sonnet-4-5-20250929' // 默认模型
      },
      {
        // 接收到增量内容
        onMessage: (delta: string, sessionId?: string) => {
          // 第一次收到数据时创建 AI 消息
          if (messageIndex === -1) {
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: delta,
              timestamp: Date.now()
            }
            conversation.messages.push(assistantMessage)
            messageIndex = conversation.messages.length - 1
            loading.value = false // 收到第一个字符后关闭 loading
          } else {
            // 后续追加内容 - 直接修改对象属性触发 Vue 响应式更新
            const currentMessage = conversation.messages[messageIndex]
            if (currentMessage) {
              currentMessage.content = currentMessage.content + delta
            }
          }

          conversation.updatedAt = Date.now()

          // 保存后端会话 ID（第一次收到时）
          if (sessionId && !conversation.sessionId) {
            conversation.sessionId = sessionId
          }

          // 节流保存：每50次更新保存一次到localStorage
          updateCount++
          if (updateCount % 50 === 0) {
            saveConversations()
          }
        },

        // 流式传输完成
        onComplete: (fullMessage: string, sessionId: string, model: string) => {
          if (messageIndex >= 0) {
            const msg = conversation.messages[messageIndex]
            if (msg) {
              msg.content = fullMessage
            }
          }
          conversation.sessionId = sessionId
          conversation.updatedAt = Date.now()
          saveConversations() // 完成后保存最终状态
          loading.value = false
          console.log('AI 回复完成，模型:', model)
        },

        // 错误处理
        onError: (error: string) => {
          message.error(`${error}`)
          // 移除失败的消息
          if (messageIndex >= 0) {
            conversation.messages.splice(messageIndex, 1)
          }
          saveConversations()
          loading.value = false
        }
      }
    )
  } catch (error: never) {
    message.error('发送消息失败，请稍后重试')
    // 移除失败的 AI 消息
    if (messageIndex >= 0) {
      conversation.messages.splice(messageIndex, 1)
    }
    saveConversations()
    loading.value = false
  }
}

onMounted(() => {
  loadConversations()
  // 如果没有对话，创建一个新的
  if (conversations.value.length === 0) {
    handleNewChat()
  } else {
    // 选择最新的对话
    currentConversationId.value = conversations.value[0]?.id || ''
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

