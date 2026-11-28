<template>
  <div class="canvas-workspace">
    <!-- 左侧：工作流目录 + 6类核心节点面板 -->
    <aside class="canvas-left-rail">
      <div class="rail-section">
        <div class="section-header">
          <span class="section-title">工作流目录 ({{ workflows.length }})</span>
          <button
            type="button"
            class="mini-primary-btn"
            title="新建工作流"
            @click="handleCreateWorkflow"
          >
            <PlusOutlined />
            <span>新建</span>
          </button>
        </div>

        <div v-if="loadingList" class="skeleton-stack">
          <div v-for="i in 3" :key="i" class="wf-skeleton-row" />
        </div>

        <div v-else-if="workflows.length === 0" class="rail-empty">
          暂无工作流，点击「新建」快速起步
        </div>

        <div v-else class="wf-list">
          <div
            v-for="wf in workflows"
            :key="wf.id"
            :class="['wf-list-item', { active: activeWorkflow?.id === wf.id }]"
            @click="selectWorkflow(wf.id)"
          >
            <div class="wf-item-main">
              <span class="wf-name" :title="wf.name">{{ wf.name }}</span>
              <span :class="['wf-status-pill', wf.status]">
                {{ wf.status === 'published' ? `已发布 v${wf.version}` : '草稿' }}
              </span>
            </div>
            <a-popconfirm
              title="确定删除此工作流？"
              ok-text="删除"
              cancel-text="取消"
              @confirm.stop="handleDeleteWorkflow(wf.id)"
            >
              <button
                type="button"
                class="wf-del-icon"
                title="删除"
                @click.stop
              >
                <DeleteOutlined />
              </button>
            </a-popconfirm>
          </div>
        </div>
      </div>

      <div class="rail-section node-palette-section">
        <div class="section-header">
          <span class="section-title">组件节点库</span>
          <span class="section-hint">点击添加 ({{ flowNodes.length }}/20)</span>
        </div>

        <div class="palette-grid">
          <button
            v-for="item in PALETTE_ITEMS"
            :key="item.type"
            type="button"
            class="palette-item"
            :disabled="!activeWorkflow || (item.type === 'start' && hasStartNode) || flowNodes.length >= 20"
            @click="handleAddNode(item.type)"
          >
            <span class="palette-dot" :style="{ backgroundColor: item.color }" />
            <div class="palette-text">
              <span class="palette-name">{{ item.label }}</span>
              <span class="palette-desc">{{ item.hint }}</span>
            </div>
          </button>
        </div>
      </div>
    </aside>

    <!-- 中央：Vue Flow 编排画布 -->
    <main class="canvas-center-stage">
      <div class="stage-toolbar">
        <div class="toolbar-left">
          <template v-if="activeWorkflow">
            <a-input
              v-model:value="editableName"
              size="small"
              class="wf-title-input"
              placeholder="输入工作流名称"
            />
            <span :class="['stage-badge', activeWorkflow.status]">
              {{ activeWorkflow.status === 'published' ? `线上快照 v${activeWorkflow.version}` : '草稿编辑态' }}
            </span>
          </template>
          <span v-else class="toolbar-empty-hint">请选择或新建一条 DAG 工作流</span>
        </div>

        <div v-if="activeWorkflow" class="toolbar-actions">
          <button
            v-if="selectedEdgeId"
            type="button"
            class="stitch-tool-btn danger"
            @click="handleRemoveSelectedEdge"
          >
            <DisconnectOutlined />
            <span>断开连线</span>
          </button>

          <button
            type="button"
            class="stitch-tool-btn"
            :disabled="saving"
            @click="handleSaveDraft"
          >
            <SaveOutlined />
            <span>{{ saving ? '保存中...' : '保存草稿' }}</span>
          </button>

          <button
            type="button"
            class="stitch-tool-btn"
            :disabled="debugging"
            @click="openDebugDrawer"
          >
            <PlayCircleOutlined />
            <span>{{ debugging ? '运行中...' : '调试运行' }}</span>
          </button>

          <button
            type="button"
            class="stitch-tool-btn primary"
            :disabled="publishing || saving"
            @click="handlePublish"
          >
            <CloudUploadOutlined />
            <span>{{ publishing ? '发布中...' : '发布快照' }}</span>
          </button>
        </div>
      </div>

      <!-- 移动端/窄屏提示 -->
      <div v-if="activeWorkflow" class="mobile-workflow-outline">
        <div class="mobile-outline-tip">当前为紧凑视图，按拓扑顺序展示节点（桌面端可自由拖拽连线）</div>
        <div class="mobile-node-chips">
          <button
            v-for="node in flowNodes"
            :key="node.id"
            type="button"
            :class="['mobile-node-chip', { active: selectedNodeId === node.id }]"
            @click="selectMobileNode(node.id)"
          >
            <span>{{ node.data?.label || node.type }}</span>
            <span class="chip-type">{{ node.type }}</span>
          </button>
        </div>
      </div>

      <div class="vue-flow-canvas-host">
        <VueFlow
          v-if="activeWorkflow"
          v-model:nodes="flowNodes"
          v-model:edges="flowEdges"
          :default-viewport="{ x: 40, y: 40, zoom: 0.95 }"
          :min-zoom="0.35"
          :max-zoom="1.8"
          fit-view-on-init
          @connect="handleConnect"
          @node-click="handleNodeClick"
          @edge-click="handleEdgeClick"
          @pane-click="handlePaneClick"
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

        <div v-else class="canvas-placeholder">
          <ApartmentOutlined class="placeholder-icon" />
          <p>点击左侧「新建」或选择已有工作流进入可视化 DAG 编排</p>
        </div>

        <div v-if="activeWorkflow" class="canvas-zoom-bar">
          <button type="button" class="zoom-btn" title="放大" @click="zoomIn()">+</button>
          <button type="button" class="zoom-btn" title="缩小" @click="zoomOut()">-</button>
          <button type="button" class="zoom-btn fit" title="自适应视图" @click="fitView({ padding: 0.2 })">
            适配画布
          </button>
        </div>
      </div>
    </main>

    <!-- 右侧：属性配置抽屉 / SSE 调试控制台 -->
    <aside v-if="activeWorkflow && (selectedNode || drawerMode === 'debug')" class="canvas-right-drawer">
      <div class="drawer-tab-strip">
        <button
          type="button"
          :class="['drawer-tab', { active: drawerMode === 'config' }]"
          @click="drawerMode = 'config'"
        >
          节点属性
        </button>
        <button
          type="button"
          :class="['drawer-tab', { active: drawerMode === 'debug' }]"
          @click="drawerMode = 'debug'"
        >
          调试试跑
        </button>
      </div>

      <div v-if="drawerMode === 'config'" class="drawer-body">
        <DagNodeInspector
          v-if="selectedNode"
          :node="selectedNode"
          :all-nodes="serializedNodes"
          :role-list="roleList"
          :model-list="modelList"
          :kb-list="kbList"
          @update-node-data="handleUpdateNodeData"
          @delete-node="handleDeleteNode"
        />
        <div v-else class="drawer-empty">
          在画布中点击任意节点即可编辑参数或模板变量
        </div>
      </div>

      <div v-else class="drawer-body debug-console">
        <div class="debug-input-group">
          <label class="debug-label">测试输入 (start.input)</label>
          <a-textarea
            v-model:value="debugInput"
            :rows="3"
            placeholder="输入问题以触发工作流草稿 SSE 调试..."
            :disabled="debugging"
          />
          <div class="debug-action-row">
            <a-button
              v-if="debugging"
              danger
              size="small"
              @click="stopDebugRun"
            >
              停止运行
            </a-button>
            <a-button
              v-else
              type="primary"
              size="small"
              :disabled="!debugInput.trim()"
              @click="runDebugWorkflow"
            >
              执行工作流试跑
            </a-button>

            <button
              v-if="lastDebugTraceId"
              type="button"
              class="trace-jump-chip"
              @click="emit('open-trace', lastDebugTraceId)"
            >
              <span>Trace: {{ lastDebugTraceId.slice(0, 12) }}</span>
              <ArrowRightOutlined />
            </button>
          </div>
        </div>

        <div v-if="debugError" class="debug-error-box">
          {{ debugError }}
        </div>

        <AgentCollaborationTimeline
          v-if="debugTimeline.length > 0"
          :timeline="debugTimeline"
        />

        <div v-if="debugOutput" class="debug-output-card">
          <div class="debug-output-head">
            <span>最终收敛输出</span>
            <span v-if="debugMeta" class="debug-meta-mono">
              {{ debugMeta.durationMs }} ms · {{ debugMeta.totalTokens }} tok · {{ debugMeta.chargedCredits }} 积分
            </span>
          </div>
          <pre class="debug-output-pre">{{ debugOutput }}</pre>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  VueFlow,
  useVueFlow,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
} from '@vue-flow/core'
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  CloudUploadOutlined,
  DisconnectOutlined,
  ApartmentOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons-vue'
