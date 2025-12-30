<template>
  <a-modal
    :open="open"
    :footer="null"
    :closable="true"
    :centered="true"
    :width="420"
    class="about-modal"
    @cancel="handleClose"
  >
    <div class="about-content">
      <!-- 应用图标 -->
      <div class="app-icon">
        <MessageOutlined />
      </div>

      <!-- 应用名称 -->
      <h1 class="app-name">ERJ Chat</h1>

      <!-- 版本号 -->
      <p class="app-version">版本: v1.0.0</p>

      <!-- 应用描述 -->
      <p class="app-description">
        ERJ Chat 是一个智能 AI 对话助手，帮助您更高效地组织和管理 AI 对话。
      </p>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <a-button type="primary" class="check-update-btn" @click="handleCheckUpdate">
          <template #icon><SyncOutlined /></template>
          检查更新
        </a-button>
        <a-button class="visit-repo-btn" @click="handleVisitRepo">
          <template #icon><LinkOutlined /></template>
          访问项目地址
        </a-button>
      </div>

      <!-- 版权信息 -->
      <p class="copyright">&copy; 2025 ERJ Chat. All rights reserved.</p>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import {
  MessageOutlined,
  SyncOutlined,
  LinkOutlined
} from '@ant-design/icons-vue'

defineOptions({
  name: 'AboutModal'
})

// Props
defineProps<{
  open: boolean
}>()

// Emits
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

// 关闭弹窗
const handleClose = () => {
  emit('update:open', false)
}

// 检查更新
const handleCheckUpdate = () => {
  // 只显示一个提示-新消息会替换旧消息
  message.success({
    content: '当前已是最新版本',
    key: 'checkUpdate'
  })
}

// 访问项目地址
const handleVisitRepo = () => {
  window.open(import.meta.env.VITE_PROJECT_GIT_URL, '_blank')
}
</script>

<style scoped lang="scss">
.about-modal {
  :deep(.ant-modal-content) {
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
  }

  :deep(.ant-modal-body) {
    padding: 0;
  }

  :deep(.ant-modal-close) {
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;

    .ant-modal-close-x {
      width: 32px;
      height: 32px;
      line-height: 32px;
      font-size: 16px;
    }
  }
}

.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 32px 32px;
  text-align: center;
}

.app-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  background: #ffffff;

  :deep(.anticon) {
    font-size: 28px;
    color: rgba(0, 0, 0, 0.75);
  }
}

.app-name {
  font-size: 24px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  margin: 0 0 8px 0;
  letter-spacing: -0.5px;
}

.app-version {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.45);
  margin: 0 0 20px 0;
}

.app-description {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.65);
  line-height: 1.6;
  margin: 0 0 28px 0;
  max-width: 320px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 240px;
  margin-bottom: 28px;

  .check-update-btn {
    height: 40px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;

    :deep(.anticon) {
      font-size: 14px;
    }
  }

  .visit-repo-btn {
    height: 40px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid rgba(0, 0, 0, 0.15);
    color: rgba(0, 0, 0, 0.88);

    &:hover {
      border-color: #1890ff;
      color: #1890ff;
    }

    :deep(.anticon) {
      font-size: 14px;
    }
  }
}

.copyright {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  margin: 0;
}
</style>
