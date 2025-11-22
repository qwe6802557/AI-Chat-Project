<template>
  <div class="chat-area">
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
          <!-- 用户消息：纯文本显示 -->
          <div v-else class="message-text">{{ message.content }}</div>
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
        <div class="input-wrapper">
          <a-button type="text" class="input-icon-btn">
            <PictureOutlined />
          </a-button>
          <a-textarea
            v-model:value="inputMessage"
            placeholder="发送消息..."
            :auto-size="{ minRows: 1, maxRows: 5 }"
            @keydown.enter.exact.prevent="handleSend"
            class="message-input"
          />
          <a-button type="text" class="input-icon-btn">
            <AudioOutlined />
          </a-button>
          <a-button
            type="primary"
            :disabled="!inputMessage.trim() || loading"
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
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'
import {
  UserOutlined,
  RobotOutlined,
  SendOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  PictureOutlined,
  AudioOutlined,
  DownOutlined
} from '@ant-design/icons-vue'
import { renderMarkdownSimple } from '@/utils/markdown'

defineOptions({
  name: 'ChatAreaComponent',
})

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface Props {
  messages: Message[]
  loading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'send-message': [content: string]
}>()

const inputMessage = ref('')
const messagesListRef = ref<HTMLElement | null>(null)
const isUserScrolling = ref(false) // 用户是否手动滚动
const isProgrammaticScroll = ref(false) // 是否为程序化滚动（非用户手动）
const scrollTimeout = ref<number | null>(null)
const distanceFromBottom = ref(0) // 距离底部的距离
const rafId = ref<number | null>(null) // requestAnimationFrame ID

// 是否显示"回到底部"按钮
const showScrollButton = computed(() => distanceFromBottom.value > 200)

/**
 * 检查是否在底部附近（阈值 100px）
 */
const isNearBottom = (): boolean => {
  if (!messagesListRef.value) return true

  const { scrollTop, scrollHeight, clientHeight } = messagesListRef.value
  const distance = scrollHeight - scrollTop - clientHeight

  // 更新距离状态
  distanceFromBottom.value = distance

  return distance < 100 // 距离底部小于100px视为在底部附近
}

/**
 * 滚动到底部
 * @param smooth 是否平滑滚动
 */
const scrollToBottom = (smooth = true) => {
  if (!messagesListRef.value) return

  // 标记为程序化滚动
  isProgrammaticScroll.value = true

  nextTick(() => {
    if (!messagesListRef.value) return

    if (smooth) {
      // 平滑滚动
      messagesListRef.value.scrollTo({
        top: messagesListRef.value.scrollHeight,
        behavior: 'smooth'
      })
    } else {
      // 立即滚动
      messagesListRef.value.scrollTop = messagesListRef.value.scrollHeight
    }

    // 滚动完成后重置标记
    setTimeout(() => {
      isProgrammaticScroll.value = false
    }, smooth ? 500 : 100) // 平滑滚动需要更长的等待时间
  })
}

/**
 * 监听滚动事件，判断用户是否手动滚动
 */
const handleScroll = () => {
  if (!messagesListRef.value) return

  // 程序化滚动忽略事件
  if (isProgrammaticScroll.value) {
    return
  }

  // 清除之前的定时器
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }

  // 检查是否在底部
  const atBottom = isNearBottom()

  // 不在底部说明在查看历史消息
  isUserScrolling.value = !atBottom

  // 500ms 后重置标记
  scrollTimeout.value = window.setTimeout(() => {
    if (isNearBottom()) {
      isUserScrolling.value = false
    }
  }, 500)
}

/**
 * 监听消息变化自动滚动
 */
watch(
  () => props.messages,
  (newMessages, oldMessages) => {

    // 只有在不是用户手动滚动时才自动滚动
    if (!isUserScrolling.value) {
      // 新增消息时滚动
      if (newMessages.length > (oldMessages?.length || 0)) {
        scrollToBottom(true)
      } else if (newMessages.length === oldMessages?.length && newMessages.length > 0) {
        handleStreamingScroll()
      }
    }
  },
  { deep: true }
)

/**
 * 处理流式输出时的滚动
 */
const handleStreamingScroll = () => {
  // 取消RAF
  if (rafId.value !== null) {
    cancelAnimationFrame(rafId.value)
  }

  // 等待DOM更新完成后再滚动
  nextTick(() => {
    rafId.value = requestAnimationFrame(() => {
      if (!messagesListRef.value) {
        return
      }

      // 标记为程序化滚动
      isProgrammaticScroll.value = true

      // 直接滚动到底部
      messagesListRef.value.scrollTop = messagesListRef.value.scrollHeight

      // 滚动完成后重置标记
      setTimeout(() => {
        isProgrammaticScroll.value = false
      }, 100)
    })
  })
}

/**
 * 监听 loading 状态变化
 */
watch(
  () => props.loading,
  (newLoading) => {
    // loading时滚动到底部
    if (newLoading && !isUserScrolling.value) {
      scrollToBottom(true)
    }
  }
)

/**
 * 发送消息
 */
const handleSend = () => {
  if (inputMessage.value.trim() && !props.loading) {
    emit('send-message', inputMessage.value.trim())
    inputMessage.value = ''

    // 发送消息后立即滚动到底部
    isUserScrolling.value = false
    nextTick(() => {
      scrollToBottom(true)
    })
  }
}

/**
 * 组件挂载后获取 DOM 引用
 */
onMounted(() => {
  // 等待 DOM 渲染完成
  nextTick(() => {
    if (messagesListRef.value) {
      // 添加滚动监听
      messagesListRef.value.addEventListener('scroll', handleScroll)

      // 初始滚动到底部
      setTimeout(() => {
        scrollToBottom(false)
      }, 100)
    }
  })
})

/**
 * 组件卸载前清理
 */
onBeforeUnmount(() => {
  // 移除滚动监听
  if (messagesListRef.value) {
    messagesListRef.value.removeEventListener('scroll', handleScroll)
  }

  // 清理定时器
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }

  // 取消 RAF
  if (rafId.value !== null) {
    cancelAnimationFrame(rafId.value)
    rafId.value = null
  }
})
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

        .message-text {
          color: $color-text-primary;
          font-size: $font-size-base;
          line-height: 1.7;
          word-wrap: break-word;
          white-space: pre-wrap;
          padding: 12px $spacing-md;
          border-radius: $radius-md;
          // 移除过渡效果，避免打字机效果时的闪烁
          // transition: all 0.2s ease;
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


