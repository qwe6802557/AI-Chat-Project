<template>
  <button
    type="button"
    class="memory-vault-trigger"
    :class="{ disabled }"
    :disabled="disabled"
    title="打开记忆工坊 (查看长期核心画像与情境记忆)"
    @click="handleClick"
  >
    <ReadOutlined class="vault-icon" />
    <span class="vault-label">记忆工坊</span>
  </button>
</template>

<script setup lang="ts">
/**
 * 记忆工坊快速呼出芯片按钮
 */
import { ReadOutlined } from '@ant-design/icons-vue'

defineOptions({
  name: 'MemoryVaultTrigger',
})

interface Props {
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  open: []
}>()

const handleClick = () => {
  if (props.disabled) return
  emit('open')
}
</script>

<style scoped lang="scss">
.memory-vault-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #475467;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  user-select: none;

  &:hover:not(.disabled) {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #1e293b;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  &:active:not(.disabled) {
    background: #e2e8f0;
    transform: translateY(0.5px);
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .vault-icon {
    font-size: 13px;
    color: #64748b;
  }

  .vault-label {
    letter-spacing: -0.01em;
  }
}
</style>
