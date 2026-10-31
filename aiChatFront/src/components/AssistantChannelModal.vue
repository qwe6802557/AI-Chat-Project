<template>
  <a-modal
    :open="open"
    title="智能助理接入平台"
    width="880px"
    :footer="null"
    destroy-on-close
    style="top: 40px; margin-bottom: 24px;"
    class="assistant-channel-modal"
    @update:open="emit('update:open', $event)"
  >
    <div class="assistant-modal-body">
      <!-- 顶部双 Tab 切换 (Stitch 质感胶囊切换) -->
      <div class="modal-tab-nav">
        <a-segmented
          v-model:value="activeTab"
          :options="[
            { label: '接入通道实例', value: 'channels' },
            { label: '智能体角色库', value: 'roles' },
          ]"
          size="middle"
        />
      </div>

      <!-- Tab 1: 通道实例 -->
      <div v-show="activeTab === 'channels'" class="tab-pane-channels">
        <div class="header-intro">
          <div class="intro-left">
            <p class="intro-title">接入通道与机器人实例</p>
            <p class="intro-desc">支持同一平台接入多个机器人实例，每个实例可独立绑定不同的智能体人设角色。</p>
          </div>
          <div class="intro-right">
            <a-button type="primary" size="small" @click="openCreateInstanceModal">
              <template #icon><PlusOutlined /></template>
              添加新实例
            </a-button>
            <a-button size="small" :loading="loading" @click="fetchChannels">
              <template #icon><ReloadOutlined /></template>
              刷新
            </a-button>
          </div>
        </div>

        <!-- 骨架屏 / 通道实例列表 -->
        <div v-if="loading && channels.length === 0" class="loading-skeleton">
          <a-skeleton active :paragraph="{ rows: 4 }" />
        </div>

        <div v-else class="channels-stack">
          <ChannelCardItem
            v-for="ch in channels"
            :key="ch.id || ch.channelType"
            :channel="ch"
            :model-list="modelList"
            :role-list="roleList"
            :can-delete="canDeleteInstance(ch)"
            @refresh="fetchChannels"
          />
        </div>
      </div>

      <!-- Tab 2: 智能体角色库 -->
      <div v-show="activeTab === 'roles'" class="tab-pane-roles">
        <AgentRoleManager
          ref="roleManagerRef"
          :model-list="modelList"
          @roles-updated="handleRolesUpdated"
        />
      </div>
    </div>

    <!-- 添加新通道实例弹窗 -->
    <a-modal
      :open="createModalVisible"
      title="添加机器人通道实例"
      width="480px"
      :confirm-loading="creatingInstance"
      @ok="handleConfirmCreateInstance"
      @cancel="createModalVisible = false"
    >
      <div class="create-instance-form">
        <div class="form-row">
          <label class="form-label required">接入渠道类型</label>
          <a-select v-model:value="newInstanceData.channelType" style="width: 100%">
            <a-select-option value="feishu">飞书机器人 (官方 WebSocket)</a-select-option>
            <a-select-option value="dingtalk">钉钉机器人 (Stream 模式)</a-select-option>
            <a-select-option value="qq">QQ 机器人 (官方开放平台)</a-select-option>
            <a-select-option value="wecom_bot">企微智能机器人</a-select-option>
            <a-select-option value="weixin">微信 (iLink 协议)</a-select-option>
          </a-select>
        </div>

        <div class="form-row">
          <label class="form-label required">实例备注名称</label>
          <a-input
            v-model:value="newInstanceData.instanceName"
            placeholder="例如：飞书技术支持机器人、钉钉HR助手..."
            :maxlength="50"
          />
        </div>

        <div class="form-row">
          <label class="form-label">绑定智能体角色</label>
          <a-select
            v-model:value="newInstanceData.roleId"
            placeholder="请选择预设角色人设 (可选)"
            allow-clear
            style="width: 100%"
          >
            <a-select-option v-for="r in roleList" :key="r.id" :value="r.id">
              {{ r.name }} {{ r.isDefault ? '(默认)' : '' }}
            </a-select-option>
          </a-select>
        </div>
      </div>
    </a-modal>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons-vue'
