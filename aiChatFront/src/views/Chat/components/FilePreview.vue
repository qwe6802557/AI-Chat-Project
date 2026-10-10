<template>
  <div v-if="files.length > 0" class="file-preview-container">
    <div class="file-preview-list">
      <div
        v-for="file in files"
        :key="file.id"
        :class="['file-preview-item', file.status, file.type]"
        @click="handleItemClick(file)"
      >
        <template v-if="file.type === 'image'">
          <a-image
            v-if="file.preview"
            :src="file.preview"
            :alt="file.name"
            class="preview-image"
            :preview="{
              src: file.serverUrl || file.preview
            }"
          >
            <template #previewMask>
              <span>预览</span>
            </template>
          </a-image>
          <div v-else class="preview-placeholder">
            <LoadingOutlined v-if="file.status === 'processing'" spin />
            <FileImageOutlined v-else />
          </div>
        </template>

        <template v-else>
          <div class="doc-card-badge" :class="getBadgeClass(file)">
            {{ getBadgeLabel(file) }}
          </div>
          <div class="doc-card-body">
            <div class="file-name" :title="file.name">
              {{ file.name }}
            </div>
            <div class="file-meta">
              <span>{{ formatSize(file.size) }}</span>
              <template v-if="file.status === 'uploaded' && formatCharCount(file)">
                <span class="meta-dot">·</span>
                <span class="parsed-tag">{{ formatCharCount(file) }}</span>
              </template>
              <template v-else-if="file.status === 'uploading' || file.status === 'processing'">
                <span class="meta-dot">·</span>
                <span>解析中...</span>
              </template>
            </div>
          </div>
        </template>

        <div v-if="file.status === 'processing' || file.status === 'uploading'" class="processing-overlay">
          <LoadingOutlined spin />
        </div>

        <div v-if="file.status === 'error'" class="error-overlay" :title="file.error">
          <ExclamationCircleOutlined />
        </div>

        <button
          v-if="!readonly"
          class="remove-btn"
          @click.stop="handleRemove(file.id)"
          title="移除"
        >
          <CloseOutlined />
        </button>
      </div>
    </div>

    <div v-if="showStats && files.length > 0" class="file-stats">
      <span>{{ files.length }} 个文件</span>
      <span class="divider">·</span>
      <span>{{ formatSize(totalSize) }}</span>
    </div>

    <DocumentPreviewModal
      :open="Boolean(activePreviewDoc)"
      :document="activePreviewDoc"
      @close="activePreviewDoc = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CloseOutlined,
  LoadingOutlined,
  FileImageOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import type { UploadedFile } from '@/interface/upload'
import { formatFileSize, getAttachmentBadgeLabel } from '@/hooks/useFileUpload'
import DocumentPreviewModal, { type PreviewableDocument } from './DocumentPreviewModal.vue'

interface Props {
  files: UploadedFile[]
  readonly?: boolean
  showStats?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  showStats: false
})

const emit = defineEmits<{
  'remove': [id: string]
}>()

const activePreviewDoc = ref<PreviewableDocument | null>(null)

const totalSize = computed(() =>
  props.files.reduce((sum, f) => sum + f.size, 0)
)

const formatSize = (bytes: number): string => {
  return formatFileSize(bytes)
}

const getBadgeLabel = (file: UploadedFile): string => {
  return getAttachmentBadgeLabel(file.name, file.type)
}

const getBadgeClass = (file: UploadedFile): string => {
  const label = getBadgeLabel(file).toLowerCase()
  if (label === 'pdf') return 'is-pdf'
  if (label === 'docx' || label === 'doc') return 'is-word'
  if (label === 'csv' || label === 'json') return 'is-data'
  return 'is-code'
}

const formatCharCount = (file: UploadedFile): string => {
  if (typeof file.charCount === 'number' && file.charCount > 0) {
    return `已解析 ${file.charCount.toLocaleString()} 字`
  }
  if (file.extractedText) {
    return `已解析 ${file.extractedText.length.toLocaleString()} 字`
  }
  return ''
}

const handleItemClick = (file: UploadedFile) => {
  if (file.type === 'image' || file.status !== 'uploaded') return
  activePreviewDoc.value = {
    name: file.name,
    type: file.type,
    url: file.serverUrl,
    sizeBytes: file.size,
    charCount: file.charCount,
    extractedText: file.extractedText,
  }
}

const handleRemove = (id: string) => {
  emit('remove', id)
}
</script>

<style scoped lang="scss">
$color-bg-primary: #FFFFFF;
$color-bg-hover: rgba(0, 0, 0, 0.04);
$color-border: rgba(0, 0, 0, 0.12);
$color-border-light: rgba(0, 0, 0, 0.07);
$color-text-primary: #18181b;
$color-text-secondary: #71717a;
$color-error: #ff4d4f;

$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 12px;

$radius-sm: 10px;
$radius-md: 12px;

.file-preview-container {
  padding: $spacing-sm $spacing-md;
  background: rgba(0, 0, 0, 0.02);
  border-radius: $radius-md $radius-md 0 0;
  border-bottom: 1px solid $color-border-light;
}

.file-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.file-preview-item {
  position: relative;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $color-bg-primary;
  border: 1px solid $color-border-light;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: $color-border;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

    .remove-btn {
      opacity: 1;
    }
  }

  &.image {
    width: 72px;
    height: 72px;

    :deep(.ant-image) {
      width: 100%;
      height: 100%;
      display: block;

      .ant-image-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .preview-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .preview-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: $color-bg-hover;
      color: $color-text-secondary;
      font-size: 24px;
    }
  }

  &.pdf,
  &.document {
    min-width: 196px;
    max-width: 268px;
    height: 58px;
    padding: 8px 28px 8px 10px;
    display: flex;
    align-items: center;
    gap: 10px;

    .doc-card-badge {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.03em;
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

    .doc-card-body {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
    }

    .file-name {
      font-size: 13px;
      font-weight: 500;
      color: $color-text-primary;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: $color-text-secondary;
      white-space: nowrap;

      .parsed-tag {
        color: #2563eb;
        font-weight: 500;
      }
    }
  }

  &.processing,
  &.uploading {
    .processing-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.78);
      display: flex;
      align-items: center;
      justify-content: center;
      color: $color-text-secondary;
      font-size: 18px;
    }
  }

  &.error {
    border-color: $color-error;

    .error-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255, 77, 79, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: $color-error;
      font-size: 18px;
    }
  }
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
  font-size: 10px;
  padding: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: scale(1.1);
  }
}

.file-stats {
  margin-top: $spacing-sm;
  font-size: 12px;
  color: $color-text-secondary;
  display: flex;
  align-items: center;
  gap: $spacing-xs;

  .divider {
    opacity: 0.5;
  }
}
</style>
