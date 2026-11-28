<template>
  <a-popover
    v-model:open="isOpen"
    trigger="click"
    placement="top"
    overlay-class-name="orchestrator-capsule-popover"
    :destroy-tooltip-on-hide="false"
  >
    <template #content>
      <div class="orchestrator-dropdown">
        <div class="dropdown-header">
          <span class="title">执行编排模式</span>
          <router-link to="/workflow" class="manage-link" @click="isOpen = false">
            编排工作室
          </router-link>
        </div>

        <div
          :class="['mode-option-item', { selected: !selectedWorkflowId && !selectedRoleId }]"
          @click="selectDefault"
        >
          <div class="option-info">
            <span class="option-name">标准 ReAct 对话</span>
            <span class="option-desc">直连所选大模型、工具插件与知识库</span>
          </div>
          <CheckOutlined v-if="!selectedWorkflowId && !selectedRoleId" class="check-icon" />
        </div>

        <div v-if="publishedWorkflows.length > 0" class="group-label">已发布 DAG 工作流</div>
        <div
          v-for="wf in publishedWorkflows"
          :key="wf.id"
          :class="['mode-option-item', { selected: selectedWorkflowId === wf.id }]"
          @click="selectWorkflow(wf.id)"
        >
          <div class="option-info">
            <span class="option-name">{{ wf.name }}</span>
            <span class="option-desc">DAG v{{ wf.version }} · 多节点拓扑执行</span>
          </div>
          <CheckOutlined v-if="selectedWorkflowId === wf.id" class="check-icon" />
        </div>

        <div v-if="roles.length > 0" class="group-label">智能体角色 / Swarm 团队</div>
        <div
          v-for="role in roles"
          :key="role.id"
          :class="['mode-option-item', { selected: selectedRoleId === role.id }]"
          @click="selectRole(role.id)"
        >
          <div class="option-info">
            <span class="option-name">{{ role.name }}</span>
            <span class="option-desc">
              {{ role.isTeam ? '多智能体 Swarm 协同团队' : (role.description || '定制人设与专属工具') }}
            </span>
          </div>
          <CheckOutlined v-if="selectedRoleId === role.id" class="check-icon" />
        </div>
      </div>
    </template>

    <a-tooltip :title="activeTooltip" placement="top" :open="isOpen ? false : undefined">
      <button
        type="button"
        :class="['orchestrator-capsule-btn', { active: Boolean(selectedWorkflowId || selectedRoleId), disabled }]"
        :disabled="disabled"
        aria-label="编排模式"
      >
        <ApartmentOutlined class="capsule-icon" />
        <span class="capsule-label">{{ activeButtonLabel }}</span>
        <span v-if="selectedWorkflowId || selectedRoleId" class="active-dot" />
      </button>
    </a-tooltip>
  </a-popover>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ApartmentOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { getPublishedWorkflows, type WorkflowItem } from '@/api/workflow'
import { getRoleList, type AgentRole } from '@/api/channel'

defineOptions({
  name: 'AgentOrchestratorCapsule',
})

const props = withDefaults(
  defineProps<{
    selectedWorkflowId?: string | null
    selectedRoleId?: string | null
    disabled?: boolean
  }>(),
  {
    selectedWorkflowId: null,
    selectedRoleId: null,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:workflowId': [id: string | null]
  'update:roleId': [id: string | null]
}>()

const isOpen = ref(false)
const publishedWorkflows = ref<WorkflowItem[]>([])
const roles = ref<AgentRole[]>([])

const loadOptions = async () => {
  try {
    const [wfRes, roleRes] = await Promise.all([
      getPublishedWorkflows().catch(() => ({ data: [] })),
      getRoleList().catch(() => ({ data: [] })),
    ])
    publishedWorkflows.value = wfRes.data || []
    roles.value = roleRes.data || []
  } catch {
    // 非核心选项容错
  }
}

watch(isOpen, (open) => {
  if (open) {
    void loadOptions()
  }
})

onMounted(() => {
  void loadOptions()
})

const activeButtonLabel = computed(() => {
  if (props.selectedWorkflowId) {
    const found = publishedWorkflows.value.find((w) => w.id === props.selectedWorkflowId)
    return found ? `流程: ${found.name}` : '工作流'
  }
  if (props.selectedRoleId) {
    const found = roles.value.find((r) => r.id === props.selectedRoleId)
    return found ? `角色: ${found.name}` : '智能体'
  }
  return '编排'
})

const activeTooltip = computed(() => {
  if (props.selectedWorkflowId) return '当前使用已发布 DAG 工作流执行对话'
  if (props.selectedRoleId) return '当前使用选定智能体角色或 Swarm 团队执行对话'
  return '切换 DAG 工作流或智能体团队协同模式'
})

const selectDefault = () => {
  emit('update:workflowId', null)
  emit('update:roleId', null)
  isOpen.value = false
}

const selectWorkflow = (id: string) => {
  emit('update:roleId', null)
  emit('update:workflowId', id)
  isOpen.value = false
}

const selectRole = (id: string) => {
  emit('update:workflowId', null)
  emit('update:roleId', id)
  isOpen.value = false
}
</script>

<style scoped>
.orchestrator-capsule-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s ease;
  white-space: nowrap;
}

.orchestrator-capsule-btn:hover:not(:disabled) {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

.orchestrator-capsule-btn.active {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #2563eb;
}

.orchestrator-capsule-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.capsule-icon {
  font-size: 13px;
}

.capsule-label {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
}

.orchestrator-dropdown {
  width: 280px;
  max-height: 340px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid #f1f5f9;
}

.title {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}

.manage-link {
  font-size: 11px;
  color: #2563eb;
}

.group-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  margin-top: 4px;
}

.mode-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 7px;
  border: 1px solid transparent;
  cursor: pointer;
}

.mode-option-item:hover {
  background: #f8fafc;
}

.mode-option-item.selected {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.option-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-name {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}

.option-desc {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.check-icon {
  color: #2563eb;
  font-size: 12px;
  flex-shrink: 0;
}
</style>
