<template>
  <div class="chat-message-viewport">
    <div v-if="messages.length === 0" class="welcome-screen">
      <div class="welcome-content">
        <div class="logo-section">
          <div class="logo-text">AICHAT</div>
        </div>

        <div class="features-grid">
          <div
            v-for="column in featureColumns"
            :key="column.title"
            class="feature-column"
          >
            <div class="feature-header">
              <component :is="column.icon" class="feature-icon" />
              <h3>{{ column.title }}</h3>
            </div>
            <button
              v-for="item in column.items"
              :key="item.value"
              type="button"
              class="example-card"
              :disabled="loading"
              @click="handlePromptClick(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else ref="messagesListRef" class="messages-list">
      <div v-if="isLoadingMore" class="loading-more-indicator">
        <LoadingOutlined class="loading-icon" spin />
        <span class="loading-text">加载历史消息...</span>
      </div>

      <div v-for="message in messages" :key="message.id" :class="['message-item', message.role]">
        <div class="message-avatar">
          <a-avatar
            v-if="message.role === 'user'"
            :size="32"
            style="background: #5B5BD6; flex-shrink: 0;"
          >
            <template #icon><UserOutlined /></template>
          </a-avatar>
          <a-avatar
            v-else
            :size="32"
            style="background: #10A37F; flex-shrink: 0;"
          >
            <template #icon><RobotOutlined /></template>
          </a-avatar>
        </div>
        <div class="message-content">
          <ChatReasoningPanel
            v-if="message.role === 'assistant' && message.reasoning && message.reasoning.mode !== 'omitted'"
            :message-id="message.id"
            :reasoning="message.reasoning"
          />
          <MarkdownMessage
            v-if="message.role === 'assistant'"
            class="markdown-content"
            :message-id="message.id"
            :content="message.content"
            :streaming="message.streaming"
          />
          <div
            v-if="message.role === 'assistant' && !message.streaming && (message.model || message.usage)"
            class="assistant-meta"
          >
            <span v-if="message.model" class="meta-chip">{{ message.model }}</span>
            <span v-if="message.usage" class="meta-chip">
              输入 {{ message.usage.promptTokens }} tok
            </span>
            <span v-if="message.usage" class="meta-chip">
              输出 {{ message.usage.completionTokens }} tok
            </span>
            <span v-if="message.usage" class="meta-chip">
              总计 {{ message.usage.totalTokens }} tok
            </span>
            <span v-else-if="message.model" class="meta-chip">
              Token 待统计
            </span>
            <span
              v-if="message.usage?.estimatedTotalCost !== undefined"
              class="meta-chip cost"
            >
              估算 {{ formatCost(message.usage.estimatedTotalCost) }}
            </span>
          </div>
          <div v-if="message.role === 'user'" class="user-message-content">
            <div v-if="message.attachments?.length" class="message-attachments">
              <a-image-preview-group>
                <template v-for="(att, idx) in message.attachments" :key="idx">
                  <div :class="['attachment-item', att.type]">
                    <a-image
                      v-if="att.type === 'image'"
                      :src="att.preview || att.url"
                      :alt="att.name"
                      class="attachment-image"
                      :preview="{ src: att.url || att.preview }"
                    >
                      <template #previewMask>
                        <span>预览</span>
                      </template>
                    </a-image>
                    <div v-else class="attachment-file">
                      <FilePdfOutlined v-if="att.type === 'pdf'" class="file-icon pdf" />
                      <FileTextOutlined v-else class="file-icon doc" />
                      <span class="file-name">{{ att.name }}</span>
                    </div>
                  </div>
                </template>
              </a-image-preview-group>
            </div>
            <div v-if="message.content" class="message-text">{{ message.content }}</div>
          </div>
        </div>
      </div>

      <div v-if="loading && !hasStreamingAssistantMessage" class="message-item assistant">
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

      <transition name="fade">
        <button
          v-show="showScrollButton"
          class="scroll-to-bottom-btn"
          title="回到底部"
          @click="scrollToBottom(true)"
        >
          <DownOutlined />
        </button>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import {
  BulbOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  UserOutlined,
  RobotOutlined,
  DownOutlined,
  LoadingOutlined,
  FilePdfOutlined,
  FileTextOutlined,
} from '@ant-design/icons-vue'
import { useScrollManager } from '@/hooks/useScrollManager'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useMessageListWatcher } from '../hooks/useMessageListWatcher'
import MarkdownMessage from './MarkdownMessage.vue'
import ChatReasoningPanel from './ChatReasoningPanel.vue'
import type { Message } from '@/interface/conversation'

