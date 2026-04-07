<template>
  <div
    v-if="reasoning.content"
    :class="['reasoning-panel', { expanded, streaming: isStreaming }]"
  >
    <button
      type="button"
      class="reasoning-toggle"
      @click="expanded = !expanded"
    >
      <div class="reasoning-copy">
        <div class="reasoning-heading">
          <span class="reasoning-badge">
            <BulbOutlined />
          </span>
          <span class="reasoning-label">Think</span>
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
      <MarkdownMessage
        :message-id="`${messageId}-reasoning`"
        :content="reasoning.content"
        :streaming="isStreaming"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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

const expanded = ref(false)

const isStreaming = computed(() => props.reasoning.status === 'streaming')

const previewText = computed(() => {
  const compactText = props.reasoning.content.replace(/\s+/g, ' ').trim()
  if (!compactText) {
    return isStreaming.value ? 'Thinking...' : ''
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
    border-color: rgba(21, 112, 239, 0.14);
    background: rgba(239, 246, 255, 0.72);
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

  :deep(.anticon) {
    font-size: 11px;
  }
}

.reasoning-label {
  font-size: 12px;
  font-weight: 600;
  color: #101828;
  line-height: 20px;
  margin-left: 4px;
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
</style>
