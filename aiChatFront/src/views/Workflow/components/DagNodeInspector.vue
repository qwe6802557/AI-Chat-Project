<template>
  <div v-if="node" class="dag-inspector">
    <div class="inspector-header">
      <div class="inspector-title-group">
        <span class="inspector-node-id">{{ node.id }}</span>
        <h3 class="inspector-title">{{ node.data.label || '节点配置' }}</h3>
      </div>
      <a-button
        v-if="node.type !== 'start'"
        type="text"
        size="small"
        danger
        title="移除节点"
        @click="emit('delete-node', node.id)"
      >
        <template #icon><DeleteOutlined /></template>
      </a-button>
    </div>

    <div class="inspector-scroll">
      <div class="field-block">
        <label class="field-label">节点名称</label>
        <a-input
          :value="node.data.label"
          size="small"
          placeholder="输入清晰直观的节点标题"
          @update:value="(val: string) => patchData({ label: val })"
        />
      </div>

      <div class="field-block">
        <label class="field-label">职责备注</label>
        <a-input
          :value="node.data.description"
          size="small"
          placeholder="可选说明"
          @update:value="(val: string) => patchData({ description: val })"
        />
      </div>

      <!-- 1. Start 节点 -->
      <template v-if="node.type === 'start'">
        <div class="field-block">
          <label class="field-label">调试默认入参 (start.input)</label>
          <a-textarea
            :value="node.data.defaultInput"
            :rows="4"
            placeholder="在画板调试试跑时预填的测试提问内容"
            @update:value="(val: string) => patchData({ defaultInput: val })"
          />
        </div>
      </template>

      <!-- 2. Agent 节点 -->
      <template v-if="node.type === 'agent'">
        <div class="field-block">
          <label class="field-label">绑定智能体角色 / Swarm 团队 (可选)</label>
          <a-select
            :value="node.data.roleId || undefined"
            size="small"
            allow-clear
            placeholder="不绑定则直接使用下方模型与人设"
            style="width: 100%"
            @update:value="(val: string | undefined) => patchData({ roleId: val || null })"
          >
            <a-select-option v-for="r in roleList" :key="r.id" :value="r.id">
              {{ r.name }} {{ r.isTeam ? '[团队 Swarm]' : '' }}
            </a-select-option>
          </a-select>
        </div>

        <div class="field-block">
          <label class="field-label">推理模型 (覆盖角色默认模型)</label>
          <a-select
            :value="node.data.modelId || undefined"
            size="small"
            allow-clear
            placeholder="默认使用系统激活主模型"
            style="width: 100%"
            @update:value="(val: string | undefined) => patchData({ modelId: val || null })"
          >
            <a-select-option v-for="m in modelList" :key="m.modelId" :value="m.modelId">
              {{ m.modelName }} ({{ m.modelId }})
            </a-select-option>
          </a-select>
        </div>

        <div class="field-block">
          <label class="field-label">系统人设指令 (System Prompt)</label>
          <a-textarea
            :value="node.data.systemPrompt"
            :rows="3"
            placeholder="约束角色专长、输出结构或分析口径..."
            @update:value="(val: string) => patchData({ systemPrompt: val })"
          />
        </div>

        <div class="field-block">
          <div class="label-row">
            <label class="field-label">用户提示词模板</label>
            <span class="hint-text">点击标签插入上游变量</span>
          </div>
          <div v-if="variableChips.length > 0" class="variable-chips">
            <button
              v-for="chip in variableChips"
              :key="chip.expr"
              type="button"
              class="var-chip"
              @click="appendTemplateVar('promptTemplate', chip.expr)"
            >
              {{ chip.label }}
            </button>
          </div>
          <a-textarea
            :value="node.data.promptTemplate"
            :rows="3"
            placeholder="例如：结合资料 {{rag_1.output}} 回答 {{start.input}}"
            @update:value="(val: string) => patchData({ promptTemplate: val })"
          />
        </div>

        <div class="field-block">
          <label class="field-label">挂载知识库 (可选)</label>
          <a-select
            :value="node.data.knowledgeBaseIds || []"
            mode="multiple"
            size="small"
            placeholder="选择直连检索的知识库"
            style="width: 100%"
            @update:value="(val: string[]) => patchData({ knowledgeBaseIds: val })"
          >
            <a-select-option v-for="kb in kbList" :key="kb.id" :value="kb.id">
              {{ kb.name }}
            </a-select-option>
          </a-select>
        </div>

        <div class="field-block">
          <label class="field-label">允许自主调用工具</label>
          <a-select
            :value="node.data.enabledTools || []"
            mode="multiple"
            size="small"
            placeholder="选择内置插件工具"
            style="width: 100%"
            @update:value="(val: string[]) => patchData({ enabledTools: val })"
          >
            <a-select-option v-for="t in availableTools" :key="t.name" :value="t.name">
              {{ t.title }} ({{ t.name }})
            </a-select-option>
          </a-select>
        </div>
      </template>

      <!-- 3. RAG 节点 -->
      <template v-if="node.type === 'rag'">
        <div class="field-block">
          <label class="field-label">检索知识库 (支持多选)</label>
          <a-select
            :value="node.data.knowledgeBaseIds || []"
            mode="multiple"
            size="small"
            placeholder="至少选择一个目标知识库"
            style="width: 100%"
            @update:value="(val: string[]) => patchData({ knowledgeBaseIds: val })"
          >
            <a-select-option v-for="kb in kbList" :key="kb.id" :value="kb.id">
              {{ kb.name }}
            </a-select-option>
          </a-select>
        </div>

        <div class="field-block">
          <label class="field-label">检索 Query 模板 (留空默认取用户输入)</label>
          <div v-if="variableChips.length > 0" class="variable-chips">
            <button
              v-for="chip in variableChips"
              :key="chip.expr"
              type="button"
              class="var-chip"
              @click="appendTemplateVar('queryTemplate', chip.expr)"
            >
              {{ chip.label }}
            </button>
          </div>
          <a-input
            :value="node.data.queryTemplate"
            size="small"
            placeholder="{{start.input}}"
            @update:value="(val: string) => patchData({ queryTemplate: val })"
          />
        </div>

        <div class="field-block">
          <label class="field-label">Top-K 召回切片数</label>
          <a-input-number
            :value="node.data.topK ?? 5"
            :min="1"
            :max="10"
            size="small"
            style="width: 100%"
            @update:value="(val: number) => patchData({ topK: val })"
          />
        </div>
      </template>

      <!-- 4. Tool 节点 -->
      <template v-if="node.type === 'tool'">
        <div class="field-block">
          <label class="field-label">选择内置确定性工具</label>
          <a-select
            :value="node.data.toolName || undefined"
            size="small"
            placeholder="选择执行插件"
            style="width: 100%"
            @update:value="handleSelectTool"
          >
            <a-select-option v-for="t in availableTools" :key="t.name" :value="t.name">
              {{ t.title }} ({{ t.name }})
            </a-select-option>
          </a-select>
        </div>

        <div v-if="Object.keys(node.data.argsTemplate || {}).length > 0" class="field-block">
          <label class="field-label">参数映射模板 (支持 <code v-pre>{{nodeId.output}}</code>)</label>
          <div
            v-for="(val, argKey) in node.data.argsTemplate"
            :key="argKey"
            class="arg-row"
          >
            <span class="arg-key">{{ argKey }}</span>
            <a-input
              :value="val"
              size="small"
              placeholder="输入常量或 {{start.input}}"
              @update:value="(nextVal: string) => patchToolArg(String(argKey), nextVal)"
            />
          </div>
        </div>
      </template>

      <!-- 5. Condition 节点 -->
      <template v-if="node.type === 'condition'">
        <div class="field-block">
          <div class="label-row">
            <label class="field-label">条件分支规则</label>
            <a-button type="link" size="small" style="padding: 0" @click="addConditionRule">
              + 新增规则
            </a-button>
          </div>

          <div
            v-for="(rule, idx) in node.data.rules || []"
            :key="rule.id"
            class="rule-card"
          >
            <div class="rule-head">
              <span class="rule-index">分支 {{ idx + 1 }} ({{ rule.id }})</span>
              <button type="button" class="rule-del-btn" @click="removeConditionRule(rule.id)">
                移除
              </button>
            </div>
            <a-input
              :value="rule.label"
              size="small"
              placeholder="分支名称 (如: 命中财务报告)"
              @update:value="(v: string) => updateConditionRule(rule.id, { label: v })"
            />
            <a-select
              :value="rule.variable"
              size="small"
              placeholder="选择评估变量"
              style="width: 100%"
              @update:value="(v: string) => updateConditionRule(rule.id, { variable: v })"
            >
              <a-select-option
                v-for="chip in variableChips"
                :key="chip.path"
                :value="chip.path"
              >
                {{ chip.label }} ({{ chip.path }})
              </a-select-option>
            </a-select>
            <div class="rule-op-row">
              <a-select
                :value="rule.operator"
                size="small"
                style="width: 112px"
                @update:value="(v: any) => updateConditionRule(rule.id, { operator: v })"
              >
                <a-select-option value="contains">包含</a-select-option>
                <a-select-option value="not_contains">不包含</a-select-option>
                <a-select-option value="equals">等于</a-select-option>
                <a-select-option value="not_equals">不等于</a-select-option>
                <a-select-option value="not_empty">非空</a-select-option>
                <a-select-option value="regex">正则匹配</a-select-option>
                <a-select-option value="gt">大于</a-select-option>
                <a-select-option value="lt">小于</a-select-option>
              </a-select>
              <a-input
                v-if="rule.operator !== 'not_empty'"
                :value="rule.value"
                size="small"
                placeholder="对比值"
                @update:value="(v: string) => updateConditionRule(rule.id, { value: v })"
              />
            </div>
          </div>
          <p class="condition-hint">未匹配任何规则时自动路由至「默认 Else」右侧锚点。</p>
        </div>
      </template>

      <!-- 6. End 节点 -->
      <template v-if="node.type === 'end'">
        <div class="field-block">
          <div class="label-row">
            <label class="field-label">最终回答汇聚模板</label>
          </div>
          <div v-if="variableChips.length > 0" class="variable-chips">
            <button
              v-for="chip in variableChips"
              :key="chip.expr"
              type="button"
              class="var-chip"
              @click="appendTemplateVar('responseTemplate', chip.expr)"
            >
              {{ chip.label }}
            </button>
          </div>
          <a-textarea
            :value="node.data.responseTemplate"
            :rows="4"
            placeholder="例如：{{agent_1.output}}；留空自动选取末层成功节点输出"
            @update:value="(val: string) => patchData({ responseTemplate: val })"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DeleteOutlined } from '@ant-design/icons-vue'
