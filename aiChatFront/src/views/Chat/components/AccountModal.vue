<template>
  <component
    :is="inline ? 'div' : 'a-modal'"
    v-bind="containerProps"
    :class="['account-modal-host', { 'account-inline-surface': inline }]"
    @update:open="handleModalOpenChange"
    @cancel="handleClose"
  >
    <div class="account-workbench">
      <!-- 顶部紧凑身份与额度摘要条 -->
      <section class="account-summary-strip">
        <div class="summary-identity">
          <AvatarUploader
            :size="56"
            :avatar="userAccount.avatar"
            @upload-success="handleAvatarChange"
          />

          <div class="identity-details">
            <div class="identity-title-row">
              <h3 class="summary-username">{{ userAccount.username }}</h3>
              <a-tag :color="userRoleClass === 'admin' ? 'blue' : 'default'" class="role-tag">
                {{ getRoleDisplayName(userAccount.role || 'user') }}
              </a-tag>
            </div>

            <div class="identity-meta-row">
              <span>{{ userAccount.email || '未设置邮箱' }}</span>
              <span class="meta-dot">·</span>
              <span>加入于 {{ formatDate(userAccount.createdAt) }}</span>
              <button
                type="button"
                class="uid-copy-chip"
                title="点击复制完整用户标识"
                @click="handleCopyUserId"
              >
                <span>ID {{ maskedUserId }}</span>
                <CopyOutlined />
              </button>
            </div>
          </div>
        </div>

        <div class="summary-credits">
          <div class="credits-header-row">
            <span class="credits-title">可用积分</span>
            <span class="credits-percent-badge">已用 {{ creditsPercent }}%</span>
          </div>
          <div class="credits-figure-row">
            <strong class="credits-remaining">{{ userAccount.credits.remaining.toLocaleString() }}</strong>
            <span class="credits-subtext">
              总额 {{ userAccount.credits.total.toLocaleString() }} · 已消耗
              {{ userAccount.credits.consumed.toLocaleString() }}
              <template v-if="userAccount.credits.reserved">
                · 预占 {{ userAccount.credits.reserved.toLocaleString() }}
              </template>
            </span>
          </div>
          <a-progress
            :percent="creditsPercent"
            :show-info="false"
            stroke-color="#1570ef"
            trail-color="#e2e8f0"
            :stroke-width="6"
          />
        </div>
      </section>

      <!-- 中部 Segmented 分段导航 + 刷新工具条 -->
      <div class="account-tab-bar">
        <a-segmented
          v-model:value="activeTab"
          :options="tabOptions"
          size="middle"
        />

        <div class="tab-bar-actions">
          <span class="session-quick-meta">
            会话 {{ conversationStatsSummary.totalSessions.toLocaleString() }} ·
            Token {{ formatToken(conversationStatsSummary.totalTokens) }}
          </span>
          <a-button
            size="small"
            class="refresh-account-btn"
            :loading="ledgerLoading"
            @click="handleRefreshAccount"
          >
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
        </div>
      </div>

      <!-- 主工作区内容面板 -->
      <div class="account-tab-stage">
        <!-- Tab 1: 用量与概览 -->
        <section v-show="activeTab === 'overview'" class="overview-grid">
          <ChatStatsPanel
            :summary="conversationStatsSummary"
            :model-breakdown="modelUsageBreakdown"
          />

          <article class="surface-card recent-ledger-card">
            <div class="card-header">
              <div class="card-title-group">
                <WalletOutlined class="card-icon" />
                <div>
                  <h4>最近积分流水</h4>
                  <p>展示最近 4 条积分变动动态</p>
                </div>
              </div>
              <a-button
                type="link"
                size="small"
                class="view-all-ledger-btn"
                @click="activeTab = 'ledger'"
              >
                查看全部 ({{ ledgerTotal }})
                <RightOutlined />
              </a-button>
            </div>

            <div v-if="ledgerLoading && recentCreditLedger.length === 0" class="card-state">
              正在加载最近积分流水...
            </div>
            <div v-else-if="recentCreditLedger.length === 0" class="card-state">
              暂无积分流水
            </div>
            <div v-else class="preview-ledger-list">
              <div
                v-for="item in previewLedgerItems"
                :key="item.id"
                class="preview-ledger-row"
              >
                <div class="preview-row-copy">
                  <strong class="preview-row-title">{{ item.title }}</strong>
                  <span class="preview-row-meta">
                    <template v-if="item.description">{{ item.description }} · </template>
                    {{ formatLedgerTime(item.createdAt) }}
                  </span>
                </div>
                <div class="preview-row-metrics">
                  <strong :class="['mono-num', 'preview-amount', getLedgerAmountClass(item.amount)]">
                    {{ formatLedgerAmount(item.amount) }}
                  </strong>
                  <span class="mono-num preview-balance">
                    余额 {{ item.balanceAfter.toLocaleString() }}
                  </span>
                </div>
              </div>
            </div>
          </article>
        </section>

        <!-- Tab 2: 积分流水（分页与筛选表格） -->
        <section v-show="activeTab === 'ledger'" class="surface-card ledger-tab-card">
          <CreditLedgerPanel
            :items="recentCreditLedger"
            :loading="ledgerLoading"
            :total="ledgerTotal"
            :page="ledgerPage"
            :page-size="ledgerPageSize"
            @page-change="handleLedgerPageChange"
          />
        </section>

        <!-- Tab 3: 账号资料与安全 -->
        <section v-show="activeTab === 'profile'" class="surface-card profile-tab-card">
          <div class="card-header">
            <div class="card-title-group">
              <IdcardOutlined class="card-icon" />
              <div>
                <h4>基础资料</h4>
                <p>维护联系方式并核对账号识别标识</p>
              </div>
            </div>
          </div>

          <div class="profile-grid">
            <div class="profile-field">
              <div class="field-copy">
                <span class="field-label">用户名</span>
                <strong class="field-value">{{ userAccount.username || '未知用户' }}</strong>
              </div>
              <UserOutlined class="field-icon" />
            </div>

            <div class="profile-field editable">
              <div class="field-copy">
                <span class="field-label">手机号</span>
                <template v-if="isEditingPhone">
                  <a-input
                    ref="phoneInputRef"
                    v-model:value="editingPhone"
                    placeholder="请输入手机号"
                    class="phone-input"
                    :maxlength="11"
                    @blur="handlePhoneBlur"
                    @keydown.enter="handlePhoneSave"
                    @keydown.escape="handlePhoneCancel"
                  />
                </template>
                <strong v-else class="field-value">{{ formatPhone(userAccount.phone) }}</strong>
              </div>

              <a-button
                v-if="isEditingPhone"
                type="link"
                size="small"
                @click="handlePhoneSave"
              >
                保存
              </a-button>
              <a-button
                v-else
                type="link"
                size="small"
                @click="startEditPhone"
              >
                <template #icon><EditOutlined /></template>
                修改
              </a-button>
            </div>

            <div class="profile-field">
              <div class="field-copy">
                <span class="field-label">绑定邮箱</span>
                <strong class="field-value">{{ userAccount.email || '未设置' }}</strong>
              </div>
              <MailOutlined class="field-icon" />
            </div>

            <div class="profile-field">
              <div class="field-copy">
                <span class="field-label">账户角色</span>
                <strong class="field-value">{{ getRoleDisplayName(userAccount.role || 'user') }}</strong>
              </div>
              <a-tag :color="userRoleClass === 'admin' ? 'blue' : 'default'" class="role-tag">
                {{ userAccount.role === 'admin' ? 'Admin' : 'User' }}
              </a-tag>
            </div>

            <div class="profile-field">
              <div class="field-copy">
                <span class="field-label">注册时间</span>
                <strong class="field-value mono-num">{{ formatDate(userAccount.createdAt) }}</strong>
              </div>
              <CalendarOutlined class="field-icon" />
            </div>

            <div class="profile-field">
              <div class="field-copy">
                <span class="field-label">用户标识 (UID)</span>
                <strong class="field-value mono-num uid-full">{{ userAccount.id || '未生成' }}</strong>
              </div>
              <a-button
                type="link"
                size="small"
                :disabled="!userAccount.id"
                @click="handleCopyUserId"
              >
                <template #icon><CopyOutlined /></template>
                复制
              </a-button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CalendarOutlined,
  CopyOutlined,
  EditOutlined,
  IdcardOutlined,
  MailOutlined,
  ReloadOutlined,
  RightOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons-vue'
