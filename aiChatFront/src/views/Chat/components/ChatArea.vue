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
          <span>支持图片、PDF、Word (.docx)、Markdown、TXT、CSV、JSON 与代码文件</span>
        </div>
      </div>
    </transition>

    <ChatMessageViewport
      :messages="messages"
      :loading="loading"
      :initial-loading="initialLoading"
      :session-loading="sessionLoading"
      :current-session-id="currentSessionId"
      :has-more-messages="hasMoreMessages"
      :load-more-messages="loadMoreMessages"
      :scroll-signal="scrollSignal"
      @prompt-click="handlePromptClick"
      @retry-message="(messageId) => emit('retry-message', messageId)"
    />

    <div class="input-area-container">
      <!-- 消息排队队列卡片 (Queued Messages) -->
      <QueuedMessageCard
        :queued-messages="currentQueuedMessages"
        :is-generating="props.loading"
        :is-paused="props.isQueuePaused"
        @send-now="(item) => emit('send-queued-now', item)"
        @edit="handleEditQueued"
        @remove="handleRemoveQueued"
        @resume-queue="() => emit('resume-queue')"
      />

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
            ref="messageTextareaRef"
            v-model:value="inputMessage"
            class="message-input prompt-textarea"
            placeholder="发送消息，或拖拽/粘贴图片与文档..."
            :auto-size="{ minRows: 2, maxRows: 6 }"
            @keydown.enter.exact.prevent="handleSend"
            @paste="handlePaste"
          />

          <div class="action-btn-cluster">
            <!-- 流式生成且输入框有文本时：双模并存（停止小方块 + ⚡ 即时干预） -->
            <template v-if="props.loading && inputMessage.trim()">
              <button
                type="button"
                class="submit-btn stop-mini-mode"
                title="停止生成"
                @click="handleStopClick"
              >
                <span class="stop-square-icon" aria-hidden="true"></span>
              </button>
              <button
                type="button"
                class="submit-btn active steer-mode"
                title="即时干预 (Enter)"
                @click="handleSteerClick"
              >
                <svg class="steer-btn-icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M9.5 1.5L3 9h4.5L6.5 14.5 13 7H8.5L9.5 1.5z" />
                </svg>
              </button>
            </template>

            <!-- 仅在流式生成且输入框没有文本时展示主停止按钮 -->
            <button
              v-else-if="props.loading"
              type="button"
              class="submit-btn stop-mode"
              title="停止生成"
              @click="handleStopClick"
            >
              <span class="stop-square-icon" aria-hidden="true"></span>
            </button>

            <!-- 常规非流式状态下的发送按钮 -->
            <button
              v-else
              type="button"
              :class="['submit-btn', { active: canSend }]"
              :disabled="!canSend"
              :title="canSend ? '发送 (Enter)' : '请输入内容'"
              @click="handleButtonClick"
            >
              <ArrowUpOutlined class="btn-icon" />
            </button>
          </div>
        </div>

        <div ref="paramsRowRef" :class="['params-row', { 'is-compact': isToolbarOverflowCompact }]">
          <div ref="paramsLeftRef" class="params-left">
            <ModelSelectorPopover
              :selected-model="selectedModel"
              :model-options="modelOptions"
              :loading="modelsLoading"
              :disabled="loading"
              @update:selected-model="handleModelChange"
            />

            <a-tooltip title="上传文件 (支持图片与文档)" placement="top">
              <div
                class="upload-trigger-btn"
                role="button"
                tabindex="0"
                :class="{ disabled: loading }"
                aria-label="上传文件"
                @click="triggerFileInput"
                @keydown.enter="triggerFileInput"
              >
                <PaperClipOutlined class="upload-icon" />
                <span class="upload-label">上传文件</span>
              </div>
            </a-tooltip>

            <WebSearchToggle
              v-model:enabled="webSearchEnabled"
              :disabled="loading"
            />

            <ToolQuickCapsules :disabled="loading" />

            <KnowledgeBaseCapsule
              :selected-ids="selectedKnowledgeBaseIds"
              :disabled="loading"
              @update:selected-ids="handleKnowledgeBaseUpdate"
            />

            <MemoryVaultTrigger
              :disabled="loading"
              @open="isMemoryVaultOpen = true"
            />

            <AgentOrchestratorCapsule
              v-model:workflow-id="selectedWorkflowId"
              v-model:role-id="selectedRoleId"
              :disabled="loading"
            />

            <span
              v-if="selectedModelReasoningBadgeLabel"
              class="reasoning-badge"
            >
              {{ selectedModelReasoningBadgeLabel }}
            </span>
          </div>

          <div class="params-right">
            <span class="cost-estimate">
              <ThunderboltFilled class="cost-icon" />
              每次消耗 {{ selectedModelReserveCredits }} 积分
            </span>
            <span
              v-if="selectedModelInputPrice > 0 || selectedModelOutputPrice > 0"
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

    <PluginCenterModal />
    <MemoryVaultDrawer v-model:open="isMemoryVaultOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import {
  CloudUploadOutlined,
  PaperClipOutlined,
  ArrowUpOutlined,
  ThunderboltFilled,
} from '@ant-design/icons-vue'
import { IMAGE_UPLOAD_ACCEPT, useFileUpload } from '@/hooks/useFileUpload'
import { useConversationStore } from '@/stores'
import { useArtifactStore } from '../stores/useArtifactStore'
import FilePreview from './FilePreview.vue'
import ChatMessageViewport from './ChatMessageViewport.vue'
import QueuedMessageCard from './QueuedMessageCard.vue'
import ModelSelectorPopover from './ModelSelectorPopover.vue'
import type { QueuedMessage } from '@/interface/conversation'
import WebSearchToggle from './WebSearchToggle.vue'
import ToolQuickCapsules from './ToolQuickCapsules.vue'
import KnowledgeBaseCapsule from './KnowledgeBaseCapsule.vue'
import PluginCenterModal from './PluginCenterModal.vue'
import MemoryVaultTrigger from './MemoryVaultTrigger.vue'
import MemoryVaultDrawer from './MemoryVaultDrawer.vue'
import AgentOrchestratorCapsule from './AgentOrchestratorCapsule.vue'
import type { Message } from '@/interface/conversation'
import type { ServerFileInfo } from '@/interface/upload'

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
    supportsVision?: boolean
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
  initialLoading?: boolean
  sessionLoading?: boolean
  isQueuePaused?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedModelInputPrice: 0,
  selectedModelOutputPrice: 0,
  selectedModelReserveCredits: 10,
  selectedModelReasoningCapability: 'none',
  selectedModelReasoningBadgeLabel: '',
  currentCreditsRemaining: 0,
  hasCreditSnapshot: false,
  initialLoading: false,
  sessionLoading: false,
  isQueuePaused: false,
})

