<template>
  <div class="voice-control-bar-container">
    <div class="control-bar-card">
      <!-- 顶部模式切换与积分状态行 -->
      <div class="mode-header-row">
        <div class="mode-capsules">
          <button
            type="button"
            class="mode-pill-btn capsule-btn"
            :class="{ active: currentMode === 'tts' }"
            @click="currentMode = 'tts'"
          >
            <SoundOutlined class="pill-icon" />
            <span>合成语音 (TTS)</span>
          </button>
          <button
            type="button"
            class="mode-pill-btn capsule-btn"
            :class="{ active: currentMode === 'stt' }"
            @click="currentMode = 'stt'"
          >
            <AudioOutlined class="pill-icon" />
            <span>识别语音 (STT)</span>
          </button>
        </div>

        <div class="header-right-hint">
          <span class="cost-estimate">
            <ThunderboltFilled class="cost-icon" />
            每次消耗 {{ props.unitCost }} 积分 (失败返还)
          </span>
        </div>
      </div>

      <!-- TTS 模式：输入行 + 胶囊参数行 -->
      <template v-if="currentMode === 'tts'">
        <div class="input-row">
          <textarea
            ref="textareaRef"
            v-model="ttsText"
            class="voice-textarea"
            placeholder="输入要合成语音的文本内容（支持中英文，最长 2000 字）..."
            :rows="2"
            :maxlength="2000"
            :disabled="props.loading"
            @keydown.enter.prevent="handleTtsEnter"
          />
          <button
            type="button"
            :class="['submit-btn', { active: canSubmitTts || props.loading, 'stop-mode': props.loading, 'stop-btn': props.loading }]"
            :disabled="!canSubmitTts && !props.loading"
            :title="props.loading ? '停止生成' : (canSubmitTts ? '合成语音 (Enter)' : '请输入文本内容')"
            @click="handleTtsButtonClick"
          >
            <span v-if="props.loading" class="stop-square-icon" aria-hidden="true"></span>
            <ArrowUpOutlined v-else class="btn-icon" />
          </button>
        </div>

        <div class="params-row">
          <div class="params-left">
            <!-- 音色选择 -->
            <div class="param-capsule voice-select-wrapper">
              <SoundOutlined class="param-capsule-icon voice-icon" />
              <a-select
                v-model:value="ttsVoiceId"
                size="small"
                class="param-select voice-select"
                :bordered="false"
                :dropdown-match-select-width="180"
                :disabled="props.loading"
              >
                <a-select-option
                  v-for="v in props.voices"
                  :key="v.voice_id"
                  :value="v.voice_id"
                >
                  {{ v.name }}
                </a-select-option>
              </a-select>
            </div>

            <!-- 语速选择 -->
            <div class="param-capsule">
              <a-select
                v-model:value="ttsSpeed"
                size="small"
                class="param-select speed-select"
                :bordered="false"
                :dropdown-match-select-width="false"
                :disabled="props.loading"
              >
                <a-select-option :value="0.75">0.75x</a-select-option>
                <a-select-option :value="1.0">1.0x</a-select-option>
                <a-select-option :value="1.25">1.25x</a-select-option>
                <a-select-option :value="1.5">1.5x</a-select-option>
              </a-select>
            </div>

            <!-- 语言选择 -->
            <div class="param-capsule">
              <a-select
                v-model:value="ttsLanguage"
                size="small"
                class="param-select lang-select"
                :bordered="false"
                :dropdown-match-select-width="false"
                :disabled="props.loading"
              >
                <a-select-option value="zh">中文</a-select-option>
                <a-select-option value="en">English</a-select-option>
              </a-select>
            </div>

            <!-- 模型选择 -->
            <div class="param-capsule model-select-wrapper">
              <ThunderboltOutlined class="param-capsule-icon" />
              <a-select
                v-model:value="ttsModel"
                size="small"
                class="param-select model-select"
                :bordered="false"
                :dropdown-match-select-width="220"
                :disabled="props.loading"
              >
                <a-select-option value="grok-voice-think-fast-1.0">grok-voice-think-fast-1.0</a-select-option>
                <a-select-option value="grok-voice-think-fast-2.0">grok-voice-think-fast-2.0</a-select-option>
                <a-select-option value="grok-voice-latest">grok-voice-latest</a-select-option>
              </a-select>
            </div>
          </div>

          <div class="params-right">
            <span class="char-count-text">{{ ttsText.length }}/2000</span>
          </div>
        </div>
      </template>

      <!-- STT 模式：录音/上传展示区 + 参数行 -->
      <template v-else>
        <div class="stt-content-row stt-panel">
          <!-- 麦克风录音子区域 -->
          <div v-if="sttMethod === 'record'" class="record-area">
            <div v-if="!isRecording && !recordedBlob" class="record-idle">
              <button type="button" class="mic-round-btn mic-circle-btn" @click="startRecording" :disabled="props.loading">
                <AudioOutlined />
              </button>
              <span class="record-hint">点击麦克风开始录音</span>
            </div>

            <div v-else-if="isRecording" class="record-active">
              <span class="pulse-indicator"></span>
              <button type="button" class="mic-stop-btn" @click="stopRecording">
                <span class="stop-box"></span>
              </button>
              <div class="record-active-meta">
                <span class="live-timer">录音中 · {{ formatRecordingTime(recordingElapsed) }}</span>
                <span class="click-stop-hint">点击红色按钮完成录制</span>
              </div>
            </div>

            <div v-else-if="recordedBlob" class="record-preview">
              <audio :src="recordedBlobUrl" controls class="stt-preview-audio" />
              <button type="button" class="re-record-pill" @click="resetRecording" :disabled="props.loading">
                <ReloadOutlined />
                <span>重录</span>
              </button>
            </div>
          </div>

          <!-- 本地文件上传子区域 -->
          <div v-else class="upload-area">
            <input
              ref="fileInputRef"
              type="file"
              accept="audio/mp3,audio/wav,audio/m4a,audio/webm,audio/ogg,.mp3,.wav,.m4a,.webm,.ogg"
              class="hidden-file-input"
              @change="onFileChange"
            />

            <div
              v-if="!selectedFile"
              class="file-drop-card"
              @click="triggerFileSelect"
              @dragover.prevent
              @drop.prevent="onFileDrop"
            >
              <InboxOutlined class="upload-icon" />
              <span class="upload-main-text">点击或将音频文件拖拽至此处</span>
              <span class="upload-sub-text">支持 MP3、WAV、M4A、WEBM 等格式，单个文件不超过 50MB</span>
            </div>

            <div v-else class="file-chosen-pill">
              <FileDoneOutlined class="file-icon" />
              <span class="file-name">{{ selectedFile.name }}</span>
              <span class="file-size">({{ formatFileSize(selectedFile.size) }})</span>
              <button type="button" class="remove-file-btn" @click="selectedFile = null" :disabled="props.loading">
                ×
              </button>
            </div>
          </div>

          <!-- STT 发送按钮 -->
          <button
            type="button"
            :class="['submit-btn', { active: canSubmitStt || props.loading, 'stop-mode': props.loading, 'stop-btn': props.loading }]"
            :disabled="!canSubmitStt && !props.loading"
            :title="props.loading ? '停止转写' : (canSubmitStt ? '开始识别转写' : '请录音或上传音频')"
            @click="handleSttButtonClick"
          >
            <span v-if="props.loading" class="stop-square-icon" aria-hidden="true"></span>
            <ArrowUpOutlined v-else class="btn-icon" />
          </button>
        </div>

        <div class="params-row">
          <div class="params-left">
            <!-- 录音 / 上传方式胶囊 -->
            <div class="param-capsule action-capsule">
              <button
                type="button"
                class="capsule-sub-btn"
                :class="{ selected: sttMethod === 'record' }"
                @click="sttMethod = 'record'"
              >
                <AudioOutlined />
                <span>录音</span>
              </button>
              <button
                type="button"
                class="capsule-sub-btn"
                :class="{ selected: sttMethod === 'upload' }"
                @click="sttMethod = 'upload'"
              >
                <UploadOutlined />
                <span>上传</span>
              </button>
            </div>

            <!-- 识别语言 -->
            <div class="param-capsule">
              <a-select
                v-model:value="sttLanguage"
                size="small"
                class="param-select lang-select"
                :bordered="false"
                :dropdown-match-select-width="false"
                :disabled="props.loading"
              >
                <a-select-option value="zh">中文</a-select-option>
                <a-select-option value="en">English</a-select-option>
              </a-select>
            </div>

            <!-- 识别模型 -->
            <div class="param-capsule model-select-wrapper">
              <ThunderboltOutlined class="param-capsule-icon" />
              <span class="stt-model-name">grok-stt</span>
            </div>
          </div>

          <div class="params-right">
            <span class="stt-status-label">{{ sttMethod === 'record' ? '麦克风模式' : '文件模式' }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  SoundOutlined,
  AudioOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
  ArrowUpOutlined,
  UploadOutlined,
  InboxOutlined,
  FileDoneOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { VoiceInfo, CreateTtsParams } from '@/interface/voice'

defineOptions({
  name: 'VoiceControlBar',
})

const props = withDefaults(
  defineProps<{
    loading?: boolean
    unitCost?: number
    voices: VoiceInfo[]
    initialVoiceId?: string
  }>(),
  {
    loading: false,
    unitCost: 20,
    initialVoiceId: 'eve',
  },
)

const emit = defineEmits<{
  'submit-tts': [params: CreateTtsParams]
  'submit-stt': [payload: { file: File | Blob; language: string; model: string }]
  'stop': []
}>()

const currentMode = ref<'tts' | 'stt'>('tts')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// TTS 状态
const ttsText = ref('')
const ttsVoiceId = ref(props.initialVoiceId || 'eve')
const ttsSpeed = ref(1.0)
const ttsLanguage = ref('zh')
const ttsModel = ref('grok-voice-think-fast-1.0')

// STT 状态
const sttMethod = ref<'record' | 'upload'>('record')
const sttLanguage = ref('zh')
const sttModel = ref('grok-stt')
const selectedFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 录音状态
const isRecording = ref(false)
const recordingElapsed = ref(0)
const recordedBlob = ref<Blob | null>(null)
const recordedBlobUrl = ref<string>('')
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let recordTimer: ReturnType<typeof setInterval> | null = null

const canSubmitTts = computed(() => {
  return ttsText.value.trim().length > 0 && !!ttsVoiceId.value && !props.loading
})

const canSubmitStt = computed(() => {
  if (props.loading) return false
  if (sttMethod.value === 'record') {
    return !!recordedBlob.value
  }
  return !!selectedFile.value
})

const handleTtsEnter = () => {
  if (canSubmitTts.value) {
    handleTtsSubmit()
  }
}

const handleTtsButtonClick = () => {
  if (props.loading) {
    emit('stop')
  } else if (canSubmitTts.value) {
    handleTtsSubmit()
  }
}

const handleTtsSubmit = () => {
  const text = ttsText.value.trim()
  ttsText.value = ''
  emit('submit-tts', {
    text,
    voiceId: ttsVoiceId.value,
    speed: ttsSpeed.value,
    language: ttsLanguage.value,
    model: ttsModel.value,
  })
}

const handleSttButtonClick = () => {
  if (props.loading) {
    emit('stop')
    return
  }
  if (!canSubmitStt.value) return

  let audioData: File | Blob | null = null
  if (sttMethod.value === 'record' && recordedBlob.value) {
    audioData = new File([recordedBlob.value], `record_${Date.now()}.webm`, {
      type: 'audio/webm',
    })
    resetRecording()
  } else if (sttMethod.value === 'upload' && selectedFile.value) {
    audioData = selectedFile.value
    selectedFile.value = null
  }

  if (!audioData) return

  emit('submit-stt', {
    file: audioData,
    language: sttLanguage.value,
    model: sttModel.value,
  })
}

// 触发文件选择
const triggerFileSelect = () => {
  fileInputRef.value?.click()
}

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    validateAndSetFile(target.files[0])
  }
}