import ChannelCardItem from './ChannelCardItem.vue'
import AgentRoleManager from './AgentRoleManager.vue'
import {
  getInstanceList,
  getRoleList,
  createInstance,
  type ChannelInfo,
  type AgentRole,
} from '@/api/channel'
import { getActiveModels, type BackendAiModel } from '@/api/model'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const activeTab = ref<'channels' | 'roles'>('channels')
const loading = ref(false)
const channels = ref<ChannelInfo[]>([])
const roleList = ref<AgentRole[]>([])
const modelList = ref<BackendAiModel[]>([])
const roleManagerRef = ref<any>(null)

const createModalVisible = ref(false)
const creatingInstance = ref(false)
const newInstanceData = ref<{
  channelType: string
  instanceName: string
  roleId?: string
}>({
  channelType: 'feishu',
  instanceName: '',
  roleId: undefined,
})

const fetchChannels = async () => {
  try {
    loading.value = true
    const res = await getInstanceList()
    if (res.data) {
      channels.value = res.data
    }
  } catch (err: any) {
    message.error(err.message || '获取接入通道列表失败')
  } finally {
    loading.value = false
  }
}

const fetchRoles = async () => {
  try {
    const res = await getRoleList()
    if (res.data) {
      roleList.value = res.data
    }
  } catch {
    // 忽略加载失败
  }
}

const fetchModels = async () => {
  try {
    const res = await getActiveModels({ category: 'chat' })
    if (res.data) {
      modelList.value = res.data
    }
  } catch {
    // 忽略加载失败
  }
}

const handleRolesUpdated = () => {
  fetchRoles()
  fetchChannels()
}

// 统计每种渠道的实例数，若同渠道实例数大于1或为非默认初始渠道则允许删除
const canDeleteInstance = (ch: ChannelInfo) => {
  if (!ch.id) return false
  const sameTypeCount = channels.value.filter((item) => item.channelType === ch.channelType).length
  return sameTypeCount > 1
}

const openCreateInstanceModal = () => {
  newInstanceData.value = {
    channelType: 'feishu',
    instanceName: '',
    roleId: roleList.value.find((r) => r.isDefault)?.id || undefined,
  }
  createModalVisible.value = true
}

const handleConfirmCreateInstance = async () => {
  if (!newInstanceData.value.instanceName.trim()) {
    message.warning('请输入实例名称')
    return
  }

  try {
    creatingInstance.value = true
    await createInstance({
      channelType: newInstanceData.value.channelType,
      instanceName: newInstanceData.value.instanceName.trim(),
      roleId: newInstanceData.value.roleId || null,
    })
    message.success('通道实例添加成功')
    createModalVisible.value = false
    await fetchChannels()
  } catch (err: any) {
    message.error(err.message || '添加通道实例失败')
  } finally {
    creatingInstance.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      fetchChannels()
      fetchRoles()
      fetchModels()
    }
  },
  { immediate: true },
)
</script>

<style scoped>
:deep(.ant-modal-content) {
  border-radius: 16px;
  overflow: hidden;
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
}

:deep(.ant-modal-body) {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 14px 20px 20px;
}

.assistant-modal-body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 100%;
}

.modal-tab-nav {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.header-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding: 2px 2px;
  flex-shrink: 0;
}

.intro-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.intro-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.intro-desc {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.intro-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.channels-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.channels-stack::-webkit-scrollbar {
  width: 6px;
}

.channels-stack::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 9999px;
}

.channels-stack::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 9999px;
  transition: background-color 0.2s ease;
}

.channels-stack::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.65);
}

.loading-skeleton {
  padding: 20px;
}

.create-instance-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 10px 0;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
