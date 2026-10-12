<template>
  <div class="video-control-bar-container">
    <div class="control-bar-card">
      <!-- 提示词输入与主要操作 -->
      <div class="input-row">
        <!-- 附带参考图预览胶囊 (如果用户上传或提供了参考图) -->
        <div v-if="referenceImageUrl" class="reference-image-chip">
          <img :src="resolveMediaUrl(referenceImageUrl)" alt="参考图" class="chip-thumb" />
          <span class="chip-label">参考图</span>
          <button
            type="button"
            class="chip-remove-btn"
            title="移除参考图"
            :disabled="props.loading"
            @click="handleRemoveImage"
          >
            <CloseOutlined />
          </button>
        </div>

        <textarea
          ref="textareaRef"
          v-model="promptText"
          class="prompt-textarea"
          placeholder="描述你想要生成的动态视频镜头，例如：A cinematic drone shot through misty pine mountains at sunrise..."
          :rows="2"
          :disabled="props.loading"
          @keydown.enter.exact.prevent="handleKeydown"
        />

        <button
          type="button"
          :class="['submit-btn', { active: canSubmit && !props.loading }]"
          :disabled="!canSubmit || props.loading"
          :title="props.loading ? '视频生成中...' : (canSubmit ? '生成视频 (Enter)' : '请输入视频描述')"
          @click="handleSubmit"
        >
          <LoadingOutlined v-if="props.loading" class="btn-icon" />
          <ArrowUpOutlined v-else class="btn-icon" />
        </button>
      </div>

      <!-- 参数配置胶囊栏 -->
      <div class="params-row">
        <div class="params-left">
          <!-- 模型类型指示胶囊（自动根据是否有参考图切换 T2V / I2V） -->
          <div class="param-capsule model-capsule">
            <VideoCameraOutlined class="param-capsule-icon" />
            <span class="model-name-text">{{ activeModelLabel }}</span>
            <span class="model-badge-tag">{{ referenceImageUrl ? '图生视频' : '文生视频' }}</span>
          </div>

          <!-- 上传参考图按钮 -->
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            style="display: none;"
            @change="handleFileSelected"
          />

          <a-tooltip :title="referenceImageUrl ? '已设置参考图' : '上传参考图 (自动切换为图生视频)'">
            <button
              type="button"
              :class="['param-capsule', 'btn-capsule', { 'has-image': !!referenceImageUrl }]"
              :disabled="props.loading || uploadingImage"
              @click="triggerFileInput"
            >
              <LoadingOutlined v-if="uploadingImage" class="param-capsule-icon" />
              <PictureOutlined v-else class="param-capsule-icon" />
              <span>{{ referenceImageUrl ? '更换参考图' : '添加参考图' }}</span>
            </button>
          </a-tooltip>

          <!-- 宽高比选择胶囊 -->
          <div class="param-capsule">
            <a-select
              v-model:value="selectedAspectRatio"
              size="small"
              class="param-select ratio-select"
              :bordered="false"
              :dropdown-match-select-width="false"
              :dropdown-style="{ minWidth: '90px' }"
              :disabled="props.loading"
            >
              <a-select-option value="16:9">16:9 横屏</a-select-option>
              <a-select-option value="9:16">9:16 竖屏</a-select-option>
              <a-select-option value="1:1">1:1 方形</a-select-option>
            </a-select>
          </div>
        </div>

        <div class="params-right">
          <!-- 积分消耗提示 -->
          <div class="credit-cost-indicator">
            <ThunderboltFilled class="credit-icon" />
            <span class="credit-cost-text">单次 200 积分</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  ArrowUpOutlined,
  LoadingOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  CloseOutlined,
  ThunderboltFilled,
} from '@ant-design/icons-vue'
import type { CreateVideoGenerationParams } from '@/interface/video'
import { uploadFiles } from '@/api/chat'
import { getApiBaseUrl } from '@/utils/common'

const props = defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [params: CreateVideoGenerationParams]
}>()

const promptText = ref('')
const referenceImageUrl = ref('')
const selectedAspectRatio = ref<'16:9' | '9:16' | '1:1'>('16:9')
const uploadingImage = ref(false)

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const canSubmit = computed(() => {
  return promptText.value.trim().length > 0
})

const activeModelLabel = computed(() => {
  return referenceImageUrl.value
    ? 'Wan2.2-I2V-A14B'
    : 'Wan2.2-T2V-A14B'
})

