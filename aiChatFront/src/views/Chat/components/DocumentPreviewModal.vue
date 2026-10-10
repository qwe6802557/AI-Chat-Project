<template>
  <a-modal
    :open="open"
    :title="null"
    :footer="null"
    :width="720"
    centered
    destroy-on-close
    class="document-preview-modal"
    @cancel="emit('close')"
  >
    <div v-if="document" class="doc-modal-body">
      <div class="doc-modal-header">
        <div class="doc-badge" :class="badgeClass">
          {{ badgeLabel }}
        </div>
        <div class="doc-header-info">
          <div class="doc-title" :title="document.name">{{ document.name }}</div>
          <div class="doc-meta">
            <span v-if="formattedSize" class="doc-meta-item">{{ formattedSize }}</span>
            <span v-if="formattedChars" class="doc-meta-pill">{{ formattedChars }}</span>
          </div>
        </div>
      </div>

      <div class="doc-content-box">
        <pre v-if="document.extractedText" class="doc-extracted-text">{{ document.extractedText }}</pre>
        <div v-else class="doc-empty-state">
          当前附件暂无可预览的提取文本，可点击下方按钮下载原文件查看。
        </div>
      </div>

      <div class="doc-modal-footer">
        <a-button
          v-if="document.extractedText"
          type="default"
          @click="handleCopyText"
        >
          复制解析文本
        </a-button>
        <a-button
          v-if="document.url"
          type="primary"
          @click="handleDownload"
        >
          下载原文件
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { message } from 'ant-design-vue'
import { formatFileSize, getAttachmentBadgeLabel } from '@/hooks/useFileUpload'

export interface PreviewableDocument {
  name: string
  type?: string
  url?: string
  sizeBytes?: number
  charCount?: number | null
  extractedText?: string | null
}

interface Props {
  open: boolean
  document: PreviewableDocument | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const badgeLabel = computed(() => {
  if (!props.document) return 'DOC'
  return getAttachmentBadgeLabel(props.document.name, props.document.type)
})

const badgeClass = computed(() => {
  const label = badgeLabel.value.toLowerCase()
  if (label === 'pdf') return 'is-pdf'
  if (label === 'docx' || label === 'doc') return 'is-word'
  if (label === 'csv' || label === 'json') return 'is-data'
  return 'is-code'
})

const formattedSize = computed(() => {
  if (!props.document?.sizeBytes || props.document.sizeBytes <= 0) return ''
  return formatFileSize(props.document.sizeBytes)
})

const formattedChars = computed(() => {
  const count = props.document?.charCount
  if (typeof count === 'number' && count > 0) {
    return `已解析 ${count.toLocaleString()} 字`
  }
  if (props.document?.extractedText) {
    return `已解析 ${props.document.extractedText.length.toLocaleString()} 字`
  }
  return ''
})

/**
 * 复制提取文本到剪贴板
 */
const handleCopyText = async () => {
  if (!props.document?.extractedText) return
  try {
    await navigator.clipboard.writeText(props.document.extractedText)
    message.success('已复制解析文本')
  } catch {
    message.error('复制失败，请手动选择复制')
  }
}

/**
 * 打开或下载原始文件
 */
const handleDownload = () => {
  if (!props.document?.url) return
  const link = window.document.createElement('a')
  link.href = props.document.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.download = props.document.name
  window.document.body.appendChild(link)
  link.click()
  window.document.body.removeChild(link)
}
</script>

<style scoped lang="scss">
.doc-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.doc-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 28px;
}

.doc-badge {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  flex-shrink: 0;
  background: #eff6ff;
  color: #2563eb;

  &.is-pdf {
    background: #fef2f2;
    color: #dc2626;
  }

  &.is-word {
    background: #eff6ff;
    color: #1d4ed8;
  }

  &.is-data {
    background: #ecfdf5;
    color: #059669;
  }

  &.is-code {
    background: #f5f3ff;
    color: #6d28d9;
  }
}

.doc-header-info {
  min-width: 0;
  flex: 1;
}

.doc-title {
  font-size: 15px;
  font-weight: 600;
  color: #18181b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: #71717a;
}

.doc-meta-pill {
  padding: 1px 8px;
  border-radius: 999px;
  background: #f4f4f5;
  color: #3f3f46;
  font-weight: 500;
}

.doc-content-box {
  max-height: 56vh;
  overflow-y: auto;
  border-radius: 12px;
  border: 1px solid rgba(24, 24, 27, 0.08);
  background: #fafafa;
  padding: 14px 16px;
}

.doc-extracted-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
  color: #27272a;
}

.doc-empty-state {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: #71717a;
}

.doc-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
