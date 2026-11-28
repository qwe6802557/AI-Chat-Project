<template>
  <div
    v-if="timeline && timeline.length > 0"
    :class="['swarm-timeline-card', { expanded: isExpanded, running: isActiveFlow }]"
  >
    <button
      type="button"
      class="timeline-header"
      :aria-expanded="isExpanded"
      @click="toggleExpand"
    >
      <div class="header-left">
        <span :class="['timeline-badge-icon', { 'is-active': isActiveFlow }]">
          <LoadingOutlined v-if="isActiveFlow" spin />
          <BranchesOutlined v-else />
        </span>
        <span class="timeline-title">多智能体协同编排</span>
        <span class="event-count-badge">{{ timeline.length }} 节点</span>
        <span v-if="!isExpanded && summaryDurationLabel" class="summary-duration-pill">
          {{ summaryDurationLabel }}
        </span>
      </div>

      <div class="header-right">
        <span :class="['summary-status-text', summaryStatusClass]">
          {{ isActiveFlow ? '协同执行中' : isAnyFailed ? '部分异常' : '已就绪' }}
        </span>
        <DownOutlined :class="['expand-icon', { rotated: isExpanded }]" />
      </div>
    </button>

    <transition name="collapse">
      <div v-if="isExpanded" class="timeline-body">
        <div class="timeline-track">
          <div
            v-for="(event, idx) in timeline"
            :key="event.id || idx"
            :class="['timeline-node', `status-${event.status}`, `type-${event.type}`]"
          >
            <!-- 节点导轨与状态指示 -->
            <div class="node-rail">
              <span class="node-bullet">
                <LoadingOutlined v-if="event.status === 'running'" spin class="bullet-spinner" />
                <CheckCircleFilled v-else-if="event.status === 'completed'" class="bullet-icon completed" />
                <CloseCircleFilled v-else-if="event.status === 'failed'" class="bullet-icon failed" />
                <span v-else class="bullet-dot" />
              </span>
              <div v-if="idx < timeline.length - 1" class="node-line" />
            </div>

            <!-- 节点内容卡片 -->
            <div class="node-content">
              <div class="node-meta">
                <span class="agent-routing">
                  <span class="agent-pill from">{{ event.fromAgent }}</span>
                  <ArrowRightOutlined class="route-arrow" />
                  <span class="agent-pill to">{{ event.toAgent }}</span>
                </span>

                <div class="telemetry-tags">
                  <span v-if="event.modelId" class="telemetry-pill model">
                    {{ event.modelId }}
                  </span>
                  <span v-if="event.durationMs !== undefined && event.durationMs !== null" class="telemetry-pill duration">
                    {{ event.durationMs }}ms
                  </span>
                  <span :class="['status-pill', event.status]">
                    {{ getStatusText(event.status) }}
                  </span>
                </div>
              </div>

              <!-- 任务目标描述 -->
              <div v-if="event.task" class="node-task">
                {{ event.task }}
              </div>

              <!-- 局部执行产出摘要 -->
              <div v-if="event.outputSnippet" class="node-output-box">
                <pre class="monospace-snippet"><code>{{ event.outputSnippet }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  BranchesOutlined,
  DownOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import type { SwarmTimelineEvent } from '@/interface/chat'

const props = withDefaults(
  defineProps<{
    timeline: SwarmTimelineEvent[]
    /** 当前消息是否仍处于流式生成中 */
    streaming?: boolean
    /** 初始是否展开，对话场景历史态默认收起为单行轻量条 */
    defaultExpanded?: boolean
    /** 流式或运行结束收敛后是否自动折叠为单行轻量条 */
    autoCollapseOnComplete?: boolean
  }>(),
  {
    streaming: false,
    defaultExpanded: true,
    autoCollapseOnComplete: false,
  },
)

const hasRunningNode = computed(() =>
  props.timeline.some((evt) => evt.status === 'running'),
)
const isActiveFlow = computed(() => Boolean(props.streaming || hasRunningNode.value))
const isAnyFailed = computed(() =>
  props.timeline.some((evt) => evt.status === 'failed'),
)

const summaryDurationLabel = computed(() => {
  const maxDuration = props.timeline.reduce((acc, evt) => {
    const val = Number(evt.durationMs || 0)
    return val > acc ? val : acc
  }, 0)
  if (maxDuration <= 0) return ''
  return maxDuration >= 1000 ? `${(maxDuration / 1000).toFixed(1)}s` : `${maxDuration}ms`
})

const summaryStatusClass = computed(() => {
  if (isActiveFlow.value) return 'is-running'
  if (isAnyFailed.value) return 'is-failed'
  return 'is-completed'
})

const userToggled = ref(false)
const isExpanded = ref(props.defaultExpanded || isActiveFlow.value)

watch(isActiveFlow, (active, prevActive) => {
  if (!props.autoCollapseOnComplete || userToggled.value) return
  if (active) {
    isExpanded.value = true
  } else if (prevActive && !active) {
    isExpanded.value = false
  }
})

const toggleExpand = () => {
  userToggled.value = true
  isExpanded.value = !isExpanded.value
}

const getStatusText = (status: SwarmTimelineEvent['status']) => {
  switch (status) {
    case 'running':
      return '执行中'
    case 'completed':
      return '已就绪'
    case 'failed':
      return '异常阻断'
    case 'skipped':
      return '分支跳过'
    default:
      return status
  }
}
</script>

<style scoped>
.swarm-timeline-card {
  width: fit-content;
  max-width: 100%;
  margin: 6px 0 8px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  overflow: hidden;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    border-radius 0.2s ease,
    box-shadow 0.2s ease;
}

.swarm-timeline-card:not(.expanded):hover {
  background: #f1f5f9;
  border-color: rgba(15, 23, 42, 0.14);
}

.swarm-timeline-card.expanded {
  width: 100%;
  border-radius: 12px;
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
}

.swarm-timeline-card.running {
  border-color: rgba(37, 99, 235, 0.24);
  background: rgba(239, 246, 255, 0.45);
}

.timeline-header {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 11px;
  background: transparent;
  border: none;
  cursor: pointer;
  user-select: none;
  text-align: left;
}

.swarm-timeline-card.expanded .timeline-header {
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  padding: 8px 12px;
}

.swarm-timeline-card.expanded .timeline-header:hover {
  background: #f1f5f9;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex-wrap: wrap;
}

.header-right {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

.timeline-badge-icon {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  flex-shrink: 0;
}

.timeline-badge-icon.is-active {
  background: rgba(37, 99, 235, 0.14);
  color: #1d4ed8;
}

.timeline-title {
  font-size: 12.5px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.event-count-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  padding: 1px 7px;
  background: rgba(15, 23, 42, 0.05);
  color: #475569;
  border-radius: 999px;
}

.summary-duration-pill {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: #64748b;
}

.summary-status-text {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 999px;
}

.summary-status-text.is-running {
  background: #dbeafe;
  color: #1d4ed8;
}

.summary-status-text.is-completed {
  background: #dcfce7;
  color: #166534;
}

.summary-status-text.is-failed {
  background: #fee2e2;
  color: #991b1b;
}

.expand-icon {
  font-size: 11px;
  color: #64748b;
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

.timeline-body {
  padding: 12px 14px;
  background: #ffffff;
}

.timeline-track {
  display: flex;
  flex-direction: column;
}

.timeline-node {
  display: flex;
  position: relative;
}

.node-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
  margin-right: 8px;
}

.node-bullet {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.bullet-spinner {
  font-size: 12px;
  color: #2563eb;
}

.bullet-icon.completed {
  font-size: 12px;
  color: #10b981;
}

.bullet-icon.failed {
  font-size: 12px;
  color: #ef4444;
}

.bullet-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
}

.node-line {
  width: 1px;
  flex: 1;
  background: #e2e8f0;
  margin: 4px 0;
}

.node-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 12px;
}

.timeline-node:last-child .node-content {
  padding-bottom: 0;
}

.node-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-routing {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.agent-pill {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 5px;
}

.agent-pill.from {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.agent-pill.to {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  font-weight: 600;
}

.route-arrow {
  font-size: 10px;
  color: #94a3b8;
}

.telemetry-tags {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.telemetry-pill {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.telemetry-pill.duration {
  color: #475569;
}

.status-pill {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.status-pill.running {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-pill.completed {
  background: #dcfce7;
  color: #166534;
}

.status-pill.failed {
  background: #fee2e2;
  color: #991b1b;
}

.status-pill.skipped {
  background: #f1f5f9;
  color: #475569;
}

.node-task {
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
  margin-top: 5px;
}

.node-output-box {
  margin-top: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 10px;
  max-height: 96px;
  overflow-y: auto;
}

.monospace-snippet {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.48;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
