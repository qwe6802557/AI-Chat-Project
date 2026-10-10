<template>
  <div v-if="toolCalls && toolCalls.length > 0" class="tool-execution-container">
    <div
      v-for="tool in toolCalls"
      :key="tool.id"
      class="tool-card"
      :class="{
        'is-success': tool.result.status === 'success',
        'is-error': tool.result.status === 'error',
        'is-expanded': isExpanded(tool.id),
      }"
    >
      <div class="tool-card-header" @click="toggleExpand(tool.id)">
        <div class="header-left">
          <component :is="getToolIcon(tool.name)" class="tool-icon" />
          <span class="tool-name">{{ tool.title || tool.name }}</span>
          <span
            :class="[
              'status-badge',
              tool.result.status === 'success' ? 'badge-success' : 'badge-error',
            ]"
          >
            {{ tool.result.status === 'success' ? '执行成功' : '执行失败' }}
          </span>
          <span class="duration-tag">{{ tool.result.durationMs }}ms</span>
        </div>

        <div class="header-right">
          <DownOutlined :class="['expand-icon', { rotated: isExpanded(tool.id) }]" />
        </div>
      </div>

      <transition name="expand">
        <div v-if="isExpanded(tool.id)" class="tool-card-body">
          <!-- 调用参数 -->
          <div v-if="tool.args && Object.keys(tool.args).length > 0" class="section-block">
            <div class="section-title">调用参数</div>
            <pre class="code-block"><code>{{ formatJson(tool.args) }}</code></pre>
          </div>

          <!-- 执行结果输出 -->
          <div class="section-block">
            <div class="section-title">执行输出</div>
            <pre
              v-if="tool.result.rawOutput || tool.result.output"
              class="code-block output-block"
            ><code>{{ tool.result.rawOutput || formatJson(tool.result.output) }}</code></pre>
            <div v-else-if="tool.result.error" class="error-text">
              {{ tool.result.error }}
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
} from '@ant-design/icons-vue'
import type { ToolExecutionRecord } from '@/interface/tools'

defineOptions({
  name: 'ToolExecutionCard',
})

defineProps<{
  toolCalls?: ToolExecutionRecord[] | null
}>()

const expandedMap = ref<Record<string, boolean>>({})

const isExpanded = (id: string): boolean => {
  return !!expandedMap.value[id]
}

const toggleExpand = (id: string) => {
  expandedMap.value[id] = !expandedMap.value[id]
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
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  font-size: 12px;
  transition: all 0.18s ease;

  &.is-success {
    border-color: #e2e8f0;
  }

  &.is-error {
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
      background: #f1f5f9;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;

      .tool-icon {
        font-size: 14px;
        color: #2563eb;
      }

      .tool-name {
        font-weight: 600;
        color: #1e293b;
      }

      .status-badge {
        font-size: 11px;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 500;

        &.badge-success {
          color: #166534;
          background: #dcfce7;
        }

        &.badge-error {
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

      .error-text {
        padding: 8px 10px;
        background: #fef2f2;
        color: #b91c1c;
        border-radius: 6px;
        font-size: 12px;
      }
    }
  }
}
</style>
