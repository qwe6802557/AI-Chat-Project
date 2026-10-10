import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ToolMetadata } from '@/interface/tools'

export const DEFAULT_TOOLS: ToolMetadata[] = [
  {
    id: 'code_interpreter',
    name: 'code_interpreter',
    title: '代码解释器',
    description: '安全沙箱运行 Python / JS 代码，快速执行算法、数据处理与逻辑演算',
    icon: 'CodeOutlined',
    category: 'data',
    supportsPresetMode: true,
    supportsFunctionCall: true,
  },
  {
    id: 'web_search_v2',
    name: 'web_search_v2',
    title: '深度联网',
    description: '通过博查与实时搜索引擎聚合全球实时新闻、资讯与技术文档',
    icon: 'GlobalOutlined',
    category: 'network',
    supportsPresetMode: true,
    supportsFunctionCall: true,
  },
  {
    id: 'calculator',
    name: 'calculator',
    title: '数学计算器',
    description: '精准高精度计算数学表达式、代数、函数公式与单位换算，消灭模型幻觉',
    icon: 'CalculatorOutlined',
    category: 'utility',
    supportsPresetMode: true,
    supportsFunctionCall: true,
  },
  {
    id: 'weather',
    name: 'weather',
    title: '实时天气',
    description: '查询国内外各城市的实时气温、天气现象、风向与空气质量指标',
    icon: 'CloudOutlined',
    category: 'utility',
    supportsPresetMode: true,
    supportsFunctionCall: true,
  },
  {
    id: 'clock_calendar',
    name: 'clock_calendar',
    title: '时钟日历',
    description: '提供精准服务器时间戳、当前星期、跨时区与公历农历换算',
    icon: 'ClockCircleOutlined',
    category: 'system',
    supportsPresetMode: true,
    supportsFunctionCall: true,
  },
  {
    id: 'url_fetcher',
    name: 'url_fetcher',
    title: '网页阅读器',
    description: '深度抓取指定 URL 网页正文，去除广告导航，提炼结构化纯文本',
    icon: 'LinkOutlined',
    category: 'network',
    supportsPresetMode: true,
    supportsFunctionCall: true,
  },
]

const STORAGE_KEY = 'aichat_enabled_tools'

export const useToolsStore = defineStore('tools', () => {
  const availableTools = ref<ToolMetadata[]>(DEFAULT_TOOLS)
  const isPluginCenterOpen = ref(false)

  // 从本地存储中恢复已启用工具
  const loadSavedEnabledTools = (): string[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // 容错使用默认
    }
    return ['web_search_v2', 'code_interpreter', 'calculator']
  }

  const enabledTools = ref<string[]>(loadSavedEnabledTools())

  const saveEnabledTools = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledTools.value))
    } catch {
      // 本地存储异常忽略
    }
  }

  const isToolEnabled = (id: string): boolean => {
    return enabledTools.value.includes(id)
  }

  const toggleTool = (id: string) => {
    const index = enabledTools.value.indexOf(id)
    if (index >= 0) {
      enabledTools.value.splice(index, 1)
    } else {
      enabledTools.value.push(id)
    }
    saveEnabledTools()
  }

  const enableTool = (id: string) => {
    if (!enabledTools.value.includes(id)) {
      enabledTools.value.push(id)
      saveEnabledTools()
    }
  }

  const disableTool = (id: string) => {
    const index = enabledTools.value.indexOf(id)
    if (index >= 0) {
      enabledTools.value.splice(index, 1)
      saveEnabledTools()
    }
  }

  const openPluginCenter = () => {
    isPluginCenterOpen.value = true
  }

  const closePluginCenter = () => {
    isPluginCenterOpen.value = false
  }

  return {
    availableTools,
    enabledTools,
    isPluginCenterOpen,
    isToolEnabled,
    toggleTool,
    enableTool,
    disableTool,
    openPluginCenter,
    closePluginCenter,
  }
})
