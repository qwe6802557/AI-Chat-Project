<template>
  <section class="chat-stats-panel" aria-label="聊天统计面板">
    <div class="stats-header">
      <div class="stats-title-group">
        <PieChartOutlined class="stats-icon" />
        <span class="stats-title">会话概览</span>
      </div>
      <span class="stats-caption">已加载 {{ summary.visibleSessions }}/{{ summary.totalSessions }}</span>
    </div>

    <div class="stats-grid">
      <div class="stats-item">
        <span class="stats-label">总会话</span>
        <span class="stats-value total">{{ summary.totalSessions }}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">计费会话</span>
        <span class="stats-value consumed">{{ summary.billableSessions }}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">总 Token</span>
        <span class="stats-value remaining">{{ formatToken(summary.totalTokens) }}</span>
      </div>
    </div>

    <div class="stats-highlight">
      <div class="highlight-main">
        <span class="highlight-label">总成本估算</span>
        <strong class="highlight-value">¥{{ formatCost(summary.totalEstimatedCost) }}</strong>
      </div>
      <span class="highlight-chip">{{ summary.topModel || '暂无主力模型' }}</span>
    </div>

    <div class="stats-progress">
      <a-progress
        :percent="billablePercent"
        :show-info="false"
        stroke-color="#1570ef"
        trail-color="#f2f4f7"
      />
      <span class="progress-text">计费会话占比 {{ billablePercent }}%</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PieChartOutlined } from '@ant-design/icons-vue'
import type { ConversationStatsSummary } from '@/interface/conversation'

defineOptions({
  name: 'ChatStatsPanel',
})

interface Props {
  summary: ConversationStatsSummary
}

const props = defineProps<Props>()

const billablePercent = computed(() => {
  if (props.summary.totalSessions === 0) {
    return 0
  }
  return Math.round((props.summary.billableSessions / props.summary.totalSessions) * 100)
})

const formatCost = (value: number) => {
  return value.toFixed(value >= 1 ? 4 : 6)
}

const formatToken = (value: number) => {
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}k`
  }
  return `${value}`
}
</script>

<style scoped lang="scss">
.chat-stats-panel {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);

  .stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;

    .stats-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stats-icon {
      font-size: 18px;
      color: #1570ef;
    }

    .stats-title {
      font-size: 15px;
      font-weight: 600;
      color: #101828;
    }

    .stats-caption {
      font-size: 12px;
      color: #667085;
      white-space: nowrap;
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .stats-item {
    text-align: center;

    .stats-label {
      display: block;
      font-size: 12px;
      color: #667085;
      margin-bottom: 4px;
    }

    .stats-value {
      display: block;
      font-size: 18px;
      font-weight: 600;

      &.total {
        color: #101828;
      }

      &.consumed {
        color: #f59e0b;
      }

      &.remaining {
        color: #10b981;
      }
    }
  }

  .stats-highlight {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    margin-bottom: 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(0, 0, 0, 0.05);

    .highlight-main {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .highlight-label {
      font-size: 12px;
      color: #667085;
    }

    .highlight-value {
      font-size: 20px;
      font-weight: 700;
      color: #1570ef;
    }

    .highlight-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(21, 112, 239, 0.08);
      color: #1570ef;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .stats-progress {
    .progress-text {
      display: block;
      text-align: right;
      font-size: 12px;
      color: #667085;
      margin-top: 4px;
    }

    :deep(.ant-progress-bg) {
      height: 6px !important;
    }

    :deep(.ant-progress-inner) {
      border-radius: 3px;
    }
  }
}
</style>