import type {
  DagConditionRule,
  DagNodeData,
  DagWorkflowNode,
} from '@/api/workflow'
import type { AgentRole } from '@/api/channel'
import type { BackendAiModel } from '@/api/model'
import type { KnowledgeBaseItem } from '@/interface/knowledge'
import { DEFAULT_TOOLS } from '@/stores/tools'

const TOOL_DEFAULT_ARGS: Record<string, Record<string, string>> = {
  calculator: { expression: '{{start.input}}' },
  weather: { city: '北京' },
  clock_calendar: { timezone: 'Asia/Shanghai' },
  url_fetcher: { url: '{{start.input}}' },
  web_search_v2: { query: '{{start.input}}' },
  code_interpreter: { language: 'python', code: 'print("ok")' },
}

const props = defineProps<{
  node: DagWorkflowNode | null
  allNodes: DagWorkflowNode[]
  roleList: AgentRole[]
  modelList: BackendAiModel[]
  kbList: KnowledgeBaseItem[]
}>()

const emit = defineEmits<{
  (e: 'update-node-data', nodeId: string, patch: Partial<DagNodeData>): void
  (e: 'delete-node', nodeId: string): void
}>()

const availableTools = DEFAULT_TOOLS

const variableChips = computed(() => {
  if (!props.node) return []
  return props.allNodes
    .filter((n) => n.id !== props.node?.id && n.type !== 'end')
    .map((n) => {
      const path = n.type === 'start' ? 'start.input' : `${n.id}.output`
      return {
        label: n.data?.label || n.id,
        path,
        expr: `{{${path}}}`,
      }
    })
})

