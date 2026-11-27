<template>
  <a-popover
    v-model:open="popoverOpen"
    trigger="click"
    placement="top"
    :arrow-point-at-center="false"
    overlay-class-name="model-selector-popover-overlay"
    :overlay-inner-style="{ padding: '0', borderRadius: '14px', overflow: 'hidden' }"
  >
    <!-- 外部触发状态胶囊 (去AI味 · 极简微质感) -->
    <div
      class="model-capsule-trigger"
      :class="{ active: popoverOpen, disabled }"
      role="button"
      tabindex="0"
    >
      <ThunderboltOutlined class="capsule-icon" />
      <span class="capsule-title">{{ currentDisplayLabel }}</span>
      <DownOutlined class="capsule-chevron" :class="{ rotate: popoverOpen }" />
    </div>

    <!-- Popover 浮层面板内容 -->
    <template #content>
      <div class="model-popover-panel">
        <!-- 仅当后端存在已启用的 Gemini 模型时展示顶部分类切换 Tab -->
        <div v-if="hasGeminiModels" class="category-segmented-container">
          <div
            class="segmented-pill"
            :class="{ active: activeCategory === 'gemini' }"
            @click="switchCategory('gemini')"
          >
            <span>Gemini 系列</span>
          </div>
          <div
            class="segmented-pill"
            :class="{ active: activeCategory === 'other' }"
            @click="switchCategory('other')"
          >
            <span>其它模型</span>
          </div>
        </div>

        <!-- Gemini 分组面板（动态渲染后端已启用的 Gemini 系列模型） -->
        <div v-if="hasGeminiModels && activeCategory === 'gemini'" class="panel-section gemini-section">
          <div class="section-label">Gemini 可用模型</div>
          <div class="other-models-list">
            <div
              v-for="model in geminiModelOptions"
              :key="model.value"
              class="other-model-item"
              :class="{ selected: selectedModel === model.value }"
              @click="selectModel(model.value)"
            >
              <div class="other-item-info">
                <span class="other-item-name" :title="model.label">{{ model.label }}</span>
                <span v-if="model.supportsVision" class="vision-item-tag">
                  视觉
                </span>
                <span v-if="model.reasoningBadgeLabel" class="other-item-tag">
                  {{ model.reasoningBadgeLabel }}
                </span>
              </div>
              <div class="other-item-meta">
                <span class="other-item-cost">{{ model.reserveCredits ?? 10 }} 积分</span>
                <CheckOutlined v-if="selectedModel === model.value" class="other-check" />
              </div>
            </div>
          </div>
        </div>

        <!-- 其它模型分组面板 -->
        <div v-else class="panel-section other-section" :class="{ 'standalone-section': !hasGeminiModels }">
          <div class="section-label">现有可用模型</div>
          <div class="other-models-list">
            <div
              v-for="model in otherModelOptions"
              :key="model.value"
              class="other-model-item"
              :class="{ selected: selectedModel === model.value }"
              @click="selectModel(model.value)"
            >
              <div class="other-item-info">
                <span class="other-item-name" :title="model.label">{{ model.label }}</span>
                <span v-if="model.supportsVision" class="vision-item-tag">
                  视觉
                </span>
                <span v-if="model.reasoningBadgeLabel" class="other-item-tag">
                  {{ model.reasoningBadgeLabel }}
                </span>
              </div>
              <div class="other-item-meta">
                <span class="other-item-cost">{{ model.reserveCredits ?? 10 }} 积分</span>
                <CheckOutlined v-if="selectedModel === model.value" class="other-check" />
              </div>
            </div>

            <div v-if="otherModelOptions.length === 0" class="empty-hint">
              暂无其它备用模型
            </div>
          </div>
        </div>

        <!-- 底部轻量信息栏 -->
        <div class="popover-footer">
          <div class="footer-target">
            <span class="footer-label">当前生效:</span>
            <a-tooltip :title="selectedModel" placement="top">
              <code class="footer-model-id">{{ selectedModel }}</code>
            </a-tooltip>
          </div>
        </div>
      </div>
    </template>
  </a-popover>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ThunderboltOutlined,
  DownOutlined,
  CheckOutlined,
} from '@ant-design/icons-vue'

export interface ModelOptionItem {
  label: string
  value: string
  inputPrice?: number
  outputPrice?: number
  reserveCredits?: number
  reasoningCapability?: string
  reasoningBadgeLabel?: string
  supportsVision?: boolean
}

interface Props {
  selectedModel: string
  modelOptions: ModelOptionItem[]
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  loading: false,
})

const emit = defineEmits<{
  'update:selectedModel': [modelId: string]
}>()

const popoverOpen = ref(false)

/**
 * 判定模型 ID 是否归属通用 Gemini 系列（预留后续接入任意新 Gemini 模型）
 */
const isGeminiModelId = (modelId: string): boolean => {
  return modelId.toLowerCase().startsWith('gemini-')
}

