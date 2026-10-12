<template>
  <div class="video-workbench-layout">
    <!-- 主体区域：左侧统一侧边栏 + 右侧视频画廊与悬浮控制台 -->
    <div class="video-main-container">
      <Sidebar
        :conversations="conversations"
        :current-conversation-id="currentConversationId"
        @new-chat="handleNewChatFromVideo"
        @select-conversation="handleSelectConversationFromVideo"
        @rename-conversation="handleRenameConversation"
        @delete-conversation="handleDeleteConversation"
      />

      <div class="video-workspace">
        <main ref="mainScrollRef" class="video-workbench-main">
          <VideoGallery
            :tasks="tasks"
            :is-generating="isGenerating"
            :generating-prompt="generatingPrompt"
            :generating-elapsed-seconds="generatingElapsedSeconds"
            :deleting-task-id="deletingTaskId"
            @reuse="handleReuseParams"
            @apply-prompt="handleApplyPrompt"
            @delete="handleDeleteTask"
            @select-video="handleSelectVideo"
          />
        </main>

        <footer class="video-workbench-footer">
          <VideoControlBar
            ref="controlBarRef"
            :loading="isGenerating"
            @submit="handleGenerate"
          />
        </footer>
      </div>
    </div>

    <!-- 沉浸式影院大屏播放弹窗框 -->
    <VideoPreviewModal
      v-model:open="previewModalOpen"
      :task="selectedPreviewTask"
      @reuse="handleReuseParams"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import Sidebar from '@/views/Chat/components/Sidebar.vue'
import VideoGallery from './components/VideoGallery.vue'
import VideoControlBar from './components/VideoControlBar.vue'
import VideoPreviewModal from './components/VideoPreviewModal.vue'
import {
  generateVideoApi,
  getVideoHistoryApi,
  getVideoStatusApi,
  deleteVideoTaskApi,
} from '@/api/video'
import { getCurrentUserAccount } from '@/api/user'
import { useAuthStore, useConversationStore } from '@/stores'
import type {
  VideoGenerationTask,
  CreateVideoGenerationParams,
} from '@/interface/video'

defineOptions({
  name: 'VideoWorkbenchPage',
})

const router = useRouter()
const authStore = useAuthStore()
const conversationStore = useConversationStore()
const { conversations, currentConversationId } = storeToRefs(conversationStore)

const controlBarRef = ref<InstanceType<typeof VideoControlBar> | null>(null)
const mainScrollRef = ref<HTMLElement | null>(null)

const tasks = ref<VideoGenerationTask[]>([])
const isGenerating = ref(false)
const generatingPrompt = ref('')
const generatingElapsedSeconds = ref(0)
const deletingTaskId = ref<string | null>(null)

const previewModalOpen = ref(false)
const selectedPreviewTask = ref<VideoGenerationTask | null>(null)

let timerId: ReturnType<typeof setInterval> | null = null
let pollerTimerId: ReturnType<typeof setInterval> | null = null

const scrollToTop = (smooth = true) => {
  if (mainScrollRef.value) {
    mainScrollRef.value.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }
}

const startTimer = () => {
  generatingElapsedSeconds.value = 0
  timerId = setInterval(() => {
    generatingElapsedSeconds.value += 1
  }, 1000)
}

