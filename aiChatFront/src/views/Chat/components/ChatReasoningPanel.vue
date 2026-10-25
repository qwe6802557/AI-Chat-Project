<template>
  <div
    v-if="reasoning.content || isStreaming"
    :class="['reasoning-panel', { expanded, streaming: isStreaming }]"
  >
    <button
      type="button"
      class="reasoning-toggle"
      @click="handleToggle"
    >
      <div class="reasoning-copy">
        <div class="reasoning-heading">
          <span class="reasoning-badge" :class="{ 'is-thinking': isStreaming }">
            <BulbOutlined />
          </span>
          <span class="reasoning-label">{{ isStreaming ? '深度思考中...' : '已深度思考' }}</span>
        </div>
        <span
          v-if="previewText"
          class="reasoning-preview"
        >
          {{ previewText }}
        </span>
      </div>
      <component :is="expanded ? DownOutlined : RightOutlined" class="reasoning-icon" />
    </button>

    <div v-if="expanded" class="reasoning-body">
      <div v-if="!reasoning.content && isStreaming" class="reasoning-empty-loading">
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
        <span class="thinking-text">思考中，正在分析问题与构建推论...</span>
      </div>
      <MarkdownMessage
        v-else
        :message-id="`${messageId}-reasoning`"
        :content="reasoning.content"
        :streaming="isStreaming"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BulbOutlined, DownOutlined, RightOutlined } from '@ant-design/icons-vue'
import type { MessageReasoning } from '@/interface/conversation'
import MarkdownMessage from './MarkdownMessage.vue'

defineOptions({
  name: 'ChatReasoningPanel',
})

const props = defineProps<{
  messageId: string
  reasoning: MessageReasoning
}>()

const isStreaming = computed(() => props.reasoning.status === 'streaming')
const userToggled = ref(false)
const expanded = ref(props.reasoning.status === 'streaming')

watch(isStreaming, (streaming, prevStreaming) => {
  if (streaming && !userToggled.value) {
    expanded.value = true
  } else if (!streaming && prevStreaming && !userToggled.value) {
    expanded.value = false
  }
})

const handleToggle = () => {
  userToggled.value = true
  expanded.value = !expanded.value
}

const previewText = computed(() => {
  const compactText = (props.reasoning.content || '').replace(/\s+/g, ' ').trim()
  if (!compactText) {
    return isStreaming.value ? '正在梳理推导思路...' : ''
  }

  return compactText.length > 72 ? `${compactText.slice(0, 72)}...` : compactText
})
</script>

<style scoped lang="scss">
.reasoning-panel {
  margin-bottom: 10px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(15, 23, 42, 0.06);
  overflow: hidden;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

  &.expanded {
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
  }

  &.streaming {
    border-color: rgba(21, 112, 239, 0.18);
    background: rgba(239, 246, 255, 0.78);
  }
}

.reasoning-toggle {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.reasoning-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reasoning-heading {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.reasoning-badge {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.06);
  color: #344054;
  flex-shrink: 0;
  transition: all 0.25s ease;

  :deep(.anticon) {
    font-size: 11px;
  }

  &.is-thinking {
    background: rgba(37, 99, 235, 0.12);
    color: #2563eb;
    animation: thinking-glow 2s ease-in-out infinite;
  }
}

@keyframes thinking-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.2);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
  }
}

.reasoning-label {
  font-size: 12px;
  font-weight: 600;
  color: #101828;
  line-height: 20px;
  margin-left: 6px;
}

.reasoning-preview {
  font-size: 12px;
  color: #667085;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reasoning-icon {
  flex-shrink: 0;
  color: #667085;
  font-size: 12px;
  margin-top: 4px;
}

.reasoning-body {
  padding: 0 12px 12px;

  :deep(.markdown-content) {
    padding: 0;
    background: transparent;
    color: #475467;
    font-size: 13px;
    line-height: 1.72;
  }
}

.reasoning-empty-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  font-size: 13px;
  color: #64748b;

  .thinking-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    animation: thinking-dot-bounce 1.4s ease-in-out infinite both;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }

  .thinking-text {
    margin-left: 4px;
    font-size: 12.5px;
    color: #64748b;
    letter-spacing: 0.2px;
  }
}

@keyframes thinking-dot-bounce {
  0%, 80%, 100% {
    transform: scale(0.65);
    opacity: 0.35;
  }
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
}
</style>
