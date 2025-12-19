<template>
  <div
    class="chat-area"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- 拖拽遮罩 -->
    <transition name="fade">
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-content">
          <CloudUploadOutlined class="drag-icon" />
          <p>释放以上传文件</p>
          <span>支持图片、PDF、Word 文档</span>
        </div>
      </div>
    </transition>

    <div v-if="messages.length === 0" class="welcome-screen">
      <div class="welcome-content">
        <div class="logo-section">
          <div class="logo-text">AICHAT</div>
        </div>

        <!-- 三列 -->
        <div class="features-grid">
          <div class="feature-column">
            <div class="feature-header">
              <BulbOutlined class="feature-icon" />
              <h3>示例</h3>
            </div>
            <div class="example-card">"用简单的话解释量子计算"</div>
            <div class="example-card">"有没有给10岁孩子生日派对的创意点子？"</div>
            <div class="example-card">"如何在JavaScript中发起HTTP请求？"</div>
          </div>

          <div class="feature-column">
            <div class="feature-header">
              <ThunderboltOutlined class="feature-icon" />
              <h3>能力</h3>
            </div>
            <div class="example-card">记住用户在对话中早些时候说的话</div>
            <div class="example-card">允许用户提供后续更正</div>
            <div class="example-card">接受过拒绝不恰当请求的培训</div>
          </div>

          <div class="feature-column">
            <div class="feature-header">
              <WarningOutlined class="feature-icon" />
              <h3>局限性</h3>
            </div>
            <div class="example-card">偶尔可能会产生不正确的信息</div>
            <div class="example-card">偶尔可能会产生有害的指示或有偏见的内容</div>
            <div class="example-card">对世界和事件的了解有限</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 消息 -->
    <div v-else ref="messagesListRef" class="messages-list">
      <!-- 加载更多指示器 -->
      <div v-if="isLoadingMore" class="loading-more-indicator">
        <LoadingOutlined class="loading-icon" spin />
        <span class="loading-text">加载历史消息...</span>
      </div>

      <div v-for="message in messages" :key="message.id" :class="['message-item', message.role]">
        <div class="message-avatar">
          <a-avatar
            :size="32"
            v-if="message.role === 'user'"
            style="background: #5B5BD6; flex-shrink: 0;"
          >
            <template #icon><UserOutlined /></template>
          </a-avatar>
          <a-avatar
            :size="32"
            v-else
            style="background: #10A37F; flex-shrink: 0;"
          >
            <template #icon><RobotOutlined /></template>
          </a-avatar>
        </div>
        <div class="message-content">
          <!-- AI 消息：渲染 Markdown -->
          <div
            v-if="message.role === 'assistant'"
            class="markdown-content"
            v-html="renderMarkdownSimple(message.content)"
          />
          <!-- 用户消息：支持图片 + 文本 -->
          <div v-else class="user-message-content">
            <!-- 用户发送的图片 -->
            <div v-if="message.attachments?.length" class="message-attachments">
              <div
                v-for="(att, idx) in message.attachments"
                :key="idx"
                :class="['attachment-item', att.type]"
              >
                <img
                  v-if="att.type === 'image'"
                  :src="att.preview"
                  :alt="att.name"
                  class="attachment-image"
                />
                <div v-else class="attachment-file">
                  <FilePdfOutlined v-if="att.type === 'pdf'" class="file-icon pdf" />
                  <FileTextOutlined v-else class="file-icon doc" />
                  <span class="file-name">{{ att.name }}</span>
                </div>
              </div>
            </div>
            <div v-if="message.content" class="message-text">{{ message.content }}</div>
          </div>
        </div>
      </div>

      <!-- 打字动画 -->
      <div v-if="loading" class="message-item assistant">
        <div class="message-avatar">
          <a-avatar
            :size="32"
            style="background: #10A37F; flex-shrink: 0;"
          >
            <template #icon><RobotOutlined /></template>
          </a-avatar>
        </div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <!-- 回到底部按钮 -->
      <transition name="fade">
        <button
          v-show="showScrollButton"
          @click="scrollToBottom(true)"
          class="scroll-to-bottom-btn"
          title="回到底部"
        >
          <DownOutlined />
        </button>
      </transition>
    </div>

    <!-- 输入 -->
    <div class="input-area-container">
      <div class="input-area">
        <!-- 文件预览区域 -->
        <FilePreview
          v-if="uploadedFiles.length > 0"
          :files="uploadedFiles"
          @remove="handleRemoveFile"
        />

        <div class="input-wrapper">
          <!-- 上传按钮 -->
          <a-button
            type="text"
            class="input-icon-btn"
            @click="triggerFileInput"
            :disabled="loading"
            title="上传图片或文件"
          >
            <PictureOutlined />
          </a-button>

          <!-- 隐藏的文件输入 -->
          <input
            ref="fileInputRef"
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            class="hidden-file-input"
            @change="handleFileInputChange"
          />

          <a-textarea
            ref="textareaRef"
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
            :disabled="!canSend"
            @click="handleSend"
            class="send-btn"
          >
            <SendOutlined />
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, toRef } from 'vue'
import {
  UserOutlined,
  RobotOutlined,
  SendOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  PictureOutlined,
  AudioOutlined,
  DownOutlined,
  LoadingOutlined,
  CloudUploadOutlined,
  FilePdfOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue'
import { renderMarkdownSimple } from '@/utils/markdown'
import { useScrollManager } from '@/hooks/useScrollManager'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useMessageListWatcher } from '../hooks/useMessageListWatcher'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import FilePreview from './FilePreview.vue'
import type { Message } from '../hooks/useConversationManager'

