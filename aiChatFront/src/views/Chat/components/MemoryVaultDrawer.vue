<template>
  <a-drawer
    v-model:open="visible"
    :title="null"
    placement="right"
    width="500"
    :closable="false"
    class="memory-vault-drawer"
    :destroy-on-close="false"
  >
    <div class="vault-container">
      <!-- 顶栏导航与操作区 -->
      <div class="vault-header">
        <div class="header-main">
          <div class="header-titles">
            <div class="badge-row">
              <span class="mono-badge">MEMORY VAULT</span>
              <span v-if="coreProfile" class="version-badge font-mono">v{{ coreProfile.version }}</span>
            </div>
            <h2 class="vault-title">记忆工坊</h2>
            <p class="vault-subtitle">三层长短期记忆引擎 · 长期核心画像与每日情境记忆</p>
          </div>
          <button type="button" class="close-btn" @click="visible = false">
            <CloseOutlined />
          </button>
        </div>

        <div class="header-actions">
          <div class="segmented-tabs">
            <button
              type="button"
              :class="['tab-btn', { active: activeTab === 'profile' }]"
              @click="activeTab = 'profile'"
            >
              核心画像 (Layer 3)
            </button>
            <button
              type="button"
              :class="['tab-btn', { active: activeTab === 'daily' }]"
              @click="activeTab = 'daily'"
            >
              每日情境 (Layer 2)
              <span v-if="dailyTotal > 0" class="tab-count font-mono">{{ dailyTotal }}</span>
            </button>
          </div>

          <button
            type="button"
            class="distill-btn"
            :disabled="isDistilling"
            @click="handleDistill"
          >
            <SyncOutlined :spin="isDistilling" class="distill-icon" />
            <span>{{ isDistilling ? '正在蒸馏...' : '增量蒸馏' }}</span>
          </button>
        </div>
      </div>

      <!-- Tab 1: 长期核心画像 (Layer 3) -->
      <div v-if="activeTab === 'profile'" class="tab-content profile-tab">
        <div v-if="profileLoading" class="loading-state">
          <LoadingOutlined spin class="loading-spinner" />
          <span>读取核心画像...</span>
        </div>

        <div v-else class="profile-scroll-body">
          <div class="card-section">
            <div class="section-header">
              <span class="section-title">核心画像与工作态势摘要</span>
              <span class="section-hint">AI 依据日常交互持续蒸馏的长期用户设定</span>
            </div>
            <div class="summary-editor-wrapper">
              <a-textarea
                v-model:value="editingSummary"
                :rows="4"
                placeholder="暂无核心画像摘要。可在此处手动补充或修正您的角色、技术栈偏好与工作上下文..."
                class="summary-textarea font-mono"
              />
              <div class="editor-footer">
                <span class="update-time font-mono">
                  更新于 {{ formatTimestamp(coreProfile?.updatedAt) }}
                </span>
                <button
                  type="button"
                  class="save-profile-btn"
                  :disabled="isSavingProfile || editingSummary === (coreProfile?.rawSummary || '')"
                  @click="handleSaveProfile"
                >
                  <CheckOutlined v-if="!isSavingProfile" />
                  <LoadingOutlined v-else spin />
                  <span>{{ isSavingProfile ? '正在保存...' : '保存纠偏' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 偏好规约 -->
          <div class="card-section">
            <div class="section-header">
              <span class="section-title">固化偏好与行为规约 (Preferences)</span>
            </div>
            <div v-if="hasPreferences" class="key-value-list">
              <div
                v-for="(val, key) in coreProfile?.preferences"
                :key="key"
                class="kv-item"
              >
                <div class="kv-key font-mono">{{ key }}</div>
                <div class="kv-val">{{ formatValue(val) }}</div>
              </div>
            </div>
            <div v-else class="empty-hint">暂无提取到的偏好规约</div>
          </div>

          <!-- 事实记忆 -->
          <div class="card-section">
            <div class="section-header">
              <span class="section-title">已确认事实库 (Facts)</span>
            </div>
            <div v-if="hasFacts" class="key-value-list">
              <div
                v-for="(val, key) in coreProfile?.facts"
                :key="key"
                class="kv-item"
              >
                <div class="kv-key font-mono">{{ key }}</div>
                <div class="kv-val">{{ formatValue(val) }}</div>
              </div>
            </div>
            <div v-else class="empty-hint">暂无确认的事实条目</div>
          </div>
        </div>
      </div>

      <!-- Tab 2: 每日情境记忆 (Layer 2) -->
      <div v-else class="tab-content daily-tab">
        <!-- 分类过滤与搜索 -->
        <div class="daily-filter-bar">
          <div class="category-chips">
            <button
              v-for="cat in CATEGORY_OPTIONS"
              :key="cat.value"
              type="button"
              :class="['filter-chip', { active: selectedCategory === cat.value }]"
              @click="handleCategoryChange(cat.value)"
            >
              {{ cat.label }}
            </button>
          </div>
        </div>

        <div v-if="dailyLoading" class="loading-state">
          <LoadingOutlined spin class="loading-spinner" />
          <span>正在检索日常记忆...</span>
        </div>

        <div v-else-if="dailyList.length === 0" class="empty-state">
          <p class="empty-title">暂无匹配的情境记忆</p>
          <span class="empty-desc">在会话中深入交流 3 分钟后，系统将自动提炼关键决策与偏好。</span>
        </div>

        <div v-else class="daily-list-body">
          <div
            v-for="item in dailyList"
            :key="item.id"
            class="daily-memory-card"
          >
            <div class="card-top-row">
              <div class="tag-group">
                <span class="category-tag font-mono">{{ formatCategoryLabel(item.category) }}</span>
                <span class="date-tag font-mono">{{ item.dateKey }}</span>
                <span v-if="item.isArchived" class="archived-tag font-mono">已蒸馏</span>
              </div>
              <a-popconfirm
                title="确定彻底遗忘此条记忆？"
                ok-text="遗忘"
                cancel-text="取消"
                ok-type="danger"
                @confirm="handleDeleteMemory(item.id)"
              >
                <button
                  type="button"
                  class="forget-btn"
                  title="彻底遗忘并删除此条记忆"
                >
                  <DeleteOutlined />
                </button>
              </a-popconfirm>
            </div>
            <div class="card-content-text">{{ item.content }}</div>
          </div>
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 记忆工坊侧边抽屉组件
 * 支持长期核心画像查看与纠偏、日常情境记忆时间线查看与一键遗忘、手动增量蒸馏
 */
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CloseOutlined,
  SyncOutlined,
  LoadingOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import {
  getCoreProfile,
  updateCoreProfile,
  getDailyMemories,
  deleteDailyMemory,
  triggerDistillMemories,
} from '@/api/memory'
import type { AgentCoreProfile, AgentDailyMemory } from '@/interface/memory'

defineOptions({
  name: 'MemoryVaultDrawer',
})

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
}>()

const visible = computed({
  get: () => props.open,
  set: (val: boolean) => emit('update:open', val),
})

const activeTab = ref<'profile' | 'daily'>('profile')

// Layer 3 核心画像状态
const coreProfile = ref<AgentCoreProfile | null>(null)
const editingSummary = ref('')
const profileLoading = ref(false)
const isSavingProfile = ref(false)
const isDistilling = ref(false)

// Layer 2 日常情境记忆状态
const dailyList = ref<AgentDailyMemory[]>([])
const dailyTotal = ref(0)
const dailyLoading = ref(false)
const selectedCategory = ref<string>('')

const CATEGORY_OPTIONS = [
  { label: '全部', value: '' },
  { label: '决策 (decision)', value: 'decision' },
  { label: '偏好 (preference)', value: 'preference' },
  { label: '工作进展 (progress)', value: 'work_progress' },
  { label: '事实 (fact)', value: 'fact' },
  { label: '洞察 (insight)', value: 'insight' },
]

const hasPreferences = computed(() => {
  return coreProfile.value?.preferences && Object.keys(coreProfile.value.preferences).length > 0
})

const hasFacts = computed(() => {
  return coreProfile.value?.facts && Object.keys(coreProfile.value.facts).length > 0
})

const fetchProfile = async () => {
  profileLoading.value = true
  try {
    const res = await getCoreProfile()
    if (res.data) {
      coreProfile.value = res.data
      editingSummary.value = res.data.rawSummary || ''
    }
  } catch (err: any) {
    message.error('获取核心画像失败: ' + (err.message || '网络异常'))
  } finally {
    profileLoading.value = false
  }
}

const fetchDaily = async () => {
  dailyLoading.value = true
  try {
    const res = await getDailyMemories({
      category: selectedCategory.value || undefined,
      limit: 50,
    })
    if (res.data) {
      dailyList.value = res.data.items || []
      dailyTotal.value = res.data.total || 0
    }
  } catch (err: any) {
    message.error('获取情境记忆列表失败: ' + (err.message || '网络异常'))
  } finally {
    dailyLoading.value = false
  }
}

const handleCategoryChange = (val: string) => {
  selectedCategory.value = val
  fetchDaily()
}

const handleSaveProfile = async () => {
  if (!coreProfile.value) return
  isSavingProfile.value = true
  try {
    const res = await updateCoreProfile({
      rawSummary: editingSummary.value,
    })
    if (res.data) {
      coreProfile.value = res.data
      editingSummary.value = res.data.rawSummary || ''
      message.success('核心画像已纠偏保存')
    }
  } catch (err: any) {
    message.error('保存核心画像失败: ' + (err.message || '网络异常'))
  } finally {
    isSavingProfile.value = false
  }
}

const handleDeleteMemory = async (id: string) => {
  // 乐观更新 UI
  const prevList = [...dailyList.value]
  dailyList.value = dailyList.value.filter((item) => item.id !== id)
  dailyTotal.value = Math.max(0, dailyTotal.value - 1)
  try {
    await deleteDailyMemory(id)
    message.success('记忆条目已彻底遗忘')
  } catch (err: any) {
    dailyList.value = prevList
    dailyTotal.value = prevList.length
    message.error('遗忘记忆失败: ' + (err.message || '网络异常'))
  }
}

const handleDistill = async () => {
  isDistilling.value = true
  try {
    const res = await triggerDistillMemories()
    if (res.data) {
      coreProfile.value = res.data
      editingSummary.value = res.data.rawSummary || ''
      message.success('增量蒸馏成功，核心画像已更新')
      // 重新拉取以同步已归档状态
      fetchDaily()
    }
  } catch (err: any) {
    message.error('记忆蒸馏失败: ' + (err.message || '网络异常'))
  } finally {
    isDistilling.value = false
  }
}

const formatCategoryLabel = (cat: string) => {
  switch (cat) {
    case 'decision':
      return 'DECISION'
    case 'preference':
      return 'PREFERENCE'
    case 'work_progress':
      return 'PROGRESS'
    case 'fact':
      return 'FACT'
    case 'insight':
      return 'INSIGHT'
    default:
      return cat.toUpperCase()
  }
}

const formatTimestamp = (ts?: string) => {
  if (!ts) return '-'
  try {
    const d = new Date(ts)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return ts
  }
}

const formatValue = (val: any): string => {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

watch(
  visible,
  (open) => {
    if (open) {
      fetchProfile()
      fetchDaily()
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.vault-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  .vault-header {
    padding: 20px 20px 16px 20px;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 16px;

    .header-main {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;

      .badge-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;

        .mono-badge {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #475467;
          background: #f1f5f9;
          padding: 1px 6px;
          border-radius: 4px;
        }

        .version-badge {
          font-size: 10px;
          color: #0284c7;
          background: #e0f2fe;
          padding: 1px 5px;
          border-radius: 4px;
          font-weight: 600;
        }
      }

      .vault-title {
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
        letter-spacing: -0.02em;
      }

      .vault-subtitle {
        font-size: 12px;
        color: #64748b;
        margin: 4px 0 0 0;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 14px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.15s ease;

        &:hover {
          color: #0f172a;
          background: #f1f5f9;
        }
      }
    }

    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      .segmented-tabs {
        display: flex;
        background: #f1f5f9;
        padding: 3px;
        border-radius: 6px;
        gap: 2px;

        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: transparent;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            color: #1e293b;
          }

          &.active {
            background: #ffffff;
            color: #0f172a;
            font-weight: 600;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }

          .tab-count {
            font-size: 10px;
            background: #e2e8f0;
            color: #334155;
            padding: 0 4px;
            border-radius: 3px;
          }
        }
      }

      .distill-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        padding: 0 10px;
        background: #0f172a;
        color: #ffffff;
        border: 1px solid #0f172a;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover:not(:disabled) {
          background: #1e293b;
          border-color: #1e293b;
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .distill-icon {
          font-size: 11px;
        }
      }
    }
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 60px 0;
      color: #64748b;
      font-size: 13px;

      .loading-spinner {
        font-size: 20px;
        color: #0284c7;
      }
    }
  }

  .profile-scroll-body {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .card-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;

      .section-header {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-bottom: 10px;

        .section-title {
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          letter-spacing: -0.01em;
        }

        .section-hint {
          font-size: 11px;
          color: #94a3b8;
        }
      }

      .summary-editor-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .summary-textarea {
          font-size: 12px;
          line-height: 1.6;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          color: #1e293b;

          &:focus {
            border-color: #0284c7;
            box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.1);
          }
        }

        .editor-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .update-time {
            font-size: 11px;
            color: #94a3b8;
          }

          .save-profile-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            height: 26px;
            padding: 0 10px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            color: #334155;
            cursor: pointer;
            transition: all 0.15s ease;

            &:hover:not(:disabled) {
              background: #f1f5f9;
              border-color: #94a3b8;
              color: #0f172a;
            }

            &:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          }
        }
      }

      .key-value-list {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .kv-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 6px 8px;
          background: #ffffff;
          border: 1px solid #f1f5f9;
          border-radius: 4px;

          .kv-key {
            font-size: 11px;
            font-weight: 600;
            color: #475467;
          }

          .kv-val {
            font-size: 12px;
            color: #1e293b;
            word-break: break-all;
          }
        }
      }

      .empty-hint {
        font-size: 12px;
        color: #94a3b8;
        font-style: italic;
        padding: 6px 0;
      }
    }
  }

  .daily-tab {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .daily-filter-bar {
      .category-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;

        .filter-chip {
          padding: 3px 8px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 11px;
          color: #475467;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            border-color: #cbd5e1;
            color: #0f172a;
          }

          &.active {
            background: #0f172a;
            border-color: #0f172a;
            color: #ffffff;
            font-weight: 500;
          }
        }
      }
    }

    .empty-state {
      padding: 60px 10px;
      text-align: center;

      .empty-title {
        font-size: 14px;
        font-weight: 600;
        color: #334155;
        margin-bottom: 4px;
      }

      .empty-desc {
        font-size: 12px;
        color: #94a3b8;
      }
    }

    .daily-list-body {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .daily-memory-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: border-color 0.15s ease;

        &:hover {
          border-color: #cbd5e1;
        }

        .card-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .tag-group {
            display: flex;
            align-items: center;
            gap: 6px;

            .category-tag {
              font-size: 10px;
              font-weight: 600;
              color: #0f172a;
              background: #e2e8f0;
              padding: 1px 5px;
              border-radius: 3px;
            }

            .date-tag {
              font-size: 10px;
              color: #64748b;
            }

            .archived-tag {
              font-size: 9px;
              color: #059669;
              background: #d1fae5;
              padding: 0 4px;
              border-radius: 2px;
            }
          }

          .forget-btn {
            background: transparent;
            border: none;
            color: #94a3b8;
            font-size: 12px;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 3px;
            transition: color 0.15s ease;

            &:hover {
              color: #ef4444;
            }
          }
        }

        .card-content-text {
          font-size: 12px;
          line-height: 1.5;
          color: #334155;
          word-break: break-all;
        }
      }
    }
  }

  .font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
}
</style>
