<template>
  <div
    v-if="reasoning.content || isStreaming"
    :class="['reasoning-panel', { expanded, streaming: isStreaming }]"
  >
    <button
      type="button"
      class="reasoning-toggle"
      :aria-expanded="expanded"
      @click="handleToggle"
    >
      <div class="reasoning-heading">
        <span class="reasoning-badge" :class="{ 'is-thinking': isStreaming }">
          <BulbOutlined />
        </span>
        <span :class="['reasoning-label', { 'is-shimmer': isStreaming }]">
          {{ isStreaming ? '深度思考中' : '已深度思考' }}
        </span>
        <span v-if="durationLabel" class="reasoning-duration">{{ durationLabel }}</span>
      </div>
      <RightOutlined :class="['reasoning-chevron', { rotated: expanded }]" />
    </button>

    <div :class="['reasoning-collapse', { open: expanded }]">
      <div class="reasoning-collapse-inner">
        <div
          v-if="hasMountedBody"
          ref="reasoningScrollRef"
          :class="['reasoning-body', { 'is-streaming-scroll': isStreaming }]"
          @scroll="handleBodyScroll"
        >
          <div v-if="!reasoning.content && isStreaming" class="reasoning-empty-loading">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-text">思考中，正在分析问题与构建推论...</span>
          </div>
          <MarkdownMessage
            v-else
            :message-id="`${messageId}-reasoning`"
            :content="reasoning.content"
            :streaming="isStreaming"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { BulbOutlined, RightOutlined } from '@ant-design/icons-vue'
import type { MessageReasoning } from '@/interface/conversation'
import MarkdownMessage from './MarkdownMessage.vue'

defineOptions({
  name: 'ChatReasoningPanel',
})

const props = defineProps<{
  messageId: string
  reasoning: MessageReasoning
}>()

const isStreaming = computed(() => props.reasoning.status === 'streaming')
const userToggled = ref(false)
const expanded = ref(props.reasoning.status === 'streaming')
const hasMountedBody = ref(expanded.value)
const reasoningScrollRef = ref<HTMLElement | null>(null)
const isUserScrolledUp = ref(false)
const elapsedMs = ref<number | null>(null)

let thinkingStartedAt = 0
let durationTimer: ReturnType<typeof setInterval> | null = null

const startTimer = () => {
  if (durationTimer) return
  thinkingStartedAt = Date.now()
  elapsedMs.value = 0
  durationTimer = setInterval(() => {
    elapsedMs.value = Date.now() - thinkingStartedAt
  }, 100)
}

const stopTimer = (freeze: boolean) => {
  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }
  if (freeze && thinkingStartedAt > 0) {
    elapsedMs.value = Math.max(100, Date.now() - thinkingStartedAt)
  }
}

if (isStreaming.value) {
  startTimer()
}

watch(expanded, (val) => {
  if (val) {
    hasMountedBody.value = true
  }
})

watch(isStreaming, (streaming, prevStreaming) => {
  if (streaming) {
    startTimer()
    if (!userToggled.value) {
      expanded.value = true
    }
    return
  }

  if (prevStreaming) {
    stopTimer(true)
    if (!userToggled.value) {
      expanded.value = false
    }
  }
})

// 仅在流式思考展开且用户未主动上滑回看时自动跟随滚动到底部
watch(
  () => props.reasoning.content,
  () => {
    if (!isStreaming.value || !expanded.value || isUserScrolledUp.value) return
    nextTick(() => {
      const el = reasoningScrollRef.value
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    })
  },
)

const handleBodyScroll = () => {
  const el = reasoningScrollRef.value
  if (!el) return
  isUserScrolledUp.value = el.scrollHeight - el.scrollTop - el.clientHeight > 24
}

const handleToggle = () => {
  userToggled.value = true
  expanded.value = !expanded.value
}

const durationLabel = computed(() => {
  if (elapsedMs.value === null) return ''
  const sec = (elapsedMs.value / 1000).toFixed(1)
  return isStreaming.value ? `${sec}s` : `用时 ${sec}s`
})

onBeforeUnmount(() => {
  stopTimer(false)
})
</script>

<style scoped lang="scss">
.reasoning-panel {
  width: fit-content;
  max-width: 100%;
  margin-bottom: 8px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.08);
  overflow: hidden;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    border-radius 0.2s ease,
    box-shadow 0.2s ease;

  &:not(.expanded):hover {
    background: #f1f5f9;
    border-color: rgba(15, 23, 42, 0.14);
  }

  &.expanded {
    width: 100%;
    border-radius: 12px;
    background: rgba(248, 250, 252, 0.72);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
  }

  &.streaming {
    border-color: rgba(37, 99, 235, 0.2);
    background: rgba(239, 246, 255, 0.5);
  }
}

.reasoning-toggle {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 10px 0 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.reasoning-heading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.reasoning-badge {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.06);
  color: #344054;
  flex-shrink: 0;
  transition: all 0.25s ease;

  :deep(.anticon) {
    font-size: 11px;
  }

  &.is-thinking {
    background: rgba(37, 99, 235, 0.12);
    color: #2563eb;
    animation: thinking-glow 2s ease-in-out infinite;
  }
}

@keyframes thinking-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.2);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
  }
}

.reasoning-label {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
  line-height: 20px;
  white-space: nowrap;

  &.is-shimmer {
    background: linear-gradient(90deg, #1e293b 0%, #2563eb 45%, #1e293b 90%);
    background-size: 200% 100%;
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    animation: reasoning-shimmer 2.2s linear infinite;
  }
}

@keyframes reasoning-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.reasoning-duration {
  font-size: 11.5px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.reasoning-chevron {
  flex-shrink: 0;
  color: #64748b;
  font-size: 11px;
  transition: transform 0.22s ease;

  &.rotated {
    transform: rotate(90deg);
  }
}

.reasoning-collapse {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 0.26s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease;

  &.open {
    grid-template-rows: 1fr;
    opacity: 1;
  }
}

.reasoning-collapse-inner {
  overflow: hidden;
  min-height: 0;
}

.reasoning-body {
  margin: 0 12px 12px 17px;
  padding: 2px 0 2px 12px;
  border-left: 2px solid #e2e8f0;

  &.is-streaming-scroll {
    border-left-color: rgba(37, 99, 235, 0.32);
    max-height: 240px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 6px;
  }

  :deep(.markdown-content) {
    padding: 0;
    background: transparent;
    color: #64748b;
    font-size: 12.5px;
    line-height: 1.68;
  }
}

.reasoning-empty-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  font-size: 12.5px;
  color: #64748b;

  .thinking-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    animation: thinking-dot-bounce 1.4s ease-in-out infinite both;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }

  .thinking-text {
    margin-left: 4px;
    font-size: 12.5px;
    color: #64748b;
    letter-spacing: 0.2px;
  }
}

@keyframes thinking-dot-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.65);
    opacity: 0.35;
  }
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
}
</style>