const onFileDrop = (e: DragEvent) => {
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    validateAndSetFile(e.dataTransfer.files[0])
  }
}

const validateAndSetFile = (file: File) => {
  if (file.size > 50 * 1024 * 1024) {
    message.error('音频文件大小不能超过 50MB')
    return
  }
  selectedFile.value = file
}

// 麦克风录音逻辑
const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []
    mediaRecorder = new MediaRecorder(stream)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' })
      recordedBlob.value = blob
      if (recordedBlobUrl.value) {
        URL.revokeObjectURL(recordedBlobUrl.value)
      }
      recordedBlobUrl.value = URL.createObjectURL(blob)
      stream.getTracks().forEach((track) => track.stop())
    }

    mediaRecorder.start(200)
    isRecording.value = true
    recordingElapsed.value = 0
    recordTimer = setInterval(() => {
      recordingElapsed.value++
    }, 1000)
  } catch (err) {
    message.error('无法启用麦克风，请检查浏览器录音权限设置')
    console.error(err)
  }
}

const stopRecording = () => {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
    isRecording.value = false
    if (recordTimer) {
      clearInterval(recordTimer)
      recordTimer = null
    }
  }
}

const resetRecording = () => {
  if (recordedBlobUrl.value) {
    URL.revokeObjectURL(recordedBlobUrl.value)
    recordedBlobUrl.value = ''
  }
  recordedBlob.value = null
  isRecording.value = false
  recordingElapsed.value = 0
}

