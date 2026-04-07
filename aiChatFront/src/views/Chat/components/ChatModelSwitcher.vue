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
          :show-search="false"
          :bordered="false"
          :dropdown-match-select-width="280"
          class="model-floating-select"
          @change="handleModelChange"
        />
        <div class="model-floating-meta">
          <span class="model-floating-cost">
            输入 {{ formatRate(selectedModelInputPrice) }} / 输出 {{ formatRate(selectedModelOutputPrice) }} / 1k tok
          </span>
          <span class="model-floating-reserve">
            预留 {{ selectedModelReserveCredits }} 积分上限
          </span>
          <span
            v-if="reasoningHint"
            class="model-floating-reasoning"
          >
            {{ reasoningHint }}
          </span>
          <span
            v-if="hasCreditSnapshot && !hasEnoughCredits"
            class="model-floating-warning"
          >
            当前余额不足
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ThunderboltOutlined } from '@ant-design/icons-vue'

defineOptions({
  name: 'ChatModelSwitcher',
})

interface Props {
  selectedModel: string
  modelOptions: Array<{ label: string; value: string }>
  modelsLoading?: boolean
  selectedModelInputPrice: number
  selectedModelOutputPrice: number
  selectedModelReserveCredits: number
  selectedModelReasoningCapability?: 'none' | 'summary' | 'raw'
  selectedModelReasoningBadgeLabel?: string
  currentCreditsRemaining?: number
  hasCreditSnapshot?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedModelReasoningCapability: 'none',
  selectedModelReasoningBadgeLabel: '',
  currentCreditsRemaining: 0,
  hasCreditSnapshot: false,
})

const emit = defineEmits<{
  'update:selected-model': [modelId: string]
}>()

const hasEnoughCredits = computed(() => {
  return props.currentCreditsRemaining >= props.selectedModelReserveCredits
})

const reasoningHint = computed(() => {
  return props.selectedModelReasoningBadgeLabel || ''
})

const handleModelChange = (value: string) => {
  emit('update:selected-model', value)
}

const formatRate = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const normalized = value.toFixed(2)
  return normalized.replace(/\.?0+$/, '')
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
  user-select: none;

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
  gap: 2px;
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
    cursor: pointer !important;
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
    cursor: pointer;
  }

  :deep(.ant-select-selection-search),
  :deep(.ant-select-selection-search-input) {
    cursor: pointer !important;
    caret-color: transparent;
  }

  :deep(.ant-select-arrow) {
    color: $color-text-secondary;
    font-size: 12px;
  }
}

.model-floating-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 16px;
  padding-left: 2px;
  color: $color-text-secondary;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
}

.model-floating-cost {
  color: $color-text-secondary;
}

.model-floating-reserve {
  color: rgba(0, 0, 0, 0.45);
}

.model-floating-reasoning {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.08);
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 600;
}

.model-floating-warning {
  color: #d97706;
  font-weight: 600;
}
</style>
