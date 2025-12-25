<template>
  <div>
    <div v-if="streaming" class="streaming-markdown">
      <div v-html="streamingHtml" />
      <span class="streaming-cursor" aria-hidden="true" />
    </div>
    <div v-else v-html="html" />
  </div>
</template>

<script setup lang="ts">
import { shallowRef, computed, watch, onBeforeUnmount } from 'vue'
import { renderMarkdown, renderStreamingMarkdown } from '@/utils/markdown'

interface Props {
  messageId: string
  content: string
  /**
   * 是否处于流式输出中
   * - 流式中会关闭代码高亮-并用 RAF 节流渲染，减少主线程压力
   */
  streaming?: boolean
}

const props = defineProps<Props>()
const streaming = computed(() => !!props.streaming)

type CacheEntry = {
  content: string
  html: string
  isComplete: boolean
}

// 按 messageId 记录最后一次渲染结果-避免重复解析
const markdownCache = new Map<string, CacheEntry>()
const MAX_CACHE_SIZE = 300

function pruneCache() {
  if (markdownCache.size <= MAX_CACHE_SIZE) return
  const firstKey = markdownCache.keys().next().value as string | undefined
  if (firstKey) {
    markdownCache.delete(firstKey)
  }
}

const html = shallowRef('')
const streamingText = shallowRef('')
const streamingHtml = shallowRef('')
let rafId: number | null = null
let isPumping = false

const STREAM_RENDER_MIN_INTERVAL_MS = 50
let renderRafId: number | null = null
let renderDirty = false
let lastStreamRenderAt = 0

const runStreamingRender = (ts: number) => {
  renderRafId = null
  if (!streaming.value) {
    renderDirty = false
    return
  }
  if (!renderDirty) return

  if (ts - lastStreamRenderAt < STREAM_RENDER_MIN_INTERVAL_MS) {
    renderRafId = requestAnimationFrame(runStreamingRender)
    return
  }

  lastStreamRenderAt = ts
  renderDirty = false
  streamingHtml.value = renderStreamingMarkdown(streamingText.value || '', streamingHtml.value, {
    highlightCode: false,
  }).html
}

const scheduleStreamingRender = () => {
  renderDirty = true
  if (renderRafId !== null) return
  renderRafId = requestAnimationFrame(runStreamingRender)
}

const renderFinalHtml = () => {
  const messageId = props.messageId
  const content = props.content || ''

  const cached = markdownCache.get(messageId)

  // 内容未变且已完整渲染-直接复用
  if (cached?.isComplete && cached.content === content) {
    html.value = cached.html
    return
  }

  const rendered = renderMarkdown(content, { highlightCode: true })
  html.value = rendered
  markdownCache.set(messageId, {
    content,
    html: rendered,
    isComplete: true,
  })

  pruneCache()
}

/**
 * 流式阶段用“纯文本 + 光标”渲染：
 * - 避免每个 delta 都重写 innerHTML（会导致闪烁/掉帧）
 * - 结束后再一次性渲染 Markdown + 高亮
 */
const pumpStreamingText = () => {
  isPumping = true
  rafId = null
  if (!streaming.value) {
    isPumping = false
    return
  }

  const target = props.content || ''
  const current = streamingText.value || ''

  // 如果内容回退-直接同步
  if (target.length <= current.length) {
    streamingText.value = target
    scheduleStreamingRender()
    isPumping = false
    return
  }

  const remaining = target.length - current.length
  let chunkSize: number

  // 目标体验-尽量逐字增长，同时在 backlog 很大时自动加速追赶，避免UI落后太多
  if (remaining > 800) {
    chunkSize = 32
  } else if (remaining > 400) {
    chunkSize = 16
  } else if (remaining > 200) {
    chunkSize = 8
  } else if (remaining > 120) {
    chunkSize = 4
  } else if (remaining > 60) {
    chunkSize = 2
  } else {
    chunkSize = 1
  }

  streamingText.value = current + target.slice(current.length, current.length + chunkSize)
  scheduleStreamingRender()

  isPumping = false
  if (streamingText.value.length < target.length) {
    rafId = requestAnimationFrame(pumpStreamingText)
  }
}

const schedulePump = () => {
  if (rafId !== null || isPumping) return
  rafId = requestAnimationFrame(pumpStreamingText)
}

watch(
  () => [props.messageId, props.content, props.streaming] as const,
  () => {
    if (streaming.value) {
      // 流式阶段：流畅追赶文本 + 实时 Markdown（关闭高亮，降低开销）
      schedulePump()
      scheduleStreamingRender()
      return
    }

    // 流式结束：确保文本追上，再渲染 Markdown
    streamingText.value = props.content || ''
    renderFinalHtml()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (renderRafId !== null) {
    cancelAnimationFrame(renderRafId)
    renderRafId = null
  }
})
</script>

<style scoped>
.streaming-markdown :deep(.streaming-text) {
  white-space: pre-wrap;
  word-break: break-word;
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  vertical-align: text-bottom;
  margin-left: 2px;
  background: currentColor;
  opacity: 0.7;
}

</style>