defineOptions({
  name: 'ChatAreaComponent',
})

interface Props {
  messages: Message[]
  loading: boolean
  currentSessionId?: string
  hasMoreMessages?: boolean
  /** 加载更多消息的函数 */
  loadMoreMessages?: (sessionId: string, page: number) => Promise<void>
}

const props = defineProps<Props>()

// 默认值
const hasMoreMessagesComputed = computed(() => props.hasMoreMessages ?? true)

const emit = defineEmits<{
  'send-message': [
    content: string,
    options?: {
      fileIds?: string[]
      serverFiles?: { id: string; url: string; name: string; type: string }[]
      files?: { base64: string; type: string; name: string }[]
    }
  ]
}>()

const inputMessage = ref('')
const messagesListRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLElement | null>(null)

// 拖拽状态
const isDragging = ref(false)
let dragCounter = 0

// 文件上传 Hook（添加时自动上传到服务器）
const {
  files: uploadedFiles,
  addFiles,
  removeFile,
  clearFiles,
  getFilesForSend,
  getFileIdsForSend,
  getUploadedFileInfos,
  hasFiles,
  isProcessing,
  canSendFiles
} = useFileUpload()

// 是否可以发送（有内容或有已上传的文件，且不在加载/处理中）
const canSend = computed(() => {
  const hasContent = !!inputMessage.value.trim()
  // 有内容可以发送，或者有已上传完成的文件可以发送
  const canSendWithFiles = hasFiles.value && canSendFiles.value
  const result = (hasContent || canSendWithFiles) && !props.loading

  return result
})

// 分页状态
const currentPage = ref(1)

// 滚动管理 Hook
const scrollManager = useScrollManager(messagesListRef)
const {
  showScrollButton,
  scrollToBottom,
  resetUserScrolling
} = scrollManager

// 消息列表监听Hook
useMessageListWatcher(
  toRef(props, 'messages'),
  toRef(props, 'loading'),
  scrollManager
)

// 向上滚动加载更多消息
const { isLoading: isLoadingMore } = useInfiniteScroll(messagesListRef, {
  threshold: 300, // 阈值
  throttleDelay: 150,
  disabled: toRef(props, 'loading'),
  hasMore: hasMoreMessagesComputed,
  onLoadMore: async () => {
    if (!props.currentSessionId || !props.loadMoreMessages) {
      return
    }

    // 加载下一页
    const nextPage = currentPage.value + 1

    // 等待加载完成
    await props.loadMoreMessages(props.currentSessionId, nextPage)

    // 更新页码
    currentPage.value = nextPage
  }
})

// 监听会话切换-重置分页状态
watch(() => props.currentSessionId, () => {
  currentPage.value = 1
})

/**
 * 发送消息
 */
