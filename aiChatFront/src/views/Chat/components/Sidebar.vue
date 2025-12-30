<template>
  <div class="sidebar">
    <!-- 顶部 -->
    <div class="sidebar-header">
      <a-button
        block
        @click="handleNewChat"
        class="new-chat-btn"
        :disabled="isClearing"
      >
        <PlusOutlined />
        {{ isClearing ? '清空中...' : '新建对话' }}
      </a-button>
    </div>

    <!-- 对话 -->
    <div class="conversations-list">
      <div
        v-for="conversation in conversations"
        :key="conversation.id"
        :class="['conversation-item', { active: conversation.id === currentConversationId }]"
        @click="handleConversationClick(conversation.id)"
      >
        <MessageOutlined class="conversation-icon" />

        <!-- 编辑模式 -->
        <input
          v-if="editingId === conversation.id"
          :ref="el => editInputRef = el as HTMLInputElement"
          v-model="editingTitle"
          class="conversation-title-input"
          @blur="handleEditConfirm"
          @keydown.enter="handleEditConfirm"
          @keydown.escape="handleEditCancel"
          @click.stop
        />

        <!-- 正常模式 -->
        <span v-else class="conversation-title">{{ conversation.title }}</span>

        <!-- 操作按钮 -->
        <a-dropdown
          v-if="editingId !== conversation.id"
          :trigger="['click']"
          placement="bottomRight"
          @click.stop
        >
          <span class="more-btn" @click.stop>
            <MoreOutlined />
          </span>
          <template #overlay>
            <a-menu @click="handleMenuClick($event, conversation)">
              <a-menu-item key="rename">
                <EditOutlined />
                <span style="margin-left: 6px;">重命名</span>
              </a-menu-item>
              <a-menu-item key="delete" class="danger-item">
                <DeleteOutlined />
                <span style="margin-left: 6px;">删除</span>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>

    <!-- 底部 -->
    <div class="sidebar-footer">
      <div
        :class="['menu-item', { disabled: isClearing }]"
        @click="!isClearing && handleClearConversations()"
      >
        <DeleteOutlined class="menu-icon" />
        <span>{{ isClearing ? '清空中...' : '清空对话' }}</span>
      </div>
<!--      <div class="menu-item">-->
<!--        <BulbOutlined class="menu-icon" />-->
<!--        <span>浅色模式</span>-->
<!--      </div>-->
      <div class="menu-item" @click="showAccountModal = true">
        <UserOutlined class="menu-icon" />
        <span>我的账户</span>
      </div>
      <div class="menu-item" @click="showAboutModal = true">
        <QuestionCircleOutlined class="menu-icon" />
        <span>更新与帮助</span>
      </div>
      <div class="menu-item" @click="handleLogout">
        <LogoutOutlined class="menu-icon" />
        <span>退出登录</span>
      </div>
    </div>

    <!-- 更新与帮助弹窗 -->
    <AboutModal v-model:open="showAboutModal" />

    <!-- 我的账户弹窗 -->
    <AccountModal v-model:open="showAccountModal" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  PlusOutlined,
  MessageOutlined,
  DeleteOutlined,
  UserOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  MoreOutlined,
  EditOutlined
} from '@ant-design/icons-vue'
import AboutModal from './AboutModal.vue'
import AccountModal from './AccountModal.vue'
import { useAuthStore, useConversationStore } from '@/stores'
import type { Conversation } from '@/stores'

defineOptions({
  name: 'SidebarComponent',
})

// 清空中状态（本地管理）
const isClearing = ref(false)

const router = useRouter()
const authStore = useAuthStore()
const conversationStore = useConversationStore()

// 从 store 获取响应式状态
const { conversations, currentConversationId } = storeToRefs(conversationStore)

// 更新与帮助弹窗
const showAboutModal = ref(false)

// 我的账户弹窗
const showAccountModal = ref(false)

// 编辑状态
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const originalTitle = ref('')  // 保存原标题用于恢复
const editInputRef = ref<HTMLInputElement | null>(null)

