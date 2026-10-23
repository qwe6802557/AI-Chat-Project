<template>
  <div
    ref="containerRef"
    @click="handleClick"
    @mouseover="handleMouseOver"
    @mouseout="handleMouseOut"
  >
    <div v-if="streaming" class="streaming-markdown">
      <template v-if="hasVisibleStreamingText">
        <div v-html="streamingHtml" />
        <span class="streaming-cursor" aria-hidden="true" />
      </template>
      <div v-else class="streaming-wait-placeholder" aria-label="正在等待回答">
        <span class="wait-dot" />
        <span class="wait-dot" />
        <span class="wait-dot" />
        <span class="wait-text">{{ waitPlaceholderText }}</span>
      </div>
    </div>
    <div v-else v-html="html" />

    <!-- 行内引用切片浮窗预览 -->
    <CitationPopover
      :visible="hoveredCitation.visible"
      :citation-id="hoveredCitation.citationId"
      :source="hoveredCitation.source"
      :anchor-rect="hoveredCitation.anchorRect"
      @open-detail="handleOpenSourceDetail"
      @mouseenter="handlePopoverMouseEnter"
      @mouseleave="handlePopoverMouseLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { shallowRef, ref, computed, watch, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import { renderMarkdown, renderStreamingMarkdown } from '@/utils/markdown'
import { sanitizeVisibleAssistantContent } from '../utils/assistantContent'
import { useArtifactStore } from '../stores/useArtifactStore'
import { getActivePinia } from 'pinia'
import type { SearchSource } from '@/interface/chat'
import CitationPopover from './CitationPopover.vue'

const containerRef = ref<HTMLElement | null>(null)

interface Props {
  messageId: string
  content: string
  /**
   * 是否处于流式输出中
   * - 流式中会关闭代码高亮-并用 RAF 节流渲染，减少主线程压力
   */
  streaming?: boolean
  sources?: SearchSource[]
  waitPlaceholderText?: string
}

const props = withDefaults(defineProps<Props>(), {
  streaming: false,
  sources: () => [],
  waitPlaceholderText: '正在思考并组织回答...',
})

const emit = defineEmits<{
  'open-source': [source: SearchSource]
}>()

const hoveredCitation = ref<{
  visible: boolean
  citationId: number | string
  source: SearchSource | null
  anchorRect: DOMRect | null
}>({
  visible: false,
  citationId: 1,
  source: null,
  anchorRect: null,
})

let hideCitationTimer: ReturnType<typeof setTimeout> | null = null

const findSourceByCitation = (citationNum: number | string): SearchSource | null => {
  if (!props.sources || props.sources.length === 0) return null
  const id = Number(citationNum)
  return props.sources.find((s) => s.id === id) || props.sources[id - 1] || null
}

const handleBadgeMouseEnter = (badge: HTMLElement) => {
  if (hideCitationTimer) {
    clearTimeout(hideCitationTimer)
    hideCitationTimer = null
  }

  const citationAttr = badge.getAttribute('data-citation')
  if (!citationAttr) return

  const citationId = Number(citationAttr) || citationAttr
  const source = findSourceByCitation(citationId)

  hoveredCitation.value = {
    visible: true,
    citationId,
    source,
    anchorRect: badge.getBoundingClientRect(),
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('aichat:highlight-source', {
        detail: { sourceId: typeof citationId === 'number' ? citationId : Number(citationId) },
      }),
    )
  }
}

const handleBadgeMouseLeave = () => {
  hideCitationTimer = setTimeout(() => {
    hoveredCitation.value.visible = false
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('aichat:highlight-source', { detail: { sourceId: null } }),
      )
    }
  }, 180)
}

const handlePopoverMouseEnter = () => {
  if (hideCitationTimer) {
    clearTimeout(hideCitationTimer)
    hideCitationTimer = null
  }
}

const handlePopoverMouseLeave = () => {
  handleBadgeMouseLeave()
}

const handleOpenSourceDetail = (source: SearchSource) => {
  hoveredCitation.value.visible = false
  emit('open-source', source)
}

const handleMouseOver = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const badge = target.closest('.citation-ref-badge') as HTMLElement | null
  if (badge) {
    handleBadgeMouseEnter(badge)
  }
}

const handleMouseOut = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const related = event.relatedTarget as HTMLElement | null
  if (target.closest('.citation-ref-badge') && (!related || !related.closest('.citation-ref-badge'))) {
    handleBadgeMouseLeave()
  }
}

/**
 * 事件委托处理代码块与引用徽章点击
 */
