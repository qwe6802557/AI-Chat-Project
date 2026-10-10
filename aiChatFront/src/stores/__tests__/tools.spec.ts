import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToolsStore } from '../tools'

describe('useToolsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('应该包含 6 大核心内置工具', () => {
    const store = useToolsStore()
    expect(store.availableTools.length).toBe(6)
    const ids = store.availableTools.map((t) => t.id)
    expect(ids).toContain('code_interpreter')
    expect(ids).toContain('web_search_v2')
    expect(ids).toContain('calculator')
    expect(ids).toContain('weather')
    expect(ids).toContain('clock_calendar')
    expect(ids).toContain('url_fetcher')
  })

  it('能够切换工具的启用与禁用状态', () => {
    const store = useToolsStore()
    store.disableTool('weather')
    expect(store.isToolEnabled('weather')).toBe(false)

    store.toggleTool('weather')
    expect(store.isToolEnabled('weather')).toBe(true)

    store.toggleTool('weather')
    expect(store.isToolEnabled('weather')).toBe(false)
  })

  it('支持打开与关闭插件中心弹窗', () => {
    const store = useToolsStore()
    expect(store.isPluginCenterOpen).toBe(false)

    store.openPluginCenter()
    expect(store.isPluginCenterOpen).toBe(true)

    store.closePluginCenter()
    expect(store.isPluginCenterOpen).toBe(false)
  })
})