import DagNodeCard from './DagNodeCard.vue'
import DagNodeInspector from './DagNodeInspector.vue'
import AgentCollaborationTimeline from '@/views/Chat/components/AgentCollaborationTimeline.vue'
import {
  createWorkflow,
  debugRunWorkflowStream,
  deleteWorkflow,
  getWorkflowList,
  publishWorkflow,
  updateWorkflow,
  type DagNodeData,
  type DagNodeRuntimeStatus,
  type DagNodeType,
  type DagWorkflowGraph,
  type DagWorkflowNode,
  type WorkflowItem,
} from '@/api/workflow'
import { getRoleList, type AgentRole } from '@/api/channel'
import { getActiveModels, type BackendAiModel } from '@/api/model'
import { getKnowledgeBases } from '@/api/knowledge'
import type { KnowledgeBaseItem } from '@/interface/knowledge'
import type { SwarmTimelineEvent } from '@/interface/chat'

const props = defineProps<{
  initialWorkflowId?: string
}>()

const emit = defineEmits<{
  (e: 'open-trace', traceId: string): void
}>()

const PALETTE_ITEMS: Array<{
  type: DagNodeType
  label: string
  hint: string
  color: string
}> = [
  { type: 'start', label: '触发输入', hint: '唯一入口', color: '#0f172a' },
  { type: 'agent', label: '智能体', hint: '模型/角色/Swarm', color: '#2563eb' },
  { type: 'rag', label: '知识检索', hint: '混合双路召回', color: '#0284c7' },
  { type: 'tool', label: '内置工具', hint: '确定性插件', color: '#0d9488' },
  { type: 'condition', label: '条件路由', hint: '多路规则分支', color: '#d97706' },
  { type: 'end', label: '输出汇聚', hint: '结果收敛', color: '#059669' },
]

