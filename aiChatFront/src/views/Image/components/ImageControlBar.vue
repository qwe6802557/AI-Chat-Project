<template>
  <div class="image-control-bar-container">
    <div class="control-bar-card">
      <div class="input-row">
        <textarea
          ref="textareaRef"
          v-model="promptText"
          class="prompt-textarea"
          placeholder="输入画面描述，例如：A minimal red chair in a bright studio..."
          :rows="2"
          :disabled="props.loading"
          @keydown.enter.prevent="handleKeydown"
        />
        <button
          type="button"
          :class="['submit-btn', { active: canSubmit, loading: props.loading }]"
          :disabled="!canSubmit || props.loading"
          @click="handleSubmit"
        >
          <LoadingOutlined v-if="props.loading" class="btn-icon" />
          <ArrowUpOutlined v-else class="btn-icon" />
        </button>
      </div>

      <div class="params-row">
        <div class="params-left">
          <!-- 模型选择 -->
          <div class="param-capsule model-select-wrapper">
            <ThunderboltOutlined class="param-capsule-icon" />
            <a-select
              v-model:value="selectedModel"
              size="small"
              class="param-select model-select"
              :bordered="false"
              :dropdown-match-select-width="220"
              :disabled="props.loading"
            >
              <a-select-option
                v-for="opt in modelOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </div>

          <!-- 数量选择 -->
          <div class="param-capsule">
            <a-select
              v-model:value="selectedCount"
              size="small"
              class="param-select count-select"
              :bordered="false"
              :dropdown-match-select-width="false"
              :dropdown-style="{ minWidth: '60px' }"
              :disabled="props.loading"
            >
              <a-select-option :value="1">1x</a-select-option>
              <a-select-option :value="2">2x</a-select-option>
              <a-select-option :value="3">3x</a-select-option>
              <a-select-option :value="4">4x</a-select-option>
            </a-select>
          </div>

          <!-- 宽高比选择 -->
          <div class="param-capsule">
            <a-select
              v-model:value="selectedAspectRatio"
              size="small"
              class="param-select ratio-select"
              :bordered="false"
              :dropdown-match-select-width="false"
              :dropdown-style="{ minWidth: '80px' }"
              :disabled="props.loading"
            >
              <a-select-option value="1:1">1:1</a-select-option>
              <a-select-option value="16:9">16:9</a-select-option>
              <a-select-option value="9:16">9:16</a-select-option>
              <a-select-option value="2:3">2:3</a-select-option>
              <a-select-option value="3:2">3:2</a-select-option>
              <a-select-option value="4:3">4:3</a-select-option>
              <a-select-option value="3:4">3:4</a-select-option>
            </a-select>
          </div>

          <!-- 分辨率选择 -->
          <div class="param-capsule">
            <a-select
              v-model:value="selectedResolution"
              size="small"
              class="param-select resolution-select"
              :bordered="false"
              :dropdown-match-select-width="false"
              :dropdown-style="{ minWidth: '64px' }"
              :disabled="props.loading"
            >
              <a-select-option value="1k">1k</a-select-option>
              <a-select-option value="2k">2k</a-select-option>
            </a-select>
          </div>

          <!-- 质量选择 -->
          <div class="param-capsule">
            <a-select
              v-model:value="selectedQuality"
              size="small"
              class="param-select quality-select"
              :bordered="false"
              :dropdown-match-select-width="false"
              :dropdown-style="{ minWidth: '100px' }"
              :disabled="props.loading"
            >
              <a-select-option value="medium">medium</a-select-option>
              <a-select-option value="low">low</a-select-option>
            </a-select>
          </div>
        </div>

        <div class="params-right">
          <span class="cost-estimate">
            <ThunderboltFilled class="cost-icon" />
            消耗 {{ estimatedCost }} 积分
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ArrowUpOutlined,
  LoadingOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
} from '@ant-design/icons-vue'
import type { CreateImageGenerationParams } from '@/interface/image'

