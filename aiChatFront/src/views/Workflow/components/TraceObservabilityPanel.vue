<template>
  <div class="trace-hub">
    <!-- 顶部真实聚合遥测 KPI -->
    <div class="kpi-strip">
      <div class="kpi-card">
        <span class="kpi-label">追踪链路总数</span>
        <span class="kpi-value">{{ stats?.totalTraces ?? 0 }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">执行成功率</span>
        <span class="kpi-value is-success">{{ (stats?.successRate ?? 0).toFixed(1) }}%</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">P95 链路耗时</span>
        <span class="kpi-value">{{ stats?.p95DurationMs ?? 0 }} ms</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">累计消耗 Token / 积分</span>
        <span class="kpi-value">
          {{ (stats?.totalTokens ?? 0).toLocaleString() }}
          <span class="kpi-sub">/ {{ stats?.totalCredits ?? 0 }} 积分</span>
        </span>
      </div>
    </div>

    <!-- 过滤工具条 -->
    <div class="filter-bar">
      <div class="filter-controls">
        <a-select
          v-model:value="filters.source"
          size="small"
          style="width: 132px"
          allow-clear
          placeholder="全部来源"
          @change="handleFilterChange"
        >
          <a-select-option value="web_chat">Web 对话</a-select-option>
          <a-select-option value="workflow_chat">工作流对话</a-select-option>
          <a-select-option value="workflow_debug">工作流调试</a-select-option>
          <a-select-option value="channel">外部接入通道</a-select-option>
        </a-select>

        <a-select
          v-model:value="filters.status"
          size="small"
          style="width: 112px"
          allow-clear
          placeholder="全部状态"
          @change="handleFilterChange"
        >
          <a-select-option value="completed">已完成</a-select-option>
          <a-select-option value="failed">异常失败</a-select-option>
          <a-select-option value="aborted">已中止</a-select-option>
          <a-select-option value="running">运行中</a-select-option>
        </a-select>

        <a-select
          v-model:value="filters.days"
          size="small"
          style="width: 108px"
          @change="handleFilterChange"
        >
          <a-select-option :value="1">近 24 小时</a-select-option>
          <a-select-option :value="7">近 7 天</a-select-option>
          <a-select-option :value="30">近 30 天</a-select-option>
        </a-select>

        <a-input-search
          v-model:value="filters.traceId"
          size="small"
          placeholder="按 Trace ID 检索..."
          style="width: 210px"
          allow-clear
          @search="handleFilterChange"
        />
      </div>

      <button type="button" class="refresh-btn" :disabled="loadingList" @click="loadAll">
        <ReloadOutlined :spin="loadingList" />
        <span>刷新数据</span>
      </button>
    </div>

    <!-- 主从列表与详情双栏 -->
    <div class="trace-split-body">
      <aside class="trace-list-pane">
        <div v-if="loadingList && traces.length === 0" class="skeleton-list">
          <div v-for="i in 5" :key="i" class="trace-skeleton-row" />
        </div>

        <div v-else-if="traces.length === 0" class="trace-empty-box">
          暂无匹配的 Trace 追踪记录
        </div>

        <div v-else class="trace-cards">
          <div
            v-for="item in traces"
            :key="item.traceId"
            :class="['trace-row-card', { active: selectedTrace?.traceId === item.traceId }]"
            @click="selectTrace(item.traceId)"
          >
            <div class="trace-row-top">
              <span :class="['trace-status-dot', item.status]" />
              <span class="trace-title" :title="item.title || item.traceId">
                {{ item.title || '未命名执行链路' }}
              </span>
              <span class="trace-duration">{{ item.durationMs }} ms</span>
            </div>

            <div class="trace-row-meta">
              <span class="mono-id">{{ item.traceId }}</span>
              <span class="source-pill">{{ getSourceText(item.source) }}</span>
              <span class="tok-pill">
                {{ item.totalPromptTokens + item.totalCompletionTokens }} tok
              </span>
            </div>
          </div>
        </div>
      </aside>

      <section class="trace-detail-pane">
        <div v-if="loadingDetail" class="detail-loading">
          <a-spin tip="加载全链路 Span 拓扑与瀑布流..." />
        </div>

        <div v-else-if="!selectedTrace" class="detail-empty">
          选择左侧任意 Trace 记录查看全链路拓扑回放与 Span 耗时瀑布流
        </div>

        <template v-else>
          <div class="detail-summary-header">
            <div class="header-top-line">
              <div class="header-id-group">
                <span :class="['status-pill', selectedTrace.status]">
                  {{ getStatusText(selectedTrace.status) }}
                </span>
                <span class="detail-trace-id">{{ selectedTrace.traceId }}</span>
                <button type="button" class="copy-id-btn" @click="copyTraceId(selectedTrace.traceId)">
                  <CopyOutlined /> 复制
                </button>
              </div>
              <div class="header-metrics">
                <span>总耗时 {{ selectedTrace.durationMs }} ms</span>
                <span>Prompt {{ selectedTrace.totalPromptTokens }}</span>
                <span>Completion {{ selectedTrace.totalCompletionTokens }}</span>
                <span>积分 {{ Number(selectedTrace.totalCredits).toFixed(2) }}</span>
              </div>
            </div>

            <div v-if="selectedTrace.errorSummary" class="trace-error-banner">
              {{ selectedTrace.errorSummary }}
            </div>
          </div>

          <!-- 上半区：只读拓扑图回放 -->
          <div class="topology-replay-box">
            <div class="box-caption">
              <span>全链路拓扑回放（点击节点联动高亮下方 Span）</span>
              <span v-if="highlightedNodeId" class="clear-filter-link" @click="highlightedNodeId = null">
                清除节点高亮
              </span>
            </div>
            <div class="replay-flow-container">
              <VueFlow
                v-model:nodes="replayNodes"
                v-model:edges="replayEdges"
                :nodes-draggable="false"
                :nodes-connectable="false"
                :min-zoom="0.35"
                :max-zoom="1.5"
                fit-view-on-init
                @node-click="handleReplayNodeClick"
              >
                <template #node-start="nodeProps">
                  <DagNodeCard v-bind="nodeProps" type="start" />
                </template>
                <template #node-agent="nodeProps">
                  <DagNodeCard v-bind="nodeProps" type="agent" />
                </template>
                <template #node-rag="nodeProps">
                  <DagNodeCard v-bind="nodeProps" type="rag" />
                </template>
                <template #node-tool="nodeProps">
                  <DagNodeCard v-bind="nodeProps" type="tool" />
                </template>
                <template #node-condition="nodeProps">
                  <DagNodeCard v-bind="nodeProps" type="condition" />
                </template>
                <template #node-end="nodeProps">
                  <DagNodeCard v-bind="nodeProps" type="end" />
                </template>
              </VueFlow>
            </div>
          </div>

          <!-- 下半区：Span 时间瀑布流 -->
          <div class="waterfall-section">
            <TraceWaterfallView
              :spans="selectedSpans"
              :trace-duration-ms="selectedTrace.durationMs"
              :highlighted-node-id="highlightedNodeId"
              @select-node="handleSelectNodeFromWaterfall"
            />
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, provide, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { MarkerType, VueFlow, useVueFlow, type Edge, type Node } from '@vue-flow/core'
import DagNodeCard from './DagNodeCard.vue'
import TraceWaterfallView from './TraceWaterfallView.vue'
import {
  getTraceDetail,
  getTraceList,
  getTraceStats,
  type AgentSpanItem,
  type AgentTraceItem,
  type AgentTraceSource,
  type AgentTraceStatus,
  type TraceStatsSummary,
} from '@/api/trace'
import {
  getWorkflowDetail,
  type DagNodeRuntimeStatus,
  type DagNodeType,
} from '@/api/workflow'

const props = defineProps<{
  initialTraceId?: string
}>()

const { fitView } = useVueFlow({ id: 'trace-replay-flow' })

const filters = reactive<{
  source?: AgentTraceSource
  status?: AgentTraceStatus
  days: number
  traceId: string
}>({
  source: undefined,
  status: undefined,
  days: 7,
  traceId: '',
})

const stats = ref<TraceStatsSummary | null>(null)
const traces = ref<AgentTraceItem[]>([])
const loadingList = ref(false)
const loadingDetail = ref(false)

const selectedTrace = ref<AgentTraceItem | null>(null)
const selectedSpans = ref<AgentSpanItem[]>([])
const highlightedNodeId = ref<string | null>(null)

const replayNodes = ref<Node[]>([])
const replayEdges = ref<Edge[]>([])
const replayStatusMap = ref<Record<string, DagNodeRuntimeStatus>>({})
const replayDurationMap = ref<Record<string, number>>({})
const replayErrorMap = ref<Record<string, string>>({})

provide('dagRuntimeState', {
  statusMap: replayStatusMap,
  durationMap: replayDurationMap,
  errorMap: replayErrorMap,
})

const getSourceText = (source: AgentTraceSource) => {
  switch (source) {
    case 'web_chat':
      return 'Web对话'
    case 'workflow_chat':
      return '工作流对话'
    case 'workflow_debug':
      return '画板调试'
    case 'channel':
      return '接入通道'
    default:
      return source
  }
}

const getStatusText = (status: AgentTraceStatus) => {
  switch (status) {
    case 'completed':
      return '执行完成'
    case 'failed':
      return '执行失败'
    case 'aborted':
      return '已中止'
    case 'running':
      return '运行中'
    default:
      return status
  }
}

const mapSpanTypeToNodeType = (spanType: AgentSpanItem['spanType']): DagNodeType => {
  switch (spanType) {
    case 'rag':
      return 'rag'
    case 'tool':
      return 'tool'
    case 'workflow':
    case 'channel_dispatch':
      return 'start'
    default:
      return 'agent'
  }
}

const buildReplayTopology = async (trace: AgentTraceItem, spans: AgentSpanItem[]) => {
  const statusMap: Record<string, DagNodeRuntimeStatus> = {}
  const durationMap: Record<string, number> = {}
  const errorMap: Record<string, string> = {}

  for (const s of spans) {
    const key = s.nodeId || s.spanId
    statusMap[key] = s.status
    durationMap[key] = s.durationMs
    if (s.status === 'failed' && s.outputSummary) {
      errorMap[key] = s.outputSummary
    }
  }
  replayStatusMap.value = statusMap
  replayDurationMap.value = durationMap
  replayErrorMap.value = errorMap

  if (trace.workflowId) {
    try {
      const wfRes = await getWorkflowDetail(trace.workflowId)
      const graph = wfRes.data?.publishedGraph || wfRes.data?.draftGraph
      if (graph && graph.nodes?.length > 0) {
        replayNodes.value = graph.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: { ...n.data },
        }))
        replayEdges.value = (graph.edges || []).map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || undefined,
          targetHandle: e.targetHandle || undefined,
          markerEnd: MarkerType.ArrowClosed,
          style: {
            stroke:
              statusMap[e.source] === 'skipped' || statusMap[e.target] === 'skipped'
                ? '#cbd5e1'
                : '#2563eb',
            strokeWidth: 1.5,
          },
        }))
        await nextTick()
        void fitView({ padding: 0.2 })
        return
      }
    } catch {
      // 关联工作流可能已被删除，降级走 Span 合成拓扑
    }
  }

  // 根据 Span 父子关系自动布局只读执行拓扑图
  const nodes: Node[] = []
  const edges: Edge[] = []
  const spanIdSet = new Set(spans.map((s) => s.spanId))
  const depthCount = new Map<number, number>()
  const depthMap = new Map<string, number>()

  for (const s of spans) {
    const parentDepth =
      s.parentSpanId && depthMap.has(s.parentSpanId)
        ? depthMap.get(s.parentSpanId)!
        : -1
    const depth = parentDepth + 1
    depthMap.set(s.spanId, depth)
    const rowIdx = depthCount.get(depth) || 0
    depthCount.set(depth, rowIdx + 1)

    nodes.push({
      id: s.spanId,
      type: mapSpanTypeToNodeType(s.spanType),
      position: { x: 40 + depth * 260, y: 30 + rowIdx * 105 },
      data: {
        label: s.name,
        modelId: s.modelId || undefined,
      },
    })

    if (s.parentSpanId && spanIdSet.has(s.parentSpanId)) {
      edges.push({
        id: `e-${s.parentSpanId}-${s.spanId}`,
        source: s.parentSpanId,
        target: s.spanId,
        markerEnd: MarkerType.ArrowClosed,
        style: { stroke: s.status === 'failed' ? '#ef4444' : '#2563eb', strokeWidth: 1.5 },
      })
    }
  }

  replayNodes.value = nodes
  replayEdges.value = edges
  await nextTick()
  void fitView({ padding: 0.2 })
}