const formatRecordingTime = (sec: number): string => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const setTtsParams = (params: Partial<CreateTtsParams>) => {
  currentMode.value = 'tts'
  if (params.text) ttsText.value = params.text
  if (params.voiceId) ttsVoiceId.value = params.voiceId
  if (params.speed) ttsSpeed.value = params.speed
  if (params.language) ttsLanguage.value = params.language
  if (params.model) ttsModel.value = params.model
}

const clearText = () => {
  ttsText.value = ''
}

defineExpose({
  setTtsParams,
  clearText,
})

watch(
  () => props.voices,
  (newVoices) => {
    if (newVoices && newVoices.length > 0 && !ttsVoiceId.value) {
      ttsVoiceId.value = newVoices[0]?.voice_id || 'eve'
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (recordTimer) clearInterval(recordTimer)
  if (recordedBlobUrl.value) URL.revokeObjectURL(recordedBlobUrl.value)
})
</script>

<style scoped lang="scss">
.voice-control-bar-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 12px 24px 20px;
}

.control-bar-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-bar-card:focus-within {
  border-color: #1890ff;
  box-shadow: 0 8px 28px rgba(24, 144, 255, 0.12);
}

.mode-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid #f2f3f5;

  .mode-capsules {
    display: inline-flex;
    gap: 4px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 2px;

    .mode-pill-btn {
      border: none;
      background: transparent;
      border-radius: 6px;
      padding: 4px 10px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s ease;

      .pill-icon {
        font-size: 13px;
      }

      &:hover {
        color: #1890ff;
      }

      &.active {
        background: #ffffff;
        color: #1890ff;
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }
  }

  .header-right-hint {
    display: flex;
    align-items: center;

    .cost-estimate {
      font-size: 12px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;

      .cost-icon {
        color: #faad14;
        font-size: 13px;
      }
    }
  }
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.voice-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2329;
  font-family: inherit;
  background: transparent;

  &::placeholder {
    color: #8c929a;
  }
}

