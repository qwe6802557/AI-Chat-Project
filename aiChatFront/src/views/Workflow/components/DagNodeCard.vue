<template>
  <div
    :class="[
      'dag-node-card',
      `node-type-${type}`,
      `runtime-${runtimeStatus || 'idle'}`,
      { 'is-selected': selected },
    ]"
  >
    <Handle
      v-if="type !== 'start'"
      type="target"
      :position="Position.Left"
      class="dag-handle target-handle"
    />

    <div class="node-accent-bar" :style="{ backgroundColor: meta.color }" />

    <div class="node-body">
      <div class="node-header">
        <span class="node-icon-box" :style="{ color: meta.color, backgroundColor: meta.softBg }">
          <component :is="meta.icon" />
        </span>
        <div class="node-title-wrap">
          <div class="node-title" :title="data?.label || meta.defaultLabel">
            {{ data?.label || meta.defaultLabel }}
          </div>
          <div class="node-type-code">{{ meta.code }}</div>
        </div>

        <span v-if="runtimeStatus" :class="['runtime-dot', runtimeStatus]" :title="statusLabel" />
      </div>

      <div v-if="subtitleText" class="node-subtitle" :title="subtitleText">
        {{ subtitleText }}
      </div>

      <div v-if="type === 'condition'" class="condition-branches-preview">
        <div
          v-for="rule in conditionRules"
          :key="rule.id"
          class="branch-row"
        >
          <span class="branch-pill">{{ rule.label || rule.id }}</span>
          <Handle
            :id="rule.id"
            type="source"
            :position="Position.Right"
            class="dag-handle branch-handle"
          />
        </div>
        <div class="branch-row is-else">
          <span class="branch-pill">默认 Else</span>
          <Handle
            id="else"
            type="source"
            :position="Position.Right"
            class="dag-handle branch-handle"
          />
        </div>
      </div>

      <div v-if="durationMs !== undefined || errorText" class="node-telemetry-row">
        <span v-if="durationMs !== undefined" class="telemetry-ms">{{ durationMs }} ms</span>
        <span v-if="errorText" class="telemetry-err" :title="errorText">执行异常</span>
      </div>
    </div>

    <Handle
      v-if="type !== 'end' && type !== 'condition'"
      type="source"
      :position="Position.Right"
      class="dag-handle source-handle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, type Component, type Ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import {
  PlayCircleOutlined,
  RobotOutlined,
  DatabaseOutlined,
  ToolOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons-vue'
import type { DagNodeData, DagNodeRuntimeStatus, DagNodeType } from '@/api/workflow'

export interface DagRuntimeInjection {
  statusMap: Ref<Record<string, DagNodeRuntimeStatus>>
  durationMap: Ref<Record<string, number>>
  errorMap: Ref<Record<string, string>>
}

const props = defineProps<{
  id: string
  type: DagNodeType
  data: DagNodeData
  selected?: boolean
}>()

const runtime = inject<DagRuntimeInjection | null>('dagRuntimeState', null)

const runtimeStatus = computed(() => runtime?.statusMap.value?.[props.id])
const durationMs = computed(() => runtime?.durationMap.value?.[props.id])
const errorText = computed(() => runtime?.errorMap.value?.[props.id])

const statusLabel = computed(() => {
  switch (runtimeStatus.value) {
    case 'running':
      return '运行中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '执行失败'
    case 'skipped':
      return '条件未命中已跳过'
    default:
      return ''
  }
})

const NODE_META: Record<
  DagNodeType,
  { code: string; defaultLabel: string; color: string; softBg: string; icon: Component }