const patchData = (patch: Partial<DagNodeData>) => {
  if (!props.node) return
  emit('update-node-data', props.node.id, patch)
}

const appendTemplateVar = (
  field: 'promptTemplate' | 'queryTemplate' | 'responseTemplate',
  expr: string,
) => {
  if (!props.node) return
  const current = String(props.node.data?.[field] || '')
  const next = current ? `${current} ${expr}` : expr
  patchData({ [field]: next })
}

const handleSelectTool = (toolName: string) => {
  const defaultArgs = TOOL_DEFAULT_ARGS[toolName] || { input: '{{start.input}}' }
  patchData({
    toolName,
    argsTemplate: { ...defaultArgs },
  })
}

const patchToolArg = (key: string, val: string) => {
  if (!props.node) return
  const current = { ...(props.node.data?.argsTemplate || {}) }
  current[key] = val
  patchData({ argsTemplate: current })
}

const addConditionRule = () => {
  if (!props.node) return
  const existing = [...(props.node.data?.rules || [])]
  const nextId = `branch_${Date.now().toString(36).slice(-4)}`
  existing.push({
    id: nextId,
    label: `分支 ${existing.length + 1}`,
    variable: variableChips.value[0]?.path || 'start.input',
    operator: 'contains',
    value: '',
  })
  patchData({ rules: existing })
}

const removeConditionRule = (ruleId: string) => {
  if (!props.node) return
  const next = (props.node.data?.rules || []).filter((r) => r.id !== ruleId)
  patchData({ rules: next })
}

const updateConditionRule = (
  ruleId: string,
  patch: Partial<DagConditionRule>,
) => {
  if (!props.node) return
  const next = (props.node.data?.rules || []).map((r) =>
    r.id === ruleId ? { ...r, ...patch } : r,
  )
  patchData({ rules: next })
}
</script>

<style scoped>
.dag-inspector {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.inspector-title-group {
  min-width: 0;
}

.inspector-node-id {
  display: inline-block;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #2563eb;
  background: #eff6ff;
  padding: 1px 6px;
  border-radius: 4px;
  margin-bottom: 3px;
}

.inspector-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.inspector-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: #334155;
}

.hint-text {
  font-size: 11px;
  color: #94a3b8;
}

.variable-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.var-chip {
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 11px;
  border-radius: 4px;
  padding: 2px 7px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.var-chip:hover {
  background: #dbeafe;
}

.arg-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.arg-key {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #475569;
}

.rule-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.rule-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rule-index {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.rule-del-btn {
  border: none;
  background: transparent;
  color: #ef4444;
  font-size: 11px;
  cursor: pointer;
}

.rule-op-row {
  display: flex;
  gap: 6px;
}

.condition-hint {
  margin: 2px 0 0;
  font-size: 11px;
  color: #64748b;
}
</style>
