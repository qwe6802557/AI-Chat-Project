<template>
  <div class="tool-quick-capsules">
    <a-popover
      v-model:open="isOpen"
      trigger="click"
      placement="topLeft"
      overlay-class-name="tool-quick-popover"
      :overlay-inner-style="{ padding: '10px 12px' }"
    >
      <template #content>
        <div class="tool-popover-content">
          <!-- 气泡头部 -->
          <div class="popover-header">
            <div class="header-title">
              <AppstoreOutlined class="header-icon" />
              <span>扩展工具库</span>
            </div>
            <span class="active-tag">
              已启用 {{ activeCount }} / {{ toolsStore.availableTools.length }}
            </span>
          </div>

          <!-- 纵向卡片列表 -->
          <div class="tool-list">
            <div
              v-for="tool in toolsStore.availableTools"
              :key="tool.id"
              :class="['tool-row', { active: toolsStore.isToolEnabled(tool.id), disabled }]"
              @click="handleRowClick(tool.id)"
            >
              <div class="tool-meta">
                <div class="icon-wrap">
                  <component :is="getIconComponent(tool.icon)" class="tool-icon" />
                </div>
                <div class="tool-info">
                  <span class="tool-name">{{ tool.title }}</span>
                  <span class="tool-desc" :title="tool.description">{{ tool.description }}</span>
                </div>
              </div>
              <a-switch
                :checked="toolsStore.isToolEnabled(tool.id)"
                size="small"
                :disabled="disabled"
                @click.stop="handleRowClick(tool.id)"
              />
            </div>
          </div>

          <!-- 底部工具中心直达 -->
          <div class="popover-footer">
            <button
              type="button"
              class="center-btn"
              :disabled="disabled"
              @click="handleOpenCenter"
            >
              <SettingOutlined class="btn-icon" />
              <span>管理插件工具中心</span>
              <RightOutlined class="btn-arrow" />
            </button>
          </div>
        </div>
      </template>

      <!-- 药丸胶囊常驻触发按钮 -->
      <a-tooltip :title="triggerTooltip" placement="top" :open="isOpen ? false : undefined">
        <button
          type="button"
          :class="[
            'tool-capsule-trigger',
            { active: activeCount > 0, open: isOpen, disabled },
          ]"
          :disabled="disabled"
        >
          <AppstoreOutlined class="trigger-icon" />
          <span class="trigger-label">扩展工具</span>
          <span v-if="activeCount > 0" class="active-badge">{{ activeCount }}</span>
          <DownOutlined :class="['arrow-down', { rotated: isOpen }]" />
        </button>
      </a-tooltip>
    </a-popover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  CodeOutlined,
  GlobalOutlined,
  CalculatorOutlined,
  CloudOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  AppstoreOutlined,
  DownOutlined,
  SettingOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import { getActivePinia } from 'pinia'
import { useToolsStore, DEFAULT_TOOLS } from '@/stores/tools'

defineOptions({
  name: 'ToolQuickCapsules',
})

const props = defineProps<{
  disabled?: boolean
}>()

const isOpen = ref(false)

const toolsStore = getActivePinia()
  ? useToolsStore()
  : ({
      availableTools: DEFAULT_TOOLS,
      enabledTools: ['web_search_v2'],
      isPluginCenterOpen: false,
      isToolEnabled: (id: string) => id === 'web_search_v2',
      toggleTool: () => {},
      openPluginCenter: () => {},
      closePluginCenter: () => {},
    } as any)

const activeCount = computed(() => toolsStore.enabledTools?.length ?? 0)

const triggerTooltip = computed(() => {
  if (props.disabled) return '当前不可配置工具'
  if (activeCount.value > 0) {
    return `点击管理扩展工具 (已挂载 ${activeCount.value} 个智能插件)`
  }
  return '点击挂载扩展工具 (代码解释器、数学运算、天气等)'
})

const handleRowClick = (toolId: string) => {
  if (props.disabled) return
  toolsStore.toggleTool(toolId)
}

const handleOpenCenter = () => {
  isOpen.value = false
  toolsStore.openPluginCenter()
}

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
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.tool-capsule-trigger {
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
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover:not(.disabled) {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  &.active {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
    font-weight: 600;

    .trigger-icon {
      color: #2563eb;
    }
  }

  &.open {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
  }

  &.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .trigger-icon {
    font-size: 13px;
    color: #64748b;
    transition: color 0.18s ease;
  }

  .trigger-label {
    line-height: 1;
  }

  .active-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 10px;
    background: #2563eb;
    color: #ffffff;
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
  }

  .arrow-down {
    font-size: 10px;
    color: #94a3b8;
    transition: transform 0.2s ease;

    &.rotated {
      transform: rotate(180deg);
    }
  }
}

.tool-popover-content {
  width: 270px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid #f1f5f9;

  .header-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #0f172a;

    .header-icon {
      color: #2563eb;
      font-size: 13px;
    }
  }

  .active-tag {
    font-size: 11px;
    color: #64748b;
    background: #f1f5f9;
    padding: 1px 6px;
    border-radius: 4px;
  }
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 2px;
}

.tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(.disabled) {
    background: #f8fafc;
    border-color: #e2e8f0;
  }

  &.active {
    background: #f0f7ff;
    border-color: #dbeafe;

    .icon-wrap {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .tool-name {
      color: #1e40af;
      font-weight: 600;
    }
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .tool-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
    margin-right: 8px;
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: #f1f5f9;
    color: #475467;
    flex-shrink: 0;
    font-size: 12px;
    transition: all 0.15s ease;
  }

  .tool-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;

    .tool-name {
      font-size: 12px;
      font-weight: 500;
      color: #1e293b;
      white-space: nowrap;
    }

    .tool-desc {
      font-size: 10px;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 155px;
    }
  }
}

.popover-footer {
  padding-top: 6px;
  border-top: 1px solid #f1f5f9;

  .center-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 28px;
    border-radius: 6px;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    color: #475467;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.18s ease;

    &:hover:not(:disabled) {
      border-color: #3b82f6;
      color: #1d4ed8;
      background: #eff6ff;
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-icon {
      font-size: 12px;
    }

    .btn-arrow {
      font-size: 9px;
      color: #94a3b8;
    }
  }
}
</style>
