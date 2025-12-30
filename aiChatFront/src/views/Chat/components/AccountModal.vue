<template>
  <a-modal
    :open="open"
    :footer="null"
    :closable="true"
    :centered="true"
    :width="600"
    class="account-modal"
    @cancel="handleClose"
  >
    <div class="account-content">
      <!-- 头像区域 -->
      <div class="avatar-section">
        <AvatarUploader
          :avatar="userAccount.avatar"
          @upload-success="handleAvatarChange"
        />
        <h2 class="username">{{ userAccount.username }}</h2>
      </div>

      <!-- 用户信息区域 -->
      <div class="info-section">
        <!-- 手机号 -->
        <div class="info-item">
          <span class="info-label">手机号</span>
          <div class="info-value-wrapper">
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
              <a-button type="link" size="small" @click="handlePhoneSave">
                保存
              </a-button>
            </template>
            <template v-else>
              <span class="info-value">{{ formatPhone(userAccount.phone) }}</span>
              <EditOutlined class="edit-icon" @click="startEditPhone" />
            </template>
          </div>
        </div>

        <!-- 邮箱 -->
        <div class="info-item">
          <span class="info-label">邮箱</span>
          <span class="info-value">{{ userAccount.email || '未设置' }}</span>
        </div>

        <!-- 角色 -->
        <div class="info-item">
          <span class="info-label">角色</span>
          <span class="info-value">
            <a-tag :color="userAccount.role === 'admin' ? 'blue' : 'default'">
              {{ getRoleDisplayName(userAccount.role) }}
            </a-tag>
          </span>
        </div>

        <!-- 注册时间 -->
        <div class="info-item">
          <span class="info-label">注册时间</span>
          <span class="info-value">{{ formatDate(userAccount.createdAt) }}</span>
        </div>
      </div>

      <!-- 积分卡片区域 -->
      <div class="credits-section">
        <div class="credits-header">
          <WalletOutlined class="credits-icon" />
          <span>积分概览</span>
        </div>
        <div class="credits-grid">
          <div class="credits-item">
            <span class="credits-label">总积分</span>
            <span class="credits-value total">{{ userAccount.credits.total.toLocaleString() }}</span>
          </div>
          <div class="credits-item">
            <span class="credits-label">已消耗</span>
            <span class="credits-value consumed">{{ userAccount.credits.consumed.toLocaleString() }}</span>
          </div>
          <div class="credits-item">
            <span class="credits-label">剩余</span>
            <span class="credits-value remaining">{{ userAccount.credits.remaining.toLocaleString() }}</span>
          </div>
        </div>
        <!-- 积分进度条 -->
        <div class="credits-progress">
          <a-progress
            :percent="creditsPercent"
            :show-info="false"
            stroke-color="#1570ef"
            trail-color="#f2f4f7"
          />
          <span class="progress-text">已使用 {{ creditsPercent }}%</span>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  EditOutlined,
  WalletOutlined
} from '@ant-design/icons-vue'
import AvatarUploader from './AvatarUploader.vue'
import { useAuthStore } from '@/stores/auth'
import { ROLE_DISPLAY_MAP } from '@/types/user'
import { formatPhone, formatDate } from '@/utils/common'

defineOptions({
  name: 'AccountModal'
})

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const authStore = useAuthStore()

// 获取用户账户信息
const userAccount = computed(() => authStore.getMockUserAccount())

// 积分百分比
const creditsPercent = computed(() => {
  const { total, consumed } = userAccount.value.credits
  return Math.round((consumed / total) * 100)
})

// 手机号编辑
const isEditingPhone = ref(false)
const editingPhone = ref('')
const phoneInputRef = ref<HTMLInputElement | null>(null)

/**
 * 开始编辑手机号
 */
const startEditPhone = () => {
  editingPhone.value = userAccount.value.phone?.replace(/\*+/g, '') || ''
  isEditingPhone.value = true
  nextTick(() => {
    phoneInputRef.value?.focus()
  })
}

/**
 * 保存手机号
 */