> = {
  start: {
    code: 'START',
    defaultLabel: '触发输入',
    color: '#0f172a',
    softBg: '#f1f5f9',
    icon: PlayCircleOutlined,
  },
  agent: {
    code: 'AGENT',
    defaultLabel: '智能体节点',
    color: '#2563eb',
    softBg: '#eff6ff',
    icon: RobotOutlined,
  },
  rag: {
    code: 'RAG',
    defaultLabel: '知识检索',
    color: '#0284c7',
    softBg: '#f0f9ff',
    icon: DatabaseOutlined,
  },
  tool: {
    code: 'TOOL',
    defaultLabel: '内置工具',
    color: '#0d9488',
    softBg: '#f0fdfa',
    icon: ToolOutlined,
  },
  condition: {
    code: 'BRANCH',
    defaultLabel: '条件路由',
    color: '#d97706',
    softBg: '#fffbeb',
    icon: BranchesOutlined,
  },
  end: {
    code: 'END',
    defaultLabel: '输出汇聚',
    color: '#059669',
    softBg: '#ecfdf5',
    icon: CheckCircleOutlined,
  },
}

const meta = computed(() => NODE_META[props.type] || NODE_META.agent)

const conditionRules = computed(() => {
  if (props.type !== 'condition') return []
  return Array.isArray(props.data?.rules) ? props.data.rules : []
})

const subtitleText = computed(() => {
  const d = props.data || {}
  switch (props.type) {
    case 'start':
      return d.description || '会话输入与变量入口'
    case 'agent':
      if (d.modelId) return `模型: ${d.modelId}`
      if (d.roleId) return '已绑定智能体角色'
      return d.description || '自动匹配默认推理模型'
    case 'rag': {
      const cnt = d.knowledgeBaseIds?.length || 0
      return cnt > 0 ? `已挂载 ${cnt} 个知识库 · Top ${d.topK || 5}` : '尚未选择目标知识库'
    }
    case 'tool':
      return d.toolName ? `插件: ${d.toolName}` : '尚未选择内置工具'
    case 'condition':
      return `${conditionRules.value.length} 条分支规则 + Else`
    case 'end':
      return d.responseTemplate ? '已配置模板汇总输出' : '自动汇聚末层节点结果'
    default:
      return d.description || ''
  }
})
</script>

<style scoped>
.dag-node-card {
  position: relative;
  display: flex;
  width: 220px;
  min-height: 76px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.16s ease, box-shadow 0.16s ease, opacity 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.dag-node-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.07);
}

.dag-node-card.is-selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.dag-node-card.runtime-running {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
}

.dag-node-card.runtime-completed {
  border-color: #10b981;
}

.dag-node-card.runtime-failed {
  border-color: #ef4444;
  background: #fef2f2;
}

.dag-node-card.runtime-skipped {
  opacity: 0.52;
  border-style: dashed;
}

.node-accent-bar {
  width: 4px;
  flex-shrink: 0;
  border-radius: 10px 0 0 10px;
}

.node-body {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-icon-box {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.node-title-wrap {
  flex: 1;
  min-width: 0;
}

.node-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-type-code {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.05em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.runtime-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.runtime-dot.running {
  background: #2563eb;
  animation: pulseDot 1.2s ease-in-out infinite;
}

.runtime-dot.completed {
  background: #10b981;
}

.runtime-dot.failed {
  background: #ef4444;
}

.runtime-dot.skipped {
  background: #94a3b8;
}

@keyframes pulseDot {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.6;
  }
}

.node-subtitle {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.condition-branches-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
}

.branch-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 22px;
  padding-right: 4px;
}

.branch-pill {
  font-size: 11px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 1px 6px;
  max-width: 155px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.branch-row.is-else .branch-pill {
  color: #64748b;
}

.node-telemetry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  border-top: 1px dashed #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}

.telemetry-ms {
  color: #475569;
}

.telemetry-err {
  color: #ef4444;
  font-weight: 500;
}

.dag-handle {
  width: 9px;
  height: 9px;
  background: #ffffff;
  border: 2px solid #94a3b8;
  border-radius: 50%;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.dag-handle:hover {
  border-color: #2563eb;
  transform: scale(1.25);
}

.branch-handle {
  right: -5px !important;
  top: 50% !important;
}
</style>
