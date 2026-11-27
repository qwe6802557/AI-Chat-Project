<template>
  <div v-if="imageUrl" :class="['chunk-visual-preview', `variant-${variant}`]">
    <div class="visual-thumb-wrap">
      <a-image
        :src="imageUrl"
        :alt="caption || '知识库视觉切片原图'"
        :preview="{ mask: '放大查看原图' }"
        class="visual-thumb-image"
      />
    </div>

    <div class="visual-meta-bar">
      <div class="visual-badges-left">
        <span class="visual-type-badge">
          <PictureOutlined />
          <span>{{ visualTypeLabel }}</span>
        </span>
        <span v-if="typeof pageNumber === 'number' && pageNumber > 0" class="visual-page-badge font-mono">
          P.{{ pageNumber }}
        </span>
      </div>
      <span v-if="visualInjected" class="visual-injected-badge" title="对话时已将该原图直连传给视觉大模型">
        原图已直连视觉模型
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PictureOutlined } from '@ant-design/icons-vue'

defineOptions({
  name: 'ChunkVisualPreview',
})

const props = withDefaults(
  defineProps<{
    imageUrl?: string
    visualType?: string
    pageNumber?: number
    visualInjected?: boolean
    variant?: 'compact' | 'full'
    caption?: string
  }>(),
  {
    imageUrl: '',
    visualType: '',
    pageNumber: undefined,
    visualInjected: false,
    variant: 'full',
    caption: '',
  },
)

const VISUAL_TYPE_LABELS: Record<string, string> = {
  chart: '数据图表',
  table: '结构表格',
  diagram: '架构图示',
  screenshot: '界面截图',
  document_page: '文档页面',
  photo: '实拍图片',
}

const visualTypeLabel = computed(() => {
  if (!props.visualType) return '视觉原图'
  return VISUAL_TYPE_LABELS[props.visualType] || '视觉原图'
})
</script>

<style scoped lang="scss">
.chunk-visual-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  overflow: hidden;

  &.variant-compact {
    gap: 6px;
    padding: 6px;

    .visual-thumb-wrap :deep(.ant-image) {
      max-height: 112px;
    }

    .visual-thumb-wrap :deep(.ant-image-img) {
      max-height: 112px;
      object-fit: cover;
    }
  }

  &.variant-full {
    .visual-thumb-wrap :deep(.ant-image) {
      max-height: 240px;
    }

    .visual-thumb-wrap :deep(.ant-image-img) {
      max-height: 240px;
      object-fit: contain;
    }
  }
}

.visual-thumb-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  overflow: hidden;

  :deep(.ant-image) {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  :deep(.ant-image-img) {
    width: 100%;
    display: block;
    border-radius: 6px;
  }
}

.visual-meta-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}

.visual-badges-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.visual-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.visual-page-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.visual-injected-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}
</style>
