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
        <!-- 顶部顶层分类分段切页 -->
        <div class="category-segmented-container">
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

        <!-- 1. Gemini 分组面板 -->
        <div v-if="activeCategory === 'gemini'" class="panel-section gemini-section">
          <div class="section-label">选择主力模型</div>
          <div class="gemini-card-grid">
            <!-- Gemini 3.8 Flash -->
            <div
              class="gemini-model-card"
              :class="{ selected: currentGeminiFamily === 'gemini-3.8-flash' }"
              @click="selectGeminiFamily('gemini-3.8-flash')"
            >
              <div class="card-header">
                <span class="model-name">3.8 Flash</span>
                <span class="cost-tag">10 积分</span>
              </div>
              <div class="card-desc">极速全能 · 日常高频首选</div>
              <CheckCircleFilled
                v-if="currentGeminiFamily === 'gemini-3.8-flash'"
                class="card-check-icon"
              />
            </div>

            <!-- Gemini 4 Argon -->
            <div
              class="gemini-model-card"
              :class="{ selected: currentGeminiFamily === 'gemini-4-argon' }"
              @click="selectGeminiFamily('gemini-4-argon')"
            >
              <div class="card-header">
                <span class="model-name">4 Argon</span>
                <span class="cost-tag premium">20 积分</span>
              </div>
              <div class="card-desc">推理旗舰 · 极限复杂逻辑</div>
              <CheckCircleFilled
                v-if="currentGeminiFamily === 'gemini-4-argon'"
                class="card-check-icon"
              />
            </div>
          </div>

          <!-- 思考强度选择器 (Tactile Segmented Control) -->
          <div class="section-label intensity-label">
            <span>思考强度 (Reasoning Effort)</span>
          </div>

          <div class="intensity-segmented-row">
            <button
              type="button"
              class="intensity-btn"
              :class="{ active: currentGeminiIntensity === 'low' }"
              @click="selectGeminiIntensity('low')"
            >
              <span class="btn-text">低 Low</span>
            </button>
            <button
              type="button"
              class="intensity-btn"
              :class="{ active: currentGeminiIntensity === 'medium' }"
              @click="selectGeminiIntensity('medium')"
            >
              <span class="btn-text">中 Med</span>
            </button>
            <button
              type="button"
              class="intensity-btn"
              :class="{ active: currentGeminiIntensity === 'high' }"
              @click="selectGeminiIntensity('high')"
            >
              <span class="btn-text">高 High</span>
            </button>
          </div>

          <!-- 强度动态提示说明 -->
          <div class="intensity-footnote">
            {{ intensityFootnote }}
          </div>
        </div>

        <!-- 2. 其它模型分组面板 -->
        <div v-else class="panel-section other-section">
          <div class="section-label">现有可用模型</div>
          <div class="other-models-list">
            <div
              v-for="model in otherModelOptions"
              :key="model.value"
              class="other-model-item"
              :class="{ selected: selectedModel === model.value }"
              @click="selectOtherModel(model.value)"
            >
              <div class="other-item-info">
                <span class="other-item-name">{{ model.label }}</span>
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
          <span class="footer-target">
            当前生效: <code>{{ selectedModel }}</code>
          </span>
          <span v-if="creditsRemaining !== undefined" class="footer-credits">
            余额: {{ creditsRemaining }} 积分
          </span>
        </div>
      </div>
    </template>
  </a-popover>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ThunderboltOutlined,
  DownOutlined,
  CheckCircleFilled,
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
}

interface Props {
  selectedModel: string
  modelOptions: ModelOptionItem[]
  disabled?: boolean
  loading?: boolean
  creditsRemaining?: number
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  loading: false,
  creditsRemaining: undefined,
})

const emit = defineEmits<{
  'update:selectedModel': [modelId: string]
}>()

const popoverOpen = ref(false)

// 判定当前选中的是否为 Gemini 系列
const isGeminiModel = computed(() => {
  return props.selectedModel.startsWith('gemini-')
})

// 分类切页状态
const activeCategory = ref<'gemini' | 'other'>(isGeminiModel.value ? 'gemini' : 'gemini')

// 解析当前 Gemini 系列家族与思考强度
const currentGeminiFamily = computed(() => {
  if (props.selectedModel.startsWith('gemini-4-argon')) {
    return 'gemini-4-argon'
  }
  return 'gemini-3.8-flash'
})

const currentGeminiIntensity = computed(() => {
  if (props.selectedModel.endsWith('-low')) return 'low'
  if (props.selectedModel.endsWith('-high')) return 'high'
  return 'medium'
})

// 其它模型列表
const otherModelOptions = computed(() => {
  return props.modelOptions.filter((m) => !m.value.startsWith('gemini-'))
})