const handleSend = () => {
  const content = inputMessage.value.trim()

  // 必须有内容或已上传的文件
  if (!content && !canSendFiles.value) {
    return
  }
  if (props.loading || isProcessing.value) {
    return
  }

  // 准备发送选项
  let sendOptions: {
    fileIds?: string[]
    serverFiles?: { id: string; url: string; name: string; type: string }[]
    files?: { base64: string; type: string; name: string }[]
  } | undefined

  // 如果有已上传的文件，获取 fileIds
  if (hasFiles.value) {
    const fileIds = getFileIdsForSend()
    const serverFiles = getUploadedFileInfos()

    if (fileIds.length > 0) {
      // 使用 fileIds 方式（文件已在添加时上传完成）
      sendOptions = {
        fileIds,
        serverFiles
      }
    } else {
      // 没有成功上传的文件，尝试用 base64 方式
      const filesData = getFilesForSend()
      if (filesData.length > 0) {
        sendOptions = { files: filesData }
      }
    }
  }

  // 发送消息
  emit('send-message', content, sendOptions)

  // 清空输入和文件
  inputMessage.value = ''
  clearFiles()

  // 发送消息后立即滚动到底部
  resetUserScrolling()
  nextTick(() => {
    scrollToBottom(true)
  })
}

// ==================== 文件上传相关方法 ====================

/**
 * 触发文件选择
 */
const triggerFileInput = () => {
  fileInputRef.value?.click()
}

/**
 * 文件输入变化
 */
const handleFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    addFiles(target.files)
    // 重置 input，允许重复选择同一文件
    target.value = ''
  }
}

/**
 * 移除文件
 */
const handleRemoveFile = (id: string) => {
  removeFile(id)
}

/**
 * 处理拖拽进入
 */
const handleDragOver = (event: DragEvent) => {
  // 检查是否包含文件
  if (event.dataTransfer?.types.includes('Files')) {
    dragCounter++
    isDragging.value = true
  }
}

/**
 * 处理拖拽离开
 */
const handleDragLeave = () => {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragging.value = false
  }
}

/**
 * 处理文件放置
 */
const handleDrop = (event: DragEvent) => {
  dragCounter = 0
  isDragging.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    addFiles(files)
  }
}

/**
 * 处理粘贴（支持粘贴图片）
 */
const handlePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return

  const files: File[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    // 检查是否是文件类型
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        files.push(file)
      }
    }
  }

  if (files.length > 0) {
    // 阻止默认粘贴行为（避免粘贴文件名）
    event.preventDefault()
    addFiles(files)
  }
}
</script>

<style scoped lang="scss">
// 样式变量
$color-bg-primary: #FFFFFF;
$color-bg-sidebar: #F9F9FA;
$color-bg-message: rgba(0, 0, 0, 0.04);
$color-bg-user-message: #E6F1FD;
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
$spacing-xl: 40px;

$radius-sm: 8px;
$radius-md: 12px;
$radius-lg: 16px;
$radius-xl: 24px;

$font-size-sm: 12px;
$font-size-base: 14px;
$font-size-lg: 16px;
$font-size-xl: 18px;
$font-size-2xl: 32px;

$avatar-size: 32px;
$input-height: 50px;