const stopTimer = () => {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

/**
 * 刷新用户个人信息与积分快照
 */
const refreshUserProfile = async () => {
  try {
    const res = await getCurrentUserAccount()
    if (res.data?.user?.credits) {
      authStore.setUserCredits(res.data.user.credits)
    }
  } catch {
    // 忽略刷新失败
  }
}

/**
 * 加载历史视频记录
 */
const loadHistory = async () => {
  try {
    const res = await getVideoHistoryApi(1, 30)
    if (res.data?.list) {
      tasks.value = res.data.list
      checkAndStartPolling()
    }
  } catch {
    // 静默失败
  }
}

/**
 * 检查并启动未完结任务的轮询检查器
 */
const checkAndStartPolling = () => {
  const hasPending = tasks.value.some(
    (t) => t.status === 'pending' || t.status === 'processing',
  )
  if (!hasPending) {
    stopPolling()
    return
  }

  if (pollerTimerId) return

  pollerTimerId = setInterval(async () => {
    const pendingTasks = tasks.value.filter(
      (t) => t.status === 'pending' || t.status === 'processing',
    )
    if (pendingTasks.length === 0) {
      stopPolling()
      return
    }

    for (const pending of pendingTasks) {
      try {
        const res = await getVideoStatusApi(pending.id)
        if (res.data) {
          const { status, videoUrl, errorMessage, updatedAt } = res.data
          if (status !== pending.status) {
            pending.status = status
            pending.videoUrl = videoUrl
            pending.errorMessage = errorMessage
            pending.updatedAt = updatedAt

            if (status === 'success') {
              message.success(`视频《${pending.prompt.slice(0, 16)}...》生成完毕`)
              refreshUserProfile()
              if (isGenerating.value) {
                isGenerating.value = false
                stopTimer()
              }
            } else if (status === 'failed') {
              message.warn(`视频《${pending.prompt.slice(0, 16)}...》未能生成，已退还积分`)
              refreshUserProfile()
              if (isGenerating.value) {
                isGenerating.value = false
                stopTimer()
              }
            }
          }
        }
      } catch {
        // 单个轮询失败继续下一个
      }
    }
  }, 4000)
}

const stopPolling = () => {
  if (pollerTimerId) {
    clearInterval(pollerTimerId)
    pollerTimerId = null
  }
}

/**
 * 发起视频生成
 */
const handleGenerate = async (params: CreateVideoGenerationParams) => {
  const creditsNeeded = 200
  const remaining = authStore.userProfile?.credits?.remaining ?? 0
  const isAdmin = authStore.userProfile?.role === 'admin'

  if (!isAdmin && remaining < creditsNeeded) {
    message.warning(`积分不足，本次需要 ${creditsNeeded} 积分，当前剩余 ${remaining} 积分`)
    controlBarRef.value?.setFormValues({ prompt: params.prompt })
    return
  }

  isGenerating.value = true
  generatingPrompt.value = params.prompt
  startTimer()
  scrollToTop(true)
  nextTick(() => {
    scrollToTop(true)
  })

  try {
    const res = await generateVideoApi(params)
    if (res.data) {
      tasks.value.unshift(res.data)
      controlBarRef.value?.clearPrompt()
      nextTick(() => {
        scrollToTop(false)
      })
      message.success('视频任务已提交至上游万相模型，正在后台生成中')
      refreshUserProfile()
      checkAndStartPolling()
    }
  } catch (error: any) {
    const msg = error?.message || '视频任务提交失败'
    message.error(msg)
    isGenerating.value = false
    stopTimer()
  }
}

/**
 * 删除指定的视频记录
 */
const handleDeleteTask = async (taskId: string) => {
  deletingTaskId.value = taskId
  try {
    const res = await deleteVideoTaskApi(taskId)
    if (res.code === 200 || res.data?.success) {
      tasks.value = tasks.value.filter((t) => t.id !== taskId)
      message.success('视频记录及媒体资源已删除')
    }
  } catch (error: any) {
    message.error(error.message || '删除视频记录失败')
  } finally {
    deletingTaskId.value = null
  }
}

/**
 * 快捷复用参数
 */
const handleReuseParams = (task: VideoGenerationTask) => {
  controlBarRef.value?.setFormValues({
    prompt: task.prompt,
    image: task.imageUrl || undefined,
    aspect_ratio: task.aspectRatio,
  })
  message.info('已将视频提示词与参数回填至控制栏')
}

/**
 * 点击灵感词快捷填入
 */
const handleApplyPrompt = (prompt: string) => {
  controlBarRef.value?.setFormValues({ prompt })
}

/**
 * 预览视频
 */
const handleSelectVideo = (task: VideoGenerationTask) => {
  selectedPreviewTask.value = task
  previewModalOpen.value = true
}

const handleNewChatFromVideo = () => {
  conversationStore.createConversation()
  router.push('/chat')
}

const handleSelectConversationFromVideo = async (id: string) => {
  await conversationStore.selectConversation(id)
  router.push('/chat')
}

const handleRenameConversation = async (id: string, title: string) => {
  await conversationStore.updateConversationTitle(id, title)
}

const handleDeleteConversation = async (id: string) => {
  await conversationStore.deleteConversation(id)
}

onMounted(() => {
  const userId = authStore.userProfile?.id
  if (userId && conversations.value.length === 0) {
    conversationStore.initializeFromServer(userId)
  }
  loadHistory()
  refreshUserProfile()
})

onActivated(() => {
  refreshUserProfile()
  checkAndStartPolling()
})

onUnmounted(() => {
  stopTimer()
  stopPolling()
})
</script>

<style scoped lang="scss">
.video-workbench-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
}

.video-main-container {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.video-workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #f8fafc;
}

.video-workbench-main {
  flex: 1;
  overflow-y: auto;
  position: relative;
  scroll-behavior: smooth;
}

.video-workbench-footer {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(
    180deg,
    rgba(248, 250, 252, 0) 0%,
    rgba(248, 250, 252, 0.9) 30%,
    rgba(248, 250, 252, 1) 100%
  );
  pointer-events: none;
  z-index: 10;
}

.video-workbench-footer > * {
  pointer-events: auto;
}
</style>
