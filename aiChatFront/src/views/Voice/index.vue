<template>
  <div class="voice-workbench-layout">
    <!-- 顶部统一模式切换导航栏 -->
    <AppHeaderNav active-mode="voice" />

    <!-- 主体区域：左侧共享侧边栏 + 右侧语音瀑布流与悬浮控制台 -->
    <div class="voice-main-container">
      <Sidebar
        :conversations="conversations"
        :current-conversation-id="currentConversationId"
        @new-chat="handleNewChatFromVoice"
        @select-conversation="handleSelectConversationFromVoice"
        @rename-conversation="handleRenameConversation"
        @delete-conversation="handleDeleteConversation"
      />

      <div class="voice-workspace">
        <main ref="mainScrollRef" class="voice-workbench-main">
          <VoiceTaskStream
            :tasks="tasks"
            :is-generating="isGenerating"
            :generating-type="generatingType"
            :generating-elapsed-seconds="generatingElapsedSeconds"
            :current-filter="currentFilter"
            @filter-change="currentFilter = $event"
            @reuse="handleReuseParams"
            @apply-prompt="handleApplyPrompt"
          />
        </main>

        <footer class="voice-workbench-footer">
          <VoiceControlBar
            ref="controlBarRef"
            :loading="isGenerating"
            :unit-cost="20"
            :voices="voices"
            @submit-tts="handleGenerateTts"
            @submit-stt="handleTranscribeStt"
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
import VoiceTaskStream from './components/VoiceTaskStream.vue'
import VoiceControlBar from './components/VoiceControlBar.vue'
import {
  getVoicesApi,
  generateTtsApi,
  transcribeSttApi,
  getVoiceHistoryApi,
} from '@/api/voice'
import { getCurrentUserAccount } from '@/api/user'
import { useAuthStore, useConversationStore } from '@/stores'
import type { VoiceTask, VoiceInfo, CreateTtsParams } from '@/interface/voice'

defineOptions({
  name: 'VoiceWorkbenchPage',
})

const router = useRouter()
const authStore = useAuthStore()
const conversationStore = useConversationStore()
const { conversations, currentConversationId } = storeToRefs(conversationStore)

const controlBarRef = ref<InstanceType<typeof VoiceControlBar> | null>(null)
const mainScrollRef = ref<HTMLElement | null>(null)

const tasks = ref<VoiceTask[]>([])
const voices = ref<VoiceInfo[]>([])
const isGenerating = ref(false)
const generatingType = ref<'tts' | 'stt'>('tts')
const generatingElapsedSeconds = ref(0)
const currentFilter = ref<'all' | 'tts' | 'stt'>('all')

let timerId: ReturnType<typeof setInterval> | null = null
let activeAbortController: AbortController | null = null

/**
 * 中止当前生成请求
 */
const handleStopGenerate = () => {
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }
}

/**
 * 滚动置顶
 */
const scrollToTop = (smooth = true) => {
  if (mainScrollRef.value) {
    mainScrollRef.value.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }
}

/**
 * 同步用户最新积分余额
 */
const syncUserCredits = async () => {
  try {
    const res = await getCurrentUserAccount()
    if (res.data?.user?.credits) {
      authStore.setUserCredits(res.data.user.credits)
    }
  } catch {
    // 静默失败
  }
}

/**
 * 拉取音色列表
 */
const fetchVoices = async () => {
  try {
    const res = await getVoicesApi()
    if (res.data?.voices && res.data.voices.length > 0) {
      voices.value = res.data.voices
    }
  } catch (err) {
    console.warn('获取音色失败，使用默认音色', err)
  }
}

/**
 * 拉取历史任务列表
 */
const fetchHistory = async () => {
  try {
    const res = await getVoiceHistoryApi({ page: 1, pageSize: 50 })
    if (res.data?.items) {
      tasks.value = res.data.items
    }
  } catch (err) {
    console.warn('拉取语音历史记录失败', err)
  }
}

/**
 * 处理提交 TTS 任务
 */
