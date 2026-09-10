<template>
  <div class="voice-task-stream">
    <!-- 顶部筛选胶囊与任务计数 -->
    <div class="stream-header">
      <div class="filter-pills">
        <button
          type="button"
          class="filter-pill"
          :class="{ active: props.currentFilter === 'all' }"
          @click="emit('filter-change', 'all')"
        >
          全部 ({{ totalCount }})
        </button>
        <button
          type="button"
          class="filter-pill"
          :class="{ active: props.currentFilter === 'tts' }"
          @click="emit('filter-change', 'tts')"
        >
          语音合成 TTS ({{ ttsCount }})
        </button>
        <button
          type="button"
          class="filter-pill"
          :class="{ active: props.currentFilter === 'stt' }"
          @click="emit('filter-change', 'stt')"
        >
          语音识别 STT ({{ sttCount }})
        </button>
      </div>
    </div>

    <!-- 生成/转写中动态占位卡片 -->
    <div v-if="props.isGenerating" class="generating-card">
      <div class="equalizer-animation">
        <span class="eq-bar bar-1"></span>
        <span class="eq-bar bar-2"></span>
        <span class="eq-bar bar-3"></span>
        <span class="eq-bar bar-4"></span>
        <span class="eq-bar bar-5"></span>
      </div>
      <div class="generating-info">
        <div class="generating-title">
          <LoadingOutlined class="spinner" />
          <span>{{ props.generatingType === 'tts' ? '正在合成高保真语音' : '正在解析音频转写文字' }} · 已耗时 {{ formatSeconds(props.generatingElapsedSeconds) }}</span>
        </div>
        <p class="generating-tip">神经语音模型实时渲染中，请稍候...</p>
      </div>
    </div>

    <!-- 任务瀑布流卡片列表 -->
    <div v-if="filteredTasks.length > 0" class="tasks-container">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-card"
        :class="[`type-${task.type}`, `status-${task.status}`]"
      >
        <!-- 头部元数据行 -->
        <div class="card-header">
          <div class="left-badges">
            <span v-if="task.type === 'tts'" class="type-tag tts-tag">
              <SoundOutlined />
              <span>语音合成</span>
            </span>
            <span v-else class="type-tag stt-tag">
              <AudioOutlined />
              <span>语音识别</span>
            </span>

            <span class="model-tag">{{ task.model }}</span>
            <span v-if="task.voiceId" class="param-tag">音色: {{ task.voiceId }}</span>
            <span v-if="task.speed && task.speed !== 1" class="param-tag">{{ task.speed }}x</span>
            <span v-if="task.duration" class="param-tag duration-tag">{{ task.duration.toFixed(1) }}s</span>
          </div>

          <div class="right-info">
            <span class="time-str">{{ formatDateTime(task.createdAt) }}</span>
          </div>
        </div>

        <!-- 文本内容区域 -->
        <div class="card-content">
          <div class="text-box">
            <p class="content-text">{{ task.text || '(无文字内容)' }}</p>
          </div>
        </div>

        <!-- 音频播放器区域 -->
        <div v-if="task.status === 'success' && task.audioUrl" class="card-player">
          <VoiceAudioPlayer
            :src="task.audioUrl"
            :duration="task.duration"
            :title="task.text.slice(0, 20)"
          />
        </div>

        <!-- 失败提示 -->
        <div v-else-if="task.status === 'failed'" class="card-error">
          <ExclamationCircleOutlined class="err-icon" />
          <span>任务处理失败：{{ task.errorMessage || '未知异常，已自动为您返还积分' }}</span>
        </div>

        <!-- 底部快捷动作行 -->
        <div class="card-footer">
          <button
            type="button"
            class="card-action-btn"
            @click="handleCopyText(task.text)"
            title="复制文本"
          >
            <CopyOutlined />
            <span>复制文本</span>
          </button>

          <button
            v-if="task.type === 'tts'"
            type="button"
            class="card-action-btn reuse-btn"
            @click="emit('reuse', task)"
            title="复用此条配置"
          >
            <RedoOutlined />
            <span>复用参数</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态提示 -->
    <div v-else-if="!props.isGenerating" class="empty-state">
      <div class="empty-icon-circle">
        <CustomerServiceOutlined />
      </div>
      <h3 class="empty-title">开启您的 AI 语音创作</h3>
      <p class="empty-desc">
        输入文字即可一键合成自然流畅的多国语言音频，或录入语音进行精准转写
      </p>

      <div class="preset-suggestions">
        <span class="suggest-label">快速试听体验：</span>
        <div class="pills-grid">
          <button
            v-for="s in samplePrompts"
            :key="s"
            type="button"
            class="preset-pill"
            @click="emit('apply-prompt', s)"
          >
            {{ s }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  SoundOutlined,
  AudioOutlined,
  LoadingOutlined,
  CopyOutlined,
  RedoOutlined,
  CustomerServiceOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import VoiceAudioPlayer from './VoiceAudioPlayer.vue'
import type { VoiceTask } from '@/interface/voice'

defineOptions({
  name: 'VoiceTaskStream',
})

const props = withDefaults(
  defineProps<{
    tasks: VoiceTask[]
    isGenerating?: boolean
    generatingType?: 'tts' | 'stt'
    generatingElapsedSeconds?: number
    currentFilter?: 'all' | 'tts' | 'stt'
  }>(),
  {
    isGenerating: false,
    generatingType: 'tts',
    generatingElapsedSeconds: 0,
    currentFilter: 'all',
  },
)

const emit = defineEmits<{
  'filter-change': [filter: 'all' | 'tts' | 'stt']
  'reuse': [task: VoiceTask]
  'apply-prompt': [text: string]
}>()

const samplePrompts = [
  '你好！欢迎使用 ERJ 智能语音创作平台，体验前沿神经语音生成技术。',
  '人工智能正在重塑人机交互，让声音更有温度、更懂人心。',
  'Welcome to ERJ Chat! Experience the natural and expressive voice generation.',
  '明月出天山，苍茫云海间。长风几万里，吹度玉门关。',
]

const totalCount = computed(() => props.tasks.length)
const ttsCount = computed(() => props.tasks.filter((t) => t.type === 'tts').length)
const sttCount = computed(() => props.tasks.filter((t) => t.type === 'stt').length)

const filteredTasks = computed(() => {
  if (props.currentFilter === 'tts') {
    return props.tasks.filter((t) => t.type === 'tts')
  }
  if (props.currentFilter === 'stt') {
    return props.tasks.filter((t) => t.type === 'stt')
  }
  return props.tasks
})

const formatSeconds = (sec: number = 0): string => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleCopyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    message.success('文本已复制到剪贴板')
  } catch {
    message.warning('无法复制到剪贴板，请手动选中文本')
  }
}
</script>

