<template>
  <div v-if="files.length > 0" class="file-preview-container">
    <div class="file-preview-list">
      <div
        v-for="file in files"
        :key="file.id"
        :class="['file-preview-item', file.status, file.type]"
      >
        <!-- 图片预览 -->
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

        <!-- PDF 预览 -->
        <template v-else-if="file.type === 'pdf'">
          <div class="file-icon pdf">
            <FilePdfOutlined />
          </div>
        </template>

        <!-- 文档预览 -->
        <template v-else>
          <div class="file-icon document">
            <FileTextOutlined />
          </div>
        </template>

        <!-- 文件名 -->
        <div v-if="file.type !== 'image'" class="file-name" :title="file.name">
          {{ truncateFileName(file.name) }}
        </div>

        <!-- 处理/上传中遮罩 -->
        <div v-if="file.status === 'processing' || file.status === 'uploading'" class="processing-overlay">
          <LoadingOutlined spin />
        </div>

        <!-- 错误遮罩 -->
        <div v-if="file.status === 'error'" class="error-overlay" :title="file.error">
          <ExclamationCircleOutlined />
        </div>

        <!-- 删除按钮 -->
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

    <!-- 文件统计信息 -->
    <div v-if="showStats && files.length > 0" class="file-stats">
      <span>{{ files.length }} 个文件</span>
      <span class="divider">·</span>
      <span>{{ formatSize(totalSize) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  CloseOutlined,
  LoadingOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import type { UploadedFile } from '@/hooks/useFileUpload'
import { formatFileSize } from '@/hooks/useFileUpload'

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

// 计算总大小
const totalSize = computed(() =>
  props.files.reduce((sum, f) => sum + f.size, 0)
)

// 格式化大小
const formatSize = (bytes: number): string => {
  return formatFileSize(bytes)
}

// 截断文件名
const truncateFileName = (name: string, maxLength: number = 12): string => {
  if (name.length <= maxLength) return name

  const ext = name.lastIndexOf('.')
  if (ext === -1) {
    return name.slice(0, maxLength - 3) + '...'
  }

  const extension = name.slice(ext)
  const baseName = name.slice(0, ext)
  const availableLength = maxLength - extension.length - 3

  if (availableLength <= 0) {
    return name.slice(0, maxLength - 3) + '...'
  }

  return baseName.slice(0, availableLength) + '...' + extension
}

// 移除文件
const handleRemove = (id: string) => {
  emit('remove', id)
}
</script>

<style scoped lang="scss">
$color-bg-primary: #FFFFFF;
$color-bg-hover: rgba(0, 0, 0, 0.04);
$color-border: rgba(0, 0, 0, 0.1);
$color-border-light: rgba(0, 0, 0, 0.06);
$color-text-primary: #000000;
$color-text-secondary: rgba(0, 0, 0, 0.6);
$color-error: #ff4d4f;
$color-pdf: #ff5722;
$color-doc: #2196f3;

$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 12px;

$radius-sm: 8px;
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
  width: 72px;
  height: 72px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $color-bg-primary;
  border: 1px solid $color-border-light;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: $color-border;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .remove-btn {
      opacity: 1;
    }
  }

  // 图片类型
  &.image {
    // a-image 组件容器
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

  // PDF和文档类型
  &.pdf,
  &.document {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: $spacing-xs;

    .file-icon {
      font-size: 28px;
      margin-bottom: $spacing-xs;

      &.pdf {
        color: $color-pdf;
      }

      &.document {
        color: $color-doc;
      }
    }

    .file-name {
      font-size: 10px;
      color: $color-text-secondary;
      text-align: center;
      line-height: 1.2;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 2px;
    }
  }

  // 处理中状态
  &.processing {
    .processing-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      color: $color-text-secondary;
      font-size: 20px;
    }
  }

  // 错误状态
  &.error {
    border-color: $color-error;

    .error-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 77, 79, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: $color-error;
      font-size: 20px;
    }
  }
}

.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
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
