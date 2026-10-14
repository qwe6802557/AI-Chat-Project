import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ArtifactItem, ArtifactVersion, ArtifactType, ViewportMode } from '../types/artifact'

export const useArtifactStore = defineStore('chatArtifact', () => {
  /** 产物字典，key 为 identifier */
  const artifacts = ref<Record<string, ArtifactItem>>({})

  /** 当前激活的产物 identifier */
  const activeArtifactId = ref<string | null>(null)

  /** 当前选中的版本序号（0 为 v1） */
  const activeVersionIndex = ref<number>(0)

  /** 双栏工作区是否展开 */
  const isWorkspaceOpen = ref<boolean>(false)

  /** 是否最大化全屏 */
  const isMaximized = ref<boolean>(false)

  /** 分栏比例（左侧聊天区域占比，默认 0.5 即 50/50） */
  const splitRatio = ref<number>(0.5)

  /** 视口模拟模式 */
  const viewportMode = ref<ViewportMode>('responsive')

  /** 预览 / 源码 Tab 切换 */
  const activeTab = ref<'preview' | 'code'>('preview')

  /**
   * 全部产物列表（按更新时间降序）
   */
  const artifactList = computed<ArtifactItem[]>(() => {
    return Object.values(artifacts.value).sort((a, b) => b.updatedAt - a.updatedAt)
  })

  /**
   * 当前激活的产物对象
   */
  const activeArtifact = computed<ArtifactItem | null>(() => {
    if (!activeArtifactId.value) return null
    return artifacts.value[activeArtifactId.value] || null
  })

  /**
   * 当前激活版本的详细内容
   */
  const currentVersion = computed<ArtifactVersion | null>(() => {
    const art = activeArtifact.value
    if (!art || !art.versions || art.versions.length === 0) return null
    const idx = Math.min(Math.max(0, activeVersionIndex.value), art.versions.length - 1)
    return art.versions[idx] || null
  })

  /**
   * 注册或更新产物
   * - 若 identifier 不存在，初始化版本 1 并自动弹出工作区
   * - 若 identifier 已存在且消息不同或明确更新，自动归集递增新版本
   * - 若处于相同消息的流式推送中，就地更新最新版本内容
   */
  function registerOrUpdateArtifact(payload: {
    identifier: string
    type: ArtifactType
    title: string
    language?: string
    content: string
    messageId?: string
    autoOpen?: boolean
  }): ArtifactItem {
    const now = Date.now()
    const { identifier, type, title, language, content, messageId, autoOpen = true } = payload
    const existing = artifacts.value[identifier]

    if (!existing) {
      const initialVersion: ArtifactVersion = {
        version: 1,
        content,
        language,
        createdAt: now,
        messageId,
      }

      const newItem: ArtifactItem = {
        identifier,
        title,
        type,
        language,
        versions: [initialVersion],
        createdAt: now,
        updatedAt: now,
      }

      artifacts.value[identifier] = newItem
      activeArtifactId.value = identifier
      activeVersionIndex.value = 0

      if (autoOpen) {
        isWorkspaceOpen.value = true
      }

      return newItem
    }

    // 存在旧产物，检查是否属于同消息的就地刷新还是新迭代
    const latestVersion = existing.versions[existing.versions.length - 1]
    const isSameMessage = latestVersion && messageId && latestVersion.messageId === messageId

    if (latestVersion && isSameMessage) {
      // 流式中更新当前最新版本
      latestVersion.content = content
      if (language) latestVersion.language = language
      existing.updatedAt = now
      existing.title = title || existing.title
      existing.type = type || existing.type
    } else {
      // 来自新的一轮修改指令或代码变更，创建递增新版本（v2, v3...）
      // 如果内容与最新版本完全一致则忽略
      if (!latestVersion || latestVersion.content.trim() !== content.trim()) {
        const nextVersionNumber = existing.versions.length + 1
        existing.versions.push({
          version: nextVersionNumber,
          content,
          language: language || existing.language,
          createdAt: now,
          messageId,
        })
        existing.updatedAt = now
        existing.title = title || existing.title
        existing.type = type || existing.type
      }
    }

    activeArtifactId.value = identifier
    activeVersionIndex.value = existing.versions.length - 1

    if (autoOpen) {
      isWorkspaceOpen.value = true
    }

    return existing
  }

  /**
   * 打开指定产物及版本
   */
  function openArtifact(identifier: string, versionIndex?: number) {
    const art = artifacts.value[identifier]
    if (!art) return

    activeArtifactId.value = identifier
    if (typeof versionIndex === 'number' && versionIndex >= 0 && versionIndex < art.versions.length) {
      activeVersionIndex.value = versionIndex
    } else {
      activeVersionIndex.value = art.versions.length - 1
    }

    isWorkspaceOpen.value = true
  }

  /**
   * 切换当前激活产物的指定版本
   */
  function selectVersion(versionIndex: number) {
    const art = activeArtifact.value
    if (!art) return
    if (versionIndex >= 0 && versionIndex < art.versions.length) {
      activeVersionIndex.value = versionIndex
    }
  }

  /**
   * 关闭工作区
   */
  function closeWorkspace() {
    isWorkspaceOpen.value = false
    isMaximized.value = false
  }

  /**
   * 切换全屏最大化
   */
  function toggleMaximize() {
    isMaximized.value = !isMaximized.value
  }

  /**
   * 设置分栏比例（0.25 ~ 0.75 之间）
   */
  function setSplitRatio(ratio: number) {
    splitRatio.value = Math.max(0.25, Math.min(0.75, ratio))
  }

  /**
   * 设置模拟视口
   */
  function setViewportMode(mode: ViewportMode) {
    viewportMode.value = mode
  }

  /**
   * 设置预览/源码 Tab
   */
  function setActiveTab(tab: 'preview' | 'code') {
    activeTab.value = tab
  }

  /**
   * 清空产物（例如切换会话时）
   */
  function clearArtifacts() {
    artifacts.value = {}
    activeArtifactId.value = null
    activeVersionIndex.value = 0
    isWorkspaceOpen.value = false
    isMaximized.value = false
  }

  return {
    artifacts,
    activeArtifactId,
    activeVersionIndex,
    isWorkspaceOpen,
    isMaximized,
    splitRatio,
    viewportMode,
    activeTab,
    artifactList,
    activeArtifact,
    currentVersion,
    registerOrUpdateArtifact,
    openArtifact,
    selectVersion,
    closeWorkspace,
    toggleMaximize,
    setSplitRatio,
    setViewportMode,
    setActiveTab,
    clearArtifacts,
  }
})
