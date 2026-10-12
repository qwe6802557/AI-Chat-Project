<template>
  <a-modal
    :open="props.open"
    :footer="null"
    :centered="true"
    :width="920"
    wrap-class-name="video-preview-modal-wrap"
    @cancel="handleClose"
  >
    <div v-if="props.task" class="theater-preview-container">
      <!-- 视频播放区域 -->
      <div class="theater-video-box" :class="`aspect-${props.task.aspectRatio.replace(':', '-')}`">
        <video
          v-if="props.task.videoUrl"
          ref="videoElementRef"
          :src="resolveMediaUrl(props.task.videoUrl)"
          class="theater-video"
          controls
          autoplay
          loop
          playsinline
        />
        <div v-else class="theater-video-placeholder">
          <span>暂无视频流</span>
        </div>
      </div>

      <!-- 视频详细元信息与控制台 -->
      <div class="theater-info-panel">
        <div class="theater-prompt-box">
          <h4 class="theater-section-title">画面描述 / 提示词</h4>
          <p class="theater-prompt-text">{{ props.task.prompt }}</p>
        </div>

        <div class="theater-meta-row">
          <div class="theater-meta-tags">
            <span class="theater-badge model-badge">{{ props.task.modelId }}</span>
            <span class="theater-badge">{{ props.task.aspectRatio }}</span>
            <span class="theater-badge">{{ props.task.duration }}s</span>
            <span class="theater-badge cost-badge">消耗 {{ props.task.costCredits }} 积分</span>
            <span class="theater-time">{{ formatDate(props.task.createdAt) }}</span>
          </div>

          <div class="theater-actions">
            <button
              type="button"
              class="theater-btn"
              @click="handleCopyPrompt"
            >
              <CopyOutlined />
              <span>复制提示词</span>
            </button>

            <button
              type="button"
              class="theater-btn"
              @click="handleReuse"
            >
              <RedoOutlined />
              <span>复用参数</span>
            </button>

            <button
              v-if="props.task.videoUrl"
              type="button"
              class="theater-btn primary-btn"
              :disabled="downloading"
              @click="handleDownloadVideo"
            >
              <LoadingOutlined v-if="downloading" />
              <DownloadOutlined v-else />
              <span>下载 MP4</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  CopyOutlined,
  RedoOutlined,
  DownloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import type { VideoGenerationTask } from '@/interface/video'
import { getApiBaseUrl } from '@/utils/common'

const props = defineProps<{
  open: boolean
  task: VideoGenerationTask | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'reuse': [task: VideoGenerationTask]
}>()

const videoElementRef = ref<HTMLVideoElement | null>(null)
const downloading = ref(false)

const handleClose = () => {
  if (videoElementRef.value) {
    videoElementRef.value.pause()
  }
  emit('update:open', false)
}

const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  const baseURL = getApiBaseUrl()
  if (!baseURL) {
    return url.startsWith('/') ? url : `/${url}`
  }
  return `${baseURL.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleCopyPrompt = async () => {
  if (!props.task?.prompt) return
  try {
    await navigator.clipboard.writeText(props.task.prompt)
    message.success('提示词已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

const handleReuse = () => {
  if (!props.task) return
  emit('reuse', props.task)
  handleClose()
}

const handleDownloadVideo = async () => {
  if (!props.task?.videoUrl) return
  downloading.value = true
  try {
    const directUrl = resolveMediaUrl(props.task.videoUrl)
    const response = await fetch(directUrl)
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `video-${props.task.id.slice(0, 8)}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)
    message.success('视频下载成功')
  } catch (error) {
    // 降级为直接打开
    window.open(resolveMediaUrl(props.task.videoUrl), '_blank')
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped lang="scss">
.theater-preview-container {
  display: flex;
  flex-direction: column;
  background: #0f172a;
  border-radius: 12px;
  overflow: hidden;
  color: #f8fafc;
}

.theater-video-box {
  position: relative;
  width: 100%;
  max-height: 68vh;
  min-height: 320px;
  background: #020617;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  &.aspect-16-9 {
    aspect-ratio: 16 / 9;
  }
  &.aspect-9-16 {
    max-height: 60vh;
    aspect-ratio: 9 / 16;
  }
  &.aspect-1-1 {
    aspect-ratio: 1 / 1;
  }
}

.theater-video {
  width: 100%;
  height: 100%;
  max-height: 68vh;
  object-fit: contain;
  background: #000;
}

.theater-video-placeholder {
  color: #64748b;
  font-size: 14px;
}

.theater-info-panel {
  padding: 16px 20px;
  background: #0f172a;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.theater-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 6px 0;
}

.theater-prompt-text {
  font-size: 14px;
  line-height: 1.5;
  color: #f1f5f9;
  margin: 0;
  word-break: break-word;
}

.theater-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.theater-meta-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.theater-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  font-family: monospace;

  &.model-badge {
    background: rgba(99, 102, 241, 0.18);
    color: #a5b4fc;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  &.cost-badge {
    background: rgba(245, 158, 11, 0.15);
    color: #fcd34d;
  }
}

.theater-time {
  font-size: 12px;
  color: #64748b;
  margin-left: 4px;
}

.theater-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theater-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  &.primary-btn {
    background: #6366f1;
    border-color: #6366f1;
    color: #ffffff;
    font-weight: 500;

    &:hover {
      background: #4f46e5;
      border-color: #4f46e5;
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
