<template>
  <div class="voice-audio-player">
    <audio
      ref="audioRef"
      :src="resolvedSrc"
      preload="metadata"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
      @error="onError"
    />

    <!-- 播放/暂停按钮 -->
    <button
      type="button"
      class="play-toggle-btn"
      :class="{ playing: isPlaying, disabled: !props.src || hasError }"
      :disabled="!props.src || hasError"
      @click="togglePlay"
      :title="isPlaying ? '暂停' : '播放'"
    >
      <span v-if="!isPlaying" class="play-icon">▶</span>
      <span v-else class="pause-icon">❚❚</span>
    </button>

    <!-- 动态波形 / 进度控制条 -->
    <div class="waveform-progress-area">
      <div class="track-wrapper" @click="handleSeek">
        <div class="track-bar">
          <div class="track-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
        <!-- 装饰性伪波形柱 -->
        <div class="waveform-bars">
          <div
            v-for="bar in barHeights"
            :key="bar.id"
            class="wave-bar"
            :class="{ active: isPlaying }"
            :style="{ height: `${bar.height}px` }"
          ></div>
        </div>
      </div>

      <!-- 时间刻度 -->
      <div class="time-display">
        <span class="current-time">{{ formatDuration(currentTime) }}</span>
        <span class="divider">/</span>
        <span class="total-time">{{ formatDuration(totalDuration) }}</span>
      </div>
    </div>

    <!-- 音量与下载控制区 -->
    <div class="actions-area">
      <!-- 静音/音量滑块 -->
      <div class="volume-control">
        <button type="button" class="volume-btn" @click="toggleMute" title="音量">
          <span v-if="isMuted || volume === 0">🔇</span>
          <span v-else-if="volume < 0.5">🔉</span>
          <span v-else>🔊</span>
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          v-model.number="volume"
          @input="onVolumeChange"
          class="volume-slider"
          title="调节音量"
        />
      </div>

      <!-- 下载按钮 -->
      <button
        v-if="props.src"
        type="button"
        class="download-btn"
        @click="handleDownload"
        title="下载音频文件"
      >
        <DownloadOutlined />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { DownloadOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { getApiBaseUrl } from '@/utils/common'

defineOptions({
  name: 'VoiceAudioPlayer',
})

const props = defineProps<{
  src: string
  duration?: number | null
  title?: string
}>()

const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const totalDuration = ref(props.duration || 0)
const volume = ref(0.85)
const isMuted = ref(false)
const hasError = ref(false)

// 伪波形数据（固定随机高度，模拟专业音频条）
const barHeights = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  height: Math.max(6, Math.min(22, Math.floor(Math.sin(i * 0.5) * 10 + 12 + ((i % 3) * 2)))),
}))

// 完整音频地址
const resolvedSrc = computed(() => {
  if (!props.src) return ''
  if (props.src.startsWith('http://') || props.src.startsWith('https://')) {
    return props.src
  }
  const baseURL = getApiBaseUrl()
  if (!baseURL) {
    return props.src.startsWith('/') ? props.src : `/${props.src}`
  }
  return `${baseURL.replace(/\/+$/, '')}${props.src.startsWith('/') ? '' : '/'}${props.src}`
})

const progressPercent = computed(() => {
  if (totalDuration.value <= 0) return 0
  return Math.min(100, Math.max(0, (currentTime.value / totalDuration.value) * 100))
})

const togglePlay = () => {
  if (!audioRef.value) return
  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play().catch((err) => {
      message.warning('音频播放失败，请检查浏览器权限')
      console.warn(err)
    })
  }
}

const onTimeUpdate = () => {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

const onLoadedMetadata = () => {
  if (audioRef.value && audioRef.value.duration && !Number.isNaN(audioRef.value.duration)) {
    totalDuration.value = audioRef.value.duration
  }
}

const onEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
}

const onError = () => {
  hasError.value = true
  isPlaying.value = false
}

