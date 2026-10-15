import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useArtifactStore } from '../useArtifactStore'

describe('useArtifactStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('registers initial artifact and auto-opens workspace', () => {
    const store = useArtifactStore()
    expect(store.isWorkspaceOpen).toBe(false)

    store.registerOrUpdateArtifact({
      identifier: 'my-app',
      title: '示例应用',
      type: 'text/html',
      content: '<h1>Hello</h1>',
      messageId: 'msg-1',
    })

    expect(store.isWorkspaceOpen).toBe(true)
    expect(store.activeArtifactId).toBe('my-app')
    expect(store.artifactList).toHaveLength(1)
    expect(store.currentVersion?.version).toBe(1)
    expect(store.currentVersion?.content).toBe('<h1>Hello</h1>')
  })

  it('increments version for subsequent changes with different messageId', () => {
    const store = useArtifactStore()

    store.registerOrUpdateArtifact({
      identifier: 'my-app',
      title: '示例应用',
      type: 'text/html',
      content: '<h1>v1</h1>',
      messageId: 'msg-1',
    })

    store.registerOrUpdateArtifact({
      identifier: 'my-app',
      title: '示例应用 - 迭代版',
      type: 'text/html',
      content: '<h1>v2</h1>',
      messageId: 'msg-2',
    })

    expect(store.artifactList).toHaveLength(1)
    expect(store.activeArtifact?.versions).toHaveLength(2)
    expect(store.currentVersion?.version).toBe(2)
    expect(store.currentVersion?.content).toBe('<h1>v2</h1>')

    // 切换版本到 v1
    store.selectVersion(0)
    expect(store.currentVersion?.version).toBe(1)
    expect(store.currentVersion?.content).toBe('<h1>v1</h1>')
  })

  it('updates in-place when messageId is the same (streaming)', () => {
    const store = useArtifactStore()

    store.registerOrUpdateArtifact({
      identifier: 'streaming-app',
      title: '流式应用',
      type: 'text/html',
      content: '<div>Loading...</div>',
      messageId: 'msg-streaming',
    })

    store.registerOrUpdateArtifact({
      identifier: 'streaming-app',
      title: '流式应用',
      type: 'text/html',
      content: '<div>Done!</div>',
      messageId: 'msg-streaming',
    })

    expect(store.activeArtifact?.versions).toHaveLength(1)
    expect(store.currentVersion?.content).toBe('<div>Done!</div>')
  })

  it('manages workspace window state and clamp split ratio', () => {
    const store = useArtifactStore()

    store.setSplitRatio(0.9)
    expect(store.splitRatio).toBe(0.75) // clamped

    store.setSplitRatio(0.1)
    expect(store.splitRatio).toBe(0.25) // clamped

    store.toggleMaximize()
    expect(store.isMaximized).toBe(true)

    store.closeWorkspace()
    expect(store.isWorkspaceOpen).toBe(false)
    expect(store.isMaximized).toBe(false)
  })

  it('computes previousVersion and handles requestIteration prompt prefill', () => {
    const store = useArtifactStore()

    store.registerOrUpdateArtifact({
      identifier: 'card-ui',
      title: '卡片组件',
      type: 'text/html',
      content: '<div>v1</div>',
      messageId: 'm1',
    })

    expect(store.previousVersion).toBeNull()

    store.registerOrUpdateArtifact({
      identifier: 'card-ui',
      title: '卡片组件',
      type: 'text/html',
      content: '<div>v2</div>',
      messageId: 'm2',
    })

    expect(store.previousVersion?.version).toBe(1)
    expect(store.previousVersion?.content).toBe('<div>v1</div>')
    expect(store.currentVersion?.version).toBe(2)

    store.requestIteration('card-ui')
    expect(store.pendingPrompt).toContain('请基于产物【卡片组件】(identifier: "card-ui"，当前为 v2)')

    const consumed = store.consumePendingPrompt()
    expect(consumed).toContain('请基于产物【卡片组件】')
    expect(store.pendingPrompt).toBeNull()
  })
})