// 从服务端返回的启用模型列表中动态提取 Gemini 系列模型
const geminiModelOptions = computed(() => {
  return props.modelOptions.filter((m) => isGeminiModelId(m.value))
})

const hasGeminiModels = computed(() => geminiModelOptions.value.length > 0)

// 判定当前选中的是否为 Gemini 系列
const isGeminiModel = computed(() => isGeminiModelId(props.selectedModel))

// 分类切页状态：仅当存在可用 Gemini 模型且当前选中它时默认展示 Gemini Tab
const activeCategory = ref<'gemini' | 'other'>(
  hasGeminiModels.value && isGeminiModel.value ? 'gemini' : 'other',
)

watch([hasGeminiModels, isGeminiModel], ([hasGemini, isGemini]) => {
  activeCategory.value = hasGemini && isGemini ? 'gemini' : 'other'
})

// 其它模型列表
const otherModelOptions = computed(() => {
  return props.modelOptions.filter((m) => !isGeminiModelId(m.value))
})

// 触发按钮上呈现的文本
const currentDisplayLabel = computed(() => {
  const matched = props.modelOptions.find((m) => m.value === props.selectedModel)
  return matched?.label || props.selectedModel
})

/**
 * 切换顶部模型分类 Tab，并自动对齐该分类下首个可用模型
 */
const switchCategory = (category: 'gemini' | 'other') => {
  if (category === 'gemini' && !hasGeminiModels.value) {
    return
  }
  activeCategory.value = category
  if (category === 'gemini') {
    if (!isGeminiModelId(props.selectedModel)) {
      const preferred = geminiModelOptions.value[0]?.value
      if (preferred) {
        emit('update:selectedModel', preferred)
      }
    }
  } else {
    if (isGeminiModelId(props.selectedModel) && otherModelOptions.value.length > 0 && otherModelOptions.value[0]) {
      emit('update:selectedModel', otherModelOptions.value[0].value)
    }
  }
}

/**
 * 选定具体模型并收起浮层
 */
const selectModel = (modelId: string) => {
  emit('update:selectedModel', modelId)
  popoverOpen.value = false
}
</script>

<style scoped lang="scss">
.model-capsule-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  color: #1e293b;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    background-color: #f1f5f9;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  &.active {
    background-color: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .capsule-icon {
    font-size: 11px;
    color: #3b82f6;
  }

  .capsule-title {
    max-width: 220px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .capsule-chevron {
    font-size: 10px;
    color: #64748b;
    transition: transform 0.2s ease;

    &.rotate {
      transform: rotate(180deg);
    }
  }
}

.model-popover-panel {
  width: 372px;
  max-width: calc(100vw - 24px);
  background-color: #ffffff;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  .category-segmented-container {
    display: flex;
    padding: 3px;
    margin: 10px 12px 6px;
    background-color: #f1f5f9;
    border-radius: 8px;
    user-select: none;

    .segmented-pill {
      flex: 1;
      text-align: center;
      padding: 5px 0;
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background-color: #ffffff;
        color: #0f172a;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }
  }

  .panel-section {
    padding: 6px 12px 10px;

    &.standalone-section {
      padding-top: 12px;
    }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  .other-models-list {
    max-height: 190px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .other-model-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: #f1f5f9;
      }

      &.selected {
        background-color: #eff6ff;

        .other-item-name {
          color: #1d4ed8;
          font-weight: 600;
        }
      }

      .other-item-info {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        flex: 1;

        .other-item-name {
          font-size: 12px;
          color: #1e293b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .other-item-tag {
          font-size: 10px;
          color: #0284c7;
          background-color: #e0f2fe;
          padding: 1px 4px;
          border-radius: 4px;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .vision-item-tag {
          font-size: 10px;
          color: #2563eb;
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 0 4px;
          border-radius: 4px;
          flex-shrink: 0;
          white-space: nowrap;
        }
      }

      .other-item-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        white-space: nowrap;

        .other-item-cost {
          font-size: 11px;
          color: #64748b;
        }

        .other-check {
          font-size: 11px;
          color: #3b82f6;
        }
      }
    }

    .empty-hint {
      text-align: center;
      padding: 16px 0;
      font-size: 12px;
      color: #94a3b8;
    }
  }

  .popover-footer {
    display: flex;
    align-items: center;
    padding: 7px 12px;
    background-color: #f8fafc;
    border-top: 1px solid #f1f5f9;
    font-size: 11px;
    color: #64748b;

    .footer-target {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-width: 0;
    }

    .footer-label {
      flex-shrink: 0;
      white-space: nowrap;
    }

    .footer-model-id {
      display: inline-block;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: monospace;
      font-size: 10.5px;
      color: #334155;
      background-color: #e2e8f0;
      padding: 1px 6px;
      border-radius: 4px;
    }
  }
}
</style>
