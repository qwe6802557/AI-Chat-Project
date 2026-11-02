<template>
  <a-modal
    :open="open"
    :title="null"
    :footer="null"
    width="980px"
    centered
    destroy-on-close
    :body-style="{ padding: '0', height: '640px', overflow: 'hidden' }"
    wrap-class-name="channel-audit-modal-wrap"
    @cancel="handleClose"
  >
    <div class="audit-container">
      <!-- 模态框顶部自定义标头 -->
      <div class="modal-header-bar">
        <div class="header-left">
          <div class="header-icon-box" :class="instance.channelType">
            <svg viewBox="0 0 24 24" class="header-svg" fill="currentColor">
              <path
                d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"
              />
            </svg>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <span class="main-title">{{ instance.instanceName || instance.name }} - 对话审计与会话记忆</span>
              <span class="channel-pill" :class="instance.channelType">
                {{ formatChannelTypeName(instance.channelType) }}
              </span>
              <span v-if="instance.roleName" class="role-pill">
                角色: {{ instance.roleName }}
              </span>
            </div>
            <span class="sub-title">实时审计外部联系人对话消息流，透视 RAG 知识检索切片与积分扣除，支持手动重置上下文记忆</span>
          </div>
        </div>
        <div class="header-right">
          <div v-if="metrics" class="header-metrics-group">
            <div class="metric-chip">
              <span class="chip-label">24h请求</span>
              <span class="chip-val">{{ metrics.totalRequests }}</span>
            </div>
            <div class="metric-chip">
              <span class="chip-label">成功率</span>
              <span class="chip-val success">{{ metrics.successRate }}%</span>
            </div>
            <div class="metric-chip">
              <span class="chip-label">平均耗时</span>
              <span class="chip-val">{{ metrics.avgLatencyMs }}ms</span>
            </div>
          </div>
          <button class="custom-close-btn" @click="handleClose">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 主体双栏区域 -->
      <div class="audit-body">
        <!-- 左侧 Master: 会话联系人列表 -->
        <aside class="sessions-sidebar">
          <div class="sidebar-search-box">
            <a-input
              v-model:value="searchKeyword"
              placeholder="搜索联系人 OpenID..."
              allow-clear
              size="small"
              class="search-input"
              @pressEnter="handleSearch"
              @change="handleSearchChange"
            >
              <template #prefix>
                <SearchOutlined style="color: #94a3b8" />
              </template>
            </a-input>
          </div>

          <div class="sessions-list-container custom-scrollbar">
            <div v-if="loadingSessions" class="loading-state">
              <a-spin tip="加载外部会话..." />
            </div>

            <div v-else-if="filteredSessions.length === 0" class="empty-sessions">
              <div class="empty-icon-wrap"><MessageOutlined /></div>
              <p class="empty-text">{{ searchKeyword ? '未搜到匹配的外部会话' : '暂无外部联系人会话数据' }}</p>
            </div>

            <div
              v-for="item in filteredSessions"
              v-else
              :key="item.fromId"
              class="session-item-card"
              :class="{ 'is-active': activeSession?.fromId === item.fromId }"
              @click="selectSession(item)"
            >
              <div class="session-avatar-dot" :class="instance.channelType">
                {{ (item.senderName || item.fromId).slice(0, 1).toUpperCase() }}
              </div>
              <div class="session-info">
                <div class="session-title-line">
                  <a-tooltip :title="'完整标识: ' + item.fromId" placement="topLeft">
                    <span class="session-openid">{{ formatOpenId(item.fromId) }}</span>
                  </a-tooltip>
                  <span class="session-time">{{ formatRelativeTime(item.lastMessageAt) }}</span>
                </div>
                <div class="session-preview">
                  <span v-if="item.lastSenderType === 'assistant'" class="reply-tag">AI:</span>
                  <span class="preview-text">{{ item.lastContent || '无消息记录' }}</span>
                </div>
                <div class="session-badges">
                  <span class="badge-pill msg-count">{{ item.totalMessages }} 条对话</span>
                  <span v-if="item.totalCredits > 0" class="badge-pill credit-cost">消耗 {{ item.totalCredits }} 积分</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- 右侧 Detail: 消息流水与记忆操作 -->
        <section class="messages-main">
          <!-- 顶部状态栏 -->
          <div v-if="activeSession" class="detail-header-bar">
            <div class="detail-user-meta">
              <div class="current-user-title">
                <span class="label">当前会话:</span>
                <a-tooltip :title="'复制完整OpenID: ' + activeSession.fromId">
                  <span class="openid-copy" @click="copyOpenId(activeSession.fromId)">
                    {{ activeSession.fromId }}
                  </span>
                </a-tooltip>
              </div>
              <div class="current-user-stat">
                共计 {{ activeSession.totalMessages }} 条交互，累计消耗 {{ activeSession.totalCredits }} 积分
              </div>
            </div>

            <div class="detail-actions">
              <a-popconfirm
                title="确定重置当前外部用户的会话记忆？"
                description="重置后将清除 Redis 上下文窗口，下一次外部用户提问将开启全新对话。历史记录仍会保留供审计。"
                ok-text="确认重置"
                cancel-text="取消"
                ok-type="danger"
                @confirm="handleClearMemory"
              >
                <a-button size="small" class="reset-memory-btn" :loading="clearingMemory">
                  <template #icon><ClearOutlined /></template>
                  重置上下文记忆
                </a-button>
              </a-popconfirm>

              <a-button size="small" class="refresh-btn" :loading="loadingMessages" @click="fetchMessages">
                <template #icon><ReloadOutlined /></template>
                刷新
              </a-button>
            </div>
          </div>

          <!-- 消息流水气泡区 -->
          <div ref="messageScrollContainer" class="messages-flow custom-scrollbar">
            <div v-if="loadingMessages && messages.length === 0" class="loading-state">
              <a-spin tip="正在调取对话审计流水..." />
            </div>

            <div v-else-if="!activeSession" class="no-selection-box">
              <div class="guide-art-icon"><InfoCircleOutlined /></div>
              <p class="guide-title">请在左侧选择一个外部联系人会话</p>
              <p class="guide-desc">可查看上下文问答、知识库切片引用与积分消耗明细</p>
            </div>

            <div v-else-if="messages.length === 0" class="empty-messages-box">
              <p class="empty-text">该会话暂未检索到对话记录</p>
            </div>

            <div v-else class="bubble-stream">
              <div
                v-for="msg in messages"
                :key="msg.id"
                class="bubble-row"
                :class="msg.senderType === 'assistant' ? 'assistant-row' : 'user-row'"
              >
                <!-- 助手头像/角色 -->
                <div v-if="msg.senderType === 'assistant'" class="avatar-tag assistant-avatar">
                  <RobotOutlined />
                </div>

                <div class="bubble-wrapper">
                  <!-- 顶部信息行 -->
                  <div class="bubble-meta">
                    <span class="sender-label">
                      {{ msg.senderType === 'assistant' ? (msg.roleName || msg.senderName || '智能助理') : '外部访客' }}
                    </span>
                    <span v-if="msg.modelId && msg.senderType === 'assistant'" class="model-pill">
                      {{ msg.modelId }}
                    </span>
                    <span v-if="msg.costCredits > 0" class="credit-pill">
                      -{{ msg.costCredits }} 积分
                    </span>
                    <span class="timestamp">{{ formatMessageTime(msg.createdAt) }}</span>
                  </div>

                  <!-- 消息气泡正文 -->
                  <div class="bubble-content" :class="msg.senderType">
                    <!-- ReAct 思考与工具链时间轴 (Stitch 风格折叠微标) -->
                    <div
                      v-if="msg.metadata?.trajectory && msg.metadata.trajectory.length > 0"
                      class="react-trajectory-box"
                    >
                      <div class="react-toggle-bar" @click="toggleTrajectoryExpanded(msg.id)">
                        <div class="react-title-col">
                          <span class="react-badge-pill">ReAct</span>
                          <span class="react-summary-text">
                            自主调用 {{ msg.metadata.trajectory.length }} 次工具
                          </span>
                        </div>
                        <div class="react-right-col">
                          <span class="react-steps-preview">
                            <span
                              v-for="(st, idx) in msg.metadata.trajectory"
                              :key="idx"
                              class="step-micro-tag"
                            >
                              {{ st.actionName }}
                            </span>
                          </span>
                          <span class="toggle-arrow" :class="{ 'is-open': expandedTrajectoryMsgIds.has(msg.id) }">▾</span>
                        </div>
                      </div>

                      <div v-if="expandedTrajectoryMsgIds.has(msg.id)" class="react-steps-list">
                        <div
                          v-for="(step, sIdx) in msg.metadata.trajectory"
                          :key="sIdx"
                          class="trajectory-step-card"
                          :class="step.status === 'success' ? 'is-success' : 'is-error'"
                        >
                          <div class="step-header">
                            <div class="step-num-name">
                              <span class="step-order">#{{ step.loopIndex }}</span>
                              <span class="step-fn-name">{{ step.actionName }}</span>
                            </div>
                            <div class="step-duration-badge">
                              {{ step.durationMs }}ms
                            </div>
                          </div>

                          <div v-if="step.thought" class="step-thought-row">
                            <span class="step-sub-label">思考:</span>
                            <span class="step-thought-text">{{ step.thought }}</span>
                          </div>

                          <div class="step-args-row">
                            <span class="step-sub-label">入参:</span>
                            <pre class="step-code-block">{{ formatJsonArgs(step.actionArgs) }}</pre>
                          </div>

                          <div class="step-obs-row">
                            <span class="step-sub-label">观测:</span>
                            <div class="step-obs-text">{{ step.observation }}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="text-body">{{ msg.content }}</div>

                    <!-- RAG 命中知识库切片溯源折叠 -->
                    <div v-if="msg.ragSources && msg.ragSources.length > 0" class="rag-sources-box">
                      <div class="rag-toggle-bar" @click="toggleRagExpanded(msg.id)">
                        <span class="rag-indicator">
                          <BookOutlined class="rag-icon" /> 知识库参考 (命中 {{ msg.ragSources.length }} 条切片)
                        </span>
                        <span class="toggle-arrow" :class="{ 'is-open': expandedRagMsgIds.has(msg.id) }">▾</span>
                      </div>
                      <div v-if="expandedRagMsgIds.has(msg.id)" class="rag-chunks-list">
                        <div
                          v-for="(chunk, idx) in msg.ragSources"
                          :key="idx"
                          class="rag-chunk-card"
                        >
                          <div class="chunk-header">
                            <span class="chunk-doc">《{{ chunk.documentTitle }}》</span>
                            <span class="chunk-score">匹配度: {{ (chunk.score * 100).toFixed(0) }}%</span>
                          </div>
                          <div class="chunk-content-preview">{{ chunk.content }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 访客头像 -->
                <div v-if="msg.senderType === 'user'" class="avatar-tag user-avatar">
                  <UserOutlined />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  SearchOutlined,
  ReloadOutlined,
  ClearOutlined,
  MessageOutlined,
  BookOutlined,
  UserOutlined,
  RobotOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons-vue'
import type {
  ChannelInfo,
  ChannelSessionSummary,
  ChannelMessageItem,
} from '@/api/channel'
import {
  getInstanceSessions,
  getSessionMessages,
  clearSessionMemory,
  getInstanceMetrics,
  type ChannelMetrics,
} from '@/api/channel'

const props = defineProps<{
  open: boolean
  instance: ChannelInfo
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const searchKeyword = ref('')
const sessions = ref<ChannelSessionSummary[]>([])
const activeSession = ref<ChannelSessionSummary | null>(null)
const messages = ref<ChannelMessageItem[]>([])
const loadingSessions = ref(false)
const loadingMessages = ref(false)
const clearingMemory = ref(false)
const metrics = ref<ChannelMetrics | null>(null)
const messageScrollContainer = ref<HTMLElement | null>(null)
const expandedRagMsgIds = ref<Set<string>>(new Set())
const expandedTrajectoryMsgIds = ref<Set<string>>(new Set())

const filteredSessions = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return sessions.value
  return sessions.value.filter(
    (s) =>
      s.fromId.toLowerCase().includes(kw) ||
      (s.senderName && s.senderName.toLowerCase().includes(kw)),
  )
})

