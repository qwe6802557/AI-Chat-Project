<template>
  <div class="chat-skeleton-container" aria-hidden="true">
    <div class="skeleton-content-wrapper">
      <!-- 模拟用户消息气泡 (靠右) -->
      <div class="skeleton-item user">
        <div class="skeleton-avatar" />
        <div class="skeleton-bubble user-bubble" />
      </div>

      <!-- 模拟助手回复气泡 (靠左，多行) -->
      <div class="skeleton-item assistant">
        <div class="skeleton-avatar" />
        <div class="skeleton-card">
          <div class="skeleton-line line-header" />
          <div class="skeleton-line line-full" />
          <div class="skeleton-line line-long" />
          <div class="skeleton-line line-medium" />
          <div class="skeleton-meta-chips">
            <div class="skeleton-chip" />
            <div class="skeleton-chip" />
            <div class="skeleton-chip" />
          </div>
        </div>
      </div>

      <!-- 模拟第二轮用户提问 -->
      <div class="skeleton-item user">
        <div class="skeleton-avatar" />
        <div class="skeleton-bubble user-bubble short" />
      </div>

      <!-- 模拟第二轮助手简短回复 -->
      <div class="skeleton-item assistant">
        <div class="skeleton-avatar" />
        <div class="skeleton-card compact">
          <div class="skeleton-line line-full" />
          <div class="skeleton-line line-medium" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'ChatSkeletonLoader',
})
</script>

<style scoped lang="scss">
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.chat-skeleton-container {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  user-select: none;
}

.skeleton-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 840px;
  margin: 0 auto;
}

// 统一扫光占位色块
.skeleton-avatar,
.skeleton-bubble,
.skeleton-line,
.skeleton-chip {
  background: linear-gradient(
    90deg,
    rgba(241, 245, 249, 0.9) 25%,
    rgba(226, 232, 240, 0.95) 37%,
    rgba(241, 245, 249, 0.9) 63%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.skeleton-item {
  display: flex;
  gap: 12px;
  width: 100%;

  .skeleton-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &.user {
    flex-direction: row-reverse;

    .skeleton-bubble {
      height: 42px;
      width: 220px;
      max-width: 70%;
      border-radius: 14px;
      border: 1px solid rgba(15, 23, 42, 0.05);

      &.short {
        width: 160px;
      }
    }
  }

  &.assistant {
    flex-direction: row;

    .skeleton-card {
      flex: 1;
      max-width: 70%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 20px;
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid rgba(15, 23, 42, 0.06);
      box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.03);

      &.compact {
        padding: 14px 18px;
        max-width: 55%;
      }
    }

    .skeleton-line {
      height: 14px;
      border-radius: 4px;

      &.line-header {
        width: 38%;
        height: 16px;
        margin-bottom: 4px;
      }

      &.line-full {
        width: 100%;
      }

      &.line-long {
        width: 88%;
      }

      &.line-medium {
        width: 62%;
      }
    }

    .skeleton-meta-chips {
      display: flex;
      gap: 8px;
      margin-top: 6px;

      .skeleton-chip {
        width: 64px;
        height: 20px;
        border-radius: 6px;
      }
    }
  }
}
</style>
