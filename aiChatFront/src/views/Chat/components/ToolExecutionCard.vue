<template>
  <div v-if="toolCalls && toolCalls.length > 0" class="tool-execution-container">
    <div
      v-for="tool in toolCalls"
      :key="tool.id"
      class="tool-card"
      :class="{
        'is-calling': isCalling(tool),
        'is-executing': isExecuting(tool),
        'is-completed': isCompleted(tool),
        'is-failed': isFailed(tool),
        'is-expanded': isExpanded(tool.id),
      }"
    >
      <div class="tool-card-header" @click="toggleExpand(tool.id)">
        <div class="header-left">
          <component :is="getToolIcon(tool.name)" class="tool-icon" />
          <span class="tool-name">{{ getToolTitle(tool) }}</span>
          <span :class="['status-badge', getStatusBadgeClass(tool)]">
            <LoadingOutlined v-if="isCalling(tool) || isExecuting(tool)" spin class="status-spinner" />
            <CheckCircleFilled v-else-if="isCompleted(tool)" class="status-icon" />
            <CloseCircleFilled v-else class="status-icon" />
            <span>{{ getStatusLabel(tool) }}</span>
          </span>
          <span v-if="getDuration(tool) !== null" class="duration-tag">
            {{ getDuration(tool) }}ms
          </span>
        </div>

        <div class="header-right">
          <DownOutlined :class="['expand-icon', { rotated: isExpanded(tool.id) }]" />
        </div>
      </div>

      <transition name="expand">
        <div v-if="isExpanded(tool.id)" class="tool-card-body">
          <!-- 调用参数 -->
          <div v-if="hasArgs(tool)" class="section-block">
            <div class="section-title">调用参数</div>
            <pre class="code-block"><code>{{ formatJson(getArgs(tool)) }}</code></pre>
          </div>

          <!-- 执行结果与输出 -->
          <div class="section-block">
            <div class="section-title">执行输出</div>
            <div v-if="isCalling(tool) || isExecuting(tool)" class="running-indicator">
              <LoadingOutlined spin />
              <span>正在等待外部工具执行返回...</span>
            </div>
            <div v-else-if="getErrorMessage(tool)" class="error-text">
              {{ getErrorMessage(tool) }}
            </div>
            <pre
              v-else-if="hasOutput(tool)"
              class="code-block output-block"
            ><code>{{ formatOutput(tool) }}</code></pre>
            <div v-else class="empty-output">
              (无返回值)
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  CodeOutlined,
  GlobalOutlined,
  CalculatorOutlined,
  CloudOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  DownOutlined,
  AppstoreOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons-vue'
import type { ToolCallItem } from '@/interface/chat'

defineOptions({
  name: 'ToolExecutionCard',
})

defineProps<{
  toolCalls?: ToolCallItem[] | null
}>()

const expandedMap = ref<Record<string, boolean>>({})

const isExpanded = (id: string): boolean => {
  return !!expandedMap.value[id]
}

const toggleExpand = (id: string) => {
  expandedMap.value[id] = !expandedMap.value[id]
}

const getStatus = (tool: ToolCallItem): 'calling' | 'executing' | 'completed' | 'failed' => {
  if (tool.status === 'calling') return 'calling'
  if (tool.status === 'executing') return 'executing'
  if (tool.status === 'completed' || tool.status === 'success') return 'completed'
  if (tool.status === 'failed' || tool.status === 'error') return 'failed'

  if (tool.result) {
    if (typeof tool.result === 'object' && tool.result.status === 'error') {
      return 'failed'
    }
    return 'completed'
  }

  return 'calling'
}

const isCalling = (tool: ToolCallItem): boolean => getStatus(tool) === 'calling'
const isExecuting = (tool: ToolCallItem): boolean => getStatus(tool) === 'executing'
const isCompleted = (tool: ToolCallItem): boolean => getStatus(tool) === 'completed'
const isFailed = (tool: ToolCallItem): boolean => getStatus(tool) === 'failed'

const getStatusLabel = (tool: ToolCallItem): string => {
  const status = getStatus(tool)
  switch (status) {
    case 'calling':
      return '准备调用'
    case 'executing':
      return '正在执行...'
    case 'completed':
      return '执行成功'
    case 'failed':
      return '执行失败'
  }
}

const getStatusBadgeClass = (tool: ToolCallItem): string => {
  const status = getStatus(tool)
  switch (status) {
    case 'calling':
      return 'badge-calling'
    case 'executing':
      return 'badge-executing'
    case 'completed':
      return 'badge-completed'
    case 'failed':
      return 'badge-failed'
  }
}

