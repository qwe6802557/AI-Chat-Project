<template>
  <a-popover
    v-model:open="isOpen"
    trigger="click"
    placement="top"
    overlay-class-name="kb-capsule-popover"
  >
    <template #content>
      <div class="kb-picker-dropdown">
        <div class="dropdown-header">
          <span class="title">选择知识库 (混合 RAG)</span>
          <router-link to="/knowledge" class="manage-link" @click="isOpen = false">
            管理知识库
          </router-link>
        </div>

        <div v-if="loading" class="dropdown-loading">
          <LoadingOutlined spin />
          <span>正在加载知识库...</span>
        </div>

        <div v-else-if="kbList.length === 0" class="dropdown-empty">
          <p>暂无可用知识库</p>
          <router-link to="/knowledge" class="create-btn" @click="isOpen = false">
            前往创建
          </router-link>
        </div>

        <div v-else class="kb-options-list">
          <div
            v-for="kb in kbList"
            :key="kb.id"
            :class="['kb-option-item', { selected: selectedIds.includes(kb.id) }]"
            @click="toggleSelect(kb.id)"
          >
            <div class="checkbox-box">
              <CheckOutlined v-if="selectedIds.includes(kb.id)" class="check-icon" />
            </div>
            <div class="kb-option-info">
              <span class="kb-option-name" :title="kb.name">{{ kb.name }}</span>
              <span class="kb-option-stats">
                {{ kb.documentCount }} 文档 · {{ kb.chunkCount }} 切片
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <button
      type="button"
      :class="['kb-capsule-btn', { active: selectedIds.length > 0, disabled }]"
      :disabled="disabled"
      @click="handleCapsuleClick"
    >
      <DatabaseOutlined class="capsule-icon" />
      <span class="capsule-label">
        {{ selectedIds.length > 0 ? `知识库 (${selectedIds.length})` : '知识库' }}
      </span>
      <span v-if="selectedIds.length > 0" class="active-dot" />
    </button>
  </a-popover>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { DatabaseOutlined, LoadingOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { getKnowledgeBases } from '@/api/knowledge'
import type { KnowledgeBaseItem } from '@/interface/knowledge'

defineOptions({
  name: 'KnowledgeBaseCapsule',
})

const props = withDefaults(
  defineProps<{
    selectedIds: string[]
    disabled?: boolean
  }>(),
  {
    selectedIds: () => [],
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:selectedIds': [ids: string[]]
}>()

const isOpen = ref(false)
const loading = ref(false)
const kbList = ref<KnowledgeBaseItem[]>([])

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getKnowledgeBases()
    kbList.value = (res.data || []).filter((item) => item.isActive !== false)
  } catch {
    // 忽略加载错误
  } finally {
    loading.value = false
  }
}

const toggleSelect = (id: string) => {
  const current = [...props.selectedIds]
  const idx = current.indexOf(id)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(id)
  }
  emit('update:selectedIds', current)
}

const handleCapsuleClick = () => {
  if (props.disabled) return
  if (!isOpen.value && kbList.value.length === 0) {
    fetchList()
  }
}

watch(isOpen, (open) => {
  if (open) {
    fetchList()
  }
})

onMounted(() => {
  fetchList()
})
</script>

<style scoped lang="scss">
.kb-capsule-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #475467;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover:not(.disabled) {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  &.active {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
    box-shadow: 0 1px 2px rgba(29, 78, 216, 0.08);

    .capsule-icon {
      color: #2563eb;
    }
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .capsule-icon {
    font-size: 13px;
    color: #64748b;
  }

  .active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #2563eb;
  }
}

.kb-picker-dropdown {
  width: 260px;
  padding: 4px;

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px 10px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 12px;

    .title {
      font-weight: 600;
      color: #1e293b;
    }

    .manage-link {
      color: #2563eb;
      font-size: 11px;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .dropdown-loading,
  .dropdown-empty {
    padding: 20px;
    text-align: center;
    font-size: 12px;
    color: #64748b;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    .create-btn {
      color: #2563eb;
      font-size: 12px;
      text-decoration: none;
      font-weight: 500;
    }
  }

  .kb-options-list {
    max-height: 220px;
    overflow-y: auto;
    padding-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .kb-option-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: #f8fafc;
      }

      &.selected {
        background: #eff6ff;

        .checkbox-box {
          background: #2563eb;
          border-color: #2563eb;
        }
      }

      .checkbox-box {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        border: 1px solid #cbd5e1;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        .check-icon {
          color: #ffffff;
          font-size: 10px;
        }
      }

      .kb-option-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;

        .kb-option-name {
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kb-option-stats {
          font-size: 11px;
          color: #64748b;
        }
      }
    }
  }
}
</style>