defineOptions({
  name: 'ChatMessageViewport',
})

interface Props {
  messages: Message[]
  loading: boolean
  currentSessionId?: string
  hasMoreMessages?: boolean
  loadMoreMessages?: (sessionId: string, page: number) => Promise<void>
  scrollSignal?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'prompt-click': [prompt: string]
}>()

interface FeatureItem {
  label: string
  value: string
}

interface FeatureColumn {
  title: string
  icon: typeof BulbOutlined
  items: FeatureItem[]
}

const featureColumns: FeatureColumn[] = [
  {
    title: '示例',
    icon: BulbOutlined,
    items: [
      {
        label: '"用简单的话解释量子计算"',
        value: '用简单的话解释量子计算',
      },
      {
        label: '"有没有给10岁孩子生日派对的创意点子？"',
        value: '有没有给10岁孩子生日派对的创意点子？',
      },
      {
        label: '"如何在JavaScript中发起HTTP请求？"',
        value: '如何在JavaScript中发起HTTP请求？',
      },
    ],
  },
  {
    title: '能力',
    icon: ThunderboltOutlined,
    items: [
      {
        label: '记住用户在对话中早些时候说的话',
        value: '记住用户在对话中早些时候说的话',
      },
      {
        label: '允许用户提供后续更正',
        value: '允许用户提供后续更正',
      },
      {
        label: '接受过拒绝不恰当请求的培训',
        value: '接受过拒绝不恰当请求的培训',
      },
    ],
  },
  {
    title: '局限性',
    icon: WarningOutlined,
    items: [
      {
        label: '偶尔可能会产生不正确的信息',
        value: '偶尔可能会产生不正确的信息',
      },
      {
        label: '偶尔可能会产生有害的指示或有偏见的内容',
        value: '偶尔可能会产生有害的指示或有偏见的内容',
      },
      {
        label: '对世界和事件的了解有限',
        value: '对世界和事件的了解有限',
      },
    ],
  },
]

const formatCost = (value: number): string => {
  return value.toFixed(value >= 1 ? 4 : 6)
}

const handlePromptClick = (prompt: string) => {
  if (props.loading) {
    return
  }

  emit('prompt-click', prompt)
}

const hasMoreMessagesComputed = computed(() => props.hasMoreMessages ?? true)
const hasStreamingAssistantMessage = computed(() =>
  props.messages.some((message) => message.role === 'assistant' && !!message.streaming)
)

const messagesListRef = ref<HTMLElement | null>(null)
const currentPage = ref(1)

const scrollManager = useScrollManager(messagesListRef)
const {
  resetUserScrolling,
  showScrollButton,
  scrollToBottom,
} = scrollManager

useMessageListWatcher(
  toRef(props, 'messages'),
  toRef(props, 'loading'),
  scrollManager
)

const { isLoading: isLoadingMore } = useInfiniteScroll(messagesListRef, {
  threshold: 300,
  throttleDelay: 150,
  disabled: toRef(props, 'loading'),
  hasMore: hasMoreMessagesComputed,
  onLoadMore: async () => {
    if (!props.currentSessionId || !props.loadMoreMessages) {
      return
    }

    const nextPage = currentPage.value + 1
    await props.loadMoreMessages(props.currentSessionId, nextPage)
    currentPage.value = nextPage
  }
})