const emit = defineEmits<{
  'update:selected-model': [modelId: string]
  'send-message': [
    content: string,
    options?: {
      fileIds?: string[]
      serverFiles?: ServerFileInfo[]
      webSearch?: boolean
      knowledgeBaseIds?: string[]
      roleId?: string | null
      workflowId?: string | null
    }
  ]
  'stop-generation': []
  'steer-message': [content: string]
  'retry-message': [messageId: string]
  'send-queued-now': [item: QueuedMessage]
  'resume-queue': []
}>()

const inputMessage = ref('')
const webSearchEnabled = ref(false)
const selectedKnowledgeBaseIds = ref<string[]>([])
const selectedRoleId = ref<string | null>(null)
const selectedWorkflowId = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const messageTextareaRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const scrollSignal = ref(0)
const isMemoryVaultOpen = ref(false)
const paramsRowRef = ref<HTMLElement | null>(null)
const paramsLeftRef = ref<HTMLElement | null>(null)
const isToolbarOverflowCompact = ref(false)
let expandedToolbarMinWidth = 0
let toolbarResizeObserver: ResizeObserver | null = null

const conversationStore = useConversationStore()
const artifactStore = useArtifactStore()
const { currentConversation } = storeToRefs(conversationStore)

/**
 * 聚焦聊天输入框并将光标移至末尾
 */
