<template>
  <div class="voice-workbench-layout">
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
            @model-change="handleModelChange"
            @stop="handleStopGenerate"
          />
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import axios from 'axios'
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

// 默认内置音色字典（确保在离线或弱网下组件挂载即立即可选）
const DEFAULT_FALLBACK_VOICES: VoiceInfo[] = [
  // 中文普通话 (精品)
  { voice_id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女声·温柔亲切)', language: 'zh-CN', category: '中文普通话 (精品)' },
  { voice_id: 'zh-CN-YunxiNeural', name: '云希 (男声·阳光沉稳)', language: 'zh-CN', category: '中文普通话 (精品)' },
  { voice_id: 'zh-CN-YunjianNeural', name: '云健 (男声·深沉浑厚)', language: 'zh-CN', category: '中文普通话 (精品)' },
  { voice_id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女声·活泼生活)', language: 'zh-CN', category: '中文普通话 (精品)' },
  { voice_id: 'zh-CN-YunyangNeural', name: '云扬 (男声·专业严肃)', language: 'zh-CN', category: '中文普通话 (精品)' },
  { voice_id: 'zh-CN-YunxiaNeural', name: '云夏 (男声·清澈少年)', language: 'zh-CN', category: '中文普通话 (精品)' },

  // 中文方言 / 地方语言
  { voice_id: 'zh-CN-liaoning-XiaobeiNeural', name: '晓北 (辽宁女声·幽默风趣)', language: 'zh-CN-liaoning', category: '中文方言 / 地方语言' },
  { voice_id: 'zh-CN-shaanxi-XiaoniNeural', name: '晓妮 (陕西女声·质朴地道)', language: 'zh-CN-shaanxi', category: '中文方言 / 地方语言' },
  { voice_id: 'zh-HK-HiuMaanNeural', name: '晓曼 (粤语女声·纯正自然)', language: 'zh-HK', category: '中文方言 / 地方语言' },
  { voice_id: 'zh-HK-HiuGaaiNeural', name: '晓佳 (粤语女声·亲和日常)', language: 'zh-HK', category: '中文方言 / 地方语言' },
  { voice_id: 'zh-HK-WanLungNeural', name: '云龙 (粤语男声·沉稳儒雅)', language: 'zh-HK', category: '中文方言 / 地方语言' },
  { voice_id: 'zh-TW-HsiaoChenNeural', name: '晓臻 (台湾国语·温柔清新)', language: 'zh-TW', category: '中文方言 / 地方语言' },
  { voice_id: 'zh-TW-HsiaoYuNeural', name: '晓雨 (台湾国语·知性亲切)', language: 'zh-TW', category: '中文方言 / 地方语言' },
  { voice_id: 'zh-TW-YunJheNeural', name: '云哲 (台湾男声·知性自然)', language: 'zh-TW', category: '中文方言 / 地方语言' },

  // 国际多语种 (支持中英文跨语言)
  { voice_id: 'en-US-AvaMultilingualNeural', name: 'Ava (美式女声·多语种支持)', language: 'en-US', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'en-US-AndrewMultilingualNeural', name: 'Andrew (美式男声·多语种支持)', language: 'en-US', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'en-US-EmmaMultilingualNeural', name: 'Emma (美式女声·自然亲和)', language: 'en-US', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'en-US-BrianMultilingualNeural', name: 'Brian (美式男声·随和自然)', language: 'en-US', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'de-DE-SeraphinaMultilingualNeural', name: 'Seraphina (德文女声·多语种支持)', language: 'de-DE', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'de-DE-FlorianMultilingualNeural', name: 'Florian (德文男声·多语种支持)', language: 'de-DE', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'fr-FR-VivienneMultilingualNeural', name: 'Vivienne (法文女声·多语种支持)', language: 'fr-FR', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'fr-FR-RemyMultilingualNeural', name: 'Remy (法文男声·多语种支持)', language: 'fr-FR', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'ko-KR-HyunsuMultilingualNeural', name: 'Hyunsu (韩文男声·多语种支持)', language: 'ko-KR', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'it-IT-GiuseppeMultilingualNeural', name: 'Giuseppe (意文男声·多语种支持)', language: 'it-IT', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'ja-JP-NanamiNeural', name: '七海 (日文女声·Nanami)', language: 'ja-JP', category: '国际多语种 (支持中英文跨语言)' },
  { voice_id: 'ja-JP-KeitaNeural', name: '圭太 (日文男声·Keita)', language: 'ja-JP', category: '国际多语种 (支持中英文跨语言)' },

  // 纯正外语 (建议输入对应语种)
  { voice_id: 'en-US-JennyNeural', name: 'Jenny (美式女声·纯正英文)', language: 'en-US', category: '纯正外语 (建议输入对应语种)' },
  { voice_id: 'en-US-GuyNeural', name: 'Guy (美式男声·纯正英文)', language: 'en-US', gender: 'Male', category: '纯正外语 (建议输入对应语种)' },
  { voice_id: 'en-GB-SoniaNeural', name: 'Sonia (英式女声·纯正英伦)', language: 'en-GB', category: '纯正外语 (建议输入对应语种)' },
  { voice_id: 'ko-KR-SunHiNeural', name: '善姬 (韩文女声·标准韩语)', language: 'ko-KR', category: '纯正外语 (建议输入对应语种)' },
  { voice_id: 'ru-RU-SvetlanaNeural', name: 'Svetlana (俄文女声·流畅纯正)', language: 'ru-RU', category: '纯正外语 (建议输入对应语种)' },
]

const DEFAULT_XFYUN_VOICES: VoiceInfo[] = [
  { voice_id: 'x4_xiaoyan', name: '小燕 (女声·标准普通话·亲切甜美)', language: 'zh-CN', gender: 'Female', category: '科大讯飞高保真' },
  { voice_id: 'x4_yezi', name: '小露 (女声·知性主播·温和自然)', language: 'zh-CN', gender: 'Female', category: '科大讯飞高保真' },
  { voice_id: 'aisjiuxu', name: '许久 (男声·磁性低沉·沉稳儒雅)', language: 'zh-CN', gender: 'Male', category: '科大讯飞高保真' },
  { voice_id: 'aisjinger', name: '小婧 (女声·亲和助理·灵动清脆)', language: 'zh-CN', gender: 'Female', category: '科大讯飞高保真' },
  { voice_id: 'aisbabyxu', name: '许小宝 (童声·天真活泼·可爱萌系)', language: 'zh-CN', gender: 'Child', category: '科大讯飞高保真' },
]

const voices = ref<VoiceInfo[]>([...DEFAULT_FALLBACK_VOICES])
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
const fetchVoices = async (model = 'edge-tts') => {
  try {
    const res = await getVoicesApi(model)
    if (res.data?.voices && res.data.voices.length > 0) {
      voices.value = res.data.voices
      return
    }
  } catch (err) {
    console.warn('获取音色失败，自动使用默认保底音色', err)
  }
  if (!voices.value || voices.value.length === 0 || model === 'xfyun-tts') {
    voices.value = model === 'xfyun-tts' ? [...DEFAULT_XFYUN_VOICES] : [...DEFAULT_FALLBACK_VOICES]
  }
}

const handleModelChange = (model: string) => {
  fetchVoices(model)
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

onActivated(() => {
  syncUserCredits()
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
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #f8fafc;
}

.voice-main-container {
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
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
