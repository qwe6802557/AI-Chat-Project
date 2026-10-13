<template>
  <div class="video-gallery-container">
    <!-- 任务卡片流 -->
    <div v-if="props.tasks.length > 0" class="video-masonry-grid">
      <div
        v-for="(task, index) in props.tasks"
        :key="task.id"
        class="video-task-card"
        :class="{
          'is-failed': task.status === 'failed',
          'is-processing': task.status === 'processing' || task.status === 'pending',
        }"
      >
        <!-- 视频主体画面区 -->
        <div
          class="video-media-wrapper"
          :class="`aspect-${task.aspectRatio.replace(':', '-')}`"
          @click="handleCardClick(task)"
        >
          <!-- 成功且有视频流 -->
          <template v-if="task.status === 'success' && task.videoUrl">
            <video
              :ref="(el) => setVideoRef(task.id, el)"
              :src="resolveMediaUrl(task.videoUrl)"
              class="preview-video"
              muted
              loop
              playsinline
              preload="metadata"
              @mouseenter="handleMouseEnter(task.id)"
              @mouseleave="handleMouseLeave(task.id)"
            />
            <div class="video-hover-scrim">
              <div class="play-indicator-btn">
                <CaretRightOutlined />
              </div>
              <div class="hover-tip-badge">点击全屏沉浸播放</div>
            </div>
            <!-- 左上角比例标签，右上角时长标签 -->
            <div class="media-corner-badge top-left">{{ task.aspectRatio }}</div>
            <div class="media-corner-badge top-right">{{ task.duration || 5 }}s</div>
          </template>

          <!-- 异步生成排队中：原地流式卡片 -->
          <template v-else-if="task.status === 'processing' || task.status === 'pending'">
            <div class="processing-placeholder">
              <div class="shimmer-effect"></div>
              <div class="breathing-ring">
                <LoadingOutlined class="spinner-icon" />
              </div>
              <span class="processing-title">
                {{ props.isGenerating && index === 0
                  ? `万相视频渲染中 · ${formatTime(props.generatingElapsedSeconds)}`
                  : '万相视频渲染中...' }}
              </span>
              <span class="processing-desc">上游正在计算扩散帧序列 (通常需 30~90s)</span>
            </div>
          </template>

          <!-- 失败状态 -->
          <template v-else>
            <div class="failed-placeholder">
              <CloseCircleOutlined class="failed-icon" />
              <span class="failed-title">生成未能完成</span>
              <span class="failed-reason">{{ task.errorMessage || '未知异常' }}</span>
              <span class="failed-refund-tag">200 积分已全额退还</span>
            </div>
          </template>
        </div>

        <!-- 任务信息与控制脚标 -->
        <div class="task-info-bar">
          <a-tooltip :title="task.prompt" placement="topLeft" :mouse-enter-delay="0.1">
            <div class="prompt-text-container">
              <span class="task-prompt">{{ task.prompt }}</span>
            </div>
          </a-tooltip>

          <div class="task-meta-and-actions">
            <div class="meta-tags-list">
              <span class="meta-tag model-tag">{{ task.modelId }}</span>
              <span class="meta-tag cost-tag">消耗 {{ task.costCredits }} 积分</span>
              <span class="task-timestamp">{{ formatDate(task.createdAt) }}</span>
            </div>

            <div class="action-buttons-group">
              <a-tooltip v-if="task.status === 'success' && task.videoUrl" title="播放预览">
                <button
                  type="button"
                  class="action-icon-btn"
                  @click.stop="emit('select-video', task)"
                >
                  <EyeOutlined />
                </button>
              </a-tooltip>

              <a-tooltip v-if="task.status === 'success' && task.videoUrl" title="下载 MP4 原画">
                <button
                  type="button"
                  class="action-icon-btn"
                  @click.stop="handleDownloadVideo(task)"
                >
                  <DownloadOutlined />
                </button>
              </a-tooltip>

              <a-tooltip title="复制提示词">
                <button
                  type="button"
                  class="action-icon-btn"
                  @click.stop="handleCopyPrompt(task.prompt)"
                >
                  <CopyOutlined />
                </button>
              </a-tooltip>

              <a-tooltip title="复用参数">
                <button
                  type="button"
                  class="action-icon-btn"
                  @click.stop="emit('reuse', task)"
                >
                  <RedoOutlined />
                </button>
              </a-tooltip>

              <a-popconfirm
                title="确定要删除该条视频记录及本地视频文件吗？此操作不可恢复。"
                ok-text="删除"
                cancel-text="取消"
                ok-type="danger"
                :disabled="props.deletingTaskId === task.id"
                @confirm="emit('delete', task.id)"
              >
                <button
                  type="button"
                  class="action-icon-btn danger-btn"
                  :disabled="props.deletingTaskId === task.id"
                  @click.stop
                >
                  <LoadingOutlined v-if="props.deletingTaskId === task.id" />
                  <DeleteOutlined v-else />
                </button>
              </a-popconfirm>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态提示与灵感引导 -->
    <div v-else class="empty-video-gallery">
      <div class="empty-icon-wrapper">
        <VideoCameraOutlined class="empty-icon" />
      </div>
      <h3 class="empty-headline">开启你的 AI 视频创意工坊</h3>
      <p class="empty-subtext">
        支持基于万相 14B 大模型生成高清电影质感视频，可输入镜头语言或上传参考图进行动态演绎
      </p>

      <div class="sample-prompts-container">
        <span class="sample-title">灵感示例，点击快速填入：</span>
        <div class="prompts-grid">
          <div
            v-for="(sample, index) in samplePrompts"
            :key="index"
            class="sample-prompt-pill"
            @click="emit('apply-prompt', sample)"
          >
            <span class="pill-text">{{ sample }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  LoadingOutlined,
  CaretRightOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  DownloadOutlined,
  CopyOutlined,
  RedoOutlined,
  DeleteOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons-vue'
import type { VideoGenerationTask } from '@/interface/video'
import { getApiBaseUrl } from '@/utils/common'

const props = defineProps<{
  tasks: VideoGenerationTask[]
  isGenerating?: boolean
  generatingPrompt?: string
  generatingElapsedSeconds?: number
  deletingTaskId?: string | null
}>()

const emit = defineEmits<{
  'reuse': [task: VideoGenerationTask]
  'apply-prompt': [prompt: string]
  'delete': [taskId: string]
  'select-video': [task: VideoGenerationTask]
}>()

const videoRefs = ref<Record<string, HTMLVideoElement>>({})

const setVideoRef = (id: string, el: any) => {
  if (el) {
    videoRefs.value[id] = el as HTMLVideoElement
  } else {
    delete videoRefs.value[id]
  }
}

const samplePrompts = [
  'A cinematic drone shot through foggy pine mountains at sunrise, 4k ultra-realistic',
  '赛博朋克雨夜街道，霓虹灯光在积水路面上泛起倒影，行人撑伞穿梭',
  '一滴晶莹露珠从清晨翠绿的叶尖滑落，超微距慢动作特写，清澈透亮',
  '宇航员在荒芜火星表面缓缓行走，红色尘埃随脚步微扬，宏伟苍凉',
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

const handleMouseEnter = (id: string) => {
  const video = videoRefs.value[id]
  if (video) {
    video.play().catch(() => {
      // 忽略因浏览器策略拦截的自动播放
    })
  }
}

const handleMouseLeave = (id: string) => {
  const video = videoRefs.value[id]
  if (video) {
    video.pause()
    video.currentTime = 0
  }
}

const handleCardClick = (task: VideoGenerationTask) => {
  if (task.status === 'success' && task.videoUrl) {
    emit('select-video', task)
  }
}

const handleCopyPrompt = async (prompt: string) => {
  try {
    await navigator.clipboard.writeText(prompt)
    message.success('提示词已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

const handleDownloadVideo = async (task: VideoGenerationTask) => {
  if (!task.videoUrl) return
  try {
    const directUrl = resolveMediaUrl(task.videoUrl)
    const response = await fetch(directUrl)
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `video-${task.id.slice(0, 8)}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)
    message.success('视频下载成功')
  } catch (error) {
    window.open(resolveMediaUrl(task.videoUrl), '_blank')
  }
}
</script>

<style scoped lang="scss">
.video-gallery-container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 24px 100px;
  box-sizing: border-box;
}

/* 流光微质感动效 */
.shimmer-effect {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.04) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmer 2s infinite ease-in-out;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.08); opacity: 1; }
}

/* 瀑布流任务卡片列表 */
.video-masonry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
}

.video-task-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
  display: flex;
  flex-direction: column;

  &:hover {
    box-shadow: 0 12px 28px -4px rgba(15, 23, 42, 0.1);
    border-color: #cbd5e1;
  }

  &.is-failed {
    border-color: #fecaca;
    background: #fffafa;
  }

  &.is-processing {
    border-color: #c7d2fe;
    box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.15);
  }
}

.video-media-wrapper {
  position: relative;
  width: 100%;
  background: #020617;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &.aspect-16-9 {
    aspect-ratio: 16 / 9;
  }
  &.aspect-9-16 {
    aspect-ratio: 9 / 16;
    max-height: 480px;
  }
  &.aspect-1-1 {
    aspect-ratio: 1 / 1;
  }
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
}

.video-hover-scrim {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.35);
  opacity: 0;
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;

  .video-media-wrapper:hover & {
    opacity: 1;
  }
}

.play-indicator-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;

  .video-media-wrapper:hover & {
    transform: scale(1.08);
  }
}

.hover-tip-badge {
  font-size: 11px;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 8px;
  border-radius: 4px;
}

.media-corner-badge {
  position: absolute;
  font-size: 11px;
  font-family: monospace;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  backdrop-filter: blur(4px);

  &.top-left {
    top: 10px;
    left: 10px;
  }
  &.top-right {
    top: 10px;
    right: 10px;
  }
}

.processing-placeholder {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 220px;
  background: #0f172a;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #f8fafc;
  padding: 20px 16px;
  box-sizing: border-box;

  .breathing-ring {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.16);
    border: 1px solid rgba(99, 102, 241, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse-ring 2.4s infinite ease-in-out;

    .spinner-icon {
      font-size: 22px;
      color: #818cf8;
    }
  }

  .processing-title {
    position: relative;
    z-index: 2;
    font-size: 13.5px;
    font-weight: 500;
    color: #f1f5f9;
    font-family: monospace;
  }
  .processing-desc {
    position: relative;
    z-index: 2;
    font-size: 12px;
    color: #94a3b8;
    text-align: center;
  }
}

.failed-placeholder {
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: #fff5f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
  box-sizing: border-box;

  .failed-icon {
    font-size: 28px;
    color: #ef4444;
  }
  .failed-title {
    font-size: 14px;
    font-weight: 500;
    color: #b91c1c;
  }
  .failed-reason {
    font-size: 12px;
    color: #ef4444;
    text-align: center;
  }
  .failed-refund-tag {
    font-size: 11px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 4px;
  }
}

.task-info-bar {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.prompt-text-container {
  width: 100%;
  cursor: default;
}

.task-prompt {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 1.5;
  color: #0f172a;
  word-break: break-word;
}

.task-meta-and-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}

.meta-tags-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  font-family: monospace;

  &.model-tag {
    background: #eef2ff;
    color: #4f46e5;
  }

  &.cost-tag {
    background: #fef3c7;
    color: #b45309;
  }
}

.task-timestamp {
  font-size: 11px;
  color: #94a3b8;
}

.action-buttons-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s ease;

  &:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  &.danger-btn:hover {
    background: #fef2f2;
    color: #ef4444;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* 空状态 */
.empty-video-gallery {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px 40px;
  text-align: center;
}

.empty-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;

  .empty-icon {
    font-size: 28px;
    color: #6366f1;
  }
}

.empty-headline {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 8px 0;
}

.empty-subtext {
  font-size: 13.5px;
  color: #64748b;
  max-width: 520px;
  margin: 0 0 28px 0;
  line-height: 1.5;
}

.sample-prompts-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 720px;
  width: 100%;
}

.sample-title {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.prompts-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.sample-prompt-pill {
  padding: 6px 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
  transition: all 0.2s ease;

  &:hover {
    border-color: #6366f1;
    color: #4f46e5;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.08);
  }

  .pill-text {
    font-size: 12.5px;
    color: #334155;
  }
}
</style>
