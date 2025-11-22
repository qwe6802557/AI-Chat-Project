<template>
  <div class="sidebar">
    <!-- 顶部 -->
    <div class="sidebar-header">
      <a-button block @click="$emit('new-chat')" class="new-chat-btn">
        <PlusOutlined />
        新建对话
      </a-button>
    </div>

    <!-- 对话 -->
    <div class="conversations-list">
      <div
        v-for="conversation in conversations"
        :key="conversation.id"
        :class="['conversation-item', { active: conversation.id === currentConversationId }]"
        @click="$emit('select-conversation', conversation.id)"
      >
        <MessageOutlined class="conversation-icon" />
        <span class="conversation-title">{{ conversation.title }}</span>
      </div>
    </div>

    <!-- 底部 -->
    <div class="sidebar-footer">
      <div class="menu-item" @click="handleClearConversations">
        <DeleteOutlined class="menu-icon" />
        <span>清空对话</span>
      </div>
      <div class="menu-item">
        <BulbOutlined class="menu-icon" />
        <span>浅色模式</span>
      </div>
      <div class="menu-item">
        <UserOutlined class="menu-icon" />
        <span>我的账户</span>
      </div>
      <div class="menu-item">
        <QuestionCircleOutlined class="menu-icon" />
        <span>更新与帮助</span>
      </div>
      <div class="menu-item" @click="handleLogout">
        <LogoutOutlined class="menu-icon" />
        <span>退出登录</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  PlusOutlined,
  MessageOutlined,
  DeleteOutlined,
  UserOutlined,
  LogoutOutlined,
  BulbOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue'

defineOptions({
  name: 'SidebarComponent',
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
  sessionId?: string
}

interface Props {
  conversations: Conversation[]
  currentConversationId: string
}

defineProps<Props>()

const emit = defineEmits<{
  'new-chat': []
  'select-conversation': [id: string]
  'clear-conversations': []
}>()

const router = useRouter()

const handleClearConversations = () => {
  Modal.confirm({
    title: '清空对话',
    content: '确定要清空所有对话记录吗？',
    okText: '清空',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      emit('clear-conversations')
    }
  })
}

const handleLogout = () => {
  Modal.confirm({
    title: '退出登录',
    content: '确定要退出登录吗？',
    okText: '退出',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('username')
      message.success('已成功退出登录')
      router.push('/login')
    }
  })
}
</script>

<style scoped lang="scss">
.sidebar {
  width: 282px;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;

  .sidebar-header {
    padding: 20px;
    border-bottom: none;

    .new-chat-btn {
      height: 44px;
      background: transparent;
      border: 1px solid rgba(0, 0, 0, 0.2);
      color: #000000;
      font-weight: 500;
      font-size: 16px;
      border-radius: 6px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;

      &:hover {
        background: rgba(0, 0, 0, 0.05);
        border-color: rgba(0, 0, 0, 0.3);
        color: #000000;
      }

      :deep(.anticon) {
        font-size: 20px;
      }
    }
  }

  .conversations-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    gap: 4px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;

      &:hover {
        background: rgba(0, 0, 0, 0.3);
      }
    }

    .conversation-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      margin-bottom: 4px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      color: #000000;
      font-size: 14px;

      &:hover {
        background: #0000000f;
      }

      &.active {
        background: #0000000f;
      }

      .conversation-icon {
        font-size: 16px;
        color: rgba(0, 0, 0, 0.6);
        flex-shrink: 0;
      }

      .conversation-title {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }

  .sidebar-footer {
    padding: 20px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 4px;

    .menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      color: #000000;
      font-size: 14px;

      &:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .menu-icon {
        font-size: 24px;
        color: rgba(0, 0, 0, 0.6);
      }
    }
  }
}
</style>