.submit-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #e4e7ed;
  color: #8c929a;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &.active {
    background: #1890ff;
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.35);

    &:hover {
      background: #40a9ff;
      transform: translateY(-1px);
    }
  }

  &.stop-mode {
    background: #18181b;
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: #ef4444;
      box-shadow: 0 2px 12px rgba(239, 68, 68, 0.45);
      transform: scale(1.05);
    }

    .stop-square-icon {
      display: inline-block;
      width: 10px;
      height: 10px;
      background: #ffffff;
      border-radius: 2px;
    }
  }

  .btn-icon {
    font-size: 16px;
  }
}

.params-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid #f2f3f5;
  gap: 8px;
}

.params-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.param-capsule {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 2px 8px;
  transition: all 0.2s ease;

  &:hover {
    border-color: #cbd5e1;
    background: #f1f5f9;
  }

  .param-capsule-icon {
    color: #faad14;
    font-size: 13px;

    &.voice-icon {
      color: #1890ff;
    }
  }
}

.param-select {
  font-size: 12px;
  font-weight: 500;
  color: #334155;

  :deep(.ant-select-selector) {
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    font-size: 12px;
  }
}

.voice-select {
  min-width: 80px;
  max-width: 130px;
}

.speed-select {
  width: 48px;
}

.lang-select {
  width: 58px;
}