const formatChannelTypeName = (type: string) => {
  const map: Record<string, string> = {
    weixin: '微信通道',
    qq: 'QQ 机器人',
    feishu: '飞书机器人',
    dingtalk: '钉钉机器人',
    wecom_bot: '企微机器人',
  }
  return map[type] || type
}

const formatOpenId = (id: string) => {
  if (!id) return ''
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}...${id.slice(-4)}`
}

const formatRelativeTime = (timeStr?: string) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  if (isNaN(date.getTime())) return timeStr
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  if (isToday) {
    return `${hours}:${minutes}`
  }
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

const formatMessageTime = (timeStr?: string) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  if (isNaN(date.getTime())) return timeStr
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

const copyOpenId = (text: string) => {
  navigator.clipboard.writeText(text).then(
    () => message.success('OpenID 标识已复制到剪贴板'),
    () => message.error('复制失败'),
  )
}

const toggleRagExpanded = (msgId: string) => {
  if (expandedRagMsgIds.value.has(msgId)) {
    expandedRagMsgIds.value.delete(msgId)
  } else {
    expandedRagMsgIds.value.add(msgId)
  }
}

const toggleTrajectoryExpanded = (msgId: string) => {
  if (expandedTrajectoryMsgIds.value.has(msgId)) {
    expandedTrajectoryMsgIds.value.delete(msgId)
  } else {
    expandedTrajectoryMsgIds.value.add(msgId)
  }
}

const formatJsonArgs = (args: any): string => {
  if (!args) return '{}'
  try {
    return typeof args === 'string' ? args : JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messageScrollContainer.value) {
      messageScrollContainer.value.scrollTop = messageScrollContainer.value.scrollHeight
    }
  })
}

const fetchMessages = async () => {
  if (!props.instance?.id || !activeSession.value?.fromId) return
  try {
    loadingMessages.value = true
    const res = await getSessionMessages(props.instance.id, activeSession.value.fromId, {
      limit: 100,
    })
    messages.value = res.data?.list || []
    scrollToBottom()
  } catch (err: any) {
    message.error(err.message || '获取对话历史失败')
  } finally {
    loadingMessages.value = false
  }
}

const selectSession = (item: ChannelSessionSummary) => {
  activeSession.value = item
  fetchMessages()
}

const fetchMetrics = async () => {
  if (!props.instance?.id) return
  try {
    const res = await getInstanceMetrics(props.instance.id)
    metrics.value = res.data || null
  } catch {
    metrics.value = null
  }
}

const fetchSessions = async () => {
  if (!props.instance?.id) return
  try {
    loadingSessions.value = true
    const res = await getInstanceSessions(props.instance.id)
    sessions.value = res.data || []
    if (sessions.value.length > 0 && !activeSession.value) {
      selectSession(sessions.value[0])
    }
  } catch (err: any) {
    message.error(err.message || '获取会话列表失败')
  } finally {
    loadingSessions.value = false
  }
}

const handleClose = () => {
  emit('update:open', false)
}

const handleClearMemory = async () => {
  if (!props.instance?.id || !activeSession.value?.fromId) return
  try {
    clearingMemory.value = true
    await clearSessionMemory(props.instance.id, activeSession.value.fromId)
    message.success('已清空当前联系人的上下文记忆缓存 (历史审计流水已保留)')
  } catch (err: any) {
    message.error(err.message || '清空会话记忆失败')
  } finally {
    clearingMemory.value = false
  }
}

const handleSearch = () => {
  // 本地过滤 computed 自动处理
}

const handleSearchChange = () => {
  if (
    activeSession.value &&
    !filteredSessions.value.some((s) => s.fromId === activeSession.value?.fromId)
  ) {
    if (filteredSessions.value.length > 0) {
      selectSession(filteredSessions.value[0])
    } else {
      activeSession.value = null
      messages.value = []
    }
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.instance?.id) {
      fetchSessions()
      fetchMetrics()
    } else {
      activeSession.value = null
      messages.value = []
      searchKeyword.value = ''
      metrics.value = null
      expandedRagMsgIds.value.clear()
    }
  },
  { immediate: true },
)
</script>

<style scoped>
/* 容器全屏流式布局 */
.audit-container {
  display: flex;
  flex-direction: column;
  height: 640px;
  background-color: #ffffff;
  overflow: hidden;
  border-radius: 14px;
}

/* 顶部标头栏 */
.modal-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  border-bottom: 1px solid #e2e8f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #eff6ff;
  color: #2563eb;
}

.header-icon-box.weixin {
  background-color: #f0fdf4;
  color: #16a34a;
}
.header-icon-box.feishu {
  background-color: #f0fdfa;
  color: #0d9488;
}
.header-icon-box.dingtalk {
  background-color: #eff6ff;
  color: #0284c7;
}
.header-icon-box.qq {
  background-color: #f5f3ff;
  color: #7c3aed;
}

.header-svg {
  width: 22px;
  height: 22px;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.main-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.channel-pill {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 12px;
  background-color: #e2e8f0;
  color: #475569;
  font-weight: 500;
}

.role-pill {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 12px;
  background-color: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
  font-weight: 500;
}

.sub-title {
  font-size: 12px;
  color: #64748b;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-metrics-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
}

.chip-label {
  color: #64748b;
  font-size: 11px;
}

.chip-val {
  font-weight: 600;
  color: #0f172a;
}

.chip-val.success {
  color: #16a34a;
}

.custom-close-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #94a3b8;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-close-btn:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}

/* 主体双栏 */
.audit-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧栏 */
.sessions-sidebar {
  width: 310px;
  border-right: 1px solid #e2e8f0;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
}

.sidebar-search-box {
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  background-color: #ffffff;
}

.sessions-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-sessions,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: #94a3b8;
  text-align: center;
}

.empty-icon-wrap {
  font-size: 28px;
  color: #cbd5e1;
  margin-bottom: 8px;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.session-item-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.session-item-card:hover {
  background-color: #f1f5f9;
  border-color: #cbd5e1;
}

.session-item-card.is-active {
  background-color: #eff6ff;
  border-color: #93c5fd;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
}

.session-avatar-dot {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background-color: #dbeafe;
  color: #1d4ed8;
  flex-shrink: 0;
}

.session-avatar-dot.weixin {
  background-color: #dcfce7;
  color: #15803d;
}

.session-avatar-dot.qq {
  background-color: #f3e8ff;
  color: #6b21a8;
}

.session-avatar-dot.feishu {
  background-color: #ccfbf1;
  color: #0f766e;
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.session-title-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.session-openid {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  font-family: monospace;
}

.session-time {
  font-size: 11px;
  color: #94a3b8;
}

.session-preview {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reply-tag {
  color: #2563eb;
  font-weight: 600;
  font-size: 11px;
}

.preview-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.badge-pill {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
}

.badge-pill.msg-count {
  background-color: #f1f5f9;
  color: #475569;
}

.badge-pill.credit-cost {
  background-color: #fff7ed;
  color: #ea580c;
  border: 1px solid #ffedd5;
}

/* 右侧主区 */
.messages-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
}

.detail-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.detail-user-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.current-user-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.current-user-title .label {
  color: #64748b;
}

.openid-copy {
  font-family: monospace;
  font-weight: 600;
  color: #2563eb;
  cursor: pointer;
  background-color: #eff6ff;
  padding: 1px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.openid-copy:hover {
  background-color: #dbeafe;
}

.current-user-stat {
  font-size: 11px;
  color: #94a3b8;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reset-memory-btn {
  color: #dc2626 !important;
  border-color: #fca5a5 !important;
  background-color: #fff1f2 !important;
}

.reset-memory-btn:hover {
  color: #b91c1c !important;
  border-color: #f87171 !important;
  background-color: #ffe4e6 !important;
}

/* 消息流水容器 */
.messages-flow {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  background-color: #f8fafc;
}

.no-selection-box,
.empty-messages-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
}

.guide-art-icon {
  font-size: 36px;
  color: #cbd5e1;
  margin-bottom: 8px;
}

.guide-art {
  font-size: 40px;
  margin-bottom: 8px;
}

.guide-title {
  font-size: 15px;
  font-weight: 500;
  color: #475569;
  margin: 0;
}

.guide-desc {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

.bubble-stream {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bubble-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.bubble-row.user-row {
  flex-direction: row;
  justify-content: flex-end;
}

.avatar-tag {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.bubble-wrapper {
  max-width: 76%;
  display: flex;
  flex-direction: column;
}

.user-row .bubble-wrapper {
  align-items: flex-end;
}

.bubble-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
  padding: 0 4px;
}

.bubble-meta .sender-label {
  font-weight: 600;
  color: #475569;
}

.model-pill {
  background-color: #f1f5f9;
  color: #2563eb;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
}

.credit-pill {
  background-color: #fff7ed;
  color: #ea580c;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.bubble-content {
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.6;
  word-break: break-word;
}

.bubble-content.user {
  background-color: #2563eb;
  color: #ffffff;
  border-top-right-radius: 2px;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.16);
}

.bubble-content.assistant {
  background-color: #ffffff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-top-left-radius: 2px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.text-body {
  white-space: pre-wrap;
}

/* ReAct 思考与工具链折叠样式 (Stitch 规范) */
.react-trajectory-box {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #cbd5e1;
}

.react-toggle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;
}

.react-toggle-bar:hover {
  background-color: #f1f5f9;
}

.react-title-col {
  display: flex;
  align-items: center;
  gap: 6px;
}

.react-badge-pill {
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  background-color: #0f172a;
  color: #f8fafc;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: -0.02em;
}

.react-summary-text {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
}

.react-right-col {
  display: flex;
  align-items: center;
  gap: 6px;
}

.react-steps-preview {
  display: flex;
  gap: 4px;
}

.step-micro-tag {
  font-family: monospace;
  font-size: 10px;
  background-color: #e2e8f0;
  color: #475569;
  padding: 1px 5px;
  border-radius: 3px;
}

.react-steps-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.trajectory-step-card {
  padding: 8px 10px;
  border-radius: 6px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 11.5px;
}

.trajectory-step-card.is-error {
  border-color: #fecaca;
  background-color: #fef2f2;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.step-num-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.step-order {
  font-family: monospace;
  font-weight: 700;
  font-size: 11px;
  color: #64748b;
}

.step-fn-name {
  font-family: monospace;
  font-weight: 600;
  color: #0f172a;
}

.step-duration-badge {
  font-family: monospace;
  font-size: 10px;
  background-color: #e2e8f0;
  color: #475569;
  padding: 1px 6px;
  border-radius: 4px;
}

.step-thought-row,
.step-args-row,
.step-obs-row {
  margin-top: 4px;
  font-size: 11px;
}

.step-sub-label {
  font-weight: 600;
  color: #64748b;
  margin-right: 4px;
}

.step-thought-text {
  color: #475569;
  font-style: italic;
}

.step-code-block {
  font-family: monospace;
  font-size: 11px;
  background-color: #0f172a;
  color: #f8fafc;
  padding: 6px 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 2px 0 0;
  line-height: 1.35;
}

.step-obs-text {
  color: #334155;
  line-height: 1.4;
  word-break: break-all;
}

/* RAG 切片溯源折叠样式 */
.rag-sources-box {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #cbd5e1;
}

.rag-toggle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  background-color: #f8fafc;
  transition: all 0.2s;
}

.rag-toggle-bar:hover {
  background-color: #f1f5f9;
}

.rag-indicator {
  font-size: 11px;
  font-weight: 600;
  color: #059669;
}

.toggle-arrow {
  font-size: 12px;
  color: #94a3b8;
  transition: transform 0.2s ease;
}

.toggle-arrow.is-open {
  transform: rotate(180deg);
}

.rag-chunks-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.rag-chunk-card {
  padding: 8px 10px;
  border-radius: 6px;
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  font-size: 11.5px;
}

.chunk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.chunk-doc {
  font-weight: 600;
  color: #166534;
}

.chunk-score {
  color: #15803d;
  font-size: 10.5px;
  font-weight: 600;
}

.chunk-content-preview {
  color: #374151;
  line-height: 1.45;
  white-space: pre-wrap;
}

/* 6px 舒适细滚动条 (规范第7项需求) */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.4);
  border-radius: 999px;
  transition: background-color 0.2s;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(100, 116, 139, 0.6);
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
</style>
