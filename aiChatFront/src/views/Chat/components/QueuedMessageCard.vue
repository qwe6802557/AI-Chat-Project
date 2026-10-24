<template>
  <transition name="queue-card-fade">
    <div v-if="queuedMessages.length > 0" class="queued-messages-wrapper">
      <div class="queued-card">
        <!-- 头部标题栏 -->
        <div class="card-header" @click="toggleCollapse">
          <div class="header-left">
            <span class="header-title">Queued Messages</span>
            <span class="count-badge">{{ queuedMessages.length }}</span>
            <span v-if="isPaused" class="header-subtitle paused-hint">
              已暂停自动发送 · 可手动点击发送
            </span>
            <span v-else class="header-subtitle">
              Sends after agent finishes working
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
  background: #1c1f24;
  background: linear-gradient(180deg, #22262c 0%, #1a1d22 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  background: rgba(0, 0, 0, 0.12);

  &:hover {
    background: rgba(0, 0, 0, 0.2);
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-title {
  color: #f1f5f9;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 600;
  padding: 0 6px;
  height: 18px;
  border-radius: 9px;
}

.header-subtitle {
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.paused-hint {
    color: #fbbf24;
    font-weight: 500;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.resume-btn {
  background: rgba(245, 158, 11, 0.18);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #fbbf24;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(245, 158, 11, 0.28);
    border-color: #fbbf24;
  }
}

.collapse-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
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
  padding: 6px 10px;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.queued-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  transition: background 0.18s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
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
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
  flex-shrink: 0;
}

.prompt-text-preview {
  color: #e2e8f0;
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
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;

  .chip-icon {
    font-size: 10px;
  }

  &.search-chip {
    background: rgba(14, 165, 233, 0.15);
    color: #38bdf8;
  }

  &.kb-chip {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
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
  color: rgba(255, 255, 255, 0.55);
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
    background: rgba(56, 189, 248, 0.16);
    color: #38bdf8;
  }

  &.edit-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  &.delete-btn:hover {
    background: rgba(239, 68, 68, 0.18);
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