.model-select {
  min-width: 160px;
  max-width: 210px;
}

.stt-model-name {
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  font-family: inherit;
}

.params-right {
  display: flex;
  align-items: center;

  .char-count-text,
  .stt-status-label {
    font-size: 11px;
    color: #94a3b8;
  }
}

.stt-content-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
}

.record-area {
  flex: 1;
  display: flex;
  align-items: center;

  .record-idle {
    display: flex;
    align-items: center;
    gap: 10px;

    .mic-round-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #1890ff;
      color: #ffffff;
      border: none;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
      transition: all 0.2s;

      &:hover {
        background: #40a9ff;
        transform: scale(1.05);
      }
    }

    .record-hint {
      font-size: 13px;
      color: #64748b;
    }
  }

  .record-active {
    display: flex;
    align-items: center;
    gap: 12px;

    .mic-stop-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #ef4444;
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.35);

      .stop-box {
        width: 12px;
        height: 12px;
        background: #ffffff;
        border-radius: 2px;
      }
    }

    .record-active-meta {
      display: flex;
      flex-direction: column;

      .live-timer {
        font-size: 13px;
        font-weight: 600;
        color: #ef4444;
      }

      .click-stop-hint {
        font-size: 11px;
        color: #94a3b8;
      }
    }
  }

  .record-preview {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;

    .stt-preview-audio {
      flex: 1;
      max-width: 360px;
      height: 34px;
    }

    .re-record-pill {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;

      &:hover {
        border-color: #1890ff;
        color: #1890ff;
      }
    }
  }
}

.upload-area {
  flex: 1;

  .hidden-file-input {
    display: none;
  }

  .file-drop-card {
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 10px 14px;
    background: #f8fafc;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #1890ff;
      background: #f0f7ff;
    }

    .upload-icon {
      font-size: 18px;
      color: #1890ff;
    }

    .upload-main-text {
      font-size: 13px;
      font-weight: 500;
      color: #334155;
    }

    .upload-sub-text {
      font-size: 11px;
      color: #94a3b8;
    }
  }

  .file-chosen-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f0f7ff;
    border: 1px solid #bae0ff;
    border-radius: 8px;
    padding: 6px 12px;

    .file-icon {
      color: #1890ff;
      font-size: 14px;
    }

    .file-name {
      font-size: 13px;
      font-weight: 500;
      color: #0958d9;
    }

    .file-size {
      font-size: 11px;
      color: #8c8c8c;
    }

    .remove-file-btn {
      background: transparent;
      border: none;
      font-size: 16px;
      line-height: 1;
      color: #8c8c8c;
      cursor: pointer;
      padding: 0 2px;

      &:hover {
        color: #ff4d4f;
      }
    }
  }
}

.action-capsule {
  padding: 2px 4px;
  gap: 2px;

  .capsule-sub-btn {
    border: none;
    background: transparent;
    border-radius: 6px;
    padding: 2px 8px;
    font-size: 11px;
    color: #64748b;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;

    &:hover {
      color: #1890ff;
    }

    &.selected {
      background: #ffffff;
      color: #1890ff;
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }
  }
}
</style>
