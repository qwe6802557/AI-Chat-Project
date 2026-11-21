<template>
  <a-drawer
    v-model:open="visible"
    :title="null"
    placement="right"
    width="520"
    :closable="false"
    class="knowledge-source-drawer"
  >
    <div v-if="source" class="source-drawer-body">
      <div class="drawer-header-bar">
        <div class="header-left">
          <span class="source-tag">知识库参考切片</span>
          <span class="chunk-index font-mono">切片 #{{ (source.chunkIndex ?? 0) + 1 }}</span>
          <span v-if="hitSourceLabel" :class="['hit-source-pill', source.hitSource]">
            {{ hitSourceLabel }}
          </span>
        </div>
        <button type="button" class="drawer-close-btn" @click="visible = false">
          <CloseOutlined />
        </button>
      </div>

      <div class="doc-info-card">
        <div class="doc-icon-wrap">
          <FileTextOutlined />
        </div>
        <div class="doc-meta-col">
          <h3 class="doc-title" :title="source.title">{{ source.title }}</h3>
          <div class="doc-stats-row">
            <span v-if="source.score" class="score-pill font-mono">
              <ThunderboltFilled class="score-icon" />
              置信度 {{ (source.score * 100).toFixed(0) }}%
            </span>
            <span v-if="typeof source.rerankScore === 'number'" class="subscore-pill font-mono">
              Rerank {{ (source.rerankScore * 100).toFixed(0) }}%
            </span>
            <span v-if="typeof source.denseScore === 'number'" class="subscore-pill font-mono">
              Dense {{ (source.denseScore * 100).toFixed(0) }}%
            </span>
            <span class="char-count font-mono">{{ source.snippet.length }} 字符</span>
          </div>
        </div>
      </div>

      <div class="snippet-content-section">
        <div class="section-title-row">
          <span class="section-title">切片正文内容</span>
          <div class="section-actions">
            <button
              v-if="source.chunkId"
              type="button"
              class="context-toggle-btn"
              :disabled="loadingContext"
              @click="handleToggleContext"
            >
              <LoadingOutlined v-if="loadingContext" spin />
              <span>{{ showContext ? '收起前后文切片' : '展开前后文切片' }}</span>
            </button>
            <button type="button" class="copy-chunk-btn" @click="handleCopySnippet">
              <CopyOutlined />
              <span>复制片段</span>
            </button>
          </div>
        </div>

        <div v-if="showContext && contextData?.prevChunks.length" class="neighbor-chunks-group">
          <div
            v-for="prev in contextData.prevChunks"
            :key="prev.id"
            class="neighbor-card"
          >
            <div class="neighbor-head font-mono">上文 · 切片 #{{ prev.chunkIndex + 1 }}</div>
            <div class="neighbor-text font-mono">{{ prev.content }}</div>
          </div>
        </div>

        <div class="snippet-text-card font-mono">
          <ChunkHighlightText :content="source.snippet" :highlights="source.highlights" />
        </div>

        <div v-if="showContext && contextData?.nextChunks.length" class="neighbor-chunks-group">
          <div
            v-for="next in contextData.nextChunks"
            :key="next.id"
            class="neighbor-card"
          >
            <div class="neighbor-head font-mono">下文 · 切片 #{{ next.chunkIndex + 1 }}</div>
            <div class="neighbor-text font-mono">{{ next.content }}</div>
          </div>
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CloseOutlined,
  FileTextOutlined,
  ThunderboltFilled,
  CopyOutlined,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import type { SearchSource } from '@/interface/chat'
import type { ChunkContextResponse } from '@/interface/knowledge'
import { getKnowledgeChunkContext } from '@/api/knowledge'
import ChunkHighlightText from '@/views/KnowledgeBase/components/ChunkHighlightText.vue'

defineOptions({
  name: 'KnowledgeSourceDrawer',
})

const props = defineProps<{
  open: boolean
  source: SearchSource | null
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
}>()

const visible = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const showContext = ref(false)
const loadingContext = ref(false)
const contextData = ref<ChunkContextResponse | null>(null)

watch(
  () => [props.source?.chunkId, props.open],
  () => {
    showContext.value = false
    contextData.value = null
  },
)

const hitSourceLabel = computed(() => {
  switch (props.source?.hitSource) {
    case 'hybrid':
      return '双路共振'
    case 'dense':
      return '语义召回'
    case 'sparse':
      return '字面匹配'
    default:
      return ''
  }
})

const handleToggleContext = async () => {
  if (!props.source?.chunkId) return
  if (showContext.value) {
    showContext.value = false
    return
  }

  if (contextData.value) {
    showContext.value = true
    return
  }

  loadingContext.value = true
  try {
    const res = await getKnowledgeChunkContext(props.source.chunkId, 1)
    contextData.value = res.data
    showContext.value = true
  } catch (err: any) {
    message.error(err.message || '加载前后文切片失败')
  } finally {
    loadingContext.value = false
  }
}

const handleCopySnippet = async () => {
  if (!props.source?.snippet) return
  try {
    await navigator.clipboard.writeText(props.source.snippet)
    message.success('切片内容已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}
</script>

<style scoped lang="scss">
.source-drawer-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 4px;
}

.drawer-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .source-tag {
      font-size: 11px;
      font-weight: 600;
      color: #2563eb;
      background: #eff6ff;
      padding: 3px 8px;
      border-radius: 4px;
    }

    .chunk-index {
      font-size: 12px;
      color: #64748b;
    }

    .hit-source-pill {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: 4px;

      &.hybrid {
        background: #eef2ff;
        color: #3730a3;
      }
      &.dense {
        background: #eff6ff;
        color: #1d4ed8;
      }
      &.sparse {
        background: #fef3c7;
        color: #92400e;
      }
    }
  }

  .drawer-close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.15s;

    &:hover {
      color: #1e293b;
    }
  }
}

.doc-info-card {
  display: flex;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;

  .doc-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #eff6ff;
    color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .doc-meta-col {
    flex: 1;
    min-width: 0;

    .doc-title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .doc-stats-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;

      .score-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: #0284c7;
        background: #e0f2fe;
        padding: 2px 6px;
        border-radius: 4px;

        .score-icon {
          font-size: 10px;
        }
      }

      .subscore-pill {
        font-size: 11px;
        color: #475569;
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .char-count {
        font-size: 11px;
        color: #64748b;
      }
    }
  }
}

.snippet-content-section {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .section-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }

    .section-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .context-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #334155;
      font-size: 11.5px;
      padding: 2px 8px;
      border-radius: 5px;
      cursor: pointer;

      &:hover:not(:disabled) {
        border-color: #2563eb;
        color: #2563eb;
      }
    }

    .copy-chunk-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: none;
      color: #2563eb;
      font-size: 12px;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .snippet-text-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #2563eb;
    border-radius: 10px;
    padding: 16px;
    font-size: 13px;
    line-height: 1.7;
    color: #1e293b;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 440px;
    overflow-y: auto;
  }

  .neighbor-chunks-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .neighbor-card {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;

      .neighbor-head {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 4px;
      }

      .neighbor-text {
        font-size: 12px;
        line-height: 1.6;
        color: #475569;
        white-space: pre-wrap;
        word-break: break-word;
      }
    }
  }
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