const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  const baseURL = getApiBaseUrl()
  if (!baseURL) {
    return url.startsWith('/') ? url : `/${url}`
  }
  return `${baseURL.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片格式文件')
    target.value = ''
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    message.warning('参考图片大小不能超过 10MB')
    target.value = ''
    return
  }

  uploadingImage.value = true
  try {
    const res = await uploadFiles([file])
    if (res.data && res.data.length > 0) {
      const uploadedUrl = res.data[0].url
      referenceImageUrl.value = uploadedUrl
      message.success('参考图上传成功，已切换至图生视频模式')
    } else {
      message.error('上传图片未返回有效地址')
    }
  } catch (error: any) {
    message.error(error.message || '上传参考图失败')
  } finally {
    uploadingImage.value = false
    target.value = ''
  }
}

const handleRemoveImage = () => {
  referenceImageUrl.value = ''
  message.info('已移除参考图，切换回文生视频模式')
}

const handleKeydown = () => {
  if (canSubmit.value && !props.loading) {
    handleSubmit()
  }
}

const handleSubmit = () => {
  const cleanPrompt = promptText.value.trim()
  if (!cleanPrompt || props.loading) return

  emit('submit', {
    prompt: cleanPrompt,
    image: referenceImageUrl.value || undefined,
    aspect_ratio: selectedAspectRatio.value,
  })
}

const clearPrompt = () => {
  promptText.value = ''
  referenceImageUrl.value = ''
}

const setFormValues = (values: Partial<CreateVideoGenerationParams>) => {
  if (values.prompt !== undefined) {
    promptText.value = values.prompt
  }
  if (values.image !== undefined) {
    referenceImageUrl.value = values.image
  }
  if (values.aspect_ratio && ['16:9', '9:16', '1:1'].includes(values.aspect_ratio)) {
    selectedAspectRatio.value = values.aspect_ratio as '16:9' | '9:16' | '1:1'
  }
}

defineExpose({
  clearPrompt,
  setFormValues,
})
</script>

<style scoped lang="scss">
.video-control-bar-container {
  width: 100%;
  max-width: 896px;
  margin: 0 auto;
  padding: 12px 20px 24px;
  box-sizing: border-box;
}

.control-bar-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  box-shadow:
    0 10px 25px -5px rgba(15, 23, 42, 0.08),
    0 8px 10px -6px rgba(15, 23, 42, 0.03);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus-within {
    border-color: #cbd5e1;
    box-shadow:
      0 12px 28px -5px rgba(99, 102, 241, 0.1),
      0 8px 12px -6px rgba(15, 23, 42, 0.04);
  }
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  position: relative;
}

.reference-image-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 4px 8px 4px 4px;
  align-self: center;
  flex-shrink: 0;

  .chip-thumb {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    object-fit: cover;
  }

  .chip-label {
    font-size: 12px;
    color: #475569;
    font-weight: 500;
  }

  .chip-remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    font-size: 11px;

    &:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
  }
}

.prompt-textarea {
  flex: 1;
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  color: #0f172a;
  padding: 4px 6px;
  font-family: inherit;

  &::placeholder {
    color: #94a3b8;
    font-size: 13.5px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.submit-btn {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: none;
  background: #e2e8f0;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  .btn-icon {
    font-size: 16px;
  }

  &.active {
    background: #6366f1;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);

    &:hover {
      background: #4f46e5;
      transform: scale(1.02);
    }

    &:active {
      transform: scale(0.96);
    }
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.params-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #f1f5f9;
}

.params-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.param-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 3px 8px;
  font-size: 12px;
  color: #475569;
  user-select: none;
  transition: all 0.15s ease;

  &.model-capsule {
    background: #eef2ff;
    border-color: #e0e7ff;
    color: #4338ca;
    font-weight: 500;

    .model-name-text {
      font-family: monospace;
      font-size: 12px;
    }

    .model-badge-tag {
      font-size: 10px;
      padding: 1px 4px;
      background: #c7d2fe;
      color: #312e81;
      border-radius: 4px;
    }
  }

  &.btn-capsule {
    cursor: pointer;
    border: 1px solid #e2e8f0;

    &:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #0f172a;
    }

    &.has-image {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
    }
  }

  .param-capsule-icon {
    font-size: 13px;
  }
}

.param-select {
  :deep(.ant-select-selector) {
    padding: 0 !important;
    font-size: 12px !important;
    color: #475569 !important;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
  }

  :deep(.ant-select-arrow) {
    color: #94a3b8;
    right: 0;
  }
}

.params-right {
  display: flex;
  align-items: center;
}

.credit-cost-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #d97706;
  background: #fef3c7;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 500;

  .credit-icon {
    font-size: 12px;
  }
}
</style>
