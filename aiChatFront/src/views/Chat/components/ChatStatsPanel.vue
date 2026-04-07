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

    <div class="stats-progress">
      <a-progress
        :percent="billablePercent"
        :show-info="false"
        stroke-color="#1570ef"
        trail-color="#eaecf0"
      />
      <span class="progress-text">有成本记录的会话占比 {{ billablePercent }}%</span>
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
  return value.toLocaleString()
}
</script>

<style scoped lang="scss">
.chat-stats-panel {
  height: 100%;
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
}

.stats-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.stats-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #101828;
  }

  p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #667085;
  }
}

.stats-icon {
  width: 18px;
  height: 18px;
  margin-top: 4px;
  color: #1570ef;
  flex-shrink: 0;
}

.stats-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  max-width: 180px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
  color: #344054;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.hero-figure {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 12px;
  padding: 14px 0 16px;
  margin-bottom: 8px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.hero-main {
  .hero-label {
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #667085;
    text-transform: uppercase;
  }

  .hero-value {
    display: block;
    font-size: 30px;
    line-height: 0.95;
    font-weight: 700;
    color: #101828;
  }
}

.hero-side {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  text-align: right;

  .hero-side-label {
    font-size: 11px;
    color: #667085;
    margin-bottom: 6px;
  }

  .hero-side-value {
    font-size: 22px;
    line-height: 1;
    font-weight: 700;
    color: #1570ef;
  }
}

.stats-list {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.stats-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);

  &:last-child {
    border-bottom: none;
  }

  span {
    font-size: 12px;
    color: #667085;
  }

  strong {
    font-size: 14px;
    font-weight: 600;
    color: #101828;
    text-align: right;
  }
}

.stats-progress {
  .progress-text {
    display: block;
    margin-top: 4px;
    text-align: right;
    font-size: 11px;
    color: #667085;
  }

  :deep(.ant-progress-inner) {
    border-radius: 999px;
  }

  :deep(.ant-progress-bg) {
    height: 6px !important;
  }
}

@media (max-width: 640px) {
  .chat-stats-panel {
    padding: 14px 16px;
    border-radius: 20px;
  }

  .stats-header,
  .hero-figure {
    grid-template-columns: 1fr;
    display: grid;
  }

  .stats-header {
    gap: 10px;
  }

  .hero-side {
    align-items: flex-start;
    text-align: left;
  }
}

@media (max-height: 820px) {
  .chat-stats-panel {
    padding: 14px 16px;
  }

  .hero-main .hero-value {
    font-size: 26px;
  }

  .hero-side .hero-side-value {
    font-size: 20px;
  }
}
</style>
