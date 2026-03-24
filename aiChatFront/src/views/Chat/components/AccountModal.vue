<template>
  <a-modal
    :open="open"
    :footer="null"
    :closable="true"
    :centered="true"
    :width="'90%'"
    class="account-modal"
    @cancel="handleClose"
  >
    <div class="account-shell">
      <aside class="identity-rail">
        <div class="rail-top">
          <span class="rail-kicker">Account Center</span>
          <span :class="['role-pill', userRoleClass]">
            {{ getRoleDisplayName(userAccount.role || 'user') }}
          </span>
        </div>

        <div class="avatar-stage">
          <AvatarUploader
            :avatar="userAccount.avatar"
            @upload-success="handleAvatarChange"
          />
        </div>

        <div class="identity-copy">
          <h2 class="username">{{ userAccount.username }}</h2>
          <p class="identity-meta">{{ userAccount.email || '未设置邮箱' }}</p>
          <p class="identity-subtitle">加入于 {{ formatDate(userAccount.createdAt) }}</p>
        </div>

        <div class="credit-spotlight">
          <span class="spotlight-label">剩余积分</span>
          <strong class="spotlight-value">{{ userAccount.credits.remaining.toLocaleString() }}</strong>
          <p class="spotlight-description">
            总积分 {{ userAccount.credits.total.toLocaleString() }}，已消耗
            {{ userAccount.credits.consumed.toLocaleString() }}
          </p>
          <a-progress
            :percent="creditsPercent"
            :show-info="false"
            stroke-color="#0f172a"
            trail-color="rgba(15, 23, 42, 0.08)"
          />
          <span class="spotlight-footnote">已使用 {{ creditsPercent }}%</span>
        </div>

        <div class="rail-stats">
          <div
            v-for="metric in railMetrics"
            :key="metric.label"
            class="rail-stat"
          >
            <span class="rail-stat-label">{{ metric.label }}</span>
            <strong class="rail-stat-value">{{ metric.value }}</strong>
          </div>
        </div>
      </aside>

      <section class="account-main">
        <header class="main-header">
          <div>
            <p class="main-kicker">我的账户</p>
            <h3>资料与使用概览</h3>
          </div>
          <p class="main-description">
            保持联系方式为最新，并查看当前账户在会话与积分层面的使用情况。
          </p>
        </header>

        <section class="surface-panel profile-panel">
          <div class="panel-header">
            <div class="panel-title">
              <PhoneOutlined class="panel-icon" />
              <div>
                <h4>基础资料</h4>
                <p>用于展示账户识别信息与常用联系方式</p>
              </div>
            </div>
          </div>

          <div class="profile-grid">
            <div class="profile-row editable">
              <div class="profile-meta">
                <span class="profile-label">手机号</span>
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
                <strong v-else class="profile-value">{{ formatPhone(userAccount.phone) }}</strong>
              </div>

              <a-button
                v-if="isEditingPhone"
                type="link"
                size="small"
                class="inline-action"
                @click="handlePhoneSave"
              >
                保存
              </a-button>
              <EditOutlined v-else class="action-icon" @click="startEditPhone" />
            </div>

            <div class="profile-row">
              <div class="profile-meta">
                <span class="profile-label">邮箱</span>
                <strong class="profile-value">{{ userAccount.email || '未设置' }}</strong>
              </div>
              <MailOutlined class="row-icon" />
            </div>

            <div class="profile-row">
              <div class="profile-meta">
                <span class="profile-label">角色</span>
                <strong class="profile-value">{{ getRoleDisplayName(userAccount.role || 'user') }}</strong>
              </div>
              <span :class="['role-pill', 'compact', userRoleClass]">
                {{ userAccount.role === 'admin' ? 'Admin' : 'User' }}
              </span>
            </div>

            <div class="profile-row">
              <div class="profile-meta">
                <span class="profile-label">注册时间</span>
                <strong class="profile-value">{{ formatDate(userAccount.createdAt) }}</strong>
              </div>
              <CalendarOutlined class="row-icon" />
            </div>

            <div class="profile-row full-width">
              <div class="profile-meta">
                <span class="profile-label">用户标识</span>
                <strong class="profile-value monospace">{{ maskedUserId }}</strong>
              </div>
              <IdcardOutlined class="row-icon" />
            </div>
          </div>
        </section>

        <section class="summary-grid">
          <article class="surface-panel usage-panel">
            <div class="panel-header">
              <div class="panel-title">
                <WalletOutlined class="panel-icon" />
                <div>
                  <h4>积分使用</h4>
                  <p>当前账户额度与使用进度</p>
                </div>
              </div>
            </div>

            <div class="usage-main">
              <div class="usage-primary">
                <span class="usage-label">可用额度</span>
                <strong class="usage-value">{{ userAccount.credits.remaining.toLocaleString() }}</strong>
              </div>

              <div class="usage-breakdown">
                <div class="breakdown-item">
                  <span>总积分</span>
                  <strong>{{ userAccount.credits.total.toLocaleString() }}</strong>
                </div>
                <div class="breakdown-item">
                  <span>已消耗</span>
                  <strong class="consumed">{{ userAccount.credits.consumed.toLocaleString() }}</strong>
                </div>
              </div>
            </div>

            <div class="usage-progress">
              <a-progress
                :percent="creditsPercent"
                :show-info="false"
                stroke-color="#1570ef"
                trail-color="#eaecf0"
              />
              <span class="progress-text">积分消耗进度 {{ creditsPercent }}%</span>
            </div>
          </article>

          <ChatStatsPanel :summary="conversationStatsSummary" />
        </section>
      </section>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CalendarOutlined,
  EditOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  WalletOutlined,
} from '@ant-design/icons-vue'
import AvatarUploader from './AvatarUploader.vue'
import ChatStatsPanel from './ChatStatsPanel.vue'
import { useConversationStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { ROLE_DISPLAY_MAP } from '@/types/user'
import { formatDate, formatPhone } from '@/utils/common'
import { buildConversationStatsSummary } from '../utils/conversationInsights'

defineOptions({
  name: 'AccountModal',
})

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const authStore = useAuthStore()
const conversationStore = useConversationStore()

const userAccount = computed(() => authStore.getMockUserAccount())

const conversationStatsSummary = computed(() =>
  buildConversationStatsSummary(
    conversationStore.conversations,
    conversationStore.conversations,
  ),
)

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

const railMetrics = computed(() => [
  {
    label: '总会话',
    value: conversationStatsSummary.value.totalSessions.toLocaleString(),
  },
  {
    label: '总 Token',
    value: formatToken(conversationStatsSummary.value.totalTokens),
  },
  {
    label: '主力模型',
    value: conversationStatsSummary.value.topModel || '暂无',
  },
])

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

const getRoleDisplayName = (role: string): string => {
  return ROLE_DISPLAY_MAP[role] || '普通用户'
}

const handleClose = () => {
  isEditingPhone.value = false
  editingPhone.value = ''
  emit('update:open', false)
}

watch(() => props.open, (newValue) => {
  if (!newValue) {
    isEditingPhone.value = false
    editingPhone.value = ''
  }
})
</script>

<style scoped lang="scss">
$color-primary: #1570ef;
$color-ink: #101828;
$color-muted: #667085;
$color-border: rgba(15, 23, 42, 0.08);
$color-surface: rgba(255, 255, 255, 0.96);
$color-shadow: rgba(15, 23, 42, 0.12);

.account-modal {
  :deep(.ant-modal) {
    width: min(860px, calc(100vw - 24px)) !important;
    max-width: calc(100vw - 24px);
  }

  :deep(.ant-modal-content) {
    border-radius: 28px;
    padding: 0;
    overflow: hidden;
    background: linear-gradient(180deg, #fbfcfe 0%, #f4f6fa 100%);
    box-shadow: 0 28px 64px rgba(15, 23, 42, 0.2);
    max-height: calc(100dvh - 28px);
  }

  :deep(.ant-modal-body) {
    padding: 0;
    max-height: calc(100dvh - 28px);
    overflow: hidden;
  }

  :deep(.ant-modal-close) {
    top: 18px;
    right: 18px;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(15, 23, 42, 0.06);
    transition: background 0.2s ease, border-color 0.2s ease;

    &:hover {
      background: #ffffff;
      border-color: rgba(15, 23, 42, 0.12);
    }

    .ant-modal-close-x {
      width: 38px;
      height: 38px;
      line-height: 38px;
      font-size: 16px;
      color: $color-ink;
    }
  }
}

.account-shell {
  display: grid;
  grid-template-columns: 286px minmax(0, 1fr);
  min-height: min(568px, calc(100dvh - 28px));
  max-height: calc(100dvh - 28px);
}

.identity-rail {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px 20px;
  background:
    radial-gradient(circle at top left, rgba(21, 112, 239, 0.2), transparent 34%),
    linear-gradient(180deg, #f7f9fc 0%, #edf2f8 100%);
  border-right: 1px solid rgba(15, 23, 42, 0.06);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.45), transparent 48%);
    pointer-events: none;
  }
}

