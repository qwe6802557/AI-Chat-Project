<template>
  <div class="image-workbench-layout">
    <!-- 顶部模式切换导航栏 -->
    <AppHeaderNav active-mode="image" />

    <!-- 主体区域：左侧纯净侧边栏 + 右侧画廊与悬浮控制台 -->
    <div class="image-main-container">
      <Sidebar
        :conversations="conversations"
        :current-conversation-id="currentConversationId"
        @new-chat="handleNewChatFromImage"
        @select-conversation="handleSelectConversationFromImage"
        @rename-conversation="handleRenameConversation"
        @delete-conversation="handleDeleteConversation"
      />

      <div class="image-workspace">
        <main ref="mainScrollRef" class="image-workbench-main">
          <ImageGallery
            :tasks="tasks"
            :is-generating="isGenerating"
            :generating-prompt="generatingPrompt"
            :generating-elapsed-seconds="generatingElapsedSeconds"
            @reuse="handleReuseParams"
            @apply-prompt="handleApplyPrompt"
          />
        </main>

        <footer class="image-workbench-footer">
          <ImageControlBar
            ref="controlBarRef"
            :loading="isGenerating"
            :unit-credit-cost="unitCreditCost"
            @submit="handleGenerate"
            @stop="handleStopGenerate"
          />
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import axios from 'axios'
import AppHeaderNav from '@/components/AppHeaderNav.vue'
import Sidebar from '@/views/Chat/components/Sidebar.vue'
import ImageGallery from './components/ImageGallery.vue'
import ImageControlBar from './components/ImageControlBar.vue'
import { generateImageApi, getImageHistoryApi } from '@/api/image'
import { getCurrentUserAccount } from '@/api/user'
import { useAuthStore, useConversationStore } from '@/stores'
import type {
  ImageGenerationTask,
  CreateImageGenerationParams,
} from '@/interface/image'

defineOptions({
  name: 'ImageWorkbenchPage',
})

const router = useRouter()
const authStore = useAuthStore()
const conversationStore = useConversationStore()
const { conversations, currentConversationId } = storeToRefs(conversationStore)
const controlBarRef = ref<InstanceType<typeof ImageControlBar> | null>(null)
const mainScrollRef = ref<HTMLElement | null>(null)

const tasks = ref<ImageGenerationTask[]>([])
const isGenerating = ref(false)
const generatingPrompt = ref('')
const generatingElapsedSeconds = ref(0)
const unitCreditCost = ref(100)

let timerId: ReturnType<typeof setInterval> | null = null
let activeAbortController: AbortController | null = null

/**
 * 中止当前图片生成请求
 */
const handleStopGenerate = () => {
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }
}

/**
 * 将画廊主视口平滑或即刻滚动置顶
 */
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

onUnmounted(() => {
  stopTimer()
  handleStopGenerate()
})

/**
 * 加载历史生图记录
 */
const loadHistory = async () => {
  try {
    const res = await getImageHistoryApi(1, 30)
    if (res.data?.items) {
      tasks.value = res.data.items
    }
  } catch {
    // 静默失败，保持空历史
  }
}

/**
 * 触发生成
 */
const handleGenerate = async (params: CreateImageGenerationParams) => {
  const creditsNeeded = (params.n || 1) * unitCreditCost.value
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

  activeAbortController = new AbortController()

  try {
    const res = await generateImageApi(params, { signal: activeAbortController.signal })
    if (res.data) {
      tasks.value.unshift(res.data)
      controlBarRef.value?.clearPrompt()
      nextTick(() => {
        scrollToTop(false)
      })
      message.success('图片生成成功')
    }
  } catch (error) {
    if (
      axios.isCancel(error) ||
      (error as Error)?.name === 'CanceledError' ||
      (error as Error)?.name === 'AbortError'
    ) {
      message.info('已中止图片生成')
    } else {
      const msg = error instanceof Error ? error.message : '生图请求失败'
      message.error(msg)
    }
  } finally {
    activeAbortController = null
    stopTimer()
    isGenerating.value = false
    refreshUserProfile()
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

const handleReuseParams = (task: ImageGenerationTask) => {
  controlBarRef.value?.setFormValues({
    prompt: task.prompt,
    model: task.modelId,
    aspect_ratio: task.aspectRatio,
    resolution: task.resolution,
    quality: task.quality,
  })
  message.info('已将历史提示词与参数回填至控制栏')
}

const handleApplyPrompt = (prompt: string) => {
  controlBarRef.value?.setFormValues({ prompt })
}

const handleNewChatFromImage = () => {
  conversationStore.createConversation()
  router.push('/chat')
}

const handleSelectConversationFromImage = async (id: string) => {
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

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.image-workbench-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #f8fafc;
  overflow: hidden;
}

.image-main-container {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.image-workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #f8fafc;
}

.image-workbench-main {
  flex: 1;
  overflow-y: auto;
  position: relative;
  scroll-behavior: smooth;
}

.image-workbench-footer {
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

.image-workbench-footer > * {
  pointer-events: auto;
}
</style>
