import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeStore } from '../knowledge'
import * as knowledgeApi from '@/api/knowledge'

vi.mock('@/api/knowledge', () => ({
  getKnowledgeBases: vi.fn(),
}))

describe('useKnowledgeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('初始状态为空且无加载', () => {
    const store = useKnowledgeStore()
    expect(store.knowledgeBases).toEqual([])
    expect(store.activeBases).toEqual([])
    expect(store.currentKb).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.isRefreshing).toBe(false)
  })

  it('首次加载触发 loading，并正确缓存知识库列表', async () => {
    const mockList = [
      {
        id: 'kb-1',
        name: '技术架构知识库',
        description: '系统架构与技术选型',
        documentCount: 5,
        chunkCount: 88,
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      },
      {
        id: 'kb-2',
        name: '已归档知识库',
        description: '',
        documentCount: 1,
        chunkCount: 10,
        isActive: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      },
    ]

    vi.mocked(knowledgeApi.getKnowledgeBases).mockResolvedValueOnce({
      code: 200,
      data: mockList as any,
      message: 'success',
    })

    const store = useKnowledgeStore()
    const promise = store.fetchKnowledgeBases(false, false)
    expect(store.loading).toBe(true)

    const result = await promise
    expect(result).toHaveLength(2)
    expect(store.knowledgeBases).toHaveLength(2)
    expect(store.activeBases).toHaveLength(1)
    expect(store.activeBases[0].id).toBe('kb-1')
    expect(store.currentKb?.id).toBe('kb-1')
    expect(store.loading).toBe(false)
  })

  it('SWR 缓存窗口内直接命中缓存，不发起重复请求', async () => {
    const mockList = [
      {
        id: 'kb-1',
        name: '技术架构知识库',
        documentCount: 5,
        chunkCount: 88,
        isActive: true,
      },
    ]

    vi.mocked(knowledgeApi.getKnowledgeBases).mockResolvedValueOnce({
      code: 200,
      data: mockList as any,
      message: 'success',
    })

    const store = useKnowledgeStore()
    await store.fetchKnowledgeBases(false, true)
    expect(knowledgeApi.getKnowledgeBases).toHaveBeenCalledTimes(1)

    // 在 30 秒内再次调用，应该命中内存 SWR 缓存，不产生网络请求
    const cachedResult = await store.fetchKnowledgeBases(false, true)
    expect(cachedResult).toHaveLength(1)
    expect(knowledgeApi.getKnowledgeBases).toHaveBeenCalledTimes(1)

    // force=true 时应强制刷新
    vi.mocked(knowledgeApi.getKnowledgeBases).mockResolvedValueOnce({
      code: 200,
      data: mockList as any,
      message: 'success',
    })
    await store.fetchKnowledgeBases(true, true)
    expect(knowledgeApi.getKnowledgeBases).toHaveBeenCalledTimes(2)
  })

  it('支持本地更新和删除知识库', () => {
    const store = useKnowledgeStore()
    const kb = {
      id: 'kb-test',
      name: '测试库',
      documentCount: 0,
      chunkCount: 0,
      isActive: true,
    } as any

    store.updateLocalBase(kb)
    expect(store.knowledgeBases).toHaveLength(1)
    expect(store.knowledgeBases[0].name).toBe('测试库')

    store.updateLocalBase({ ...kb, name: '测试库(已重命名)' })
    expect(store.knowledgeBases).toHaveLength(1)
    expect(store.knowledgeBases[0].name).toBe('测试库(已重命名)')

    store.removeLocalBase('kb-test')
    expect(store.knowledgeBases).toHaveLength(0)
  })
})