const focusMessageTextarea = () => {
  nextTick(() => {
    const rawEl = messageTextareaRef.value
    const el = rawEl && '$el' in rawEl ? rawEl.$el : (rawEl as HTMLElement | null)
    const textarea = el?.tagName === 'TEXTAREA'
      ? (el as HTMLTextAreaElement)
      : el?.querySelector<HTMLTextAreaElement>('textarea')
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }
  })
}

// 监听跨轮次产物修改请求，预填输入框并自动聚焦
watch(
  () => artifactStore.pendingPrompt,
  (prompt) => {
    if (prompt) {
      inputMessage.value = prompt
      artifactStore.consumePendingPrompt()
      focusMessageTextarea()
    }
  },
)

// 切换对话时，自动恢复当前会话持久化绑定的知识库
watch(
  () => currentConversation.value?.id,
  () => {
    selectedKnowledgeBaseIds.value = currentConversation.value?.knowledgeBaseIds
      ? [...currentConversation.value.knowledgeBaseIds]
      : []
  },
  { immediate: true },
)

const handleKnowledgeBaseUpdate = (ids: string[]) => {
  selectedKnowledgeBaseIds.value = ids
  if (currentConversation.value) {
    conversationStore.updateConversationKnowledgeBases(currentConversation.value.id, ids)
  }
}

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

// 当输入栏实际可用宽度不足导致左侧按钮溢出时，自动收起为图标紧凑模式并留出恢复缓冲避免抖动
const updateToolbarCompactState = () => {
  const rowEl = paramsRowRef.value
  const leftEl = paramsLeftRef.value
  if (!rowEl || !leftEl) return

  if (window.innerWidth <= 1200 || rowEl.clientWidth <= 748) {
    isToolbarOverflowCompact.value = false
    expandedToolbarMinWidth = 0
    return
  }

  if (!isToolbarOverflowCompact.value) {
    const overflowWidth = leftEl.scrollWidth - leftEl.clientWidth
    if (overflowWidth > 1) {
      expandedToolbarMinWidth = rowEl.clientWidth + overflowWidth
      isToolbarOverflowCompact.value = true
    }
    return
  }

  if (rowEl.clientWidth >= expandedToolbarMinWidth + 16) {
    isToolbarOverflowCompact.value = false
    expandedToolbarMinWidth = 0
  }
}

watch(
  () => [
    props.selectedModel,
    props.selectedModelReasoningBadgeLabel,
    props.selectedModelInputPrice,
    props.selectedModelOutputPrice,
    props.hasCreditSnapshot,
    hasEnoughCredits.value,
    selectedKnowledgeBaseIds.value.length,
  ],
  () => {
    expandedToolbarMinWidth = 0
    isToolbarOverflowCompact.value = false
    nextTick(updateToolbarCompactState)
  },
)