const handleClick = async (event: MouseEvent) => {
  const target = event.target as HTMLElement

  // 处理引用角标点击
  const citationBadge = target.closest('.citation-ref-badge') as HTMLElement | null
  if (citationBadge) {
    const citationAttr = citationBadge.getAttribute('data-citation')
    if (citationAttr) {
      const citationId = Number(citationAttr) || citationAttr
      const source = findSourceByCitation(citationId)
      if (source) {
        if (source.isKnowledgeBase) {
          handleOpenSourceDetail(source)
        } else if (source.url) {
          window.open(source.url, '_blank', 'noopener,noreferrer')
        }
      }
    }
    return
  }

  const isCopy = target.classList.contains('copy-btn')
  const isOpenArtifact = target.classList.contains('open-artifact-btn')
  if (!isCopy && !isOpenArtifact) return

  // 找到对应的code元素与语言标签
  const codeBlock = target.closest('.code-block')
  const codeElement = codeBlock?.querySelector('code')
  const langElement = codeBlock?.querySelector('.code-language')
  if (!codeElement) return

  const text = codeElement.textContent || ''
  const lang = (langElement?.textContent || '').trim().toLowerCase()

  if (isOpenArtifact) {
    const isVisual = target.classList.contains('visual-btn') || target.getAttribute('data-action') === 'preview'
    let artifactType = 'application/vnd.ant.code'
    if (lang === 'html' || text.trim().startsWith('<html') || text.trim().startsWith('<!DOCTYPE')) {
      artifactType = 'text/html'
    } else if (lang === 'svg' || text.trim().startsWith('<svg')) {
      artifactType = 'image/svg+xml'
    } else if (lang === 'mermaid' || text.trim().startsWith('graph') || text.trim().startsWith('flowchart')) {
      artifactType = 'application/vnd.ant.mermaid'
    }

    const shortId = `snippet-${props.messageId.slice(0, 8)}-${Math.random().toString(36).slice(2, 6)}`
    if (getActivePinia()) {
      const artifactStore = useArtifactStore()
      artifactStore.registerOrUpdateArtifact({
        identifier: shortId,
        type: artifactType,
        title: `${lang ? lang.toUpperCase() + ' ' : ''}代码片段`,
        language: lang,
        content: text,
        messageId: props.messageId,
        autoOpen: true,
      })
      artifactStore.setActiveTab(isVisual ? 'preview' : 'code')
    }
    message.success(isVisual ? '已升格为 Artifact 并在沙箱中实时预览' : '已升格为 Artifact 并在工作区高亮查看')
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    message.success('复制成功')
  } catch {
    // 降级方案-使用execCommand
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      message.success('复制成功')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }
}

const streaming = computed(() => !!props.streaming)
const getRenderableContent = (): string => {
  return sanitizeVisibleAssistantContent(props.content || '')
}

const hasVisibleStreamingText = computed(() => {
  const target = getRenderableContent().trim()
  const current = (streamingText.value || '').trim()
  return Boolean(target.length > 0 || current.length > 0)
})

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
  const content = getRenderableContent()

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
  const visibleTarget = getRenderableContent()
  const current = streamingText.value || ''

  // 如果内容回退-直接同步
  if (visibleTarget.length <= current.length) {
    streamingText.value = visibleTarget
    scheduleStreamingRender()
    isPumping = false
    return
  }

  const remaining = visibleTarget.length - current.length
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

  streamingText.value =
    current + visibleTarget.slice(current.length, current.length + chunkSize)
  scheduleStreamingRender()

  isPumping = false
  if (streamingText.value.length < visibleTarget.length) {
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
    streamingText.value = getRenderableContent()
    renderFinalHtml()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (hideCitationTimer) {
    clearTimeout(hideCitationTimer)
    hideCitationTimer = null
  }
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

.streaming-wait-placeholder {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  user-select: none;
}

.streaming-wait-placeholder .wait-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3b82f6;
  opacity: 0.65;
  animation: wait-dot-bounce 1.35s ease-in-out infinite both;
}

.streaming-wait-placeholder .wait-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.streaming-wait-placeholder .wait-dot:nth-child(2) {
  animation-delay: -0.16s;
}

.streaming-wait-placeholder .wait-text {
  margin-left: 4px;
  font-size: 13px;
  color: #64748b;
  font-weight: 400;
  letter-spacing: 0.2px;
}

@keyframes wait-dot-bounce {
  0%, 80%, 100% {
    transform: scale(0.65);
    opacity: 0.35;
  }
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  vertical-align: text-bottom;
  margin-left: 2px;
  background: #2563eb;
  border-radius: 1px;
  animation: streaming-cursor-blink 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes streaming-cursor-blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.15;
  }
}

:deep(.citation-ref-badge) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  min-width: 18px;
  height: 18px;
  font-size: 11px;
  font-weight: 600;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  cursor: pointer;
  margin: 0 2px;
  vertical-align: super;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.citation-ref-badge:hover) {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}
</style>
