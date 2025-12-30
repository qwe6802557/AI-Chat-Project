<template>
  <div class="avatar-uploader">
    <div
      class="avatar-container"
      @click="triggerUpload"
      @mouseenter="showOverlay = true"
      @mouseleave="showOverlay = false"
    >
      <!-- 头像显示 -->
      <a-avatar
        :size="80"
        :src="currentAvatar"
        class="avatar"
      >
        <template #icon>
          <UserOutlined />
        </template>
      </a-avatar>

      <!-- Hover蒙层 -->
      <transition name="fade">
        <div v-show="showOverlay || isUploading" class="avatar-overlay">
          <LoadingOutlined v-if="isUploading" class="overlay-icon" spin />
          <CameraOutlined v-else class="overlay-icon" />
          <span class="overlay-text">{{ isUploading ? '上传中...' : '更换头像' }}</span>
        </div>
      </transition>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="hidden-input"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UserOutlined, CameraOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'

defineOptions({
  name: 'AvatarUploader'
})

const props = defineProps<{
  avatar?: string | null
}>()

const emit = defineEmits<{
  'update:avatar': [url: string]
  'upload-success': [url: string]
}>()

// 上传Hook
const {
  isUploading,
  previewUrl,
  handleAvatarUpload
} = useAvatarUpload()

// 本地状态
const showOverlay = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 当前显示的头像
const currentAvatar = computed(() => previewUrl.value || props.avatar || undefined)

/**
 * 触发文件选择
 */
const triggerUpload = () => {
  if (isUploading.value) return
  fileInputRef.value?.click()
}

/**
 * 处理文件选择
 */
const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  const result = await handleAvatarUpload(file)

  if (result) {
    emit('update:avatar', result)
    emit('upload-success', result)
  }

  // 重置
  target.value = ''
}
</script>

<style scoped lang="scss">
.avatar-uploader {
  display: inline-block;

  .avatar-container {
    position: relative;
    width: 80px;
    height: 80px;
    cursor: pointer;
    border-radius: 50%;
    overflow: hidden;

    .avatar {
      width: 100%;
      height: 100%;
      background: #5B5BD6;

      :deep(.anticon) {
        font-size: 32px;
      }
    }

    .avatar-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;

      .overlay-icon {
        font-size: 20px;
        color: #ffffff;
      }

      .overlay-text {
        font-size: 12px;
        color: #ffffff;
      }
    }
  }

  .hidden-input {
    display: none;
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
