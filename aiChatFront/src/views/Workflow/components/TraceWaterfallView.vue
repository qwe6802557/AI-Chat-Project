<template>
  <div class="trace-waterfall">
    <div v-if="spans.length === 0" class="waterfall-empty">
      暂无 Span 时序明细数据
    </div>

    <template v-else>
      <div class="waterfall-ruler">
        <div class="col-name">执行阶段 / Span 层级</div>
        <div class="col-timeline">
          <span>0 ms</span>
          <span>{{ Math.round(totalWindowMs * 0.5) }} ms</span>
          <span>{{ totalWindowMs }} ms</span>
        </div>
        <div class="col-metrics">耗时 · Token</div>
      </div>

      <div class="waterfall-rows">
        <div
          v-for="row in flattenedRows"
          :key="row.span.spanId"
          :class="[
            'waterfall-row',
            {
              'is-active': selectedSpanId === row.span.spanId,
              'is-node-highlight': highlightedNodeId && row.span.nodeId === highlightedNodeId,
            },
          ]"
          @click="handleSelectRow(row.span)"
        >
          <div class="col-name" :style="{ paddingLeft: `${10 + row.depth * 16}px` }">
            <span v-if="row.depth > 0" class="tree-elbow" aria-hidden="true" />
            <span :class="['span-kind-tag', row.span.spanType]">
              {{ getSpanBadge(row.span.spanType) }}
            </span>
            <span class="span-name" :title="row.span.name">{{ row.span.name }}</span>
          </div>

          <div class="col-timeline">
            <div class="bar-track">
              <div
                :class="['bar-fill', `status-${row.span.status}`, `kind-${row.span.spanType}`]"
                :style="{
                  left: `${row.leftPct}%`,
                  width: `${row.widthPct}%`,
                }"
              />
            </div>
          </div>

          <div class="col-metrics">
            <span class="metric-ms">{{ row.span.durationMs }} ms</span>
            <span
              v-if="row.span.promptTokens + row.span.completionTokens > 0"
              class="metric-tok"
            >
              {{ row.span.promptTokens + row.span.completionTokens }} tok
            </span>
          </div>
        </div>
      </div>

      <!-- 选中 Span 载荷脱敏检视区 -->
      <div v-if="selectedSpan" class="span-detail-card">
        <div class="detail-head">
          <div class="detail-title-line">
            <span :class="['span-kind-tag', selectedSpan.spanType]">
              {{ getSpanBadge(selectedSpan.spanType) }}
            </span>
            <strong class="detail-name">{{ selectedSpan.name }}</strong>
            <span v-if="selectedSpan.modelId" class="detail-model">{{ selectedSpan.modelId }}</span>
          </div>
          <div class="detail-telemetry">
            <span>Span: {{ selectedSpan.spanId }}</span>
            <span>耗时: {{ selectedSpan.durationMs }} ms</span>
            <span v-if="selectedSpan.estimatedCredits > 0">
              估算积分: {{ Number(selectedSpan.estimatedCredits).toFixed(4) }}
            </span>
          </div>
        </div>

        <div class="detail-io-grid">
          <div class="io-box">
            <div class="io-label">Input 脱敏摘要</div>
            <pre class="io-pre">{{ selectedSpan.inputSummary || '（无入参快照）' }}</pre>
          </div>
          <div class="io-box">
            <div class="io-label">Output 脱敏摘要</div>
            <pre class="io-pre">{{ selectedSpan.outputSummary || '（无出参快照）' }}</pre>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AgentSpanItem, AgentSpanType } from '@/api/trace'

const props = defineProps<{
  spans: AgentSpanItem[]
  traceDurationMs: number
  highlightedNodeId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select-node', nodeId: string | null): void
}>()

const selectedSpanId = ref<string | null>(null)

watch(
  () => props.spans,
  (list) => {
    const first = list[0]
    if (first && !list.some((s) => s.spanId === selectedSpanId.value)) {
      selectedSpanId.value = first.spanId
    } else if (!first) {
      selectedSpanId.value = null
    }
  },
  { immediate: true },
)

const selectedSpan = computed(() =>
  props.spans.find((s) => s.spanId === selectedSpanId.value) || null,
)

const minStartedAt = computed(() => {
  if (props.spans.length === 0) return 0
  return Math.min(...props.spans.map((s) => Number(s.startedAt || 0)))
})

const totalWindowMs = computed(() => {
  if (props.spans.length === 0) return Math.max(1, props.traceDurationMs)
  const origin = minStartedAt.value
  const maxEndOffset = Math.max(
    props.traceDurationMs,
    ...props.spans.map((s) => Number(s.startedAt || origin) - origin + Number(s.durationMs || 0)),
  )
  return Math.max(1, maxEndOffset)
})

interface FlattenedSpanRow {
  span: AgentSpanItem
  depth: number
  leftPct: number
  widthPct: number
}

