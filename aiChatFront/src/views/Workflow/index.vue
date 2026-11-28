<template>
  <div class="workflow-workbench-layout">
    <div class="workflow-main-container">
      <header class="workflow-header-section">
        <div class="header-left">
          <div class="title-row">
            <ApartmentOutlined class="page-icon" />
            <h1 class="page-title">智能编排与链路观测</h1>
          </div>
          <p class="page-subtitle">
            可视化 DAG 多智能体拓扑工作流编排，基于分布式 Trace ID 全链路追踪耗时与消耗归因。
          </p>
        </div>

        <div class="header-tab-switcher">
          <button
            type="button"
            :class="['view-tab-btn', { active: activeTab === 'canvas' }]"
            @click="switchTab('canvas')"
          >
            <PartitionOutlined />
            <span>DAG 编排画板</span>
          </button>
          <button
            type="button"
            :class="['view-tab-btn', { active: activeTab === 'traces' }]"
            @click="switchTab('traces')"
          >
            <LineChartOutlined />
            <span>Trace 观测中心</span>
          </button>
        </div>
      </header>

      <div class="workflow-body-host">
        <WorkflowCanvasPanel
          v-if="activeTab === 'canvas'"
          :initial-workflow-id="targetWorkflowId"
          @open-trace="handleJumpToTrace"
        />
        <TraceObservabilityPanel
          v-else
          :initial-trace-id="targetTraceId"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  PartitionOutlined,
  LineChartOutlined,
} from '@ant-design/icons-vue'
import WorkflowCanvasPanel from './components/WorkflowCanvasPanel.vue'
import TraceObservabilityPanel from './components/TraceObservabilityPanel.vue'

defineOptions({
  name: 'WorkflowStudioPage',
})

const route = useRoute()
const router = useRouter()

const activeTab = ref<'canvas' | 'traces'>(
  route.query.tab === 'traces' ? 'traces' : 'canvas',
)
const targetTraceId = ref<string | undefined>(
  typeof route.query.traceId === 'string' ? route.query.traceId : undefined,
)
const targetWorkflowId = ref<string | undefined>(
  typeof route.query.workflowId === 'string' ? route.query.workflowId : undefined,
)

const switchTab = (tab: 'canvas' | 'traces') => {
  activeTab.value = tab
  void router.replace({
    path: '/workflow',
    query: tab === 'traces' && targetTraceId.value
      ? { tab: 'traces', traceId: targetTraceId.value }
      : { tab },
  })
}

const handleJumpToTrace = (traceId: string) => {
  targetTraceId.value = traceId
  activeTab.value = 'traces'
  void router.replace({
    path: '/workflow',
    query: { tab: 'traces', traceId },
  })
}

watch(
  () => route.query,
  (q) => {
    if (q.tab === 'traces' || q.traceId) {
      activeTab.value = 'traces'
      if (typeof q.traceId === 'string') {
        targetTraceId.value = q.traceId
      }
    } else if (q.tab === 'canvas' || q.workflowId) {
      activeTab.value = 'canvas'
      if (typeof q.workflowId === 'string') {
        targetWorkflowId.value = q.workflowId
      }
    }
  },
)
</script>

<style scoped>
.workflow-workbench-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background-color: #f8fafc;
  color: #1e293b;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.workflow-main-container {
  flex: 1;
  max-width: 1480px;
  width: 100%;
  margin: 0 auto;
  padding: 18px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.workflow-header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-icon {
  font-size: 22px;
  color: #2563eb;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}

.header-tab-switcher {
  display: inline-flex;
  align-items: center;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  gap: 2px;
}

.view-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 7px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

.view-tab-btn.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.workflow-body-host {
  flex: 1;
  min-height: 540px;
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .workflow-main-container {
    padding: 12px 12px 20px;
  }
}
</style>
