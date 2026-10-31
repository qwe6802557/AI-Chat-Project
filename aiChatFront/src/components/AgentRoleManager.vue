<template>
  <div class="role-manager-container">
    <!-- 头部工具栏 -->
    <div class="role-header-bar">
      <div class="role-header-left">
        <span class="role-count-text">共 {{ roles.length }} 个独立智能体角色</span>
        <span class="role-tip-text">角色人设与驱动大模型已彻底解耦，可任意挂载至各个通道</span>
      </div>
      <a-button type="primary" size="small" @click="openCreateModal">
        <template #icon><PlusOutlined /></template>
        新建角色
      </a-button>
    </div>

    <!-- 骨架屏 / 角色列表 -->
    <div v-if="loading && roles.length === 0" class="loading-box">
      <a-skeleton active :paragraph="{ rows: 3 }" />
    </div>

    <div v-else-if="roles.length === 0" class="empty-box">
      <a-empty description="暂无智能体角色，点击上方按钮创建" />
    </div>

    <div v-else class="role-cards-stack">
      <div
        v-for="role in roles"
        :key="role.id"
        class="role-card-item"
        :class="{ 'is-default': role.isDefault }"
      >
        <div class="role-card-main">
          <div class="role-avatar-col">
            <div class="role-icon-box">
              <RobotOutlined class="role-svg-icon" />
            </div>
          </div>

          <div class="role-content-col">
            <div class="role-title-row">
              <span class="role-name">{{ role.name }}</span>
              <a-tag v-if="role.isDefault" color="processing" class="tag-badge">默认助理</a-tag>
              <a-tag v-if="role.boundModelId" color="default" class="tag-badge">
                模型: {{ role.boundModelId }}
              </a-tag>
              <a-tag v-else color="warning" class="tag-badge">跟随系统默认模型</a-tag>
              <a-tooltip
                v-if="role.knowledgeBaseIds && role.knowledgeBaseIds.length > 0"
                :title="getKnowledgeBaseNames(role.knowledgeBaseIds)"
              >
                <a-tag color="cyan" class="tag-badge">
                  <template #icon><BookOutlined /></template>
                  知识库 ({{ role.knowledgeBaseIds.length }})
                </a-tag>
              </a-tooltip>
            </div>

            <p class="role-desc">
              {{ role.description || '暂无描述' }}
            </p>

            <div v-if="role.systemPrompt" class="prompt-preview-box">
              <span class="prompt-label">人设 Prompt：</span>
              <span class="prompt-text">{{ role.systemPrompt }}</span>
            </div>
          </div>

          <div class="role-actions-col">
            <a-button size="small" class="subtle-btn" @click="openEditModal(role)">
              <template #icon><EditOutlined /></template>
              编辑
            </a-button>
            <a-popconfirm
              v-if="!role.isDefault"
              title="确定删除此角色吗？关联的通道将重置为人设未绑定。"
              ok-text="确认删除"
              cancel-text="取消"
              @confirm="handleDelete(role.id)"
            >
              <a-button size="small" class="role-delete-btn">
                <template #icon><DeleteOutlined /></template>
                删除
              </a-button>
            </a-popconfirm>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建/编辑角色弹窗 -->
    <a-modal
      :open="editModalVisible"
      :title="isEditing ? '编辑智能体角色' : '新建智能体角色'"
      width="560px"
      :confirm-loading="submitting"
      @ok="handleSaveRole"
      @cancel="editModalVisible = false"
    >
      <div class="role-form">
        <div class="form-item">
          <label class="form-label required">角色名称</label>
          <a-input
            v-model:value="formData.name"
            placeholder="例如：技术支持专家、HR助手、通用助理..."
            :maxlength="50"
          />
        </div>

        <div class="form-item">
          <label class="form-label">角色简述</label>
          <a-input
            v-model:value="formData.description"
            placeholder="简要概括此角色的职责边界..."
            :maxlength="100"
          />
        </div>

        <div class="form-item">
          <label class="form-label">驱动大模型</label>
          <a-select
            v-model:value="formData.boundModelId"
            placeholder="跟随系统默认模型"
            allow-clear
            style="width: 100%"
          >
            <a-select-option v-for="m in modelList" :key="m.modelId" :value="m.modelId">
              {{ m.modelName }} ({{ m.modelId }})
            </a-select-option>
          </a-select>
        </div>

        <div class="form-item">
          <div class="form-label-row">
            <label class="form-label">挂载专属知识库 (Agent RAG)</label>
            <span class="form-tip">对话时自动检索知识库内容注入人设背景</span>
          </div>
          <a-select
            v-model:value="formData.knowledgeBaseIds"
            mode="multiple"
            placeholder="选择关联的知识库（支持多选）"
            allow-clear
            :max-tag-count="3"
            style="width: 100%"
          >
            <a-select-option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">
              {{ kb.name }} ({{ kb.documentCount || 0 }} 篇文档)
            </a-select-option>
          </a-select>
        </div>

        <div class="form-item">
          <label class="form-label">专属角色设定 (System Prompt)</label>
          <a-textarea
            v-model:value="formData.systemPrompt"
            placeholder="输入角色的具体人设、回答风格与业务准则..."
            :rows="4"
          />
        </div>

        <div class="form-item-inline">
          <label class="form-label">设为默认助理</label>
          <a-switch v-model:checked="formData.isDefault" />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  RobotOutlined,
  BookOutlined,
} from '@ant-design/icons-vue'
import {
  getRoleList,
  createRole,
  updateRole,
  deleteRole,
  type AgentRole,
} from '@/api/channel'
import { getKnowledgeBases } from '@/api/knowledge'
import type { KnowledgeBaseItem } from '@/interface/knowledge'
import type { BackendAiModel } from '@/api/model'

