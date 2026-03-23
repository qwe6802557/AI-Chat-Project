<template>
  <div class="model-floating-switcher">
    <div class="model-floating-chip">
      <div class="model-floating-icon">
        <ThunderboltOutlined />
      </div>
      <div class="model-floating-copy">
        <a-select
          :value="selectedModel"
          :options="modelOptions"
          :loading="modelsLoading"
          size="middle"
          show-search
          option-filter-prop="label"
          :bordered="false"
          :dropdown-match-select-width="280"
          class="model-floating-select"
          @change="handleModelChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ThunderboltOutlined } from '@ant-design/icons-vue'

defineOptions({
  name: 'ChatModelSwitcher',
})

interface Props {
  selectedModel: string
  modelOptions: Array<{ label: string; value: string }>
  modelsLoading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'update:selected-model': [modelId: string]
}>()

const handleModelChange = (value: string) => {
  emit('update:selected-model', value)
}
</script>

<style scoped lang="scss">
$color-text-primary: #000000;
$color-text-secondary: rgba(0, 0, 0, 0.6);

.model-floating-switcher {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 15;
  pointer-events: none;
  padding: 10px;
  background: #ffffff;

  @media (max-width: 768px) {
    padding: 12px 16px;
  }

  .model-floating-chip {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 46px;
    padding: 6px 0 6px 8px;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(40px);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 16px;
    pointer-events: auto;

    @media (max-width: 768px) {
      width: 100%;
    }
  }

  .model-floating-icon {
    width: 30px;
    height: 30px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #111111 0%, #2f2f2f 100%);
    color: #ffffff;
    flex-shrink: 0;

    :deep(.anticon) {
      font-size: 14px;
    }
  }

  .model-floating-copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;

    @media (max-width: 768px) {
      width: 100%;
    }
  }

  .model-floating-select {
    min-width: 208px;
    max-width: 248px;
    font-weight: 600;

    @media (max-width: 768px) {
      min-width: 0;
      max-width: none;
      width: 100%;
    }

    :deep(.ant-select-selector) {
      min-height: 24px !important;
      padding: 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      display: flex !important;
      align-items: center !important;
    }

    &:deep(.ant-select-focused .ant-select-selector) {
      box-shadow: none !important;
    }

    :deep(.ant-select-selection-item),
    :deep(.ant-select-selection-search-input) {
      color: $color-text-primary;
      font-size: 13px;
      font-weight: 500;
      line-height: 24px;
    }

    :deep(.ant-select-selection-item) {
      display: flex;
      align-items: center;
      min-height: 24px;
    }

    :deep(.ant-select-arrow) {
      color: $color-text-secondary;
      font-size: 12px;
    }
  }
}
</style>
