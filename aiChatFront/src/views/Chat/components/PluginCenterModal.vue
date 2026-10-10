<template>
  <a-modal
    :open="toolsStore.isPluginCenterOpen"
    title="插件工具中心"
    :footer="null"
    width="640px"
    class="plugin-center-modal"
    @cancel="toolsStore.closePluginCenter"
  >
    <div class="plugin-center-body">
      <div class="modal-intro">
        <p class="intro-desc">
          为 AI 助手模型赋予外部实时计算、深度网络抓取、环境时钟感知与安全代码执行能力。
        </p>
        <div class="intro-stats">
          <span class="active-count">已启用 {{ toolsStore.enabledTools.length }} / {{ toolsStore.availableTools.length }} 款插件</span>
        </div>
      </div>

      <div class="plugins-list">
        <div
          v-for="tool in toolsStore.availableTools"
          :key="tool.id"
          :class="['plugin-item-card', { active: toolsStore.isToolEnabled(tool.id) }]"
          @click="toolsStore.toggleTool(tool.id)"
        >
          <div class="plugin-icon-box">
            <component :is="getIconComponent(tool.icon)" class="plugin-icon" />
          </div>

          <div class="plugin-info">
            <div class="plugin-header">
              <span class="plugin-title">{{ tool.title }}</span>
              <span class="category-tag">{{ getCategoryLabel(tool.category) }}</span>
            </div>
            <p class="plugin-desc">{{ tool.description }}</p>
          </div>

          <div class="plugin-action" @click.stop>
            <a-switch
              :checked="toolsStore.isToolEnabled(tool.id)"
              size="small"
              @change="() => toolsStore.toggleTool(tool.id)"
            />
          </div>
        </div>
      </div>

      <div class="modal-actions-bar">
        <div class="batch-btns">
          <a-button size="small" type="link" @click="handleEnableAll">全部启用</a-button>
          <a-button size="small" type="link" danger @click="handleDisableAll">清空禁用</a-button>
        </div>
        <a-button type="primary" size="middle" @click="toolsStore.closePluginCenter">
          完成配置
        </a-button>
      </div>
    </div>
  </a-modal>
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
import type { ToolMetadata } from '@/interface/tools'

defineOptions({
  name: 'PluginCenterModal',
})

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

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'data':
      return '计算与数据'
    case 'network':
      return '网络与抓取'
    case 'utility':
      return '实用工具'
    case 'system':
      return '系统环境'
    default:
      return '扩展插件'
  }
}

const handleEnableAll = () => {
  toolsStore.availableTools.forEach((t: ToolMetadata) => {
    toolsStore.enableTool(t.id)
  })
}

const handleDisableAll = () => {
  toolsStore.availableTools.forEach((t: ToolMetadata) => {
    toolsStore.disableTool(t.id)
  })
}
</script>

<style scoped lang="scss">
.plugin-center-body {
  padding: 4px 0;
}

.modal-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;

  .intro-desc {
    margin: 0;
    font-size: 13px;
    color: #64748b;
    line-height: 1.5;
  }

  .active-count {
    font-size: 12px;
    font-weight: 600;
    color: #2563eb;
    background: #eff6ff;
    padding: 3px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }
}

.plugins-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 4px;
}

.plugin-item-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  &.active {
    border-color: #93c5fd;
    background: #f0f7ff;

    .plugin-icon-box {
      background: #dbeafe;
      color: #2563eb;
    }

    .plugin-title {
      color: #1d4ed8;
    }
  }

  .plugin-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: #f1f5f9;
    color: #475467;
    flex-shrink: 0;
    transition: all 0.2s ease;

    .plugin-icon {
      font-size: 18px;
    }
  }

  .plugin-info {
    flex: 1;
    min-width: 0;

    .plugin-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 3px;

      .plugin-title {
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        transition: color 0.15s ease;
      }

      .category-tag {
        font-size: 11px;
        color: #64748b;
        background: #f1f5f9;
        padding: 1px 6px;
        border-radius: 4px;
      }
    }

    .plugin-desc {
      margin: 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .plugin-action {
    flex-shrink: 0;
  }
}

.modal-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
}
</style>