const { fitView, zoomIn, zoomOut } = useVueFlow()

const workflows = ref<WorkflowItem[]>([])
const loadingList = ref(false)
const activeWorkflow = ref<WorkflowItem | null>(null)
const editableName = ref('')
const saving = ref(false)
const publishing = ref(false)

const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])
const selectedNodeId = ref<string | null>(null)
const selectedEdgeId = ref<string | null>(null)
const drawerMode = ref<'config' | 'debug'>('config')

const roleList = ref<AgentRole[]>([])
const modelList = ref<BackendAiModel[]>([])
const kbList = ref<KnowledgeBaseItem[]>([])

// 实时运行态注入给 DagNodeCard
const runtimeStatusMap = ref<Record<string, DagNodeRuntimeStatus>>({})
const runtimeDurationMap = ref<Record<string, number>>({})
const runtimeErrorMap = ref<Record<string, string>>({})
provide('dagRuntimeState', {
  statusMap: runtimeStatusMap,
  durationMap: runtimeDurationMap,
  errorMap: runtimeErrorMap,
})

// 调试状态
const debugging = ref(false)
const debugInput = ref('')
const debugOutput = ref('')
const debugError = ref('')
const debugTimeline = ref<SwarmTimelineEvent[]>([])
const lastDebugTraceId = ref<string | null>(null)
const debugMeta = ref<{
  durationMs: number
  totalTokens: number
  chargedCredits: number
} | null>(null)
let debugStreamController: { close: () => void } | null = null

const hasStartNode = computed(() =>
  flowNodes.value.some((n) => n.type === 'start'),
)

const serializedNodes = computed<DagWorkflowNode[]>(() =>
  flowNodes.value.map((n) => ({
    id: n.id,
    type: (n.type || 'agent') as DagNodeType,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    data: { ...(n.data || { label: '' }) },
  })),
)

