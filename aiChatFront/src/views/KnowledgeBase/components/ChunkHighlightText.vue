<template>
  <span class="chunk-highlight-text">
    <template v-for="(seg, idx) in segments" :key="idx">
      <mark v-if="seg.highlighted" class="chunk-highlight-mark">{{ seg.text }}</mark>
      <template v-else>{{ seg.text }}</template>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HighlightSpan } from '@/interface/knowledge'

defineOptions({
  name: 'ChunkHighlightText',
})

interface TextSegment {
  text: string
  highlighted: boolean
}

const props = defineProps<{
  content: string
  highlights?: HighlightSpan[]
  keyword?: string
}>()

const buildKeywordSpans = (content: string, keyword: string): HighlightSpan[] => {
  const cleanKeyword = keyword.trim()
  if (!cleanKeyword) return []

  const lowerContent = content.toLowerCase()
  const lowerKw = cleanKeyword.toLowerCase()
  const spans: HighlightSpan[] = []
  let from = 0

  while (from < lowerContent.length && spans.length < 30) {
    const idx = lowerContent.indexOf(lowerKw, from)
    if (idx === -1) break
    spans.push({
      start: idx,
      end: idx + cleanKeyword.length,
      term: content.slice(idx, idx + cleanKeyword.length),
    })
    from = idx + cleanKeyword.length
  }

  return spans
}

const segments = computed<TextSegment[]>(() => {
  const text = props.content || ''
  if (!text) return []

  const rawSpans =
    props.highlights && props.highlights.length > 0
      ? props.highlights
      : props.keyword
        ? buildKeywordSpans(text, props.keyword)
        : []

  if (rawSpans.length === 0) {
    return [{ text, highlighted: false }]
  }

  const normalized = rawSpans
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end))
    .map((s) => ({
      start: Math.max(0, Math.min(text.length, s.start)),
      end: Math.max(0, Math.min(text.length, s.end)),
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start)

  const result: TextSegment[] = []
  let cursor = 0

  for (const span of normalized) {
    const start = Math.max(cursor, span.start)
    if (start >= span.end) continue

    if (start > cursor) {
      result.push({ text: text.slice(cursor, start), highlighted: false })
    }
    result.push({ text: text.slice(start, span.end), highlighted: true })
    cursor = span.end
  }

  if (cursor < text.length) {
    result.push({ text: text.slice(cursor), highlighted: false })
  }

  return result
})
</script>

<style scoped lang="scss">
.chunk-highlight-text {
  white-space: inherit;
  word-break: inherit;
}

.chunk-highlight-mark {
  background: rgba(251, 191, 36, 0.32);
  color: #78350f;
  border-radius: 3px;
  padding: 0 2px;
  font-weight: 600;
}
</style>