// 新建对话
const handleNewChat = () => {
  if (isClearing.value) return
  conversationStore.createConversation()
}

// 点击会话项
const handleConversationClick = (id: string) => {
  // 如果正在编辑，不触发选择
  if (editingId.value) return
  conversationStore.selectConversation(id)
}

// 菜单点击
const handleMenuClick = (e: { key: string }, conversation: Conversation) => {
  if (e.key === 'rename') {
    startEditing(conversation)
  } else if (e.key === 'delete') {
    handleDeleteConversation(conversation)
  }
}

// 开始编辑
const startEditing = (conversation: Conversation) => {
  editingId.value = conversation.id
  editingTitle.value = conversation.title
  originalTitle.value = conversation.title  // 保存原标题
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

// 确认编辑
const handleEditConfirm = async () => {
  if (!editingId.value) return

  const newTitle = editingTitle.value.trim()
  const currentEditingId = editingId.value
  const savedOriginalTitle = originalTitle.value

  // 标题没有变化或为空则取消编辑
  if (!newTitle || newTitle === savedOriginalTitle) {
    editingId.value = null
    editingTitle.value = ''
    originalTitle.value = ''
    return
  }

  // 清除编辑状态
  editingId.value = null
  editingTitle.value = ''
  originalTitle.value = ''

  // 直接调用 store 方法
  const success = await conversationStore.updateConversationTitle(currentEditingId, newTitle)
  if (success) {
    message.success('重命名成功')
  } else {
    message.error('重命名失败')
  }
}

// 取消编辑
const handleEditCancel = () => {
  editingId.value = null
  editingTitle.value = ''
  originalTitle.value = ''
}

// 删除会话
const handleDeleteConversation = (conversation: Conversation) => {
  Modal.confirm({
    title: '删除对话',
    content: `确定要删除对话「${conversation.title}」吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await conversationStore.deleteConversation(conversation.id)
      message.success('对话已删除')
    }
  })
}

const handleClearConversations = () => {
  const count = conversations.value.length
  if (count === 0) {
    message.info('暂无对话可清空')
    return
  }

  Modal.confirm({
    title: '清空对话',
    content: `确定要清空所有对话吗？这将删除全部 ${count} 个会话（包括已归档的会话）。此操作不可恢复。`,
    okText: '清空全部',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      isClearing.value = true
      try {
        const userId = authStore.getUserId()
        const result = await conversationStore.clearAllConversations(userId || undefined)
        if (result) {
          message.success(`已清空 ${result.deletedCount} 个对话`)
          // 清空后创建新对话
          conversationStore.createConversation()
        } else {
          message.error('清空对话失败')
        }
      } finally {
        isClearing.value = false
      }
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
      // 清除认证状态
      authStore.clearAuth()
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
      position: relative;

      &:hover {
        background: #0000000f;

        .more-btn {
          opacity: 1;
        }
      }

      &.active {
        background: #0000000f;

        .more-btn {
          opacity: 1;
        }
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

      .conversation-title-input {
        flex: 1;
        border: 1px solid #1890ff;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 14px;
        outline: none;
        background: #fff;
        color: #000;

        &:focus {
          border-color: #1890ff;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
        }
      }

      .more-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        opacity: 0;
        transition: all 0.2s;
        flex-shrink: 0;

        &:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        :deep(.anticon) {
          font-size: 14px;
          color: rgba(0, 0, 0, 0.6);
        }
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

      &:hover:not(.disabled) {
        background: rgba(0, 0, 0, 0.05);
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .menu-icon {
        font-size: 24px;
        color: rgba(0, 0, 0, 0.6);
      }
    }
  }
}

// 下拉菜单样式
:deep(.ant-dropdown-menu) {
  padding: 4px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 120px;

  .ant-dropdown-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 14px;

    .anticon {
      font-size: 16px;
    }

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    &.danger-item {
      color: #ff4d4f;

      &:hover {
        background: rgba(255, 77, 79, 0.1);
      }
    }
  }
}
</style>