const selectTrace = async (traceId: string) => {
  try {
    loadingDetail.value = true
    highlightedNodeId.value = null
    const res = await getTraceDetail(traceId)
    if (res.data) {
      selectedTrace.value = res.data.trace
      selectedSpans.value = res.data.spans || []
      await buildReplayTopology(res.data.trace, res.data.spans || [])
    }
  } catch (err: unknown) {
    message.error(err instanceof Error && err.message ? err.message : '加载 Trace 详情失败')
  } finally {
    loadingDetail.value = false
  }
}

const loadAll = async () => {
  try {
    loadingList.value = true
    const [statsRes, listRes] = await Promise.all([
      getTraceStats({
        source: filters.source,
        days: filters.days,
      }),
      getTraceList({
        source: filters.source,
        status: filters.status,
        days: filters.days,
        traceId: filters.traceId.trim() || undefined,
        pageSize: 30,
      }),
    ])
    stats.value = statsRes.data || null
    traces.value = listRes.data?.items || []

    const targetTraceId =
      props.initialTraceId && props.initialTraceId.trim()
        ? props.initialTraceId.trim()
        : traces.value[0]?.traceId

    if (targetTraceId) {
      await selectTrace(targetTraceId)
    } else {
      selectedTrace.value = null
      selectedSpans.value = []
    }
  } catch (err: unknown) {
    message.error(err instanceof Error && err.message ? err.message : '加载可观测数据失败')
  } finally {
    loadingList.value = false
  }
}

