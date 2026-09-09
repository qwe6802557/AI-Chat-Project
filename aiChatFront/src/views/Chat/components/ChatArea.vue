<template>
  <div
    class="chat-area"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <transition name="fade">
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-content">
          <CloudUploadOutlined class="drag-icon" />
          <p>释放以上传文件</p>
          <span>支持 JPG、PNG、GIF、WebP、BMP 图片</span>
        </div>
      </div>
    </transition>

    <ChatMessageViewport
      :messages="messages"
      :loading="loading"
      :current-session-id="currentSessionId"
      :has-more-messages="hasMoreMessages"
      :load-more-messages="loadMoreMessages"
      :scroll-signal="scrollSignal"
      @prompt-click="handlePromptClick"
    />

    <div class="input-area-container">
      <div class="control-bar-card">
        <FilePreview
          v-if="uploadedFiles.length > 0"
          :files="uploadedFiles"
          @remove="handleRemoveFile"
        />

        <div class="input-row">
          <input
            ref="fileInputRef"
            type="file"
            multiple
            :accept="IMAGE_UPLOAD_ACCEPT"
            class="hidden-file-input"
            @change="handleFileInputChange"
          />

          <a-textarea
            v-model:value="inputMessage"
            class="message-input prompt-textarea"
            placeholder="发送消息，或拖拽/粘贴图片..."
            :auto-size="{ minRows: 2, maxRows: 6 }"
            :disabled="loading"
            @keydown.enter.exact.prevent="handleSend"
            @paste="handlePaste"
          />

          <button
            type="button"
            :class="['submit-btn', { active: canSend, loading: loading }]"
            :disabled="!canSend || loading"
            :title="canSend ? '发送 (Enter)' : '请输入内容'"
            @click="handleSend"
          >
            <LoadingOutlined v-if="loading" class="btn-icon" />
            <ArrowUpOutlined v-else class="btn-icon" />
          </button>
        </div>

        <div class="params-row">
          <div class="params-left">
            <div class="model-select-wrapper">
              <ThunderboltOutlined class="model-select-icon" />
              <a-select
                :value="selectedModel"
                :options="modelOptions"
                :loading="modelsLoading"
                size="small"
                class="param-select model-select"
                :bordered="false"
                :dropdown-match-select-width="260"
                @change="handleModelChange"
              />
            </div>

            <div
              class="upload-trigger-btn"
              role="button"
              tabindex="0"
              :class="{ disabled: loading }"
              title="上传图片"
              @click="triggerFileInput"
              @keydown.enter="triggerFileInput"
            >
              <PictureOutlined class="upload-icon" />
              <span>上传图片</span>
            </div>

            <span v-if="selectedModelReasoningBadgeLabel" class="reasoning-badge">
              {{ selectedModelReasoningBadgeLabel }}
            </span>
          </div>

          <div class="params-right">
            <span class="cost-estimate">
              <ThunderboltFilled class="cost-icon" />
              预留 {{ selectedModelReserveCredits }} 积分上限
            </span>
            <span
              v-if="selectedModelInputPrice || selectedModelOutputPrice"
              class="rate-hint"
            >
              ({{ formatRate(selectedModelInputPrice) }}/{{ formatRate(selectedModelOutputPrice) }} tok)
            </span>
            <span
              v-if="hasCreditSnapshot && !hasEnoughCredits"
              class="credit-warning"
            >
              当前余额不足
            </span>
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
  CloudUploadOutlined,
  PictureOutlined,
  ArrowUpOutlined,
  LoadingOutlined,
  ThunderboltOutlined,
  ThunderboltFilled,
} from '@ant-design/icons-vue'
import { IMAGE_UPLOAD_ACCEPT, useFileUpload } from '@/hooks/useFileUpload'
import FilePreview from './FilePreview.vue'
import ChatMessageViewport from './ChatMessageViewport.vue'
import type { Message } from '@/interface/conversation'

defineOptions({
  name: 'ChatAreaComponent',
})

interface Props {
  messages: Message[]
  loading: boolean
  selectedModel: string
  modelOptions: Array<{
    label: string
    value: string
    inputPrice?: number
    outputPrice?: number
    reserveCredits?: number
    reasoningCapability?: 'none' | 'summary' | 'raw'
    reasoningBadgeLabel?: string
  }>
  modelsLoading?: boolean
  currentSessionId?: string
  hasMoreMessages?: boolean
  loadMoreMessages?: (sessionId: string, page: number) => Promise<void>
  selectedModelInputPrice?: number
  selectedModelOutputPrice?: number
  selectedModelReserveCredits?: number
  selectedModelReasoningCapability?: 'none' | 'summary' | 'raw'
  selectedModelReasoningBadgeLabel?: string
  currentCreditsRemaining?: number
  hasCreditSnapshot?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedModelInputPrice: 0,
  selectedModelOutputPrice: 0,
  selectedModelReserveCredits: 0,
  selectedModelReasoningCapability: 'none',
  selectedModelReasoningBadgeLabel: '',
  currentCreditsRemaining: 0,
  hasCreditSnapshot: false,
})

const emit = defineEmits<{
  'update:selected-model': [modelId: string]
  'send-message': [
    content: string,
    options?: {
      fileIds?: string[]
      serverFiles?: { id: string; url: string; name: string; type: string }[]
    }
  ]
}>()

const inputMessage = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const scrollSignal = ref(0)

const isDragging = ref(false)
let dragCounter = 0

const {
  files: uploadedFiles,
  addFiles,
  removeFile,
  clearFiles,
  getFileIdsForSend,
  getUploadedFileInfos,
  hasFiles,
  isProcessing,
  canSendFiles,
} = useFileUpload()

