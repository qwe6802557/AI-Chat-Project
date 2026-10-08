<template>
  <a-tooltip :title="tooltipContent" placement="top">
    <button
      type="button"
      :class="['web-search-toggle', { active: enabled, disabled }]"
      :disabled="disabled"
      :aria-pressed="enabled"
      @click="handleToggle"
    >
      <GlobalOutlined class="search-icon" />
      <span class="toggle-label">联网搜索</span>
      <span v-if="enabled" class="active-indicator" />
    </button>
  </a-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { GlobalOutlined } from '@ant-design/icons-vue'

defineOptions({
  name: 'WebSearchToggle',
})

const props = withDefaults(
  defineProps<{
    enabled: boolean
    disabled?: boolean
  }>(),
  {
    enabled: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:enabled': [value: boolean]
}>()

const tooltipContent = computed(() => {
  if (props.enabled) {
    return '已开启联网检索 (实时检索权威网页与事实信息，普惠包含)'
  }
  return '点击开启联网检索 (支持实时搜索新闻、资料与来源溯源)'
})

const handleToggle = () => {
  if (props.disabled) return
  emit('update:enabled', !props.enabled)
}
</script>

<style scoped lang="scss">
.web-search-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #475467;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover:not(.disabled) {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  &.active {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
    box-shadow: 0 1px 2px rgba(29, 78, 216, 0.08);

    .search-icon {
      color: #2563eb;
    }
  }

  &.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .search-icon {
    font-size: 13px;
    color: #64748b;
    transition: color 0.2s ease;
  }

  .toggle-label {
    line-height: 1;
  }

  .active-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #2563eb;
    box-shadow: 0 0 6px rgba(37, 99, 235, 0.6);
  }
}
</style>