watch(() => props.currentSessionId, () => {
  currentPage.value = 1
})

watch(() => props.scrollSignal, (nextSignal, previousSignal) => {
  if (nextSignal === undefined || nextSignal === previousSignal) {
    return
  }
  resetUserScrolling()
  scrollToBottom(true)
})
</script>

<style scoped lang="scss">
$color-bg-primary: #FFFFFF;
$color-bg-message: rgba(0, 0, 0, 0.04);
$color-bg-user-message: #E6F1FD;
$color-text-primary: #000000;
$color-text-secondary: rgba(0, 0, 0, 0.6);
$color-border: rgba(0, 0, 0, 0.1);
$color-shadow: rgba(0, 0, 0, 0.1);

$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 40px;

$radius-sm: 8px;
$radius-md: 12px;

$font-size-sm: 12px;
$font-size-base: 14px;
$font-size-xl: 18px;
$font-size-2xl: 32px;

$avatar-size: 32px;

.chat-message-viewport {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
          border: none;
          color: $color-text-primary;
          font-size: $font-size-base;
          line-height: 1.5;
          transition: all 0.2s ease;
          cursor: pointer;
          text-align: left;
          width: 100%;

          &:hover {
            background: rgba(0, 0, 0, 0.06);
            transform: translateY(-1px);
          }

          &:disabled {
            cursor: not-allowed;
            opacity: 0.7;
            transform: none;
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
  width: 100%;
  margin: 0 auto;
  padding: 85px 40px 12px;
  scroll-behavior: smooth;

  @media (max-width: 768px) {
    padding: 84px $spacing-md 120px;
  }

  .loading-more-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-sm;
    padding: $spacing-md 0;
    margin-bottom: $spacing-md;
    background: linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0));
    position: sticky;
    top: 64px;
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

      .markdown-content {
        width: 100%;
        color: $color-text-primary;
        font-size: $font-size-base;
        line-height: 1.7;
        word-wrap: break-word;
        padding: 12px $spacing-md;
        border-radius: $radius-md;
        background: $color-bg-message;

        :deep(p) {
          margin: 8px 0;

          &:first-child {
            margin-top: 0;
          }

          &:last-child {
            margin-bottom: 0;
          }
        }

        :deep(h1),
        :deep(h2),
        :deep(h3),
        :deep(h4),
        :deep(h5),
        :deep(h6) {
          margin: 16px 0 8px;
          font-weight: 600;
          line-height: 1.4;
          color: $color-text-primary;

          &:first-child {
            margin-top: 0;
          }
        }

        :deep(h1) { font-size: 24px; }
        :deep(h2) { font-size: 20px; }
        :deep(h3) { font-size: 18px; }
        :deep(h4) { font-size: 16px; }
        :deep(h5) { font-size: 14px; }
        :deep(h6) { font-size: 13px; }

        :deep(code:not(pre code)) {
          background: rgba(0, 0, 0, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
          font-size: 13px;
          color: #d73a49;
        }

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

          ul,
          ol {
            margin: 4px 0;
          }
        }

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

        :deep(hr) {
          border: none;
          height: 1px;
          background: #ddd;
          margin: 16px 0;
        }

        :deep(a) {
          color: #0969da;
          text-decoration: none;
          transition: all 0.2s ease;

          &:hover {
            text-decoration: underline;
            color: #0550ae;
          }
        }

        :deep(img) {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 8px 0;
          display: block;
        }

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

        :deep(.streaming-text) {
          opacity: 0.7;
        }
      }

      .assistant-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;

        .meta-chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.05);
          color: $color-text-secondary;
          font-size: 12px;
          line-height: 1.4;

          &.cost {
            color: #0b7a5c;
            background: rgba(16, 163, 127, 0.12);
          }
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

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;

    &:hover {
      background: rgba(0, 0, 0, 0.2);
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
    font-size: 16px;
    color: $color-text-primary;
  }

  @media (max-width: 768px) {
    right: $spacing-lg;
    bottom: 120px;
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
