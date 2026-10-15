<template>
  <Teleport to="body">
    <Transition name="citation-popover-fade">
      <div
        v-if="visible && anchorRect"
        class="citation-hover-popover"
        :style="popoverStyle"
        @mouseenter="$emit('mouseenter')"
        @mouseleave="$emit('mouseleave')"
      >
        <div class="popover-content-card">
          <!-- 头部来源类型与置信度/域名 -->
          <div class="popover-header">
            <div class="header-type">
              <span v-if="source?.isKnowledgeBase" class="type-badge kb">
                <DatabaseOutlined class="type-icon" />
                <span>知识库切片</span>
              </span>
              <span v-else class="type-badge web">
                <GlobalOutlined class="type-icon" />
                <span>外部检索来源</span>
              </span>

              <span v-if="source?.score" class="score-badge">
                <ThunderboltFilled class="score-icon" />
                <span>置信度 {{ (source.score * 100).toFixed(0) }}%</span>
              </span>
              <span v-else-if="displayDomain" class="domain-badge" :title="displayDomain">
                {{ displayDomain }}
              </span>
            </div>

            <span class="index-badge">#{{ citationId }}</span>
          </div>

          <!-- 来源标题 -->
          <div class="popover-title" :title="source?.title || `参考来源 #${citationId}`">
            {{ source?.title || `未命名参考来源 #${citationId}` }}
          </div>

          <!-- 切片内容摘要 -->
          <div class="popover-snippet font-mono">
            {{ source?.snippet || '暂无切片预览内容' }}
          </div>

          <!-- 底部操作栏 -->
          <div class="popover-footer">
            <button
              v-if="source?.isKnowledgeBase"
              type="button"
              class="footer-action-btn primary"
              @click="$emit('open-detail', source)"
            >
              <FileTextOutlined />
              <span>查看切片详情</span>
            </button>
            <a
              v-else-if="source?.url"
              :href="source.url"
              target="_blank"
              rel="noopener noreferrer"
              class="footer-action-btn external"
            >
              <LinkOutlined />
              <span>访问原始网页</span>
            </a>
            <span v-else class="footer-tip">内置系统引用</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  DatabaseOutlined,
  GlobalOutlined,
  ThunderboltFilled,
  FileTextOutlined,
  LinkOutlined,
} from '@ant-design/icons-vue'
import type { SearchSource } from '@/interface/chat'

defineOptions({
  name: 'CitationPopover',
})

interface Props {
  visible: boolean
  source?: SearchSource | null
  citationId: number | string
  anchorRect: DOMRect | { top: number; left: number; width: number; height: number; bottom?: number } | null
}

const props = defineProps<Props>()

defineEmits<{
  'open-detail': [source: SearchSource]
  mouseenter: []
  mouseleave: []
}>()

const displayDomain = computed(() => {
  if (!props.source?.url) return props.source?.sitename || ''
  try {
    return new URL(props.source.url).hostname.replace(/^www\./, '')
  } catch {
    return props.source.sitename || ''
  }
})

const popoverStyle = computed(() => {
  if (!props.anchorRect) return { display: 'none' }

  const width = 310
  const estimatedHeight = 175
  const margin = 12

  const rect = props.anchorRect
  const rectBottom = rect.bottom ?? rect.top + rect.height

  // 默认向上弹出
  let top = rect.top - estimatedHeight - 8
  if (top < margin) {
    // 顶部空间不足，向下弹出
    top = rectBottom + 8
  }

  // 水平居中于徽章
  let left = rect.left + rect.width / 2 - width / 2
  const maxLeft = (typeof window !== 'undefined' ? window.innerWidth : 1200) - width - margin

  if (left < margin) left = margin
  if (left > maxLeft) left = maxLeft

  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    zIndex: 9999,
  }
})
</script>

<style scoped lang="scss">
.citation-hover-popover {
  pointer-events: auto;
}

.popover-content-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 12px;
  box-shadow:
    0 12px 28px -6px rgba(15, 23, 42, 0.16),
    0 4px 10px -2px rgba(15, 23, 42, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  .header-type {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .type-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;

    &.kb {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }

    &.web {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #e2e8f0;
    }

    .type-icon {
      font-size: 11px;
    }
  }

  .score-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 600;
    color: #16a34a;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    padding: 2px 6px;
    border-radius: 4px;

    .score-icon {
      font-size: 10px;
      color: #16a34a;
    }
  }

  .domain-badge {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 110px;
  }

  .index-badge {
    font-size: 11px;
    font-weight: 700;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 1px 5px;
    border-radius: 4px;
    flex-shrink: 0;
  }
}

.popover-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.popover-snippet {
  font-size: 11.5px;
  line-height: 1.5;
  color: #475467;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  padding: 8px 10px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.popover-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 2px;

  .footer-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

    &.primary {
      color: #ffffff;
      background: #2563eb;
      border: 1px solid #1d4ed8;

      &:hover {
        background: #1d4ed8;
      }
    }

    &.external {
      color: #0f172a;
      background: #f8fafc;
      border: 1px solid #cbd5e1;

      &:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
      }
    }
  }

  .footer-tip {
    font-size: 11px;
    color: #94a3b8;
  }
}

/* 进退场渐变过渡 */
.citation-popover-fade-enter-active,
.citation-popover-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.citation-popover-fade-enter-from,
.citation-popover-fade-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.97);
}
</style>