.rail-top,
.identity-copy,
.credit-spotlight,
.rail-stats {
  position: relative;
  z-index: 1;
}

.rail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rail-kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: $color-muted;
  text-transform: uppercase;
}

.role-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;

  &.admin {
    background: rgba(21, 112, 239, 0.1);
    color: $color-primary;
    border-color: rgba(21, 112, 239, 0.12);
  }

  &.user {
    background: rgba(15, 23, 42, 0.06);
    color: $color-ink;
    border-color: rgba(15, 23, 42, 0.08);
  }

  &.compact {
    min-width: 64px;
  }
}

.avatar-stage {
  display: flex;
  justify-content: flex-start;
}

.identity-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.username {
  margin: 0;
  font-size: 28px;
  line-height: 1;
  font-weight: 700;
  color: $color-ink;
}

.identity-meta,
.identity-subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: $color-muted;
}

.credit-spotlight {
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(10px);

  .spotlight-label {
    display: block;
    margin-bottom: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: $color-muted;
    text-transform: uppercase;
  }

  .spotlight-value {
    display: block;
    font-size: 34px;
    line-height: 0.95;
    font-weight: 700;
    color: $color-ink;
  }

  .spotlight-description {
    margin: 8px 0 10px;
    font-size: 12px;
    line-height: 1.5;
    color: $color-muted;
  }

  .spotlight-footnote {
    display: block;
    margin-top: 6px;
    font-size: 11px;
    color: $color-muted;
  }

  :deep(.ant-progress-inner) {
    border-radius: 999px;
  }

  :deep(.ant-progress-bg) {
    height: 6px !important;
  }
}

