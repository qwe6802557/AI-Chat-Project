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
            <span class="char-count font-mono">{{ source.snippet.length }} 字符</span>
          </div>
        </div>
      </div>

      <div class="snippet-content-section">
        <div class="section-title-row">
          <span class="section-title">切片正文内容</span>
          <button type="button" class="copy-chunk-btn" @click="handleCopySnippet">
            <CopyOutlined />
            <span>复制片段</span>
          </button>
        </div>
        <div class="snippet-text-card font-mono">
          {{ source.snippet }}
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  CloseOutlined,
  FileTextOutlined,
  ThunderboltFilled,
  CopyOutlined,
} from '@ant-design/icons-vue'
import type { SearchSource } from '@/interface/chat'

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
      gap: 12px;

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
    border-radius: 10px;
    padding: 16px;
    font-size: 13px;
    line-height: 1.7;
    color: #1e293b;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 480px;
    overflow-y: auto;
  }
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