const hasEnoughCredits = computed(() => {
  if (!props.hasCreditSnapshot) {
    return true
  }

  return props.currentCreditsRemaining >= props.selectedModelReserveCredits
})

const canSend = computed(() => {
  const hasContent = !!inputMessage.value.trim()
  const canSendWithFiles = hasFiles.value && canSendFiles.value
  return (hasContent || canSendWithFiles) && !props.loading && hasEnoughCredits.value
})

const formatRate = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0'
  }
  const normalized = value.toFixed(2)
  return normalized.replace(/\.?0+$/, '')
}

const handleModelChange = (value: string) => {
  emit('update:selected-model', value)
}

const handlePromptClick = (prompt: string) => {
  emit('send-message', prompt)
}

const handleSend = () => {
  const content = inputMessage.value.trim()

  if (!content && !canSendFiles.value) {
    return
  }

  if (props.loading || isProcessing.value) {
    return
  }

  if (!hasEnoughCredits.value) {
    message.warning(
      `当前模型发送前至少需预留 ${props.selectedModelReserveCredits} 积分，最终按实际 token 结算，剩余 ${props.currentCreditsRemaining} 积分`,
    )
    return
  }

  let sendOptions: {
    fileIds?: string[]
    serverFiles?: { id: string; url: string; name: string; type: string }[]
  } | undefined

  if (hasFiles.value) {
    const fileIds = getFileIdsForSend()
    const serverFiles = getUploadedFileInfos()

    if (fileIds.length > 0) {
      sendOptions = {
        fileIds,
        serverFiles,
      }
    }
  }

  emit('send-message', content, sendOptions)

  inputMessage.value = ''
  clearFiles()
  scrollSignal.value += 1
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    addFiles(target.files)
    target.value = ''
  }
}

const handleRemoveFile = (id: string) => {
  removeFile(id)
}

const handleDragOver = (event: DragEvent) => {
  if (event.dataTransfer?.types.includes('Files')) {
    dragCounter++
    isDragging.value = true
  }
}

const handleDragLeave = () => {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragging.value = false
  }
}

const handleDrop = (event: DragEvent) => {
  dragCounter = 0
  isDragging.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    addFiles(files)
  }
}

const handlePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return

  const files: File[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        files.push(file)
      }
    }
  }

  if (files.length > 0) {
    event.preventDefault()
    addFiles(files)
  }
}
</script>

<style scoped lang="scss">
$color-bg-primary: #f8fafc;
$color-bg-message: rgba(0, 0, 0, 0.04);
$color-bg-input: rgba(255, 255, 255, 0.8);
$color-text-primary: #000000;
$color-text-secondary: rgba(0, 0, 0, 0.6);
$color-text-placeholder: rgba(0, 0, 0, 0.4);
$color-border: rgba(0, 0, 0, 0.1);
$color-border-light: rgba(0, 0, 0, 0.04);
$color-shadow: rgba(0, 0, 0, 0.1);

$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;

$radius-sm: 8px;
$radius-md: 12px;
$radius-lg: 16px;

$font-size-sm: 12px;
$font-size-base: 14px;
$font-size-lg: 16px;

.chat-area {
  flex: 1;
  background: $color-bg-primary;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;

  .drag-overlay {
    position: absolute;
    inset: 0;
    background: rgba(91, 91, 214, 0.1);
    border: 2px dashed #5B5BD6;
    border-radius: $radius-md;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);

    .drag-content {
      text-align: center;
      color: #5B5BD6;

      .drag-icon {
        font-size: 48px;
        margin-bottom: $spacing-md;
      }

      p {
        font-size: $font-size-lg;
        font-weight: 600;
        margin: 0 0 $spacing-xs;
      }

      span {
        font-size: $font-size-sm;
        opacity: 0.8;
      }
    }
  }

  .hidden-file-input {
    display: none;
  }
}

.input-area-container {
  width: 100%;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(
    180deg,
    rgba(248, 250, 252, 0) 0%,
    rgba(248, 250, 252, 0.9) 30%,
    #f8fafc 100%
  );
  padding: 0 16px 20px;
  pointer-events: none;
  z-index: 10;
}

.control-bar-card {
  pointer-events: auto;
  width: 100%;
  max-width: 840px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #e1e4e8;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus-within {
    border-color: #1890ff;
    box-shadow: 0 8px 28px rgba(24, 144, 255, 0.12);
  }
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
  padding: 0;

  &::placeholder {
    color: #8c929a;
  }

  &:focus {
    box-shadow: none;
    outline: none;
  }

  :deep(.ant-input) {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 0;
    font-size: 14px;
    line-height: 1.5;
    color: #1f2329;
    resize: none;

    &::placeholder {
      color: #8c929a;
    }

    &:focus {
      box-shadow: none;
      outline: none;
    }
  }
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
  margin-bottom: 2px;

  &.active {
    background: #1890ff;
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.35);

    &:hover {
      background: #40a9ff;
      transform: translateY(-1px);
    }
  }

  &.loading {
    background: #1890ff;
    color: #ffffff;
    cursor: wait;
  }

  .btn-icon {
    font-size: 16px;
  }
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

.model-select-wrapper {
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

  .model-select-icon {
    color: #faad14;
    font-size: 13px;
  }

  .model-select {
    font-size: 12px;
    font-weight: 500;
    min-width: 120px;
    max-width: 200px;

    :deep(.ant-select-selector) {
      padding: 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      font-size: 12px;
    }
  }
}

.upload-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: #475467;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;

  &:hover:not(.disabled) {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .upload-icon {
    font-size: 13px;
  }
}

.reasoning-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #dbeafe;
  font-weight: 500;
}

.params-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
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

.rate-hint {
  font-size: 11px;
  color: #94a3b8;
}

.credit-warning {
  font-size: 11px;
  color: #ef4444;
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
