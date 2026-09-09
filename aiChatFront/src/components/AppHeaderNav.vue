<template>
  <header class="app-header-nav">
    <div class="nav-left">
      <div class="brand-title" @click="router.push('/chat')">
        <span class="brand-text">创作控制台</span>
      </div>
    </div>

    <div class="nav-center">
      <div class="mode-switcher">
        <button
          type="button"
          :class="['mode-tab', { active: currentMode === 'chat' }]"
          @click="handleSwitchMode('chat')"
        >
          <MessageOutlined class="tab-icon" />
          <span>聊天</span>
        </button>

        <button
          type="button"
          :class="['mode-tab', { active: currentMode === 'image' }]"
          @click="handleSwitchMode('image')"
        >
          <PictureOutlined class="tab-icon" />
          <span>图片</span>
        </button>

        <a-tooltip title="即将上线，敬请期待">
          <button type="button" class="mode-tab disabled">
            <VideoCameraOutlined class="tab-icon" />
            <span>视频</span>
          </button>
        </a-tooltip>

        <a-tooltip title="即将上线，敬请期待">
          <button type="button" class="mode-tab disabled">
            <AudioOutlined class="tab-icon" />
            <span>语音</span>
          </button>
        </a-tooltip>
      </div>
    </div>

    <div class="nav-right">
      <div v-if="creditsRemaining !== undefined" class="credits-badge">
        <ThunderboltFilled class="credits-icon" />
        <span>{{ creditsRemaining }} 积分</span>
      </div>

      <a-dropdown placement="bottomRight">
        <div class="user-profile-badge">
          <a-avatar size="small" class="user-avatar">
            {{ userInitial }}
          </a-avatar>
          <span class="user-name-tag">{{ displayName }}</span>
          <DownOutlined class="dropdown-arrow" />
        </div>
        <template #overlay>
          <a-menu class="user-dropdown-menu">
            <a-menu-item key="account" @click="handleOpenAccount">
              <UserOutlined />
              <span style="margin-left: 8px;">个人账户</span>
            </a-menu-item>
            <a-menu-item key="clear" class="danger-menu-item" @click="handleClearConversations">
              <DeleteOutlined />
              <span style="margin-left: 8px;">清空对话</span>
            </a-menu-item>
            <a-menu-item key="about" @click="showAboutModal = true">
              <QuestionCircleOutlined />
              <span style="margin-left: 8px;">更新与帮助</span>
            </a-menu-item>
            <a-menu-divider />
            <a-menu-item key="logout" class="danger-menu-item" @click="handleLogout">
              <LogoutOutlined />
              <span style="margin-left: 8px;">退出登录</span>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <!-- 更新与帮助弹窗 -->
    <AboutModal v-model:open="showAboutModal" />
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  MessageOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  DownOutlined,
  UserOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  LogoutOutlined,
  ThunderboltFilled,
} from '@ant-design/icons-vue'
import { useAuthStore, useConversationStore } from '@/stores'
import AboutModal from '@/views/Chat/components/AboutModal.vue'

defineOptions({
  name: 'AppHeaderNav',
})

const props = defineProps<{
  activeMode?: 'chat' | 'image' | 'video' | 'audio'
}>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const conversationStore = useConversationStore()
const showAboutModal = ref(false)

const currentMode = computed(() => {
  if (props.activeMode) return props.activeMode
  if (route.path.startsWith('/image')) return 'image'
  return 'chat'
})

const displayName = computed(() => {
  const profile = authStore.userProfile
  if (!profile) return '未知用户'
  const username = profile.username || '用户'
  const shortId = profile.id ? profile.id.slice(0, 8) : ''
  return shortId ? `${username} · ${shortId}` : username
})

const userInitial = computed(() => {
  const name = authStore.userProfile?.username || 'U'
  return name.charAt(0).toUpperCase()
})

const creditsRemaining = computed(() => {
  return authStore.userProfile?.credits?.remaining ?? 0
})

const handleSwitchMode = (mode: 'chat' | 'image') => {
  if (mode === 'chat' && route.path !== '/chat') {
    router.push('/chat')
  } else if (mode === 'image' && route.path !== '/image') {
    router.push('/image')
  }
}

const handleOpenAccount = async () => {
  await router.push({
    name: 'account',
    query: {
      from: route.fullPath,
    },
  })
}

const handleClearConversations = () => {
  const count = conversationStore.conversations.length
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
      const userId = authStore.userProfile?.id
      const result = await conversationStore.clearAllConversations(userId)
      if (result) {
        conversationStore.createConversation()
        message.success(`已清空 ${result.deletedCount} 个对话`)
      } else {
        message.error('清空对话失败')
      }
    },
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
      conversationStore.resetLocalState()
      authStore.clearAuth()
      message.success('已成功退出登录')
      router.push('/login')
    },
  })
}
</script>

<style scoped>
.app-header-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  background: #ffffff;
  border-bottom: 1px solid #eef0f3;
  user-select: none;
}

.nav-left {
  display: flex;
  align-items: center;
}

.brand-title {
  cursor: pointer;
  display: flex;
  align-items: center;
}

.brand-text {
  font-size: 16px;
  font-weight: 600;
  color: #1a1d21;
  letter-spacing: -0.2px;
}

.nav-center {
  display: flex;
  align-items: center;
}

.mode-switcher {
  display: flex;
  align-items: center;
  background: #f4f5f7;
  padding: 3px;
  border-radius: 20px;
  gap: 2px;
}

.mode-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  font-size: 13px;
  color: #646a73;
  background: transparent;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.mode-tab:hover:not(.disabled) {
  color: #1f2329;
}

.mode-tab.active {
  color: #1f2329;
  background: #ffffff;
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.mode-tab.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tab-icon {
  font-size: 14px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.credits-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: #e6a23c;
}

.credits-icon {
  font-size: 12px;
  color: #e6a23c;
}

.user-profile-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.user-profile-badge:hover {
  background: #f4f5f7;
}

.user-avatar {
  background: #1890ff;
  color: #fff;
  font-size: 12px;
}

.user-name-tag {
  font-size: 13px;
  color: #333;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-arrow {
  font-size: 10px;
  color: #8c929a;
}

.danger-menu-item {
  color: #ff4d4f;
}

:deep(.user-dropdown-menu) {
  min-width: 140px;
  border-radius: 8px;
  padding: 4px;
}
</style>
