<template>
  <transition name="queue-card-fade">
    <div v-if="queuedMessages.length > 0" class="queued-messages-wrapper">
      <div class="queued-card">
        <!-- 头部标题栏 -->
        <div class="card-header" @click="toggleCollapse">
          <div class="header-left">
            <span class="header-title">排队待发消息</span>
            <span class="count-badge">{{ queuedMessages.length }}</span>
            <span v-if="isPaused" class="header-subtitle paused-hint">
              已暂停自动发送 · 可手动点击发送
            </span>
            <span v-else class="header-subtitle">
              将在当前回答生成结束后自动发送
            </span>
          </div>

          <div class="header-right">
            <button
              v-if="isPaused"
              type="button"
              class="resume-btn"
              title="恢复队列自动发送"
              @click.stop="emit('resume-queue')"
            >
              继续自动发送
            </button>

            <button
              v-if="queuedMessages.length > 1"
              type="button"
              class="collapse-btn"
              :title="isCollapsed ? '展开所有排队项' : '收起排队项'"
              @click.stop="toggleCollapse"
            >
              <DownOutlined :class="['chevron-icon', { rotated: !isCollapsed }]" />
            </button>
          </div>
        </div>

        <!-- 队列列表项 -->
        <div class="card-body">
          <transition-group name="queue-item" tag="div" class="items-list">
            <div
              v-for="(item, index) in visibleItems"
              :key="item.id"
              class="queued-item-row"
            >
              <div class="item-content-col">
                <div class="item-text-line">
                  <span v-if="queuedMessages.length > 1" class="item-index-num">#{{ index + 1 }}</span>
                  <span class="prompt-text-preview" :title="item.prompt">{{ item.prompt }}</span>
                </div>

                <!-- 辅助配置胶囊 (附件/联网/知识库) -->
                <div v-if="hasItemMeta(item)" class="item-meta-chips">
                  <span v-if="getAttachmentCount(item) > 0" class="meta-chip">
                    <PaperClipOutlined class="chip-icon" />
                    {{ getAttachmentCount(item) }} 个附件
                  </span>
                  <span v-if="item.webSearch" class="meta-chip search-chip">
                    <GlobalOutlined class="chip-icon" />
                    联网搜索
                  </span>
                  <span v-if="item.knowledgeBaseIds && item.knowledgeBaseIds.length > 0" class="meta-chip kb-chip">
                    <DatabaseOutlined class="chip-icon" />
                    {{ item.knowledgeBaseIds.length }} 个知识库
                  </span>
                </div>
              </div>

              <!-- 右侧快捷操作区 -->
              <div class="item-actions-col">
                <a-tooltip title="立即发送 (打断当前响应并立即发出)">
                  <button
                    type="button"
                    class="action-icon-btn send-now-btn"
                    @click.stop="emit('send-now', item)"
                  >
                    <ArrowRightOutlined />
                  </button>
                </a-tooltip>

                <a-tooltip title="编辑回填 (撤出排队并回到输入框)">
                  <button
                    type="button"
                    class="action-icon-btn edit-btn"
                    @click.stop="emit('edit', item)"
                  >
                    <EditOutlined />
                  </button>
                </a-tooltip>

                <a-tooltip title="移除排队">
                  <button
                    type="button"
                    class="action-icon-btn delete-btn"
                    @click.stop="emit('remove', item)"
                  >
                    <DeleteOutlined />
                  </button>
                </a-tooltip>
              </div>
            </div>
          </transition-group>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ArrowRightOutlined,
  EditOutlined,
  DeleteOutlined,
  DownOutlined,
  PaperClipOutlined,
  GlobalOutlined,
  DatabaseOutlined,
} from '@ant-design/icons-vue'
import type { QueuedMessage } from '@/interface/conversation'

const props = withDefaults(
  defineProps<{
    queuedMessages: QueuedMessage[]
    isGenerating?: boolean
    isPaused?: boolean
  }>(),
  {
    isGenerating: false,
    isPaused: false,
  },
)

const emit = defineEmits<{
  'send-now': [item: QueuedMessage]
  'edit': [item: QueuedMessage]
  'remove': [item: QueuedMessage]
  'resume-queue': []
}>()

const isCollapsed = ref(false)

const toggleCollapse = () => {
  if (props.queuedMessages.length > 1) {
    isCollapsed.value = !isCollapsed.value
  }
}

const visibleItems = computed(() => {
  if (isCollapsed.value && props.queuedMessages.length > 1) {
    return [props.queuedMessages[0]]
  }
  return props.queuedMessages
})

const getAttachmentCount = (item: QueuedMessage): number => {
  if (item.serverFiles && item.serverFiles.length > 0) {
    return item.serverFiles.length
  }
  if (item.fileIds && item.fileIds.length > 0) {
    return item.fileIds.length
  }
  return 0
}

const hasItemMeta = (item: QueuedMessage): boolean => {
  return (
    getAttachmentCount(item) > 0 ||
    Boolean(item.webSearch) ||
    Boolean(item.knowledgeBaseIds && item.knowledgeBaseIds.length > 0)
  )
}
</script>

<style scoped lang="scss">
.queued-messages-wrapper {
  pointer-events: auto;
  width: 100%;
  max-width: 840px;
  margin: 0 auto 8px auto;
  user-select: none;
}

.queued-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03);
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  background: #f8fafc;
  transition: background 0.2s ease;

  &:hover {
    background: #f1f5f9;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-title {
  color: #1e293b;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e0f2fe;
  color: #0284c7;
  font-size: 11px;
  font-weight: 600;
  padding: 0 6px;
  height: 18px;
  border-radius: 9px;
  border: 1px solid #bae6fd;
}

.header-subtitle {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.paused-hint {
    color: #d97706;
    font-weight: 500;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.resume-btn {
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #b45309;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #fde68a;
    color: #92400e;
  }
}

.collapse-btn {
  background: transparent;
  border: none;
  color: #64748b;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    color: #0f172a;
    background: #e2e8f0;
  }

  .chevron-icon {
    font-size: 11px;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &.rotated {
      transform: rotate(180deg);
    }
  }
}

.card-body {
  padding: 8px 12px;
  background: #ffffff;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queued-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  transition: all 0.18s ease;

  &:hover {
    background: #f1f5f9;
    border-color: #e2e8f0;
  }
}

.item-content-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-text-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.item-index-num {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
  flex-shrink: 0;
}

.prompt-text-preview {
  color: #1e293b;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.item-meta-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;

  .chip-icon {
    font-size: 10px;
  }

  &.search-chip {
    background: #e0f2fe;
    border-color: #bae6fd;
    color: #0284c7;
  }

  &.kb-chip {
    background: #f3e8ff;
    border-color: #e9d5ff;
    color: #7e22ce;
  }
}

.item-actions-col {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 10px;
}

.action-icon-btn {
  background: transparent;
  border: none;
  color: #64748b;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &.send-now-btn:hover {
    background: #e0f2fe;
    color: #0284c7;
  }

  &.edit-btn:hover {
    background: #eff6ff;
    color: #2563eb;
  }

  &.delete-btn:hover {
    background: #fee2e2;
    color: #ef4444;
  }
}

/* 动效 transitions */
.queue-card-fade-enter-active,
.queue-card-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-card-fade-enter-from,
.queue-card-fade-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.queue-item-enter-active,
.queue-item-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-item-enter-from,
.queue-item-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}
</style>