const selectedNode = computed<DagWorkflowNode | null>(() => {
  if (!selectedNodeId.value) return null
  return serializedNodes.value.find((n) => n.id === selectedNodeId.value) || null
})

const buildEdgeStyle = (animated = false) => ({
  type: 'default',
  animated,
  markerEnd: MarkerType.ArrowClosed,
  style: {
    stroke: animated ? '#2563eb' : '#94a3b8',
    strokeWidth: animated ? 2 : 1.5,
  },
})

const hydrateGraphIntoCanvas = async (graph: DagWorkflowGraph) => {
  flowNodes.value = (graph.nodes || []).map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position || { x: 100, y: 160 },
    data: { ...(n.data || {}) },
  }))
  flowEdges.value = (graph.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || undefined,
    targetHandle: e.targetHandle || undefined,
    label: e.label || (e.sourceHandle && e.sourceHandle !== 'else' ? e.sourceHandle : undefined),
    ...buildEdgeStyle(false),
  }))

  const startNode = flowNodes.value.find((n) => n.type === 'start')
  selectedNodeId.value = flowNodes.value[0]?.id || null
  selectedEdgeId.value = null
  debugInput.value =
    (startNode?.data as DagNodeData)?.defaultInput ||
    '请帮我总结近期重点数据与执行建议'

  runtimeStatusMap.value = {}
  runtimeDurationMap.value = {}
  runtimeErrorMap.value = {}

  await nextTick()
  void fitView({ padding: 0.22 })
}

const selectWorkflow = async (id: string) => {
  const found = workflows.value.find((w) => w.id === id)
  if (!found) return
  activeWorkflow.value = found
  editableName.value = found.name
  drawerMode.value = 'config'
  await hydrateGraphIntoCanvas(found.draftGraph || { nodes: [], edges: [] })
}

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback

const loadInitialData = async () => {
  try {
    loadingList.value = true
    const [wfRes, roleRes, modelRes, kbRes] = await Promise.all([
      getWorkflowList(),
      getRoleList().catch(() => ({ data: [] })),
      getActiveModels({ category: 'chat' }).catch(() => ({ data: [] })),
      getKnowledgeBases().catch(() => ({ data: [] })),
    ])
    workflows.value = wfRes.data || []
    roleList.value = roleRes.data || []
    modelList.value = modelRes.data || []
    kbList.value = kbRes.data || []

    const targetId =
      props.initialWorkflowId && workflows.value.some((w) => w.id === props.initialWorkflowId)
        ? props.initialWorkflowId
        : workflows.value[0]?.id

    if (targetId) {
      await selectWorkflow(targetId)
    } else {
      activeWorkflow.value = null
    }
  } catch (err: unknown) {
    message.error(getErrorMessage(err, '加载工作流列表失败'))
  } finally {
    loadingList.value = false
  }
}

watch(
  () => props.initialWorkflowId,
  (nextId) => {
    if (nextId && workflows.value.some((w) => w.id === nextId)) {
      void selectWorkflow(nextId)
    }
  },
)

const handleCreateWorkflow = async () => {
  try {
    const seq = workflows.value.length + 1
    const res = await createWorkflow({
      name: `智能编排流程 ${seq}`,
      description: '由阶段 4 工作台创建的 DAG 工作流',
    })
    if (res.data) {
      workflows.value.unshift(res.data)
      await selectWorkflow(res.data.id)
      message.success('已创建工作流并加载起始拓扑')
    }
  } catch (err: unknown) {
    message.error(getErrorMessage(err, '新建工作流失败'))
  }
}

const handleDeleteWorkflow = async (id: string) => {
  try {
    await deleteWorkflow(id)
    workflows.value = workflows.value.filter((w) => w.id !== id)
    if (activeWorkflow.value?.id === id) {
      if (workflows.value[0]) {
        await selectWorkflow(workflows.value[0].id)
      } else {
        activeWorkflow.value = null
        flowNodes.value = []
        flowEdges.value = []
      }
    }
    message.success('工作流已删除')
  } catch (err: unknown) {
    message.error(getErrorMessage(err, '删除工作流失败'))
  }
}

const buildCurrentGraphPayload = (): DagWorkflowGraph => ({
  nodes: serializedNodes.value,
  edges: flowEdges.value.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || null,
    targetHandle: e.targetHandle || null,
    label: typeof e.label === 'string' ? e.label : undefined,
  })),
})