onMounted(() => {
  nextTick(updateToolbarCompactState)
  window.addEventListener('resize', updateToolbarCompactState)
  if (typeof ResizeObserver !== 'undefined' && paramsRowRef.value) {
    toolbarResizeObserver = new ResizeObserver(() => {
      updateToolbarCompactState()
    })
    toolbarResizeObserver.observe(paramsRowRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateToolbarCompactState)
  toolbarResizeObserver?.disconnect()
  toolbarResizeObserver = null
})

const canQueue = computed(() => {
  const hasContent = !!inputMessage.value.trim()
  const canSendWithFiles = hasFiles.value && canSendFiles.value
  return (hasContent || canSendWithFiles) && hasEnoughCredits.value
})

const canSend = computed(() => {
  const hasContent = !!inputMessage.value.trim()
  const canSendWithFiles = hasFiles.value && canSendFiles.value
  return (hasContent || canSendWithFiles) && !props.loading && hasEnoughCredits.value
})

const activeConvId = computed(() => props.currentSessionId || conversationStore.currentConversationId || currentConversation.value?.id || '')

const currentQueuedMessages = computed<QueuedMessage[]>(() => {
  if (!activeConvId.value) return []
  return conversationStore.getQueuedMessages(activeConvId.value)
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
  const options: { webSearch?: boolean; knowledgeBaseIds?: string[] } = {}
  if (webSearchEnabled.value) options.webSearch = true
  if (selectedKnowledgeBaseIds.value.length > 0) options.knowledgeBaseIds = selectedKnowledgeBaseIds.value
  if (Object.keys(options).length > 0) {
    emit('send-message', prompt, options)
  } else {
    emit('send-message', prompt)
  }
}

const handleStopClick = () => {
  emit('stop-generation')
}

/**
 * 触发流式生成中的即时干预并清空输入框
 */
const handleSteerClick = () => {
  const content = inputMessage.value.trim()
  if (!content || !props.loading) return
  emit('steer-message', content)
  inputMessage.value = ''
}

const handleButtonClick = () => {
  if (props.loading) {
    if (canQueue.value) {
      handleSend()
    } else {
      emit('stop-generation')
    }
  } else if (canSend.value) {
    handleSend()
  }
}

const handleEditQueued = (item: QueuedMessage) => {
  if (activeConvId.value) {
    conversationStore.removeQueuedMessage(activeConvId.value, item.id)
  }
  inputMessage.value = item.prompt
  if (item.webSearch !== undefined) {
    webSearchEnabled.value = item.webSearch
  }
  if (item.knowledgeBaseIds) {
    selectedKnowledgeBaseIds.value = [...item.knowledgeBaseIds]
  }
  focusMessageTextarea()
}

const handleRemoveQueued = (item: QueuedMessage) => {
  if (activeConvId.value) {
    conversationStore.removeQueuedMessage(activeConvId.value, item.id)
  }
}

const handleSend = () => {
  const content = inputMessage.value.trim()

  if (!content && !canSendFiles.value) {
    return
  }

  if (isProcessing.value) {
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
    serverFiles?: ServerFileInfo[]
    webSearch?: boolean
    knowledgeBaseIds?: string[]
    roleId?: string | null
    workflowId?: string | null
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

  if (webSearchEnabled.value) {
    sendOptions = {
      ...(sendOptions || {}),
      webSearch: true,
    }
  }

  if (selectedKnowledgeBaseIds.value.length > 0) {
    sendOptions = {
      ...(sendOptions || {}),
      knowledgeBaseIds: selectedKnowledgeBaseIds.value,
    }
  }

  if (selectedWorkflowId.value !== null || selectedRoleId.value !== null) {
    sendOptions = {
      ...(sendOptions || {}),
      workflowId: selectedWorkflowId.value,
      roleId: selectedRoleId.value,
    }
  }

  // 若当前正在流式生成响应中，则将该消息推入排队队列
  if (props.loading) {
    const convId = activeConvId.value
    if (convId) {
      conversationStore.enqueueMessage(convId, {
        prompt: content,
        fileIds: sendOptions?.fileIds,
        serverFiles: sendOptions?.serverFiles,
        webSearch: sendOptions?.webSearch,
        knowledgeBaseIds: sendOptions?.knowledgeBaseIds,
        model: props.selectedModel,
      })
      inputMessage.value = ''
      clearFiles()
      scrollSignal.value += 1
      return
    } else {
      message.warning('正在生成中，请稍后')
      return
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
  container-type: inline-size;
  container-name: composer-bar;
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

.action-btn-cluster {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-bottom: 2px;
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

    &.queue-btn {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      box-shadow: 0 2px 10px rgba(14, 165, 233, 0.38);

      &:hover {
        background: #0284c7;
        box-shadow: 0 4px 14px rgba(14, 165, 233, 0.5);
      }
    }
  }

  &.loading {
    background: #1890ff;
    color: #ffffff;
    cursor: wait;
  }

  &.stop-mode {
    background: #18181b;
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: #ef4444;
      box-shadow: 0 2px 12px rgba(239, 68, 68, 0.45);
      transform: scale(1.05);
    }

    .stop-square-icon {
      display: inline-block;
      width: 10px;
      height: 10px;
      background: #ffffff;
      border-radius: 2px;
    }
  }

  &.stop-mini-mode {
    width: 32px;
    height: 32px;
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
    cursor: pointer;
    box-shadow: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &:hover {
      background: #e2e8f0;
      color: #0f172a;
      border-color: #94a3b8;
    }

    .stop-square-icon {
      display: inline-block;
      width: 9px;
      height: 9px;
      background: #475569;
      border-radius: 2px;
    }
  }

  &.steer-mode {
    width: 36px;
    height: 36px;
    background: #0f172a;
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &:hover {
      background: #1e293b;
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }

    .steer-btn-icon {
      width: 15px;
      height: 15px;
    }
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
  flex-wrap: nowrap;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
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
  height: 28px;
  padding: 0 8px;
  border-radius: 8px;
  font-size: 12px;
  color: #475467;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  user-select: none;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
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
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}

:deep(.web-search-toggle),
:deep(.kb-capsule-btn),
:deep(.tool-capsule-trigger),
:deep(.memory-vault-trigger),
:deep(.model-capsule-trigger) {
  white-space: nowrap !important;
  flex-shrink: 0 !important;
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
  white-space: nowrap;
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

// 窄屏及工具栏溢出时的图标紧凑模式（子组件内部类名必须完整放入 :deep() 内以避免附带父组件 scope 属性）
@mixin compact-toolbar-rules {
  .params-left {
    gap: 6px;
  }

  .upload-trigger-btn {
    width: 28px;
    padding: 0;
    justify-content: center;
    gap: 0;

    .upload-label {
      display: none;
    }

    .upload-icon {
      font-size: 14px;
    }
  }

  :deep(.web-search-toggle) {
    min-width: 28px;
    padding: 0 7px;
    justify-content: center;
    gap: 4px;
  }

  :deep(.web-search-toggle .toggle-label) {
    display: none;
  }

  :deep(.web-search-toggle .search-icon) {
    font-size: 14px;
  }

  :deep(.tool-capsule-trigger) {
    min-width: 28px;
    padding: 0 7px;
    justify-content: center;
    gap: 4px;
  }

  :deep(.tool-capsule-trigger .trigger-label),
  :deep(.tool-capsule-trigger .arrow-down) {
    display: none;
  }

  :deep(.tool-capsule-trigger .trigger-icon) {
    font-size: 14px;
  }

  :deep(.kb-capsule-btn) {
    min-width: 28px;
    padding: 0 7px;
    justify-content: center;
    gap: 4px;
  }

  :deep(.kb-capsule-btn .capsule-label) {
    display: none;
  }

  :deep(.kb-capsule-btn .capsule-icon) {
    font-size: 14px;
  }

  :deep(.memory-vault-trigger) {
    width: 28px;
    padding: 0;
    justify-content: center;
    gap: 0;
  }

  :deep(.memory-vault-trigger .vault-label) {
    display: none;
  }

  :deep(.memory-vault-trigger .vault-icon) {
    font-size: 14px;
  }

  :deep(.model-capsule-trigger .capsule-title) {
    max-width: 150px;
  }
}

.control-bar-card .params-row.is-compact {
  @include compact-toolbar-rules;
}

@media (max-width: 1200px) {
  .control-bar-card .params-row {
    @include compact-toolbar-rules;
  }
}

@container composer-bar (max-width: 780px) {
  .control-bar-card .params-row {
    @include compact-toolbar-rules;
  }
}

@container composer-bar (max-width: 560px) {
  .control-bar-card .params-row {
    .rate-hint {
      display: none;
    }

    :deep(.model-capsule-trigger .capsule-title) {
      max-width: 110px;
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