const getDuration = (tool: ToolCallItem): number | null => {
  if (typeof tool.durationMs === 'number') {
    return tool.durationMs
  }
  if (tool.result && typeof tool.result === 'object' && typeof tool.result.durationMs === 'number') {
    return tool.result.durationMs
  }
  return null
}

const getArgs = (tool: ToolCallItem) => {
  return tool.arguments ?? tool.args ?? null
}

const hasArgs = (tool: ToolCallItem): boolean => {
  const args = getArgs(tool)
  if (!args) return false
  if (typeof args === 'object') {
    return Object.keys(args).length > 0
  }
  return true
}

const getErrorMessage = (tool: ToolCallItem): string | null => {
  if (tool.result && typeof tool.result === 'object') {
    if (tool.result.error) return String(tool.result.error)
    if (tool.result.status === 'error' && tool.result.message) return String(tool.result.message)
  }
  if (isFailed(tool)) {
    return '工具执行未成功返回结果'
  }
  return null
}

const hasOutput = (tool: ToolCallItem): boolean => {
  return tool.result !== undefined && tool.result !== null
}

const formatOutput = (tool: ToolCallItem): string => {
  const res = tool.result
  if (res && typeof res === 'object') {
    if (res.rawOutput) return String(res.rawOutput)
    if (res.output !== undefined) return formatJson(res.output)
  }
  return formatJson(res)
}

const getToolTitle = (tool: ToolCallItem): string => {
  if (tool.title) return tool.title

  switch (tool.name) {
    case 'calculator':
      return '计算器'
    case 'clock_calendar':
      return '时钟与日历'
    case 'code_interpreter':
      return '代码沙箱'
    case 'url_fetcher':
      return '网页读取'
    case 'weather':
      return '天气查询'
    case 'web_search_v2':
      return '深度联网搜索'
    default:
      return tool.name
  }
}

const getToolIcon = (name: string) => {
  switch (name) {
    case 'code_interpreter':
      return CodeOutlined
    case 'web_search_v2':
      return GlobalOutlined
    case 'calculator':
      return CalculatorOutlined
    case 'weather':
      return CloudOutlined
    case 'clock_calendar':
      return ClockCircleOutlined
    case 'url_fetcher':
      return LinkOutlined
    default:
      return AppstoreOutlined
  }
}

const formatJson = (val: any): string => {
  if (typeof val === 'string') return val
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}
</script>

<style scoped lang="scss">
.tool-execution-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.tool-card {
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  font-size: 12px;
  transition: all 0.2s ease;

  &.is-calling {
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  &.is-executing {
    border-color: #93c5fd;
    background: #f0f7ff;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
  }

  &.is-completed {
    border-color: #e2e8f0;
    background: #f8fafc;
  }

  &.is-failed {
    border-color: #fecaca;
    background: #fff5f5;
  }

  .tool-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;

    &:hover {
      background: rgba(15, 23, 42, 0.03);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      .tool-icon {
        font-size: 14px;
        color: #2563eb;
      }

      .tool-name {
        font-weight: 600;
        color: #1e293b;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 500;

        .status-spinner {
          font-size: 10px;
        }

        .status-icon {
          font-size: 11px;
        }

        &.badge-calling {
          color: #475467;
          background: #f2f4f7;
        }

        &.badge-executing {
          color: #1d4ed8;
          background: #dbeafe;
        }

        &.badge-completed {
          color: #166534;
          background: #dcfce7;
        }

        &.badge-failed {
          color: #991b1b;
          background: #fee2e2;
        }
      }

      .duration-tag {
        font-size: 11px;
        color: #64748b;
        font-family: monospace;
      }
    }

    .header-right {
      .expand-icon {
        font-size: 10px;
        color: #94a3b8;
        transition: transform 0.2s ease;

        &.rotated {
          transform: rotate(180deg);
        }
      }
    }
  }

  .tool-card-body {
    padding: 10px 12px;
    border-top: 1px solid #e2e8f0;
    background: #ffffff;

    .section-block {
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }

      .section-title {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .code-block {
        margin: 0;
        padding: 8px 10px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 6px;
        font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
        font-size: 11px;
        line-height: 1.45;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 240px;
      }

      .running-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: #f0f7ff;
        color: #2563eb;
        border-radius: 6px;
        font-size: 12px;
      }

      .error-text {
        padding: 8px 10px;
        background: #fef2f2;
        color: #b91c1c;
        border-radius: 6px;
        font-size: 12px;
      }

      .empty-output {
        font-size: 11px;
        color: #94a3b8;
        font-style: italic;
        padding: 4px 0;
      }
    }
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease-out;
  max-height: 600px;
  opacity: 1;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
}
</style>