// 触发按钮上呈现的文本
const currentDisplayLabel = computed(() => {
  if (props.selectedModel.startsWith('gemini-3.8-flash')) {
    const intensityMap = { low: 'Low', medium: 'Med', high: 'High' }
    return `Gemini 3.8 Flash · ${intensityMap[currentGeminiIntensity.value]} 思考`
  }
  if (props.selectedModel.startsWith('gemini-4-argon')) {
    const intensityMap = { low: 'Low', medium: 'Med', high: 'High' }
    return `Gemini 4 Argon · ${intensityMap[currentGeminiIntensity.value]} 思考`
  }
  const matched = props.modelOptions.find((m) => m.value === props.selectedModel)
  return matched?.label || props.selectedModel
})

// 思考强度副文本说明
const intensityFootnote = computed(() => {
  switch (currentGeminiIntensity.value) {
    case 'low':
      return 'Low：轻量快速思考，极速即时首字输出，适合日常高频问答'
    case 'high':
      return 'High：极限深度思维链，适用于复杂算法设计与长逻辑推导'
    case 'medium':
    default:
      return 'Medium：推荐基准，兼顾流式首字响应与高质量深度逻辑推导'
  }
})

// 切换类别
const switchCategory = (category: 'gemini' | 'other') => {
  activeCategory.value = category
  if (category === 'gemini') {
    if (!props.selectedModel.startsWith('gemini-')) {
      emit('update:selectedModel', 'gemini-3.8-flash-medium')
    }
  } else {
    if (props.selectedModel.startsWith('gemini-') && otherModelOptions.value.length > 0 && otherModelOptions.value[0]) {
      emit('update:selectedModel', otherModelOptions.value[0].value)
    }
  }
}

// 选择 Gemini 主力模型
const selectGeminiFamily = (family: 'gemini-3.8-flash' | 'gemini-4-argon') => {
  const targetId = `${family}-${currentGeminiIntensity.value}`
  emit('update:selectedModel', targetId)
}

// 选择思考强度
const selectGeminiIntensity = (intensity: 'low' | 'medium' | 'high') => {
  const targetId = `${currentGeminiFamily.value}-${intensity}`
  emit('update:selectedModel', targetId)
}

// 选择其它模型
const selectOtherModel = (modelId: string) => {
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
  width: 330px;
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

    .section-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;

      &.intensity-label {
        margin-top: 10px;
        margin-bottom: 6px;
      }
    }
  }

  .gemini-card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    .gemini-model-card {
      position: relative;
      padding: 8px 10px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        border-color: #cbd5e1;
        background-color: #f1f5f9;
      }

      &.selected {
        background-color: #f0f7ff;
        border-color: #3b82f6;

        .model-name {
          color: #1d4ed8;
          font-weight: 600;
        }
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 3px;

        .model-name {
          font-size: 13px;
          color: #1e293b;
        }

        .cost-tag {
          font-size: 10px;
          color: #475569;
          background-color: #e2e8f0;
          padding: 1px 5px;
          border-radius: 4px;

          &.premium {
            background-color: #e0e7ff;
            color: #4338ca;
          }
        }
      }

      .card-desc {
        font-size: 10px;
        color: #64748b;
        line-height: 1.3;
      }

      .card-check-icon {
        position: absolute;
        top: 6px;
        right: 6px;
        font-size: 11px;
        color: #3b82f6;
      }
    }
  }

  .intensity-segmented-row {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;

    .intensity-btn {
      flex: 1;
      height: 28px;
      padding: 0 4px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s ease;
      outline: none;

      &:hover {
        border-color: #cbd5e1;
      }

      &.active {
        background-color: #1e293b;
        border-color: #1e293b;
        color: #ffffff;
      }
    }
  }

  .intensity-footnote {
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
    padding: 4px 6px;
    background-color: #f8fafc;
    border-radius: 6px;
    border-left: 2px solid #3b82f6;
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

        .other-item-name {
          font-size: 12px;
          color: #1e293b;
        }

        .other-item-tag {
          font-size: 10px;
          color: #0284c7;
          background-color: #e0f2fe;
          padding: 1px 4px;
          border-radius: 4px;
        }
      }

      .other-item-meta {
        display: flex;
        align-items: center;
        gap: 6px;

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
    justify-content: space-between;
    padding: 7px 12px;
    background-color: #f8fafc;
    border-top: 1px solid #f1f5f9;
    font-size: 11px;
    color: #64748b;

    code {
      font-family: monospace;
      font-size: 10px;
      color: #334155;
      background-color: #e2e8f0;
      padding: 1px 4px;
      border-radius: 3px;
    }
  }
}
</style>