defineOptions({
  name: 'ImageControlBar',
})

const props = defineProps<{
  loading?: boolean
  unitCreditCost?: number
}>()

const emit = defineEmits<{
  'submit': [params: CreateImageGenerationParams]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const promptText = ref('')
const selectedModel = ref('grok-imagine-image-2.0')
const selectedCount = ref(1)
const selectedAspectRatio = ref('1:1')
const selectedResolution = ref('1k')
const selectedQuality = ref('medium')

const modelOptions = [
  { label: 'grok-imagine-image-2.0', value: 'grok-imagine-image-2.0' },
]

const canSubmit = computed(() => {
  return promptText.value.trim().length > 0 && !props.loading
})

const estimatedCost = computed(() => {
  const unit = props.unitCreditCost ?? 100
  return unit * selectedCount.value
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.shiftKey) {
    return
  }
  if (canSubmit.value) {
    handleSubmit()
  }
}

const handleSubmit = () => {
  if (!canSubmit.value) return
  const prompt = promptText.value.trim()
  promptText.value = ''
  emit('submit', {
    prompt,
    model: selectedModel.value,
    n: selectedCount.value,
    aspect_ratio: selectedAspectRatio.value,
    resolution: selectedResolution.value,
    quality: selectedQuality.value,
  })
}

/**
 * 允许外部组件回填提示词与参数
 */
const setFormValues = (params: Partial<CreateImageGenerationParams>) => {
  if (params.prompt !== undefined) promptText.value = params.prompt
  if (params.model !== undefined) selectedModel.value = params.model
  if (params.n !== undefined) selectedCount.value = params.n
  if (params.aspect_ratio !== undefined) selectedAspectRatio.value = params.aspect_ratio
  if (params.resolution !== undefined) selectedResolution.value = params.resolution
  if (params.quality !== undefined) selectedQuality.value = params.quality
}

const clearPrompt = () => {
  promptText.value = ''
}

defineExpose({
  setFormValues,
  clearPrompt,
})
</script>

<style scoped lang="scss">
.image-control-bar-container {
  width: 100%;
  max-width: 840px;
  margin: 0 auto;
  padding: 0 16px 20px;
}

.control-bar-card {
  background: #ffffff;
  border: 1px solid #e1e4e8;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.control-bar-card:focus-within {
  border-color: #1890ff;
  box-shadow: 0 8px 28px rgba(24, 144, 255, 0.12);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.prompt-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2329;
  font-family: inherit;
  background: transparent;
}

.prompt-textarea::placeholder {
  color: #8c929a;
}

.submit-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #e4e7ed;
  color: #8c929a;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.submit-btn.active {
  background: #1890ff;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.35);
}

.submit-btn.active:hover {
  background: #40a9ff;
  transform: translateY(-1px);
}

.submit-btn.loading {
  background: #1890ff;
  color: #ffffff;
  cursor: wait;
}

.btn-icon {
  font-size: 16px;
}

.params-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid #f2f3f5;
  gap: 8px;
}

.params-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.param-capsule {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 2px 8px;
  transition: all 0.2s ease;

  &:hover {
    border-color: #cbd5e1;
    background: #f1f5f9;
  }
}

.param-capsule-icon {
  color: #faad14;
  font-size: 13px;
}

.param-select {
  font-size: 12px;
  font-weight: 500;
  color: #334155;

  :deep(.ant-select-selector) {
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    font-size: 12px;
  }
}

.model-select {
  min-width: 170px;
  max-width: 220px;
}

.count-select {
  width: 40px;
}

.ratio-select {
  width: 50px;
}

.resolution-select {
  width: 40px;
}

.quality-select {
  width: 72px;
}

.params-right {
  display: flex;
  align-items: center;
}

.cost-estimate {
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.cost-icon {
  color: #faad14;
  font-size: 13px;
}
</style>