.rail-stats {
  display: grid;
  gap: 6px;
}

.rail-stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);

  &:last-child {
    border-bottom: none;
  }
}

.rail-stat-label {
  font-size: 12px;
  color: $color-muted;
}

.rail-stat-value {
  font-size: 14px;
  font-weight: 600;
  color: $color-ink;
  text-align: right;
}

.account-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px 22px 20px;
  overflow: auto;
}

.main-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
  gap: 14px;
  align-items: end;
}

.main-kicker {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: $color-muted;
  text-transform: uppercase;
}

.main-header h3 {
  margin: 0;
  font-size: 24px;
  line-height: 1.1;
  font-weight: 700;
  color: $color-ink;
}

.main-description {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: $color-muted;
}

.surface-panel {
  padding: 16px 18px;
  border-radius: 20px;
  background: $color-surface;
  border: 1px solid $color-border;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
}

.panel-header {
  margin-bottom: 14px;
}

.panel-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: $color-ink;
  }

  p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: $color-muted;
  }
}

.panel-icon {
  width: 18px;
  height: 18px;
  margin-top: 3px;
  color: $color-primary;
  flex-shrink: 0;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.profile-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 62px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(249, 250, 251, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.05);
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;

  &:hover {
    background: #ffffff;
    border-color: rgba(15, 23, 42, 0.1);
    transform: translateY(-1px);
  }

  &.full-width {
    grid-column: 1 / -1;
  }
}