defineProps<{
  modelList: BackendAiModel[]
}>()

const emit = defineEmits<{
  (e: 'roles-updated'): void
}>()

const loading = ref(false)
const roles = ref<AgentRole[]>([])
const knowledgeBases = ref<KnowledgeBaseItem[]>([])
const editModalVisible = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)

const formData = ref({
  name: '',
  description: '',
  boundModelId: undefined as string | undefined,
  systemPrompt: '',
  knowledgeBaseIds: [] as string[],
  isDefault: false,
})

const fetchKnowledgeBases = async () => {
  try {
    const res = await getKnowledgeBases()
    if (res.data) {
      knowledgeBases.value = res.data
    }
  } catch (err: any) {
    console.warn('拉取知识库列表异常:', err)
  }
}

const getKnowledgeBaseNames = (ids?: string[] | null): string => {
  if (!ids || ids.length === 0) return ''
  const names = ids
    .map((id) => knowledgeBases.value.find((kb) => kb.id === id)?.name)
    .filter(Boolean)
  return names.length > 0 ? `已关联知识库：${names.join('、')}` : '已关联知识库'
}

const fetchRoles = async () => {
  try {
    loading.value = true
    const res = await getRoleList()
    if (res.data) {
      roles.value = res.data
    }
  } catch (err: any) {
    message.error(err.message || '获取角色列表失败')
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  fetchKnowledgeBases()
  isEditing.value = false
  editingId.value = null
  formData.value = {
    name: '',
    description: '',
    boundModelId: undefined,
    systemPrompt: '',
    knowledgeBaseIds: [],
    isDefault: roles.value.length === 0,
  }
  editModalVisible.value = true
}

const openEditModal = (role: AgentRole) => {
  fetchKnowledgeBases()
  isEditing.value = true
  editingId.value = role.id
  formData.value = {
    name: role.name,
    description: role.description || '',
    boundModelId: role.boundModelId || undefined,
    systemPrompt: role.systemPrompt || '',
    knowledgeBaseIds: Array.isArray(role.knowledgeBaseIds) ? [...role.knowledgeBaseIds] : [],
    isDefault: !!role.isDefault,
  }
  editModalVisible.value = true
}

const handleSaveRole = async () => {
  if (!formData.value.name.trim()) {
    message.warning('请输入角色名称')
    return
  }

  try {
    submitting.value = true
    const payload = {
      name: formData.value.name.trim(),
      description: formData.value.description.trim() || null,
      boundModelId: formData.value.boundModelId || null,
      systemPrompt: formData.value.systemPrompt || null,
      knowledgeBaseIds: formData.value.knowledgeBaseIds || [],
      isDefault: formData.value.isDefault,
    }

    if (isEditing.value && editingId.value) {
      await updateRole(editingId.value, payload)
      message.success('角色更新成功')
    } else {
      await createRole(payload)
      message.success('角色创建成功')
    }
    editModalVisible.value = false
    await fetchRoles()
    emit('roles-updated')
  } catch (err: any) {
    message.error(err.message || '保存角色失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (id: string) => {
  try {
    await deleteRole(id)
    message.success('角色已删除')
    await fetchRoles()
    emit('roles-updated')
  } catch (err: any) {
    message.error(err.message || '删除角色失败')
  }
}

onMounted(() => {
  fetchRoles()
  fetchKnowledgeBases()
})

defineExpose({
  fetchRoles,
})
</script>

<style scoped>
.role-manager-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.role-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 4px 8px;
  flex-shrink: 0;
}

.role-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.role-count-text {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.role-tip-text {
  font-size: 12px;
  color: #64748b;
}

.role-cards-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: min(660px, calc(100vh - 270px));
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding-right: 6px;
  padding-bottom: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
  scroll-behavior: smooth;
}

.role-cards-stack::-webkit-scrollbar {
  width: 6px;
}

.role-cards-stack::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 9999px;
}

.role-cards-stack::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 9999px;
  transition: background-color 0.2s ease;
}