const handleSaveDraft = async (): Promise<boolean> => {
  if (!activeWorkflow.value) return false
  try {
    saving.value = true
    const res = await updateWorkflow(activeWorkflow.value.id, {
      name: editableName.value.trim() || activeWorkflow.value.name,
      draftGraph: buildCurrentGraphPayload(),
    })
    if (res.data) {
      activeWorkflow.value = res.data
      workflows.value = workflows.value.map((w) =>
        w.id === res.data!.id ? res.data! : w,
      )
      message.success('草稿拓扑已保存')
    }
    return true
  } catch (err: unknown) {
    message.error(getErrorMessage(err, '草稿校验或保存失败'))
    return false
  } finally {
    saving.value = false
  }
}

const handlePublish = async () => {
  if (!activeWorkflow.value) return
  const saved = await handleSaveDraft()
  if (!saved) return
  try {
    publishing.value = true
    const res = await publishWorkflow(activeWorkflow.value.id)
    if (res.data) {
      activeWorkflow.value = res.data
      workflows.value = workflows.value.map((w) =>
        w.id === res.data!.id ? res.data! : w,
      )
      message.success(`工作流已发布不可变快照 (v${res.data.version})`)
    }
  } catch (err: unknown) {
    message.error(getErrorMessage(err, '发布失败'))
  } finally {
    publishing.value = false
  }
}

const handleAddNode = (type: DagNodeType) => {
  if (!activeWorkflow.value || flowNodes.value.length >= 20) return
  const index = flowNodes.value.length + 1
  const id = `${type}_${Date.now().toString(36).slice(-4)}`
  const defaultLabels: Record<DagNodeType, string> = {
    start: '触发输入',
    agent: `分析智能体 ${index}`,
    rag: '知识库召回',
    tool: '插件工具',
    condition: '条件分支',
    end: '输出汇总',
  }

  const extraData: Partial<DagNodeData> = {}
  if (type === 'condition') {
    extraData.rules = [
      {
        id: 'branch_1',
        label: '规则分支',
        variable: 'start.input',
        operator: 'not_empty',
        value: '',
      },
    ]
  } else if (type === 'tool') {
    extraData.toolName = 'calculator'
    extraData.argsTemplate = { expression: '1+1' }
  } else if (type === 'agent') {
    extraData.promptTemplate = '{{start.input}}'
  }

  const maxX = flowNodes.value.reduce((acc, n) => Math.max(acc, n.position.x), 80)
  flowNodes.value.push({
    id,
    type,
    position: { x: Math.min(920, maxX + 120), y: 120 + (index % 3) * 110 },
    data: { label: defaultLabels[type], ...extraData },
  })
  selectedNodeId.value = id
  drawerMode.value = 'config'
}