<style scoped lang="scss">
.voice-task-stream {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  .stream-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .filter-pills {
      display: flex;
      gap: 8px;

      .filter-pill {
        border: 1px solid #eaecf0;
        background: #ffffff;
        color: #475467;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 500;
        border-radius: 20px;
        padding: 5px 14px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          border-color: #1570ef;
          color: #1570ef;
        }

        &.active {
          background: #1570ef;
          color: #ffffff;
          border-color: #1570ef;
          box-shadow: 0 1px 3px rgba(21, 112, 239, 0.25);
        }
      }
    }
  }

  .generating-card {
    background: #ffffff;
    border: 1px solid #b2ddff;
    border-radius: 16px;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 4px 12px rgba(21, 112, 239, 0.08);

    .equalizer-animation {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 32px;

      .eq-bar {
        width: 4px;
        background: #1570ef;
        border-radius: 2px;
        animation: eqPulse 1s ease-in-out infinite alternate;

        &.bar-1 { height: 14px; animation-delay: 0.1s; }
        &.bar-2 { height: 26px; animation-delay: 0.3s; }
        &.bar-3 { height: 32px; animation-delay: 0.2s; }
        &.bar-4 { height: 20px; animation-delay: 0.4s; }
        &.bar-5 { height: 16px; animation-delay: 0.15s; }
      }
    }

    .generating-info {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .generating-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 600;
        color: #1570ef;

        .spinner {
          font-size: 16px;
        }
      }

      .generating-tip {
        margin: 0;
        font-size: 13px;
        color: #667085;
      }
    }
  }

  .tasks-container {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .task-card {
      background: #ffffff;
      border: 1px solid #eaecf0;
      border-radius: 16px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 1px 3px rgba(16, 24, 40, 0.05);
      transition: all 0.2s ease;

      &:hover {
        border-color: #d0d5dd;
        box-shadow: 0 4px 12px rgba(16, 24, 40, 0.08);
      }

      &.status-failed {
        border-color: #fda29b;
        background: #fffbfa;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;

        .left-badges {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;

          .type-tag {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 6px;

            &.tts-tag {
              background: #eff8ff;
              color: #175cd3;
            }

            &.stt-tag {
              background: #ecfdf3;
              color: #027a48;
            }
          }

          .model-tag {
            font-size: 11px;
            font-family: 'Inter', monospace;
            color: #475467;
            background: #f2f4f7;
            padding: 2px 8px;
            border-radius: 6px;
          }

          .param-tag {
            font-size: 11px;
            color: #667085;
            background: #f8fafc;
            border: 1px solid #eaecf0;
            padding: 2px 6px;
            border-radius: 4px;
          }
        }

        .time-str {
          font-size: 12px;
          color: #98a2b3;
        }
      }

      .card-content {
        .text-box {
          background: #fcfcfd;
          border-left: 3px solid #1570ef;
          padding: 10px 14px;
          border-radius: 0 8px 8px 0;

          .content-text {
            margin: 0;
            font-size: 14px;
            line-height: 1.6;
            color: #1d2939;
            word-break: break-word;
          }
        }
      }

      .card-player {
        margin-top: 2px;
      }

      .card-error {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #fee4e2;
        color: #d92d20;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 13px;

        .err-icon {
          font-size: 16px;
        }
      }

      .card-footer {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 8px;
        border-top: 1px solid #f2f4f7;

        .card-action-btn {
          border: none;
          background: transparent;
          color: #667085;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.2s;

          &:hover {
            color: #1570ef;
            background: #f2f4f7;
          }

          &.reuse-btn:hover {
            color: #027a48;
          }
        }
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: #ffffff;
    border: 1px dashed #d0d5dd;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;

    .empty-icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #eff8ff;
      color: #1570ef;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 600;
      color: #101828;
      margin: 0;
    }

    .empty-desc {
      font-size: 14px;
      color: #667085;
      max-width: 440px;
      margin: 0;
    }

    .preset-suggestions {
      margin-top: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;

      .suggest-label {
        font-size: 12px;
        color: #98a2b3;
      }

      .pills-grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        max-width: 620px;

        .preset-pill {
          border: 1px solid #eaecf0;
          background: #f8fafc;
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 13px;
          color: #344054;
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            border-color: #1570ef;
            background: #ffffff;
            color: #1570ef;
            box-shadow: 0 2px 6px rgba(16, 24, 40, 0.06);
          }
        }
      }
    }
  }
}

@keyframes eqPulse {
  0% { transform: scaleY(0.4); }
  100% { transform: scaleY(1.2); }
}
</style>
