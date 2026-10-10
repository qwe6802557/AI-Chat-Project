<template>
  <div class="tool-quick-capsules">
    <div class="capsules-scroll">
      <!-- 快捷工具胶囊 -->
      <a-tooltip
        v-for="tool in toolsStore.availableTools"
        :key="tool.id"
        :title="tool.description"
        placement="top"
      >
        <button
          type="button"
          :class="[
            'tool-capsule',
            { active: toolsStore.isToolEnabled(tool.id), disabled },
          ]"
          :disabled="disabled"
          @click="toolsStore.toggleTool(tool.id)"
        >
          <component :is="getIconComponent(tool.icon)" class="capsule-icon" />
          <span class="capsule-title">{{ tool.title }}</span>
          <span v-if="toolsStore.isToolEnabled(tool.id)" class="capsule-indicator" />
        </button>
      </a-tooltip>

      <!-- 工具中心配置入口 -->
      <a-tooltip title="打开插件工具中心，精细化配置或查看工具" placement="top">
        <button
          type="button"
          class="tool-capsule center-trigger"
          :disabled="disabled"
          @click="toolsStore.openPluginCenter"
        >
          <AppstoreOutlined class="capsule-icon" />
          <span class="capsule-title">工具中心</span>
        </button>
      </a-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CodeOutlined,
  GlobalOutlined,
  CalculatorOutlined,
  CloudOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  AppstoreOutlined,
} from '@ant-design/icons-vue'
import { getActivePinia } from 'pinia'
import { useToolsStore, DEFAULT_TOOLS } from '@/stores/tools'

defineOptions({
  name: 'ToolQuickCapsules',
})

defineProps<{
  disabled?: boolean
}>()

const toolsStore = getActivePinia()
  ? useToolsStore()
  : ({
      availableTools: DEFAULT_TOOLS,
      enabledTools: ['web_search_v2'],
      isPluginCenterOpen: false,
      isToolEnabled: (id: string) => id === 'web_search_v2',
      toggleTool: () => {},
      enableTool: () => {},
      disableTool: () => {},
      openPluginCenter: () => {},
      closePluginCenter: () => {},
    } as any)

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'CodeOutlined':
      return CodeOutlined
    case 'GlobalOutlined':
      return GlobalOutlined
    case 'CalculatorOutlined':
      return CalculatorOutlined
    case 'CloudOutlined':
      return CloudOutlined
    case 'ClockCircleOutlined':
      return ClockCircleOutlined
    case 'LinkOutlined':
      return LinkOutlined
    default:
      return AppstoreOutlined
  }
}
</script>

<style scoped lang="scss">
.tool-quick-capsules {
  display: flex;
  align-items: center;
  max-width: 100%;
  overflow: hidden;
}

.capsules-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 2px 0;

  &::-webkit-scrollbar {
    display: none;
  }
}

.tool-capsule {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: #475467;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover:not(.disabled) {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  &:active:not(.disabled) {
    transform: scale(0.96);
  }

  &.active {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
    font-weight: 600;

    .capsule-icon {
      color: #2563eb;
    }
  }

  &.center-trigger {
    background: #f8fafc;
    border-style: dashed;
    color: #64748b;

    &:hover:not(.disabled) {
      color: #2563eb;
      border-color: #93c5fd;
      background: #eff6ff;
    }
  }

  &.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .capsule-icon {
    font-size: 12px;
    color: #64748b;
    transition: color 0.15s ease;
  }

  .capsule-title {
    line-height: 1;
  }

  .capsule-indicator {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #2563eb;
  }
}
</style>