const handleConnect = (connection: Connection) => {
  if (!connection.source || !connection.target || connection.source === connection.target) {
    return
  }
  const exists = flowEdges.value.some(
    (e) =>
      e.source === connection.source &&
      e.target === connection.target &&
      (e.sourceHandle || null) === (connection.sourceHandle || null),
  )
  if (exists) return

  flowEdges.value.push({
    id: `e-${connection.source}-${connection.target}-${Date.now().toString(36).slice(-3)}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    label:
      connection.sourceHandle && connection.sourceHandle !== 'else'
        ? connection.sourceHandle
        : connection.sourceHandle === 'else'
          ? 'Else'
          : undefined,
    ...buildEdgeStyle(false),
  })
}

const handleNodeClick = ({ node }: { node: Node }) => {
  selectedNodeId.value = node.id
  selectedEdgeId.value = null
  drawerMode.value = 'config'
}

const handleEdgeClick = ({ edge }: { edge: Edge }) => {
  selectedEdgeId.value = edge.id
}

const handlePaneClick = () => {
  selectedEdgeId.value = null
}

const handleRemoveSelectedEdge = () => {
  if (!selectedEdgeId.value) return
  flowEdges.value = flowEdges.value.filter((e) => e.id !== selectedEdgeId.value)
  selectedEdgeId.value = null
}

const selectMobileNode = (nodeId: string) => {
  selectedNodeId.value = nodeId
  drawerMode.value = 'config'
}

const handleUpdateNodeData = (nodeId: string, patch: Partial<DagNodeData>) => {
  flowNodes.value = flowNodes.value.map((n) =>
    n.id === nodeId ? { ...n, data: { ...(n.data || {}), ...patch } } : n,
  )
}

const handleDeleteNode = (nodeId: string) => {
  flowNodes.value = flowNodes.value.filter((n) => n.id !== nodeId)
  flowEdges.value = flowEdges.value.filter(
    (e) => e.source !== nodeId && e.target !== nodeId,
  )
  if (selectedNodeId.value === nodeId) {
    selectedNodeId.value = flowNodes.value[0]?.id || null
  }
}

const openDebugDrawer = () => {
  drawerMode.value = 'debug'
  if (!debugInput.value.trim()) {
    const startNode = flowNodes.value.find((n) => n.type === 'start')
    debugInput.value =
      (startNode?.data as DagNodeData)?.defaultInput ||
      '请分析并输出今日工作建议'
  }
}

const stopDebugRun = () => {
  debugStreamController?.close()
  debugStreamController = null
  debugging.value = false
  flowEdges.value = flowEdges.value.map((e) => ({ ...e, ...buildEdgeStyle(false) }))
}

const runDebugWorkflow = async () => {
  if (!activeWorkflow.value || !debugInput.value.trim()) return
  const ok = await handleSaveDraft()
  if (!ok) return

  drawerMode.value = 'debug'
  debugging.value = true
  debugOutput.value = ''
  debugError.value = ''
  debugTimeline.value = []
  debugMeta.value = null
  lastDebugTraceId.value = null
  runtimeStatusMap.value = {}
  runtimeDurationMap.value = {}
  runtimeErrorMap.value = {}
  flowEdges.value = flowEdges.value.map((e) => ({ ...e, ...buildEdgeStyle(true) }))

  debugStreamController = debugRunWorkflowStream(
    activeWorkflow.value.id,
    debugInput.value.trim(),
    {
      onEvent: (evt) => {
        if (evt.traceId) {
          lastDebugTraceId.value = evt.traceId
        }
        switch (evt.type) {
          case 'dag_node_status':
            if (evt.nodeId && evt.status) {
              runtimeStatusMap.value = {
                ...runtimeStatusMap.value,
                [evt.nodeId]: evt.status,
              }
              if (typeof evt.durationMs === 'number') {
                runtimeDurationMap.value = {
                  ...runtimeDurationMap.value,
                  [evt.nodeId]: evt.durationMs,
                }
              }
              if (evt.error) {
                runtimeErrorMap.value = {
                  ...runtimeErrorMap.value,
                  [evt.nodeId]: evt.error,
                }
              }
            }
            break
          case 'agent_timeline_event':
            if (evt.timelineEvent?.id) {
              const idx = debugTimeline.value.findIndex(
                (t) => t.id === evt.timelineEvent!.id,
              )
              if (idx >= 0) {
                debugTimeline.value[idx] = evt.timelineEvent
              } else {
                debugTimeline.value.push(evt.timelineEvent)
              }
            }
            break
          case 'done':
            debugOutput.value = evt.message || ''
            debugMeta.value = {
              durationMs: evt.durationMs || 0,
              totalTokens: evt.usage?.totalTokens || 0,
              chargedCredits: evt.chargedCredits || 0,
            }
            debugging.value = false
            flowEdges.value = flowEdges.value.map((e) => ({
              ...e,
              ...buildEdgeStyle(false),
            }))
            break
          case 'error':
            debugError.value = evt.error || '运行异常'
            debugging.value = false
            flowEdges.value = flowEdges.value.map((e) => ({
              ...e,
              ...buildEdgeStyle(false),
            }))
            break
        }
      },
      onError: (errMsg) => {
        debugError.value = errMsg
        debugging.value = false
        flowEdges.value = flowEdges.value.map((e) => ({
          ...e,
          ...buildEdgeStyle(false),
        }))
      },
    },
  )
}

onMounted(() => {
  void loadInitialData()
})

onBeforeUnmount(() => {
  stopDebugRun()
})
</script>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
</style>

<style scoped>
.canvas-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.canvas-left-rail {
  width: 248px;
  flex-shrink: 0;
  border-right: 1px solid #e2e8f0;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.rail-section {
  padding: 14px;
  border-bottom: 1px solid #f1f5f9;
}

.rail-section:last-child {
  border-bottom: none;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.section-hint {
  font-size: 11px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.mini-primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.mini-primary-btn:hover {
  background: #dbeafe;
}

.skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wf-skeleton-row {
  height: 44px;
  border-radius: 8px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.rail-empty {
  font-size: 12px;
  color: #94a3b8;
  padding: 12px 4px;
}

.wf-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.wf-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: #f8fafc;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.wf-list-item:hover {
  border-color: #cbd5e1;
}

.wf-list-item.active {
  background: #eff6ff;
  border-color: #93c5fd;
}

.wf-item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wf-name {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wf-status-pill {
  align-self: flex-start;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #e2e8f0;
  color: #475569;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.wf-status-pill.published {
  background: #ecfdf5;
  color: #059669;
}

.wf-del-icon {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
}

.wf-del-icon:hover {
  color: #ef4444;
}

.palette-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.palette-item:hover:not(:disabled) {
  border-color: #2563eb;
  transform: translateX(2px);
}

.palette-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.palette-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.palette-text {
  display: flex;
  flex-direction: column;
}

.palette-name {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}

.palette-desc {
  font-size: 11px;
  color: #64748b;
}

.canvas-center-stage {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.stage-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wf-title-input {
  width: 210px;
  font-weight: 600;
}

.stage-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
}

.stage-badge.published {
  background: #ecfdf5;
  color: #059669;
}

.toolbar-empty-hint {
  font-size: 13px;
  color: #64748b;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stitch-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 7px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #0f172a;
  cursor: pointer;
  transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

.stitch-tool-btn:hover:not(:disabled) {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.stitch-tool-btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.stitch-tool-btn.primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.stitch-tool-btn.danger {
  color: #ef4444;
  border-color: #fecaca;
  background: #fef2f2;
}

.stitch-tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vue-flow-canvas-host {
  position: relative;
  flex: 1;
  min-height: 460px;
  background-color: #f8fafc;
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 20px 20px;
}

.canvas-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #64748b;
  font-size: 13px;
}

.placeholder-icon {
  font-size: 30px;
  color: #94a3b8;
}

.canvas-zoom-bar {
  position: absolute;
  left: 14px;
  bottom: 14px;
  display: inline-flex;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
  z-index: 5;
}

.zoom-btn {
  border: none;
  border-right: 1px solid #e2e8f0;
  background: #ffffff;
  color: #334155;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.zoom-btn:last-child {
  border-right: none;
}

.zoom-btn:hover {
  background: #f8fafc;
  color: #2563eb;
}

.canvas-right-drawer {
  width: 356px;
  flex-shrink: 0;
  border-left: 1px solid #e2e8f0;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.drawer-tab-strip {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.drawer-tab {
  border: none;
  background: transparent;
  padding: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.drawer-tab.active {
  background: #ffffff;
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.drawer-empty {
  padding: 28px 18px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
}

.debug-console {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.debug-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.debug-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.debug-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.trace-jump-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  cursor: pointer;
}

.debug-error-box {
  padding: 10px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 12px;
}

.debug-output-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  overflow: hidden;
}

.debug-output-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}

.debug-meta-mono {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.debug-output-pre {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.55;
  color: #1e293b;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.mobile-workflow-outline {
  display: none;
}

@media (max-width: 768px) {
  .canvas-workspace {
    flex-direction: column;
  }

  .canvas-left-rail {
    width: 100%;
    max-height: 220px;
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
  }

  .node-palette-section {
    display: none;
  }

  .canvas-right-drawer {
    width: 100%;
    border-left: none;
    border-top: 1px solid #e2e8f0;
  }

  .mobile-workflow-outline {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .mobile-outline-tip {
    font-size: 11px;
    color: #64748b;
  }

  .mobile-node-chips {
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }

  .mobile-node-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    font-size: 12px;
    white-space: nowrap;
  }

  .mobile-node-chip.active {
    border-color: #2563eb;
    color: #2563eb;
  }

  .chip-type {
    font-size: 10px;
    color: #94a3b8;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
}
</style>