const handleGenerateTts = async (params: CreateTtsParams) => {
  if (isGenerating.value) return

  isGenerating.value = true
  generatingType.value = 'tts'
  generatingElapsedSeconds.value = 0

  timerId = setInterval(() => {
    generatingElapsedSeconds.value++
  }, 1000)

  activeAbortController = new AbortController()

  try {
    const res = await generateTtsApi(params, {
      signal: activeAbortController.signal,
    })

    if (res.data) {
      tasks.value.unshift(res.data)
      message.success('语音合成成功！')
      await syncUserCredits()
      await nextTick()
      scrollToTop(true)
    }
  } catch (error: any) {
    if (axios.isCancel(error) || error?.name === 'CanceledError') {
      message.info('已取消语音合成任务')
    } else {
      const errMsg =
        error?.response?.data?.message || error?.message || '语音合成失败，请稍后重试'
      message.error(errMsg)
    }
    await syncUserCredits()
    await fetchHistory()
  } finally {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
    isGenerating.value = false
    activeAbortController = null
  }
}

/**
 * 处理提交 STT 任务
 */
const handleTranscribeStt = async (payload: {
  file: File | Blob
  language: string
  model: string
}) => {
  if (isGenerating.value) return

  isGenerating.value = true
  generatingType.value = 'stt'
  generatingElapsedSeconds.value = 0

  timerId = setInterval(() => {
    generatingElapsedSeconds.value++
  }, 1000)

  activeAbortController = new AbortController()

  try {
    const formData = new FormData()
    formData.append('file', payload.file)
    formData.append('language', payload.language)
    formData.append('model', payload.model)

    const res = await transcribeSttApi(formData, {
      signal: activeAbortController.signal,
    })

    if (res.data) {
      tasks.value.unshift(res.data)
      message.success('语音识别转写完成！')
      await syncUserCredits()
      await nextTick()
      scrollToTop(true)
    }
  } catch (error: any) {
    if (axios.isCancel(error) || error?.name === 'CanceledError') {
      message.info('已取消语音转写任务')
    } else {
      const errMsg =
        error?.response?.data?.message || error?.message || '语音识别失败，请稍后重试'
      message.error(errMsg)
    }
    await syncUserCredits()
    await fetchHistory()
  } finally {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
    isGenerating.value = false
    activeAbortController = null
  }
}

/**
 * 复用已有任务参数
 */
const handleReuseParams = (task: VoiceTask) => {
  if (task.type === 'tts' && controlBarRef.value) {
    controlBarRef.value.setTtsParams({
      text: task.text,
      voiceId: task.voiceId || 'eve',
      speed: task.speed || 1.0,
      language: task.language || 'zh',
      model: task.model,
    })
    message.success('已填入该条任务的配置参数')
  }
}

/**
 * 应用快捷预设提示词
 */
const handleApplyPrompt = (prompt: string) => {
  if (controlBarRef.value) {
    controlBarRef.value.setTtsParams({ text: prompt })
  }
}

// 侧边栏联动
const handleNewChatFromVoice = () => {
  conversationStore.createConversation()
  router.push('/chat')
}

const handleSelectConversationFromVoice = async (id: string) => {
  await conversationStore.selectConversation(id)
  router.push('/chat')
}

const handleRenameConversation = async (id: string, title: string) => {
  await conversationStore.updateConversationTitle(id, title)
}

const handleDeleteConversation = async (id: string) => {
  await conversationStore.deleteConversation(id)
}

onMounted(async () => {
  const userId = authStore.userProfile?.id
  if (userId && conversations.value.length === 0) {
    conversationStore.initializeFromServer(userId)
  }
  await Promise.all([fetchVoices(), fetchHistory(), syncUserCredits()])
})

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
  if (activeAbortController) activeAbortController.abort()
})
</script>

<style scoped lang="scss">
.voice-workbench-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #f8fafc;
}

.voice-main-container {
  display: flex;
  flex: 1;
  width: 100%;
  height: calc(100vh - 60px);
  overflow: hidden;
  position: relative;
}

.voice-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  position: relative;
  overflow: hidden;

  .voice-workbench-main {
    flex: 1;
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .voice-workbench-footer {
    flex-shrink: 0;
    width: 100%;
    background: transparent;
    pointer-events: auto;
  }
}
</style>