import AvatarUploader from './AvatarUploader.vue'
import ChatStatsPanel from './ChatStatsPanel.vue'
import CreditLedgerPanel from './CreditLedgerPanel.vue'
import { getCurrentUserAccount } from '@/api/user'
import { useConversationStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { RecentCreditLedgerItem } from '@/types/user'
import { ROLE_DISPLAY_MAP } from '@/types/user'
import { formatDate, formatPhone } from '@/utils/common'
import logger from '@/utils/logger'
import {
  buildConversationStatsSummary,
  buildModelUsageBreakdown,
} from '../utils/conversationInsights'

defineOptions({
  name: 'AccountModal',
})

const props = defineProps<{
  open?: boolean
  inline?: boolean
  layoutMode?: 'modal' | 'page'
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

type AccountTabKey = 'overview' | 'ledger' | 'profile'
const activeTab = ref<AccountTabKey>('overview')
const tabOptions = [
  { label: '用量与概览', value: 'overview' },
  { label: '积分流水', value: 'ledger' },
  { label: '账号资料', value: 'profile' },
]

const authStore = useAuthStore()
const conversationStore = useConversationStore()
const ledgerLoading = ref(false)
const recentCreditLedger = ref<RecentCreditLedgerItem[]>([])
const ledgerPage = ref(1)
const ledgerPageSize = 10
const ledgerTotal = ref(0)

const isVisible = computed(() => props.inline || !!props.open)

const containerProps = computed(() => {
  if (props.inline) {
    return {}
  }

  return {
    open: props.open,
    title: '个人账户中心',
    footer: null,
    closable: true,
    centered: true,
    destroyOnClose: true,
    width: '1020px',
  }
})

const userAccount = computed(() => authStore.getUserAccount())

const conversationStatsSummary = computed(() =>
  buildConversationStatsSummary(
    conversationStore.conversations,
    conversationStore.conversations,
  ),
)

const modelUsageBreakdown = computed(() =>
  buildModelUsageBreakdown(conversationStore.conversations, 4),
)

const previewLedgerItems = computed(() => recentCreditLedger.value.slice(0, 4))

const creditsPercent = computed(() => {
  const { total, consumed } = userAccount.value.credits
  if (total <= 0) {
    return 0
  }
  return Math.min(100, Math.round((consumed / total) * 100))
})

const formatToken = (value: number) => {
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}k`
  }
  return value.toLocaleString()
}

const userRoleClass = computed(() => userAccount.value.role || 'user')

const maskedUserId = computed(() => {
  const id = userAccount.value.id || ''
  if (!id) {
    return '未生成'
  }
  if (id.length <= 12) {
    return id
  }
  return `${id.slice(0, 8)}...${id.slice(-4)}`
})

const isEditingPhone = ref(false)
const editingPhone = ref('')
const phoneInputRef = ref<HTMLInputElement | null>(null)

const startEditPhone = () => {
  editingPhone.value = userAccount.value.phone?.replace(/\*+/g, '') || ''
  isEditingPhone.value = true
  nextTick(() => {
    phoneInputRef.value?.focus()
  })
}

const handlePhoneSave = () => {
  const phone = editingPhone.value.trim()

  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    message.warning('请输入正确的手机号')
    return
  }

  authStore.updatePhone(phone)
  isEditingPhone.value = false
  message.success('手机号更新成功')
}

const handlePhoneCancel = () => {
  isEditingPhone.value = false
  editingPhone.value = ''
}

const handlePhoneBlur = () => {
  setTimeout(() => {
    if (isEditingPhone.value) {
      handlePhoneCancel()
    }
  }, 150)
}

const handleAvatarChange = (avatarUrl: string) => {
  authStore.setUserAvatar(avatarUrl)
}

const handleCopyUserId = async () => {
  const userId = userAccount.value.id
  if (!userId) return
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(userId)
      message.success('已复制用户标识')
      return
    }
  } catch {
    // 剪贴板不可用时走降级提示
  }
  message.info(`用户标识：${userId}`)
}

const fetchAccountDetails = async (page: number = 1) => {
  if (!authStore.isAuthenticated) {
    recentCreditLedger.value = []
    ledgerTotal.value = 0
    return
  }

  ledgerLoading.value = true
  try {
    const response = await getCurrentUserAccount({
      ledgerPage: page,
      ledgerPageSize,
    })
    if (response.data.user?.credits) {
      authStore.setUserCredits(response.data.user.credits)
    }

    const ledgerPageData = response.data.recentLedger
    const items = ledgerPageData?.items || []
    recentCreditLedger.value = items
    ledgerPage.value = ledgerPageData?.page || page
    ledgerTotal.value = ledgerPageData?.total ?? items.length
  } catch (error) {
    logger.error('加载账户详情失败:', error)
    message.warning('加载积分流水失败，请稍后重试')
  } finally {
    ledgerLoading.value = false
  }
}

const handleRefreshAccount = () => {
  void fetchAccountDetails(ledgerPage.value || 1)
}

const handleLedgerPageChange = (nextPage: number) => {
  void fetchAccountDetails(nextPage)
}

const formatLedgerTime = (value: string): string => {
  if (!value) {
    return '未知时间'
  }
  try {
    return new Date(value).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

const formatLedgerAmount = (amount: number): string => {
  if (amount > 0) return `+${amount.toLocaleString()}`
  if (amount < 0) return amount.toLocaleString()
  return '0'
}

const getLedgerAmountClass = (amount: number): string => {
  if (amount > 0) return 'positive'
  if (amount < 0) return 'negative'
  return 'neutral'
}

const getRoleDisplayName = (role: string): string => {
  return ROLE_DISPLAY_MAP[role] || '普通用户'
}

const handleClose = () => {
  if (props.inline) {
    return
  }
  isEditingPhone.value = false
  editingPhone.value = ''
  emit('update:open', false)
}

const handleModalOpenChange = (nextOpen: boolean) => {
  if (!props.inline) {
    emit('update:open', nextOpen)
  }
}

watch(
  isVisible,
  (newValue) => {
    if (newValue) {
      activeTab.value = 'overview'
      ledgerPage.value = 1
      ledgerTotal.value = 0
      recentCreditLedger.value = []
      void fetchAccountDetails(1)
      return
    }

    isEditingPhone.value = false
    editingPhone.value = ''
    ledgerLoading.value = false
    ledgerPage.value = 1
    ledgerTotal.value = 0
    recentCreditLedger.value = []
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.account-inline-surface {
  max-width: 1020px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 24px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
}

.account-workbench {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 460px;
}

.account-summary-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 14px 18px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.summary-identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.identity-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.identity-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.summary-username {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
  font-weight: 700;
  color: #0f172a;
}

.role-tag {
  margin-inline-end: 0;
  font-size: 11px;
  line-height: 18px;
  font-weight: 600;
}

.identity-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: #64748b;
}

.meta-dot {
  color: #cbd5e1;
}

.uid-copy-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;

  &:hover {
    border-color: #1570ef;
    color: #1570ef;
  }
}

.summary-credits {
  min-width: 280px;
  flex: 0 1 340px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  :deep(.ant-progress) {
    line-height: 1;
  }
}

.credits-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.credits-title {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.credits-percent-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 600;
  color: #1570ef;
  background: rgba(21, 112, 239, 0.08);
  padding: 1px 8px;
  border-radius: 999px;
}

.credits-figure-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.credits-remaining {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 700;
  color: #0f172a;
}

.credits-subtext {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 11.5px;
  color: #64748b;
}

.account-tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.tab-bar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.session-quick-meta {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: #64748b;
}

.account-tab-stage {
  min-height: 330px;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 16px;
  align-items: stretch;
}

.surface-card {
  padding: 16px 18px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.recent-ledger-card {
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.card-title-group {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #0f172a;
  }

  p {
    margin: 2px 0 0;
    font-size: 12px;
    color: #64748b;
  }
}

.card-icon {
  font-size: 16px;
  margin-top: 3px;
  color: #1570ef;
  flex-shrink: 0;
}

.view-all-ledger-btn {
  padding-inline: 0;
  font-size: 12.5px;
}

.card-state {
  flex: 1;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #94a3b8;
}

.preview-ledger-list {
  display: flex;
  flex-direction: column;
}

.preview-ledger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid #f1f5f9;
}

.preview-row-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-row-title {
  font-size: 13px;
  font-weight: 500;
  color: #0f172a;
}

.preview-row-meta {
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-row-metrics {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.mono-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.preview-amount {
  font-size: 13.5px;
  font-weight: 600;

  &.positive {
    color: #15803d;
  }

  &.negative {
    color: #b91c1c;
  }

  &.neutral {
    color: #64748b;
  }
}

.preview-balance {
  font-size: 11.5px;
  color: #64748b;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.profile-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 62px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.field-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 11.5px;
  color: #64748b;
}

.field-value {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  word-break: break-all;

  &.uid-full {
    font-size: 12px;
    font-weight: 500;
    color: #334155;
  }
}

.field-icon {
  font-size: 16px;
  color: #94a3b8;
  flex-shrink: 0;
}

.phone-input {
  width: 160px;
  height: 30px;
}

@media (max-width: 768px) {
  .account-summary-strip {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-credits {
    min-width: 0;
    flex: none;
  }

  .overview-grid,
  .profile-grid {
    grid-template-columns: 1fr;
  }
}
</style>
