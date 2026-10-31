<template>
  <div class="channel-card-item" :class="{ 'is-active': isConnected, 'is-pending': isConnecting }">
    <div class="card-main">
      <div class="left-section">
        <div class="channel-avatar" :class="channel.channelType">
          <!-- 微信 -->
          <svg v-if="channel.channelType === 'weixin'" viewBox="0 0 24 24" class="channel-svg-icon" fill="currentColor">
            <path d="M8.5 2C4.36 2 1 4.91 1 8.5c0 1.98.92 3.75 2.39 4.98L2.5 17.5l4.31-1.44c.54.12 1.1.19 1.69.19.26 0 .52-.02.77-.05-.28-.7-.44-1.47-.44-2.27 0-3.87 3.58-7 8-7 .26 0 .51.02.76.05C16.92 4.14 13.06 2 8.5 2zm-2.25 4a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm4.5 0a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm6.42 4c-3.73 0-6.75 2.57-6.75 5.75 0 3.18 3.02 5.75 6.75 5.75.52 0 1.02-.05 1.5-.16L21.5 22.5l-.79-3.15C21.49 18.29 22 17.07 22 15.75c0-3.18-3.02-5.75-6.75-5.75zm-2.17 3.5a1 1 0 110 2 1 1 0 010-2zm4.34 0a1 1 0 110 2 1 1 0 010-2z" />
          </svg>
          <!-- QQ -->
          <svg v-else-if="channel.channelType === 'qq'" viewBox="0 0 24 24" class="channel-svg-icon" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 2.85 1.2 5.41 3.12 7.24-.13.84-.52 2.15-1.12 2.76.85 0 2.54-.7 3.51-1.37.78.24 1.62.37 2.49.37 5.52 0 10-4.48 10-10S17.52 2 12 2zm0 3c2.76 0 5 2.01 5 4.5S14.76 14 12 14s-5-2.01-5-4.5S9.24 5 12 5zm-3.5 11c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm7 0c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" />
          </svg>
          <!-- 飞书 -->
          <svg v-else-if="channel.channelType === 'feishu'" viewBox="0 0 24 24" class="channel-svg-icon" fill="currentColor">
            <path d="M2.5 12.5L20.5 3l-6 18-4-6.5-8-2z" />
          </svg>
          <!-- 钉钉 -->
          <svg v-else-if="channel.channelType === 'dingtalk'" viewBox="0 0 24 24" class="channel-svg-icon" fill="currentColor">
            <path d="M19.5 4.5l-15 8 6 2 2 6 7-16zm-7.8 8.6l4.8-5.3-6.1 4.1.3 2.7 1-1.5z" />
          </svg>
          <!-- 企微机器人 -->
          <svg v-else viewBox="0 0 24 24" class="channel-svg-icon" fill="currentColor">
            <path d="M12 2a2 2 0 012 2v1h4a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h4V4a2 2 0 012-2zm-4 8a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm8 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-6.5 6a.5.5 0 000 1h5a.5.5 0 000-1h-5z" />
          </svg>
        </div>

        <div class="channel-meta">
          <div class="name-row">
            <span class="channel-name">{{ channel.instanceName || channel.name }}</span>
            <span v-if="channel.roleName" class="role-tag">
              角色: {{ channel.roleName }}
            </span>
            <span v-if="channel.boundModelId" class="bound-tag">
              模型: {{ channel.boundModelId }}
            </span>
          </div>
          <div class="status-row">
            <span class="status-dot" :class="statusColorClass"></span>
            <span class="status-text">{{ statusText }}</span>
          </div>
        </div>
      </div>

      <div class="right-actions">
        <a-button size="small" class="subtle-btn" @click="showConfig = !showConfig">
          <template #icon><SettingOutlined /></template>
          配置
        </a-button>

        <a-button
          v-if="isConnected"
          size="small"
          danger
          :loading="loadingAction"
          @click="handleDisconnect"
        >
          断开
        </a-button>

        <a-button
          v-else
          size="small"
          type="primary"
          :loading="loadingAction"
          @click="handleConnect"
        >
          接入
        </a-button>
      </div>
    </div>

    <!-- 微信内嵌平滑展开扫码区域 -->
    <transition name="fold">
      <div v-if="isWeixin && (isExpandingQr || channel.loginStatus === 'waiting_scan' || channel.loginStatus === 'scanned')" class="inline-qr-panel">
        <div class="qr-content-wrapper">
          <div class="qr-frame">
            <template v-if="qrCodeImg">
              <img v-if="isBase64Image" :src="qrCodeImg" alt="微信授权二维码" class="qr-image" />
              <a-qrcode v-else :value="qrCodeImg" :size="124" :bordered="false" />
            </template>
            <div v-else class="qr-loading-box">
              <a-spin tip="生成专属二维码中..." />
            </div>
          </div>

          <div class="qr-info-pane">
            <div class="qr-title-badge">
              <span class="pulse-beacon"></span>
              {{ channel.loginStatus === 'scanned' ? '已扫码，请在手机上点击确认' : '请使用手机微信扫描二维码授权' }}
            </div>
            <p class="qr-desc">采用腾讯微信官方iLink智能体协议</p>
            <div class="qr-action-bar">
              <a-button size="small" :loading="loadingQr" @click="refreshQr">刷新二维码</a-button>
              <a-button size="small" type="text" @click="isExpandingQr = false">收起</a-button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 配置面板折叠区域 -->
    <transition name="fold">
      <div v-if="showConfig" class="inline-config-panel">
        <div class="config-grid">
          <!-- 实例备注名 -->
          <div class="config-item">
            <label class="item-label">实例名称</label>
            <a-input
              v-model:value="instanceName"
              placeholder="例如：飞书技术支持机器人"
              size="small"
            />
          </div>

          <!-- 绑定智能体角色 (解耦核心) -->
          <div class="config-item">
            <label class="item-label">绑定智能体角色 (Role)</label>
            <a-select
              v-model:value="selectedRoleId"
              placeholder="选择挂载的角色人设"
              size="small"
              style="width: 100%"
              allow-clear
            >
              <a-select-option v-for="r in roleList" :key="r.id" :value="r.id">
                {{ r.name }} {{ r.isDefault ? '(默认)' : '' }}
              </a-select-option>
            </a-select>
          </div>

          <!-- QQ 凭据字段 -->
          <div v-if="channel.channelType === 'qq'" class="config-item-full">
            <div class="creds-row">
              <div class="creds-col">
                <label class="item-label">QQ AppID</label>
                <a-input v-model:value="qqAppId" placeholder="开放平台 AppID" size="small" />
              </div>
              <div class="creds-col">
                <label class="item-label">QQ AppSecret</label>
                <a-input-password v-model:value="qqAppSecret" placeholder="开放平台 AppSecret" size="small" />
              </div>
            </div>
          </div>

          <!-- 飞书凭据字段 -->
          <div v-if="channel.channelType === 'feishu'" class="config-item-full">
            <div class="creds-row">
              <div class="creds-col">
                <label class="item-label">飞书 App ID (cli_xxx)</label>
                <a-input v-model:value="feishuAppId" placeholder="飞书开放平台 App ID" size="small" />
              </div>
              <div class="creds-col">
                <label class="item-label">飞书 App Secret</label>
                <a-input-password v-model:value="feishuAppSecret" placeholder="飞书开放平台 App Secret" size="small" />
              </div>
            </div>
          </div>

          <!-- 钉钉凭据字段 -->
          <div v-if="channel.channelType === 'dingtalk'" class="config-item-full">
            <div class="creds-row">
              <div class="creds-col">
                <label class="item-label">钉钉 Client ID (AppKey)</label>
                <a-input v-model:value="dingtalkClientId" placeholder="开放平台 AppKey" size="small" />
              </div>
              <div class="creds-col">
                <label class="item-label">钉钉 Client Secret (AppSecret)</label>
                <a-input-password v-model:value="dingtalkClientSecret" placeholder="开放平台 AppSecret" size="small" />
              </div>
            </div>
          </div>
        </div>

        <div class="config-footer">
          <div class="footer-left">
            <a-popconfirm
              v-if="canDelete"
              title="确定删除此机器人实例吗？删除后长连接将立即终止。"
              ok-text="确认删除"
              cancel-text="取消"
              @confirm="handleDeleteInstance"
            >
              <a-button size="small" danger class="del-btn">
                <template #icon><DeleteOutlined /></template>
                删除实例
              </a-button>
            </a-popconfirm>
          </div>

          <div class="footer-right">
            <a-button size="small" type="primary" :loading="savingConfig" @click="handleSaveSettings">
              保存配置
            </a-button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import { SettingOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import type { ChannelInfo, AgentRole } from '@/api/channel'
import {
  toggleInstance,
  updateInstanceSettings,
  deleteInstance,
  getWeixinQrCode,
  toggleChannel,
  updateChannelSettings,
} from '@/api/channel'
import type { BackendAiModel } from '@/api/model'

const props = withDefaults(
  defineProps<{
    channel: ChannelInfo
    modelList: BackendAiModel[]
    roleList?: AgentRole[]
    canDelete?: boolean
  }>(),
  {
    roleList: () => [],
    canDelete: false,
  },
)

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const loadingAction = ref(false)
const showConfig = ref(false)
const isExpandingQr = ref(false)
const qrCodeImg = ref(props.channel.qrCodeUrl || '')
const loadingQr = ref(false)
const savingConfig = ref(false)

const instanceName = ref(props.channel.instanceName || props.channel.name)
const selectedRoleId = ref<string | undefined>(props.channel.roleId || undefined)

const qqAppId = ref('')
const qqAppSecret = ref('')
const feishuAppId = ref('')
const feishuAppSecret = ref('')
const dingtalkClientId = ref('')
const dingtalkClientSecret = ref('')

const isWeixin = computed(() => props.channel.channelType === 'weixin')
const isConnected = computed(() => props.channel.status === 'connected')
const isConnecting = computed(
  () =>
    props.channel.status === 'connecting' ||
    props.channel.loginStatus === 'waiting_scan' ||
    props.channel.loginStatus === 'scanned',
)
const isBase64Image = computed(() => qrCodeImg.value?.startsWith('data:image/') || false)

watch(
  () => props.channel,
  (val) => {
    if (val) {
      instanceName.value = val.instanceName || val.name
      selectedRoleId.value = val.roleId || undefined
      if (val.qrCodeUrl) qrCodeImg.value = val.qrCodeUrl
    }
  },
  { deep: true },
)

const statusColorClass = computed(() => {
  if (isConnected.value) return 'dot-connected'
  if (isConnecting.value) return 'dot-connecting'
  return 'dot-disconnected'
})

const statusText = computed(() => {
  if (props.channel.loginStatus === 'waiting_scan') return '等待扫码'
  if (props.channel.loginStatus === 'scanned') return '已扫码待确认'
  if (isConnected.value) return '已连接'
  if (isConnecting.value) return '连接中'
  return '未创建'
})

const handleConnect = async () => {
  if (isWeixin.value) {
    isExpandingQr.value = true
    await refreshQr()
    return
  }

  try {
    loadingAction.value = true
    if (props.channel.id) {
      await toggleInstance(props.channel.id, true)
    } else {
      await toggleChannel(props.channel.channelType, true)
    }
    message.success(`${instanceName.value} 接入服务已启动`)
    emit('refresh')
  } catch (err: any) {
    message.error(err.message || '接入失败')
  } finally {
    loadingAction.value = false
  }
}

const handleDisconnect = async () => {
  try {
    loadingAction.value = true
    if (props.channel.id) {
      await toggleInstance(props.channel.id, false)
    } else {
      await toggleChannel(props.channel.channelType, false)
    }
    message.success(`${instanceName.value} 已断开连接`)
    isExpandingQr.value = false
    emit('refresh')
  } catch (err: any) {
    message.error(err.message || '断开失败')
  } finally {
    loadingAction.value = false
  }
}

const refreshQr = async () => {
  try {
    loadingQr.value = true
    const res = await getWeixinQrCode(props.channel.id)
    if (res.data?.qrCodeUrl) {
      qrCodeImg.value = res.data.qrCodeUrl
    }
  } catch (err: any) {
    message.error(err.message || '获取微信扫码凭据失败')
  } finally {
    loadingQr.value = false
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

const startQrPolling = () => {
  stopQrPolling()
  pollTimer = setInterval(() => {
    if (isExpandingQr.value && !isConnected.value) {
      emit('refresh')
    }
  }, 3000)
}

const stopQrPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(isExpandingQr, (val) => {
  if (val) startQrPolling()
  else stopQrPolling()
})

onUnmounted(() => {
  stopQrPolling()
})

const handleDeleteInstance = async () => {
  if (!props.channel.id) return
  try {
    await deleteInstance(props.channel.id)
    message.success('实例已删除')
    emit('refresh')
  } catch (err: any) {
    message.error(err.message || '删除实例失败')
  }
}

const handleSaveSettings = async () => {
  try {
    savingConfig.value = true
    const payload: any = {
      instanceName: instanceName.value.trim(),
      roleId: selectedRoleId.value || null,
    }

    if (props.channel.channelType === 'qq' && (qqAppId.value || qqAppSecret.value)) {
      payload.credentials = {
        appId: qqAppId.value,
        appSecret: qqAppSecret.value,
      }
    } else if (props.channel.channelType === 'feishu' && (feishuAppId.value || feishuAppSecret.value)) {
      payload.credentials = {
        appId: feishuAppId.value,
        appSecret: feishuAppSecret.value,
      }
    } else if (
      props.channel.channelType === 'dingtalk' &&
      (dingtalkClientId.value || dingtalkClientSecret.value)
    ) {
      payload.credentials = {
        appId: dingtalkClientId.value,
        appSecret: dingtalkClientSecret.value,
      }
    }

    if (props.channel.id) {
      await updateInstanceSettings(props.channel.id, payload)
    } else {
      await updateChannelSettings(props.channel.channelType, payload)
    }

    message.success('通道配置保存成功')
    showConfig.value = false
    emit('refresh')
  } catch (err: any) {
    message.error(err.message || '保存配置失败')
  } finally {
    savingConfig.value = false
  }
}
</script>

<style scoped>
.channel-card-item {
  border: 1px solid rgba(226, 232, 240, 0.85);
  border-radius: 12px;
  background: #ffffff;
  margin-bottom: 12px;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.channel-card-item:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

.channel-card-item.is-active {
  border-color: rgba(16, 185, 129, 0.3);
  background: #fbfdfc;
}

.card-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 14px;
}

.channel-avatar {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  color: #475569;
  flex-shrink: 0;
}

.channel-avatar.weixin {
  background: #ecfdf5;
  color: #10b981;
}

.channel-avatar.qq {
  background: #eff6ff;
  color: #3b82f6;
}

.channel-avatar.feishu {
  background: #f0fdf4;
  color: #059669;
}

.channel-avatar.dingtalk {
  background: #eff6ff;
  color: #2563eb;
}

.channel-avatar.wecom_bot {
  background: #f0fdfa;
  color: #0d9488;
}

.channel-svg-icon {
  width: 24px;
  height: 24px;
}

.channel-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.channel-name {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.role-tag {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 500;
}

.bound-tag {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 4px;
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.dot-connected {
  background: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.dot-connecting {
  background: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
  animation: pulse 1.5s infinite;
}

.dot-disconnected {
  background: #94a3b8;
}

.status-text {
  font-size: 12px;
  color: #64748b;
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.subtle-btn {
  color: #475569;
}

/* 微信内嵌二维码 */
.inline-qr-panel {
  border-top: 1px dashed #e2e8f0;
  background: #f8fafc;
  padding: 16px 20px;
}

.qr-content-wrapper {
  display: flex;
  align-items: center;
  gap: 20px;
}

.qr-frame {
  width: 136px;
  height: 136px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.qr-image {
  width: 124px;
  height: 124px;
  object-fit: contain;
}

.qr-loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-info-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qr-title-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.pulse-beacon {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
  animation: pulse 1.8s infinite;
}

.qr-desc {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.qr-action-bar {
  display: flex;
  gap: 8px;
}

/* 折叠配置面板 */
.inline-config-panel {
  border-top: 1px solid #f1f5f9;
  background: #fcfdfe;
  padding: 16px 20px;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-item-full {
  grid-column: span 2;
}

.creds-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.creds-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-label {
  font-size: 12px;
  font-weight: 500;
  color: #475569;
}

.config-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}

.footer-left {
  display: flex;
  align-items: center;
}

.footer-right {
  display: flex;
  align-items: center;
}

/* 过渡动效 */
.fold-enter-active,
.fold-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 500px;
}

.fold-enter-from,
.fold-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
  100% {
    transform: scale(0.95);
    opacity: 0.8;
  }
}
</style>