.profile-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-label {
  font-size: 11px;
  color: $color-muted;
}

.profile-value {
  font-size: 14px;
  line-height: 1.35;
  font-weight: 600;
  color: $color-ink;
  word-break: break-word;

  &.monospace {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 12px;
  }
}

.phone-input {
  width: 150px;
  height: 34px;
  border-radius: 10px;

  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 3px rgba(21, 112, 239, 0.1);
  }
}

.row-icon,
.action-icon {
  flex-shrink: 0;
  font-size: 18px;
  color: $color-muted;
}

.action-icon {
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: $color-primary;
  }
}

.inline-action {
  padding-inline: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.usage-main {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(180px, 0.9fr);
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.usage-primary {
  .usage-label {
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: $color-muted;
    text-transform: uppercase;
  }

  .usage-value {
    display: block;
    font-size: 32px;
    line-height: 0.95;
    font-weight: 700;
    color: $color-ink;
  }
}

.usage-breakdown {
  display: grid;
  gap: 8px;
}

.breakdown-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(249, 250, 251, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.05);

  span {
    font-size: 12px;
    color: $color-muted;
  }

  strong {
    font-size: 14px;
    font-weight: 700;
    color: $color-ink;

    &.consumed {
      color: #d97706;
    }
  }
}

.usage-progress {
  .progress-text {
    display: block;
    margin-top: 6px;
    text-align: right;
    font-size: 12px;
    color: $color-muted;
  }

  :deep(.ant-progress-inner) {
    border-radius: 999px;
  }

  :deep(.ant-progress-bg) {
    height: 6px !important;
  }
}

@media (max-width: 920px) {
  .account-shell {
    grid-template-columns: 1fr;
    max-height: calc(100dvh - 28px);
  }

  .identity-rail {
    border-right: none;
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }

  .main-header,
  .summary-grid,
  .usage-main {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .account-shell {
    min-height: auto;
  }

  .identity-rail,
  .account-main {
    padding: 18px 18px 16px;
  }

  .surface-panel {
    padding: 15px 16px;
    border-radius: 20px;
  }

  .profile-grid {
    grid-template-columns: 1fr;
  }

  .profile-row.full-width {
    grid-column: auto;
  }

  .username {
    font-size: 26px;
  }

  .credit-spotlight .spotlight-value,
  .usage-primary .usage-value {
    font-size: 28px;
  }

  .phone-input {
    width: 100%;
  }
}

@media (max-height: 820px) {
  .account-shell {
    grid-template-columns: 264px minmax(0, 1fr);
    min-height: min(520px, calc(100dvh - 24px));
    max-height: calc(100dvh - 24px);
  }

  .identity-rail {
    gap: 12px;
    padding: 18px 16px;
  }

  .account-main {
    gap: 10px;
    padding: 18px 18px 16px;
  }

  .username {
    font-size: 24px;
  }

  .credit-spotlight .spotlight-value,
  .usage-primary .usage-value {
    font-size: 26px;
  }

  .main-header h3 {
    font-size: 22px;
  }

  .surface-panel {
    padding: 14px 16px;
  }

  .profile-row {
    min-height: 56px;
    padding: 10px 12px;
  }

  .hero-spotlight,
  .credit-spotlight {
    padding: 12px 14px;
  }
}
</style>
