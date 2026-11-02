<template>
  <div v-if="timeline && timeline.length > 0" class="swarm-timeline-card">
    <div class="timeline-header" @click="isExpanded = !isExpanded">
      <div class="header-left">
        <BranchesOutlined class="timeline-main-icon" />
        <span class="timeline-title">多智能体协同编排</span>
        <span class="swarm-badge">SWARM TIMELINE</span>
        <span class="event-count-badge">{{ timeline.length }} 节点</span>
      </div>

      <div class="header-right">
        <DownOutlined :class="['expand-icon', { rotated: isExpanded }]" />
      </div>
    </div>

    <transition name="collapse">
      <div v-if="isExpanded" class="timeline-body">
        <div class="timeline-track">
          <div
            v-for="(event, idx) in timeline"
            :key="event.id || idx"
            :class="['timeline-node', `status-${event.status}`, `type-${event.type}`]"
          >
            <!-- 节点导轨与发光微标 -->
            <div class="node-rail">
              <span class="node-bullet">
                <LoadingOutlined v-if="event.status === 'running'" spin class="bullet-spinner" />
                <CheckCircleFilled v-else-if="event.status === 'completed'" class="bullet-icon completed" />
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
import { ref } from 'vue'
import {
  BranchesOutlined,
  DownOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import type { SwarmTimelineEvent } from '@/interface/chat'

defineProps<{
  timeline: SwarmTimelineEvent[]
}>()

const isExpanded = ref(true)

const getStatusText = (status: SwarmTimelineEvent['status']) => {
  switch (status) {
    case 'running':
      return '执行中'
    case 'completed':
      return '已就绪'
    case 'failed':
      return '异常阻断'
    default:
      return status
  }
}
</script>

<style scoped>
.swarm-timeline-card {
  margin: 10px 0;
  background: #090d16;
  border: 1px solid rgba(129, 140, 248, 0.25);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #0f172a;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.timeline-header:hover {
  background: #131d35;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-main-icon {
  color: #818cf8;
  font-size: 14px;
}

.timeline-title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  letter-spacing: -0.01em;
}

.swarm-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  background: rgba(129, 140, 248, 0.14);
  color: #a5b4fc;
  border: 1px solid rgba(129, 140, 248, 0.3);
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.event-count-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  padding: 1px 5px;
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
  border-radius: 4px;
}

.expand-icon {
  font-size: 12px;
  color: #64748b;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

.timeline-body {
  padding: 12px 14px;
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
  width: 22px;
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
  color: #fbbf24;
}

.bullet-icon.completed {
  font-size: 12px;
  color: #34d399;
}

.bullet-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #64748b;
}

.node-line {
  width: 1px;
  flex: 1;
  background: rgba(148, 163, 184, 0.18);
  margin: 4px 0;
}

.node-content {
  flex: 1;
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
}

.agent-pill {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 4px;
}

.agent-pill.from {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.agent-pill.to {
  background: rgba(129, 140, 248, 0.16);
  color: #c7d2fe;
  border: 1px solid rgba(129, 140, 248, 0.35);
  font-weight: 600;
}

.route-arrow {
  font-size: 10px;
  color: #64748b;
}

.telemetry-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.telemetry-pill {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #020617;
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.telemetry-pill.duration {
  color: #38bdf8;
}

.status-pill {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 500;
}

.status-pill.running {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.25);
  animation: pulse-breathing 2s infinite ease-in-out;
}

.status-pill.completed {
  background: rgba(52, 211, 153, 0.1);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.2);
}

.status-pill.failed {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.2);
}

.node-task {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
  margin-top: 4px;
}

.node-output-box {
  margin-top: 6px;
  background: #020617;
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 5px;
  padding: 6px 8px;
}

.monospace-snippet {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.45;
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-all;
}

@keyframes pulse-breathing {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.75;
    transform: scale(0.98);
  }
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
