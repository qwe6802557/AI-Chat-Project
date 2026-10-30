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
            <span class="channel-name">{{ channel.name }}</span>
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
        <a-button size="small" class="subtle-btn" @click="handleOpenDocs">
          文档
        </a-button>

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
            <img v-if="qrCodeImg" :src="qrCodeImg" alt="微信授权二维码" class="qr-image" />
            <div v-else class="qr-loading-box">
              <a-spin tip="生成专属二维码中..." />
            </div>
          </div>

          <div class="qr-info-pane">
            <div class="qr-title-badge">
              <span class="pulse-beacon"></span>
              {{ channel.loginStatus === 'scanned' ? '已扫码，请在手机上点击确认' : '请使用手机微信扫描二维码授权' }}
            </div>
            <p class="qr-desc">
              采用腾讯微信官方 iLink 智能体协议，扫码后无需常驻手机端，免被封号风险。
            </p>
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
          <div class="config-item">
            <label class="item-label">驱动大模型</label>
            <a-select
              v-model:value="modelBinding"
              placeholder="跟随系统默认模型"
              size="small"
              style="width: 100%;"
              allow-clear
            >
              <a-select-option v-for="m in modelList" :key="m.modelId" :value="m.modelId">
                {{ m.modelName }} ({{ m.modelId }})
              </a-select-option>
            </a-select>
          </div>

          <div class="config-item">
            <label class="item-label">专属角色设定 (System Prompt)</label>
            <a-textarea
              v-model:value="promptBinding"
              placeholder="为当前通道设置定制的人设与回答基调（可选）..."
              size="small"
              :rows="2"
            />
          </div>

          <!-- QQ / 飞书 凭据字段 -->
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
        </div>

        <div class="config-footer">
          <a-button size="small" type="primary" :loading="savingConfig" @click="handleSaveSettings">
            保存配置
          </a-button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { SettingOutlined } from '@ant-design/icons-vue'
import type { ChannelInfo } from '@/api/channel'
import {
  toggleChannel,
  updateChannelSettings,
  getWeixinQrCode,
} from '@/api/channel'
import type { BackendAiModel } from '@/api/model'

const props = defineProps<{
  channel: ChannelInfo
  modelList: BackendAiModel[]
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const loadingAction = ref(false)
const showConfig = ref(false)
const isExpandingQr = ref(false)
const qrCodeImg = ref('')
const loadingQr = ref(false)
const savingConfig = ref(false)

const modelBinding = ref(props.channel.boundModelId || undefined)
const promptBinding = ref(props.channel.systemPrompt || '')
const qqAppId = ref('')
const qqAppSecret = ref('')

const isWeixin = computed(() => props.channel.channelType === 'weixin')
const isConnected = computed(() => props.channel.status === 'connected')
const isConnecting = computed(() => props.channel.status === 'connecting' || props.channel.loginStatus === 'waiting_scan' || props.channel.loginStatus === 'scanned')

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
    await toggleChannel(props.channel.channelType, true)
    message.success(`${props.channel.name} 接入服务已启动`)
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
    await toggleChannel(props.channel.channelType, false)
    message.success(`${props.channel.name} 已断开连接`)
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
    const res = await getWeixinQrCode()
    if (res.data?.qrCodeUrl) {
      qrCodeImg.value = res.data.qrCodeUrl
    }
  } catch (err: any) {
    message.error(err.message || '获取微信扫码凭据失败')
  } finally {
    loadingQr.value = false
  }
}

const handleSaveSettings = async () => {
  try {
    savingConfig.value = true
    const payload: any = {
      boundModelId: modelBinding.value || null,
      systemPrompt: promptBinding.value || null,
    }

    if (props.channel.channelType === 'qq' && (qqAppId.value || qqAppSecret.value)) {
      payload.credentials = {
        appId: qqAppId.value,
        appSecret: qqAppSecret.value,
      }
    }

    await updateChannelSettings(props.channel.channelType, payload)
    message.success('通道配置保存成功')
    showConfig.value = false
    emit('refresh')
  } catch (err: any) {
    message.error(err.message || '保存配置失败')
  } finally {
    savingConfig.value = false
  }
}

const handleOpenDocs = () => {
  if (props.channel.channelType === 'weixin') {
    window.open('https://github.com/zhayujie/chatgpt-on-wechat', '_blank')
  } else if (props.channel.channelType === 'qq') {
    window.open('https://q.qq.com/#/apps/bot', '_blank')
  } else if (props.channel.channelType === 'feishu') {
    window.open('https://open.feishu.cn/document', '_blank')
  } else if (props.channel.channelType === 'dingtalk') {
    window.open('https://open.dingtalk.com/document', '_blank')
  } else {
    window.open('https://work.weixin.qq.com/api/doc', '_blank')
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
}

.channel-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  letter-spacing: -0.01em;
}

.bound-tag {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, monospace;
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
}

.dot-connected {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.dot-connecting {
  background: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
  animation: pulse 1.8s infinite;
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
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #475569;
}

.subtle-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

/* 微信扫码内嵌折叠展开面板 */
.inline-qr-panel {
  border-top: 1px solid #f1f5f9;
  background: #fafafa;
  padding: 18px 20px;
}

.qr-content-wrapper {
  display: flex;
  align-items: center;
  gap: 24px;
}

.qr-frame {
  width: 140px;
  height: 140px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  flex-shrink: 0;
}

.qr-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #94a3b8;
}

.qr-info-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qr-title-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.pulse-beacon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  animation: pulse 1.5s infinite;
}

.qr-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
}

.qr-action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

/* 内嵌配置面板 */
.inline-config-panel {
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
  padding: 16px 20px;
}

.config-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-item-full {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.creds-row {
  display: flex;
  gap: 12px;
}

.creds-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-label {
  font-size: 12px;
  font-weight: 500;
  color: #475569;
}

.config-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

/* 动效 */
.fold-enter-active,
.fold-leave-active {
  transition: all 0.25s ease-out;
  max-height: 260px;
  opacity: 1;
}

.fold-enter-from,
.fold-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}
</style>