const handleFilterChange = () => {
  void loadAll()
}

const handleReplayNodeClick = ({ node }: { node: Node }) => {
  highlightedNodeId.value = node.id
}

const handleSelectNodeFromWaterfall = (nodeId: string | null) => {
  highlightedNodeId.value = nodeId
}

const copyTraceId = async (traceId: string) => {
  try {
    await navigator.clipboard.writeText(traceId)
    message.success('已复制 Trace ID')
  } catch {
    message.info(traceId)
  }
}

watch(
  () => props.initialTraceId,
  (nextId) => {
    if (nextId && nextId.trim()) {
      void selectTrace(nextId.trim())
    }
  },
)

onMounted(() => {
  void loadAll()
})
</script>

<style scoped>
.trace-hub {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.kpi-label {
  font-size: 12px;
  color: #64748b;
}

.kpi-value {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.kpi-value.is-success {
  color: #059669;
}

.kpi-sub {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 7px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #334155;
  font-size: 12px;
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
}

.trace-split-body {
  display: flex;
  flex: 1;
  min-height: 520px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.trace-list-pane {
  width: 332px;
  flex-shrink: 0;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
  padding: 10px;
  background: #f8fafc;
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trace-skeleton-row {
  height: 58px;
  border-radius: 8px;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.trace-empty-box {
  padding: 36px 12px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.trace-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trace-row-card {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.trace-row-card:hover {
  border-color: #cbd5e1;
}

.trace-row-card.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.trace-row-top {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}

.trace-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #94a3b8;
}

.trace-status-dot.completed {
  background: #10b981;
}

.trace-status-dot.failed,
.trace-status-dot.aborted {
  background: #ef4444;
}

.trace-status-dot.running {
  background: #2563eb;
}

.trace-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trace-duration {
  font-size: 11px;
  color: #475569;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.trace-row-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.mono-id {
  font-size: 11px;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.source-pill,
.tok-pill {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  font-variant-numeric: tabular-nums;
}

.trace-detail-pane {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-loading,
.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
}

.detail-summary-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-top-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.header-id-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
}

.status-pill.completed {
  background: #ecfdf5;
  color: #059669;
}

.status-pill.failed,
.status-pill.aborted {
  background: #fef2f2;
  color: #ef4444;
}

.detail-trace-id {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.copy-id-btn {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 11px;
  color: #475569;
  cursor: pointer;
}

.header-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #475569;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.trace-error-banner {
  padding: 8px 12px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 12px;
}

.topology-replay-box {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  background: #f8fafc;
}

.box-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.clear-filter-link {
  font-size: 11px;
  font-weight: 500;
  color: #2563eb;
  cursor: pointer;
}

.replay-flow-container {
  height: 220px;
  background-color: #f8fafc;
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 20px 20px;
}

.waterfall-section {
  display: flex;
  flex-direction: column;
}

@media (max-width: 960px) {
  .kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .trace-split-body {
    flex-direction: column;
  }

  .trace-list-pane {
    width: 100%;
    max-height: 220px;
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
  }
}
</style>
