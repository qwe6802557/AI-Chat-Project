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

    <ChatModelSwitcher
      :selected-model="selectedModel"
      :model-options="modelOptions"
      :models-loading="modelsLoading"
      :selected-model-input-price="selectedModelInputPrice"
      :selected-model-output-price="selectedModelOutputPrice"
      :selected-model-reserve-credits="selectedModelReserveCredits"
      :selected-model-reasoning-capability="selectedModelReasoningCapability"
      :selected-model-reasoning-badge-label="selectedModelReasoningBadgeLabel"
      :current-credits-remaining="currentCreditsRemaining"
      :has-credit-snapshot="hasCreditSnapshot"
      @update:selected-model="handleModelChange"
    />

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
      <div class="input-area">
        <FilePreview
          v-if="uploadedFiles.length > 0"
          :files="uploadedFiles"
          @remove="handleRemoveFile"
        />

        <div class="input-wrapper">
          <a-button
            type="text"
            class="input-icon-btn"
            title="上传图片"
            :disabled="loading"
            @click="triggerFileInput"
          >
            <PictureOutlined />
          </a-button>

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
            placeholder="发送消息，或拖拽/粘贴图片..."
            :auto-size="{ minRows: 1, maxRows: 5 }"
            @keydown.enter.exact.prevent="handleSend"
            @paste="handlePaste"
            class="message-input"
          />
          <a-button type="text" class="input-icon-btn">
            <AudioOutlined />
          </a-button>
          <a-button
            type="primary"
            class="send-btn"
            :disabled="!canSend"
            @click="handleSend"
          >
            <SendOutlined />
          </a-button>
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
  AudioOutlined,
  SendOutlined,
} from '@ant-design/icons-vue'
import { IMAGE_UPLOAD_ACCEPT, useFileUpload } from '@/hooks/useFileUpload'
import FilePreview from './FilePreview.vue'
import ChatModelSwitcher from './ChatModelSwitcher.vue'
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
$color-bg-primary: #FFFFFF;
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
  min-height: 80px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  margin-bottom: 24px;
}

.input-area {
  width: calc(100% - 40px);
  max-width: 760px;
  margin: 0 auto;

  @media (max-width: 768px) {
    width: calc(100% - 32px);
    padding: 0 $spacing-md;
  }

  .input-wrapper {
    background: $color-bg-input;
    backdrop-filter: blur(40px);
    border: 1px solid $color-border-light;
    border-radius: $radius-lg;
    padding: 12px $spacing-md;
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    box-shadow: 0 2px 8px $color-shadow;
    transition: all 0.2s ease;

    &:hover {
      border-color: $color-border;
    }

    &:focus-within {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .input-icon-btn {
      color: $color-text-secondary;
      padding: 6px;
      height: auto;
      min-width: auto;
      border-radius: $radius-sm;
      transition: all 0.2s ease;

      &:hover {
        color: $color-text-primary;
        background: $color-bg-message;
      }

      :deep(.anticon) {
        font-size: $font-size-lg;
      }
    }

    .message-input {
      flex: 1;
      background: transparent;
      border: none;
      color: $color-text-primary;
      font-size: $font-size-base;
      line-height: 1.5;
      resize: none;
      min-height: 24px;

      &::placeholder {
        color: $color-text-placeholder;
      }

      &:focus {
        box-shadow: none;
        outline: none;
      }

      :deep(.ant-input) {
        background: transparent;
        border: none;
        color: $color-text-primary;
        padding: 0;
        font-size: $font-size-base;
        line-height: 1.5;

        &::placeholder {
          color: $color-text-placeholder;
        }

        &:focus {
          box-shadow: none;
          outline: none;
        }
      }
    }

    .send-btn {
      background: $color-text-primary;
      border: none;
      border-radius: $radius-sm;
      padding: $spacing-sm 12px;
      height: auto;
      min-width: auto;
      transition: all 0.2s ease;

      &:hover:not(:disabled) {
        background: $color-text-secondary;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &:disabled {
        background: rgba(0, 0, 0, 0.2);
        opacity: 0.5;
        cursor: not-allowed;
      }

      :deep(.anticon) {
        font-size: $font-size-lg;
        color: $color-bg-primary;
      }
    }
  }
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
