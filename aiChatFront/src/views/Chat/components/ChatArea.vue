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
    <div v-else class="messages-list">
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
          <div class="message-text">{{ message.content }}</div>
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
    </div>

    <!-- 输入 -->
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  UserOutlined,
  RobotOutlined,
  SendOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  PictureOutlined,
  AudioOutlined
} from '@ant-design/icons-vue'

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

const handleSend = () => {
  if (inputMessage.value.trim() && !props.loading) {
    emit('send-message', inputMessage.value.trim())
    inputMessage.value = ''
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
    padding: $spacing-xl $spacing-lg 120px;
    max-width: 800px;
    width: 100%;
    margin: 0 auto;

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
          transition: all 0.2s ease;
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

  .input-area {
    position: absolute;
    bottom: $spacing-xl;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 40px);
    max-width: 760px;

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
}
</style>


