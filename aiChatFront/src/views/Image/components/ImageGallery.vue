<template>
  <div class="image-gallery-container">
    <!-- 生成中占位卡片 -->
    <div v-if="props.isGenerating" class="generating-card">
      <div class="skeleton-image-wrapper">
        <div class="shimmer-effect"></div>
        <div class="generating-overlay">
          <LoadingOutlined class="spinner-icon" />
          <span class="timer-text">正在绘制中 · 已耗时 {{ formatTime(props.generatingElapsedSeconds) }}</span>
        </div>
      </div>
      <div class="generating-prompt-box">
        <span class="prompt-label">当前提示词：</span>
        <span class="prompt-text">{{ props.generatingPrompt }}</span>
      </div>
    </div>

    <!-- 历史任务画廊 -->
    <div v-if="props.tasks.length > 0" class="tasks-list">
      <div
        v-for="task in props.tasks"
        :key="task.id"
        class="task-card"
      >
        <!-- 图片栅格展示区 -->
        <div
          v-if="task.imageUrls && task.imageUrls.length > 0"
          class="image-grid"
          :class="[
            `grid-count-${Math.min(task.imageUrls.length || 1, 4)}`,
            `aspect-${task.aspectRatio.replace(':', '-')}`
          ]"
        >
          <a-image-preview-group>
            <div
              v-for="(url, idx) in task.imageUrls"
              :key="idx"
              class="image-item-wrapper"
            >
              <a-image
                :src="resolveImageUrl(url)"
                :alt="task.prompt"
                class="generated-img"
              >
                <template #previewMask>
                  <div class="custom-preview-mask">
                    <EyeOutlined />
                    <span>预览</span>
                  </div>
                </template>
              </a-image>
              <div class="image-hover-actions">
                <a-tooltip title="下载原图">
                  <button
                    type="button"
                    class="action-icon-btn"
                    @click.stop="handleDownload(resolveImageUrl(url), task.prompt, idx)"
                  >
                    <DownloadOutlined />
                  </button>
                </a-tooltip>
              </div>
            </div>
          </a-image-preview-group>
        </div>

        <!-- 任务信息与快捷操作 -->
        <div class="task-footer">
          <div class="prompt-display">
            <span class="task-prompt">{{ task.prompt }}</span>
          </div>

          <div class="task-meta-bar">
            <div class="meta-tags">
              <span v-if="task.status === 'failed'" class="meta-tag failed-tag">生成失败</span>
              <span class="meta-tag model-tag">{{ task.modelId }}</span>
              <span class="meta-tag">{{ task.aspectRatio }}</span>
              <span class="meta-tag">{{ task.resolution }}</span>
              <span class="meta-tag">{{ task.quality }}</span>
              <span class="meta-tag cost-tag">消耗 {{ task.costCredits }} 积分</span>
              <span class="task-time">{{ formatDate(task.createdAt) }}</span>
            </div>

            <div class="action-buttons">
              <a-tooltip title="复制提示词">
                <button
                  type="button"
                  class="action-text-btn"
                  @click="handleCopyPrompt(task.prompt)"
                >
                  <CopyOutlined />
                  <span>复制词</span>
                </button>
              </a-tooltip>

              <a-tooltip title="复用全部生成参数">
                <button
                  type="button"
                  class="action-text-btn"
                  @click="emit('reuse', task)"
                >
                  <RedoOutlined />
                  <span>复用参数</span>
                </button>
              </a-tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!props.isGenerating" class="empty-gallery">
      <div class="empty-icon-box">
        <PictureOutlined class="empty-icon" />
      </div>
      <h3 class="empty-title">开启你的创意画作</h3>
      <p class="empty-desc">
        在下方输入描述词并选择分辨率与比例，点击发送即可开始生成
      </p>
      <div class="prompt-suggestions">
        <button
          v-for="s in samplePrompts"
          :key="s"
          type="button"
          class="suggestion-pill"
          @click="emit('apply-prompt', s)"
        >
          {{ s }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  LoadingOutlined,
  PictureOutlined,
  DownloadOutlined,
  CopyOutlined,
  RedoOutlined,
  EyeOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { ImageGenerationTask } from '@/interface/image'

defineOptions({
  name: 'ImageGallery',
})

const props = defineProps<{
  tasks: ImageGenerationTask[]
  isGenerating?: boolean
  generatingPrompt?: string
  generatingElapsedSeconds?: number
}>()

const emit = defineEmits<{
  'reuse': [task: ImageGenerationTask]
  'apply-prompt': [prompt: string]
}>()

const samplePrompts = [
  'A minimal red chair in a bright studio',
  '赛博朋克风格的雨夜霓虹街头，超高清细节，电影光影',
  '山间清晨的云雾缭绕，水墨意境，东方美学',
  '可爱的毛茸茸小橘猫坐在窗台晒太阳，微距特写',
]

const formatTime = (seconds: number = 0): string => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}s`
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * 确保图片路径无论本地转存还是外链都能正常渲染
 */
const resolveImageUrl = (url: string): string => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  return `${baseURL.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

const handleCopyPrompt = async (prompt: string) => {
  try {
    await navigator.clipboard.writeText(prompt)
    message.success('提示词已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

const handleDownload = async (url: string, prompt: string, index: number) => {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `${prompt.slice(0, 20).trim() || 'image'}_${index + 1}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}
</script>

<style scoped>
.image-gallery-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px 120px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 生成中卡片 */
.generating-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e8ecf0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  animation: fadeIn 0.3s ease-out;
}

.skeleton-image-wrapper {
  position: relative;
  width: 100%;
  height: 360px;
  background: #f0f2f5;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shimmer-effect {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmer 1.8s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.generating-overlay {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #1f2329;
}

.spinner-icon {
  font-size: 28px;
  color: #1890ff;
}

.timer-text {
  font-size: 14px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.85);
  padding: 6px 14px;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.generating-prompt-box {
  padding: 14px 18px;
  font-size: 14px;
  background: #fafbfc;
  border-top: 1px solid #edf0f3;
}

.prompt-label {
  color: #8c929a;
}

.prompt-text {
  color: #1f2329;
  font-weight: 500;
}

/* 历史任务卡片 */
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.task-card {
  background: #ffffff;
  border: 1px solid #eaedf1;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.task-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}

.image-grid {
  background: #f8fafc;
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.2s ease;
}

/* 单张图片：紧凑自适应贴合，居中，彻底消除灰边 (Option A) */
.grid-count-1 {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
}

.grid-count-1 .image-item-wrapper {
  position: relative;
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: transparent;
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.grid-count-1 :deep(.ant-image) {
  display: inline-flex;
  width: auto;
  height: auto;
  max-width: 100%;
}

.grid-count-1 :deep(.ant-image-img) {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 640px;
  object-fit: contain;
  border-radius: 12px;
}

/* 多张图片（2x, 3x, 4x 栅格排布） */
.grid-count-2,
.grid-count-3,
.grid-count-4 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.grid-count-2 .image-item-wrapper,
.grid-count-3 .image-item-wrapper,
.grid-count-4 .image-item-wrapper {
  position: relative;
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: #f1f5f9;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.04);
}

.grid-count-2 :deep(.ant-image),
.grid-count-3 :deep(.ant-image),
.grid-count-4 :deep(.ant-image) {
  width: 100%;
  height: 100%;
  display: flex;
}

.grid-count-2 :deep(.ant-image-img),
.grid-count-3 :deep(.ant-image-img),
.grid-count-4 :deep(.ant-image-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
}

/* 比例规则（主要服务于多图栅格整齐度） */
.aspect-1-1 .image-item-wrapper {
  aspect-ratio: 1 / 1;
}
.aspect-16-9 .image-item-wrapper {
  aspect-ratio: 16 / 9;
}
.aspect-9-16 .image-item-wrapper {
  aspect-ratio: 9 / 16;
}
.aspect-2-3 .image-item-wrapper {
  aspect-ratio: 2 / 3;
}
.aspect-3-2 .image-item-wrapper {
  aspect-ratio: 3 / 2;
}
.aspect-4-3 .image-item-wrapper {
  aspect-ratio: 4 / 3;
}
.aspect-3-4 .image-item-wrapper {
  aspect-ratio: 3 / 4;
}

/* 单图时尊重图片原始比例自适应，不强制拉伸或裁切 */
.grid-count-1.aspect-1-1 .image-item-wrapper,
.grid-count-1.aspect-16-9 .image-item-wrapper,
.grid-count-1.aspect-9-16 .image-item-wrapper,
.grid-count-1.aspect-2-3 .image-item-wrapper,
.grid-count-1.aspect-3-2 .image-item-wrapper,
.grid-count-1.aspect-4-3 .image-item-wrapper,
.grid-count-1.aspect-3-4 .image-item-wrapper {
  aspect-ratio: unset;
}

.custom-preview-mask {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #ffffff;
  pointer-events: none;
}

.image-hover-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 5;
}

.image-item-wrapper:hover .image-hover-actions {
  opacity: 1;
}

.action-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: background 0.2s ease;
}

.action-icon-btn:hover {
  background: rgba(0, 0, 0, 0.85);
}

.task-footer {
  padding: 14px 18px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-prompt {
  font-size: 15px;
  color: #1f2329;
  line-height: 1.5;
  font-weight: 500;
}

.task-meta-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.meta-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #f2f4f7;
  color: #646a73;
}

.model-tag {
  background: #e8f3ff;
  color: #1890ff;
  font-weight: 500;
}

.failed-tag {
  background: #fff1f0;
  color: #cf1322;
  font-weight: 500;
}

.cost-tag {
  background: #fdf6ec;
  color: #e6a23c;
}

.task-time {
  font-size: 11px;
  color: #8c929a;
  margin-left: 4px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-text-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #646a73;
  background: transparent;
  border: 1px solid #e1e4e8;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-text-btn:hover {
  color: #1890ff;
  border-color: #1890ff;
}

/* 空状态 */
.empty-gallery {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon-box {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: #f0f5ff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.empty-icon {
  font-size: 32px;
  color: #1890ff;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2329;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: #8c929a;
  max-width: 440px;
  margin-bottom: 24px;
}

.prompt-suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  max-width: 640px;
}

.suggestion-pill {
  font-size: 13px;
  color: #4e5969;
  background: #f4f5f7;
  border: 1px solid transparent;
  padding: 8px 14px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.suggestion-pill:hover {
  background: #ffffff;
  border-color: #1890ff;
  color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.12);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
