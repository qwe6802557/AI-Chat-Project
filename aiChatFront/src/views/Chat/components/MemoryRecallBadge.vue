<template>
  <div v-if="hasRecallData" class="memory-recall-badge">
    <button
      type="button"
      class="recall-summary-bar"
      :class="{ expanded: isExpanded }"
      @click="isExpanded = !isExpanded"
    >
      <div class="summary-left">
        <span class="mono-tag">MEM</span>
        <span class="summary-text">{{ summaryLabel }}</span>
      </div>
      <DownOutlined :class="['toggle-arrow', { 'is-expanded': isExpanded }]" />
    </button>

    <div v-if="isExpanded" class="recall-details-panel">
      <!-- 长期核心画像召回 -->
      <div v-if="memoryRecall.profileRecalled && memoryRecall.coreSummary" class="recall-item core-item">
        <div class="item-header">
          <span class="category-pill core">CORE PROFILE</span>
          <span class="hint-text font-mono">全局画像注入</span>
        </div>
        <div class="item-body">{{ memoryRecall.coreSummary }}</div>
      </div>

      <!-- 日常情境记忆召回 -->
      <div
        v-for="item in memoryRecall.items"
        :key="item.id"
        class="recall-item daily-item"
      >
        <div class="item-header">
          <span class="category-pill">{{ formatCategory(item.category) }}</span>
          <span v-if="item.similarity" class="similarity-score font-mono">
            相似度 {{ (item.similarity * 100).toFixed(0) }}%
          </span>
        </div>
        <div class="item-body">{{ item.summary }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 消息流内记忆动态召回微标组件
 */
import { ref, computed } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'
import type { MemoryRecallPayload } from '@/interface/memory'

defineOptions({
  name: 'MemoryRecallBadge',
})

interface Props {
  memoryRecall: MemoryRecallPayload
}

const props = defineProps<Props>()
const isExpanded = ref(false)

const hasRecallData = computed(() => {
  return props.memoryRecall && (props.memoryRecall.profileRecalled || (props.memoryRecall.items && props.memoryRecall.items.length > 0))
})

const summaryLabel = computed(() => {
  const parts: string[] = []
  if (props.memoryRecall.profileRecalled) {
    parts.push('核心画像')
  }
  const count = props.memoryRecall.items?.length || 0
  if (count > 0) {
    parts.push(`${count} 条情境记忆`)
  }
  return parts.length > 0 ? `已激活 ${parts.join(' + ')}` : '已召回相关记忆'
})

const formatCategory = (cat: string) => {
  switch (cat) {
    case 'decision':
      return 'DECISION · 决策'
    case 'preference':
      return 'PREF · 偏好'
    case 'work_progress':
      return 'PROGRESS · 进展'
    case 'fact':
      return 'FACT · 事实'
    case 'insight':
      return 'INSIGHT · 洞察'
    default:
      return cat.toUpperCase()
  }
}
</script>

<style scoped lang="scss">
.memory-recall-badge {
  margin: 6px 0 10px 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  .recall-summary-bar {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 11px;
    color: #475467;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;

    &:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #1e293b;
    }

    &.expanded {
      background: #f1f5f9;
      border-color: #94a3b8;
    }

    .summary-left {
      display: inline-flex;
      align-items: center;
      gap: 6px;

      .mono-tag {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.05em;
        background: #e2e8f0;
        color: #334155;
        padding: 1px 4px;
        border-radius: 3px;
      }

      .summary-text {
        font-weight: 500;
      }
    }

    .toggle-arrow {
      font-size: 9px;
      color: #94a3b8;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &.is-expanded {
        transform: rotate(180deg);
      }
    }
  }

  .recall-details-panel {
    margin-top: 6px;
    max-width: 520px;
    width: 100%;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

    .recall-item {
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 12px;
      line-height: 1.5;

      &.core-item {
        background: #fafafa;
        border-color: #e5e5e5;
      }

      .item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;

        .category-pill {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10px;
          font-weight: 600;
          color: #475467;
          background: #e2e8f0;
          padding: 1px 5px;
          border-radius: 3px;
          letter-spacing: 0.02em;

          &.core {
            color: #0f172a;
            background: #e2e8f0;
            border: 1px solid #cbd5e1;
          }
        }

        .similarity-score,
        .hint-text {
          font-size: 10px;
          color: #64748b;
        }
      }

      .item-body {
        color: #334155;
        font-size: 12px;
        white-space: pre-wrap;
        word-break: break-all;
      }
    }
  }

  .font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
}
</style>