.chat-area {
  flex: 1;
  background: $color-bg-primary;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;

  // 拖拽遮罩
  .drag-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
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

  // 隐藏的文件输入
  .hidden-file-input {
    display: none;
  }

  .welcome-screen {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 160px 0 0;
    overflow-y: auto;

    .welcome-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 60px;
      max-width: 1000px;
      padding: 0 $spacing-lg;

      .logo-section {
        .logo-text {
          font-size: $font-size-2xl;
          font-weight: 600;
          color: $color-text-primary;
          text-align: center;
          letter-spacing: -0.5px;
        }
      }

      .features-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(240px, 280px));
        gap: $spacing-xl;
        width: 100%;

        @media (max-width: 1024px) {
          grid-template-columns: 1fr;
          max-width: 400px;
        }

        .feature-column {
          display: flex;
          flex-direction: column;
          gap: $spacing-sm;

          .feature-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: $spacing-sm;
            margin-bottom: $spacing-md;

            .feature-icon {
              font-size: 28px;
              color: $color-text-primary;
            }

            h3 {
              font-size: $font-size-xl;
              font-weight: 600;
              color: $color-text-primary;
              margin: 0;
            }
          }

          .example-card {
            background: $color-bg-message;
            padding: 12px $spacing-md;
            border-radius: $radius-sm;
            color: $color-text-primary;
            font-size: $font-size-base;
            line-height: 1.5;
            transition: all 0.2s ease;
            cursor: pointer;

            &:hover {
              background: rgba(0, 0, 0, 0.06);
              transform: translateY(-1px);
            }
          }
        }
      }
    }
  }

  .messages-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 40px 40px 12px 40px;
    //max-width: 800px;
    width: 100%;
    margin: 0 auto;
    scroll-behavior: smooth; // CSS 原生平滑滚动支持

    @media (max-width: 768px) {
      padding: $spacing-lg $spacing-md 120px;
    }

    // 加载更多指示器
    .loading-more-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: $spacing-sm;
      padding: $spacing-md 0;
      margin-bottom: $spacing-md;
      background: linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0));
      position: sticky;
      top: 0;
      z-index: 5;

      .loading-icon {
        font-size: 16px;
        color: $color-text-secondary;
      }

      .loading-text {
        color: $color-text-secondary;
        font-size: $font-size-sm;
      }
    }

    .message-item {
      display: flex;
      gap: $spacing-md;
      margin-bottom: $spacing-lg;
      animation: fadeIn 0.3s ease;

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .message-avatar {
        flex-shrink: 0;
        width: $avatar-size;
        height: $avatar-size;
      }

      .message-content {
        flex: 1;
        min-width: 0;
        max-width: 70%;
        display: flex;
        flex-direction: column;

        .message-text {
          color: $color-text-primary;
          font-size: $font-size-base;
          line-height: 1.7;
          word-wrap: break-word;
          white-space: pre-wrap;
          padding: 12px $spacing-md;
          border-radius: $radius-md;
        }

        // 用户消息内容（支持附件）
        .user-message-content {
          display: flex;
          flex-direction: column;
          gap: $spacing-sm;

          .message-attachments {
            display: flex;
            flex-wrap: wrap;
            gap: $spacing-sm;
            justify-content: flex-end;

            .attachment-item {
              border-radius: $radius-sm;
              overflow: hidden;

              &.image {
                .attachment-image {
                  max-width: 200px;
                  max-height: 200px;
                  object-fit: cover;
                  border-radius: $radius-sm;
                  cursor: pointer;
                  transition: transform 0.2s ease;

                  &:hover {
                    transform: scale(1.02);
                  }
                }
              }

              .attachment-file {
                display: flex;
                align-items: center;
                gap: $spacing-xs;
                padding: $spacing-sm $spacing-md;
                background: rgba(0, 0, 0, 0.04);
                border-radius: $radius-sm;

                .file-icon {
                  font-size: 20px;

                  &.pdf {
                    color: #ff5722;
                  }

                  &.doc {
                    color: #2196f3;
                  }
                }

                .file-name {
                  font-size: $font-size-sm;
                  color: $color-text-secondary;
                  max-width: 150px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
              }
            }
          }
        }

        // Markdown 内容样式
        .markdown-content {
          color: $color-text-primary;
          font-size: $font-size-base;
          line-height: 1.7;
          word-wrap: break-word;
          padding: 12px $spacing-md;
          border-radius: $radius-md;
          background: $color-bg-message;
          width: 100%;

          // 段落
          :deep(p) {
            margin: 8px 0;

            &:first-child {
              margin-top: 0;
            }

            &:last-child {
              margin-bottom: 0;
            }
          }

          // 标题
          :deep(h1),
          :deep(h2),
          :deep(h3),
          :deep(h4),
          :deep(h5),
          :deep(h6) {
            margin: 16px 0 8px 0;
            font-weight: 600;
            line-height: 1.4;
            color: $color-text-primary;

            &:first-child {
              margin-top: 0;
            }
          }

          :deep(h1) {
            font-size: 24px;
          }
          :deep(h2) {
            font-size: 20px;
          }
          :deep(h3) {
            font-size: 18px;
          }
          :deep(h4) {
            font-size: 16px;
          }
          :deep(h5) {
            font-size: 14px;
          }
          :deep(h6) {
            font-size: 13px;
          }

          // 行内代码
          :deep(code:not(pre code)) {
            background: rgba(0, 0, 0, 0.08);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
            font-size: 13px;
            color: #d73a49;
          }

          // 代码块容器
          :deep(.code-block) {
            background: #282c34;
            border-radius: 8px;
            margin: 12px 0;
            overflow: hidden;
            position: relative;

            .code-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: rgba(0, 0, 0, 0.2);
              padding: 6px 12px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);

              .code-language {
                color: #abb2bf;
                font-size: 12px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
              }

              .copy-btn {
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: #abb2bf;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.2s ease;

                &:hover {
                  background: rgba(255, 255, 255, 0.2);
                  color: #fff;
                }
              }
            }

            code {
              display: block;
              padding: 12px;
              overflow-x: auto;
              color: #abb2bf;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
              font-size: 13px;
              line-height: 1.5;
              background: transparent;

              &::-webkit-scrollbar {
                height: 6px;
              }

              &::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.1);
              }

              &::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;

                &:hover {
                  background: rgba(255, 255, 255, 0.3);
                }
              }
            }
          }

          // 列表
          :deep(ul),
          :deep(ol) {
            margin: 12px 0;
            padding-left: 24px;

            li {
              margin: 4px 0;
              line-height: 1.6;

              &::marker {
                color: $color-text-secondary;
              }
            }

            // 嵌套列表
            ul,
            ol {
              margin: 4px 0;
            }
          }

          // 引用块
          :deep(blockquote) {
            border-left: 3px solid #ddd;
            margin: 12px 0;
            padding: 8px 0 8px 12px;
            color: rgba(0, 0, 0, 0.6);
            background: rgba(0, 0, 0, 0.02);
            border-radius: 0 4px 4px 0;

            p {
              margin: 4px 0;
            }
          }

          // 表格容器
          :deep(.table-wrapper) {
            overflow-x: auto;
            margin: 12px 0;

            &::-webkit-scrollbar {
              height: 6px;
            }

            &::-webkit-scrollbar-track {
              background: rgba(0, 0, 0, 0.05);
            }

            &::-webkit-scrollbar-thumb {
              background: rgba(0, 0, 0, 0.2);
              border-radius: 3px;

              &:hover {
                background: rgba(0, 0, 0, 0.3);
              }
            }
          }

          // 表格
          :deep(.markdown-table) {
            width: 100%;
            border-collapse: collapse;
            border-spacing: 0;
            font-size: 14px;

            th,
            td {
              border: 1px solid #ddd;
              padding: 8px 12px;
              text-align: left;
            }

            th {
              background: rgba(0, 0, 0, 0.04);
              font-weight: 600;
              color: $color-text-primary;
            }

            tr:nth-child(even) {
              background: rgba(0, 0, 0, 0.02);
            }
          }

          // 水平线
          :deep(hr) {
            border: none;
            height: 1px;
            background: #ddd;
            margin: 16px 0;
          }

          // 链接
          :deep(a) {
            color: #0969da;
            text-decoration: none;
            transition: all 0.2s ease;

            &:hover {
              text-decoration: underline;
              color: #0550ae;
            }
          }

          // 图片
          :deep(img) {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            margin: 8px 0;
            display: block;
          }

          // 强调
          :deep(strong) {
            font-weight: 600;
            color: $color-text-primary;
          }

          :deep(em) {
            font-style: italic;
          }

          :deep(del) {
            text-decoration: line-through;
            opacity: 0.7;
          }

          // 流式输出时的未完成文本
          :deep(.streaming-text) {
            opacity: 0.7;
          }
        }

        .typing-indicator {
          display: flex;
          gap: 6px;
          padding: $spacing-sm 0;

          span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: $color-text-secondary;
            animation: typing 1.4s infinite ease-in-out;

            &:nth-child(2) {
              animation-delay: 0.2s;
            }

            &:nth-child(3) {
              animation-delay: 0.4s;
            }
          }
        }
      }

      // AI消息
      &.assistant {
        flex-direction: row;
        justify-content: flex-start;

        .message-content {
          justify-content: flex-start;

          .message-text {
            background: $color-bg-message;
          }
        }
      }

      // 用户消息
      &.user {
        flex-direction: row-reverse;
        justify-content: flex-start;

        .message-content {
          justify-content: flex-end;
          max-width: 32rem;

          .message-text {
            background: $color-bg-user-message;
            color: $color-text-primary;
          }
        }
      }
    }
  }

  @keyframes typing {
    0%, 60%, 100% {
      opacity: 0.3;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-10px);
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
      bottom: $spacing-lg;
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

  // 滚动条
  .messages-list::-webkit-scrollbar {
    width: 6px;
  }

  .messages-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-list::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;

    &:hover {
      background: rgba(0, 0, 0, 0.2);
    }
  }

  // 回到底部按钮
  .scroll-to-bottom-btn {
    position: fixed;
    bottom: 140px;
    right: $spacing-xl;
    width: 40px;
    height: 40px;
    background: $color-bg-primary;
    border: 1px solid $color-border;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px $color-shadow;
    transition: all 0.3s ease;
    z-index: 10;

    &:hover {
      background: $color-bg-message;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &:active {
      transform: translateY(0);
    }

    :deep(.anticon) {
      font-size: $font-size-lg;
      color: $color-text-primary;
    }

    @media (max-width: 768px) {
      right: $spacing-lg;
      bottom: 120px;
    }
  }

  // 过渡动画
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
    transform: translateY(10px);
  }
}
</style>


