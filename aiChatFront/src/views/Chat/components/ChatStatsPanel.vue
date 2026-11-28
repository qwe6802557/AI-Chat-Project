<template>
  <section class="chat-stats-panel" aria-label="聊天统计面板">
    <div class="stats-header">
      <div class="stats-title">
        <PieChartOutlined class="stats-icon" />
        <div>
          <h4>会话概览</h4>
          <p>聚合当前已加载会话的模型消耗与计费情况</p>
        </div>
      </div>
      <span class="stats-chip">{{ summary.topModel || '暂无主力模型' }}</span>
    </div>

    <div class="hero-figure">
      <div class="hero-main">
        <span class="hero-label">总消耗估算</span>
        <strong class="hero-value">{{ formatCost(summary.totalEstimatedCost) }}</strong>
      </div>
      <div class="hero-side">
        <span class="hero-side-label">计费占比</span>
        <strong class="hero-side-value">{{ billablePercent }}%</strong>
      </div>
    </div>

    <div class="stats-list">
      <div class="stats-row">
        <span>总会话</span>
        <strong>{{ summary.totalSessions }}</strong>
      </div>
      <div class="stats-row">
        <span>计费会话</span>
        <strong>{{ summary.billableSessions }}</strong>
      </div>
      <div class="stats-row">
        <span>总 Token</span>
        <strong>{{ formatToken(summary.totalTokens) }}</strong>
      </div>
      <div class="stats-row">
        <span>已加载摘要</span>
        <strong>{{ summary.visibleSessions }} / {{ summary.totalSessions }}</strong>
      </div>
    </div>

    <div v-if="modelBreakdown && modelBreakdown.length > 0" class="model-breakdown">
      <div class="breakdown-header">
        <span>常用模型消耗分布</span>
        <span class="breakdown-hint">按已加载会话</span>
      </div>
      <div class="breakdown-bars">
        <div
          v-for="item in modelBreakdown"
          :key="item.model"
          class="breakdown-row"
        >
          <div class="breakdown-meta">
            <code class="breakdown-model">{{ item.model }}</code>
            <span class="breakdown-figures">
              {{ item.sessions }} 会话 · {{ formatToken(item.tokens) }} tok · {{ item.percentage }}%
            </span>
          </div>
          <div class="breakdown-track">
            <div
              class="breakdown-fill"
              :style="{ width: `${Math.max(item.percentage, 3)}%` }"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PieChartOutlined } from '@ant-design/icons-vue'
import type { ConversationStatsSummary } from '@/interface/conversation'
import type { ModelUsageBreakdownItem } from '../utils/conversationInsights'

defineOptions({
  name: 'ChatStatsPanel',
})

interface Props {
  summary: ConversationStatsSummary
  modelBreakdown?: ModelUsageBreakdownItem[]
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
  return value.toLocaleString()
}
</script>

<style scoped lang="scss">
.chat-stats-panel {
  height: 100%;
  padding: 16px 18px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.stats-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.stats-title {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #0f172a;
  }

  p {
    margin: 2px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: #64748b;
  }
}

.stats-icon {
  font-size: 16px;
  margin-top: 3px;
  color: #1570ef;
  flex-shrink: 0;
}

.stats-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  max-width: 170px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.hero-figure {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  margin-bottom: 4px;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
}

.hero-main {
  .hero-label {
    display: block;
    margin-bottom: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
  }

  .hero-value {
    display: block;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    font-size: 24px;
    line-height: 1.05;
    font-weight: 700;
    color: #0f172a;
  }
}

.hero-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;

  .hero-side-label {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 4px;
  }

  .hero-side-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    font-size: 20px;
    line-height: 1.05;
    font-weight: 700;
    color: #1570ef;
  }
}

.stats-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  padding: 10px 0 4px;
}

.stats-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #f1f5f9;

  span {
    font-size: 12px;
    color: #64748b;
  }

  strong {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    text-align: right;
  }
}

.model-breakdown {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.breakdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.breakdown-hint {
  font-weight: 400;
  font-size: 11px;
  color: #94a3b8;
}

.breakdown-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.breakdown-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.breakdown-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.breakdown-model {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breakdown-figures {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  flex-shrink: 0;
}

.breakdown-track {
  height: 4px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
}

.breakdown-fill {
  height: 100%;
  border-radius: 999px;
  background: #1570ef;
  transition: width 0.24s ease;
}

@media (max-width: 640px) {
  .stats-list {
    grid-template-columns: 1fr;
  }
}
</style>