const handleSeek = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  if (!target || !audioRef.value || totalDuration.value <= 0) return
  const rect = target.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const ratio = Math.max(0, Math.min(1, clickX / rect.width))
  const newTime = ratio * totalDuration.value
  audioRef.value.currentTime = newTime
  currentTime.value = newTime
}

const toggleMute = () => {
  if (!audioRef.value) return
  isMuted.value = !isMuted.value
  audioRef.value.muted = isMuted.value
}

const onVolumeChange = () => {
  if (!audioRef.value) return
  audioRef.value.volume = volume.value
  if (volume.value > 0 && isMuted.value) {
    isMuted.value = false
    audioRef.value.muted = false
  }
}

const formatDuration = (seconds: number = 0): string => {
  if (!seconds || Number.isNaN(seconds)) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const handleDownload = async () => {
  if (!resolvedSrc.value) return
  try {
    const res = await fetch(resolvedSrc.value)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = props.title ? `${props.title}.mp3` : `audio_${Date.now()}.mp3`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
    message.success('音频已开始下载')
  } catch {
    window.open(resolvedSrc.value, '_blank')
  }
}

watch(
  () => props.src,
  () => {
    currentTime.value = 0
    isPlaying.value = false
    hasError.value = false
  },
)

onMounted(() => {
  if (audioRef.value) {
    audioRef.value.volume = volume.value
  }
})

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause()
  }
})
</script>

<style scoped lang="scss">
.voice-audio-player {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f8fafc;
  border: 1px solid #eaecf0;
  border-radius: 12px;
  padding: 10px 16px;
  transition: all 0.2s ease;

  &:hover {
    border-color: #d0d5dd;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(16, 24, 40, 0.04);
  }

  .play-toggle-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #1570ef;
    color: #ffffff;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(21, 112, 239, 0.25);

    &:hover:not(:disabled) {
      background: #1366d9;
      transform: scale(1.05);
    }

    &:active:not(:disabled) {
      transform: scale(0.96);
    }

    &.playing {
      background: #027a48;
      box-shadow: 0 2px 6px rgba(2, 122, 72, 0.25);
    }

    &.disabled {
      background: #d0d5dd;
      cursor: not-allowed;
      box-shadow: none;
    }

    .play-icon {
      margin-left: 2px;
    }
  }

  .waveform-progress-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;

    .track-wrapper {
      position: relative;
      height: 26px;
      cursor: pointer;
      display: flex;
      align-items: center;

      .track-bar {
        position: absolute;
        left: 0;
        right: 0;
        height: 4px;
        background: #eaecf0;
        border-radius: 2px;
        overflow: hidden;

        .track-fill {
          height: 100%;
          background: #1570ef;
          transition: width 0.1s linear;
        }
      }

      .waveform-bars {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        pointer-events: none;
        opacity: 0.35;

        .wave-bar {
          width: 3px;
          background: #98a2b3;
          border-radius: 1.5px;
          transition: all 0.2s ease;

          &.active {
            animation: pulseWave 0.8s ease-in-out infinite alternate;
          }
        }
      }
    }

    .time-display {
      display: flex;
      gap: 4px;
      font-size: 11px;
      font-family: 'Inter', monospace;
      color: #667085;

      .divider {
        color: #d0d5dd;
      }
    }
  }

  .actions-area {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    .volume-control {
      display: flex;
      align-items: center;
      gap: 4px;

      .volume-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
        line-height: 1;
        opacity: 0.75;
        transition: opacity 0.2s;

        &:hover {
          opacity: 1;
        }
      }

      .volume-slider {
        width: 55px;
        height: 4px;
        accent-color: #1570ef;
        cursor: pointer;
      }
    }

    .download-btn {
      background: transparent;
      border: 1px solid #d0d5dd;
      border-radius: 6px;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #475467;
      transition: all 0.2s;

      &:hover {
        background: #f2f4f7;
        color: #1570ef;
        border-color: #1570ef;
      }
    }
  }
}

@keyframes pulseWave {
  0% {
    transform: scaleY(0.7);
    background: #1570ef;
  }
  100% {
    transform: scaleY(1.3);
    background: #53b1fd;
  }
}
</style>