const flattenedRows = computed<FlattenedSpanRow[]>(() => {
  const byParent = new Map<string | null, AgentSpanItem[]>()
  const spanIdSet = new Set(props.spans.map((s) => s.spanId))

  for (const span of props.spans) {
    const parentKey =
      span.parentSpanId && spanIdSet.has(span.parentSpanId)
        ? span.parentSpanId
        : null
    const list = byParent.get(parentKey) || []
    list.push(span)
    byParent.set(parentKey, list)
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => Number(a.startedAt) - Number(b.startedAt))
  }

  const ordered: Array<{ span: AgentSpanItem; depth: number }> = []
  const visited = new Set<string>()

  const walk = (parentId: string | null, depth: number) => {
    for (const item of byParent.get(parentId) || []) {
      if (visited.has(item.spanId)) continue
      visited.add(item.spanId)
      ordered.push({ span: item, depth: Math.min(5, depth) })
      walk(item.spanId, depth + 1)
    }
  }
  walk(null, 0)

  // 兜底补全潜在孤立节点
  for (const span of props.spans) {
    if (!visited.has(span.spanId)) {
      ordered.push({ span, depth: 0 })
    }
  }

  const origin = minStartedAt.value
  const total = totalWindowMs.value

  return ordered.map(({ span, depth }) => {
    const offsetMs = Math.max(0, Number(span.startedAt || origin) - origin)
    const leftPct = Math.min(98, (offsetMs / total) * 100)
    const rawWidthPct = (Math.max(1, Number(span.durationMs || 0)) / total) * 100
    const widthPct = Math.max(1.5, Math.min(100 - leftPct, rawWidthPct))
    return { span, depth, leftPct, widthPct }
  })
})

const getSpanBadge = (spanType: AgentSpanType) => {
  switch (spanType) {
    case 'workflow':
      return 'FLOW'
    case 'dag_node':
      return 'NODE'
    case 'llm':
      return 'LLM'
    case 'tool':
      return 'TOOL'
    case 'rag':
      return 'RAG'
    case 'memory':
      return 'MEM'
    case 'swarm_handoff':
      return 'SWARM'
    case 'channel_dispatch':
      return 'CHAN'
    default:
      return 'SPAN'
  }
}

const handleSelectRow = (span: AgentSpanItem) => {
  selectedSpanId.value = span.spanId
  emit('select-node', span.nodeId || null)
}
</script>

<style scoped>
.trace-waterfall {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.waterfall-empty {
  padding: 28px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
}

.waterfall-ruler {
  display: grid;
  grid-template-columns: 280px minmax(180px, 1fr) 150px;
  gap: 12px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px 8px 0 0;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

.waterfall-ruler .col-timeline {
  display: flex;
  justify-content: space-between;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.waterfall-ruler .col-metrics {
  text-align: right;
}

.waterfall-rows {
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  background: #ffffff;
  overflow: hidden;
}

.waterfall-row {
  display: grid;
  grid-template-columns: 280px minmax(180px, 1fr) 150px;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background-color 0.14s ease;
}

.waterfall-row:last-child {
  border-bottom: none;
}

.waterfall-row:hover {
  background: #f8fafc;
}

.waterfall-row.is-active {
  background: #eff6ff;
}

.waterfall-row.is-node-highlight:not(.is-active) {
  background: #f0f9ff;
}

.col-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.tree-elbow {
  width: 8px;
  height: 8px;
  border-left: 1.5px solid #cbd5e1;
  border-bottom: 1.5px solid #cbd5e1;
  flex-shrink: 0;
  margin-top: -3px;
}

.span-kind-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  flex-shrink: 0;
  background: #f1f5f9;
  color: #334155;
}

.span-kind-tag.llm {
  background: #eff6ff;
  color: #2563eb;
}

.span-kind-tag.rag {
  background: #f0f9ff;
  color: #0284c7;
}

.span-kind-tag.tool {
  background: #f0fdfa;
  color: #0d9488;
}

.span-kind-tag.dag_node,
.span-kind-tag.workflow {
  background: #f1f5f9;
  color: #0f172a;
}

.span-kind-tag.swarm_handoff {
  background: #fffbeb;
  color: #b45309;
}

.span-name {
  font-size: 12px;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-track {
  position: relative;
  height: 10px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 4px;
  background: #2563eb;
}

.bar-fill.kind-rag {
  background: #0284c7;
}

.bar-fill.kind-tool {
  background: #0d9488;
}

.bar-fill.kind-swarm_handoff {
  background: #d97706;
}

.bar-fill.status-failed {
  background: #ef4444;
}

.bar-fill.status-skipped {
  background: #94a3b8;
}

.col-metrics {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}

.metric-ms {
  color: #0f172a;
  font-weight: 500;
}

.metric-tok {
  color: #64748b;
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 4px;
}

.span-detail-card {
  margin-top: 4px;
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.detail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f1f5f9;
}

.detail-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-name {
  font-size: 13px;
  color: #0f172a;
}

.detail-model {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 1px 6px;
  border-radius: 4px;
}

.detail-telemetry {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.detail-io-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.io-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.io-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

.io-pre {
  margin: 0;
  padding: 8px 10px;
  max-height: 140px;
  overflow: auto;
  font-size: 11px;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #1e293b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 768px) {
  .waterfall-ruler,
  .waterfall-row {
    grid-template-columns: 1fr 90px;
  }

  .waterfall-ruler .col-timeline,
  .waterfall-row .col-timeline {
    display: none;
  }

  .detail-io-grid {
    grid-template-columns: 1fr;
  }
}
</style>