.role-cards-stack::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.65);
}

.role-card-item {
  border: 1px solid rgba(226, 232, 240, 0.85);
  border-radius: 12px;
  background: #ffffff;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  flex-shrink: 0;
}

.role-card-item:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

.role-card-item.is-default {
  border-color: rgba(59, 130, 246, 0.3);
  background: #fbfdff;
}

.role-card-main {
  display: flex;
  align-items: flex-start;
  padding: 14px 18px;
  gap: 14px;
}

.role-avatar-col {
  flex-shrink: 0;
  padding-top: 2px;
}

.role-icon-box {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #f0fdf4;
  color: #059669;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.role-card-item.is-default .role-icon-box {
  background: #eff6ff;
  color: #2563eb;
}

.role-content-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.role-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.tag-badge {
  margin: 0;
  font-size: 11px;
  border-radius: 4px;
  line-height: 18px;
}

.role-desc {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.prompt-preview-box {
  margin-top: 6px;
  background: #f8fafc;
  border: 1px dashed #e2e8f0;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: #475569;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.prompt-label {
  font-weight: 600;
  color: #334155;
}

.role-actions-col {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.subtle-btn {
  color: #475569;
}

.role-actions-col :deep(.role-delete-btn),
.role-delete-btn {
  color: #ff4d4f !important;
  border-color: #ffccc7 !important;
  background-color: #fff1f0 !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.role-actions-col :deep(.role-delete-btn:hover),
.role-delete-btn:hover {
  color: #cf1322 !important;
  border-color: #ffa39e !important;
  background-color: #ffe8e6 !important;
}

.loading-box,
.empty-box {
  padding: 30px;
  text-align: center;
}

/* 弹窗表单样式 */
.role-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 0;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-tip {
  font-size: 11px;
  color: #94a3b8;
  font-weight: normal;
}

.form-item-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}
</style>