const handlePhoneSave = () => {
  const phone = editingPhone.value.trim()

  // 验证
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    message.warning('请输入正确的手机号')
    return
  }

  authStore.updatePhone(phone)
  isEditingPhone.value = false
  message.success('手机号更新成功')
}

/**
 * 取消编辑
 */
const handlePhoneCancel = () => {
  isEditingPhone.value = false
  editingPhone.value = ''
}

/**
 * 失焦处理
 */
const handlePhoneBlur = () => {
  // 延迟关闭
  setTimeout(() => {
    if (isEditingPhone.value) {
      handlePhoneCancel()
    }
  }, 150)
}

// 头像更新
const handleAvatarChange = (avatarUrl: string) => {
  authStore.setUserAvatar(avatarUrl)
}

/**
 * 获取角色显示名称
 */
const getRoleDisplayName = (role: string): string => {
  return ROLE_DISPLAY_MAP[role] || '普通用户'
}

/**
 * 关闭弹框
 */
const handleClose = () => {
  // 关闭时重置编辑状态
  isEditingPhone.value = false
  editingPhone.value = ''
  emit('update:open', false)
}

// 监听弹框打开，重置状态
watch(() => props.open, (newVal) => {
  if (!newVal) {
    isEditingPhone.value = false
    editingPhone.value = ''
  }
})
</script>

<style scoped lang="scss">
// 颜色变量
$color-primary: #1570ef;
$color-avatar: #5B5BD6;
$color-bg-input: #f2f4f7;
$color-text-primary: #101828;
$color-text-secondary: #667085;
$color-border: #d0d5dd;

.account-modal {
  :deep(.ant-modal-content) {
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
  }

  :deep(.ant-modal-body) {
    padding: 0;
  }

  :deep(.ant-modal-close) {
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;

    .ant-modal-close-x {
      width: 32px;
      height: 32px;
      line-height: 32px;
      font-size: 16px;
    }
  }
}

.account-content {
  padding: 32px 24px 24px;

  // 头像区域
  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 24px;

    .username {
      margin: 16px 0 0;
      font-size: 20px;
      font-weight: 600;
      color: $color-text-primary;
    }
  }

  // 信息区域
  .info-section {
    background: $color-bg-input;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;

    .info-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);

      &:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      &:first-child {
        padding-top: 0;
      }

      .info-label {
        font-size: 14px;
        color: $color-text-secondary;
        flex-shrink: 0;
      }

      .info-value-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        justify-content: flex-end;
      }

      .info-value {
        font-size: 14px;
        color: $color-text-primary;
        text-align: right;
      }

      .edit-icon {
        font-size: 14px;
        color: $color-text-secondary;
        cursor: pointer;
        transition: color 0.2s;

        &:hover {
          color: $color-primary;
        }
      }

      .phone-input {
        width: 140px;
        height: 32px;
        border-radius: 6px;
        font-size: 14px;

        &:focus {
          border-color: $color-primary;
          box-shadow: 0 0 0 2px rgba(21, 112, 239, 0.1);
        }
      }
    }
  }

  // 积分区域
  .credits-section {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 12px;
    padding: 16px;

    .credits-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      font-size: 15px;
      font-weight: 600;
      color: $color-text-primary;

      .credits-icon {
        font-size: 18px;
        color: $color-primary;
      }
    }

    .credits-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;

      .credits-item {
        text-align: center;

        .credits-label {
          display: block;
          font-size: 12px;
          color: $color-text-secondary;
          margin-bottom: 4px;
        }

        .credits-value {
          display: block;
          font-size: 18px;
          font-weight: 600;

          &.total {
            color: $color-text-primary;
          }

          &.consumed {
            color: #f59e0b;
          }

          &.remaining {
            color: #10b981;
          }
        }
      }
    }

    .credits-progress {
      .progress-text {
        display: block;
        text-align: right;
        font-size: 12px;
        color: $color-text-secondary;
        margin-top: 4px;
      }

      :deep(.ant-progress-bg) {
        height: 6px !important;
      }

      :deep(.ant-progress-inner) {
        border-radius: 3px;
      }
    }
  }
}
</style>
