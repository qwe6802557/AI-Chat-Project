import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RetrievalPlayground from '../RetrievalPlayground.vue'
import { searchKnowledgeBase } from '@/api/knowledge'

vi.mock('@/api/knowledge', () => ({
  searchKnowledgeBase: vi.fn(),
}))

const mockSearch = vi.mocked(searchKnowledgeBase)

describe('RetrievalPlayground', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('支持切换模式与 Rerank 参数执行检索并触发 open-context 事件', async () => {
    const content = '采用 BGE-M3 与 BGE-Reranker 执行双路检索与精排。'
    const bgeStart = content.indexOf('BGE-Reranker')
    const mockHit = {
      chunkId: 'chunk-101',
      documentId: 'doc-1',
      knowledgeBaseId: 'kb-1',
      documentTitle: 'RAG 架构指南',
      content,
      chunkIndex: 2,
      score: 0.92,
      charCount: content.length,
      hitSource: 'hybrid' as const,
      denseScore: 0.86,
      denseRank: 1,
      sparseRank: 2,
      rerankScore: 0.92,
      rerankApplied: true,
      matchedTerms: ['BGE-Reranker'],
      highlights: [{ start: bgeStart, end: bgeStart + 'BGE-Reranker'.length, term: 'BGE-Reranker' }],
    }

    mockSearch.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: [mockHit],
    } as unknown as Awaited<ReturnType<typeof searchKnowledgeBase>>)

    const wrapper = mount(RetrievalPlayground, {
      props: {
        knowledgeBaseId: 'kb-1',
        documents: [
          {
            id: 'doc-1',
            knowledgeBaseId: 'kb-1',
            userId: 'u1',
            title: 'RAG 架构指南',
            fileType: 'md',
            fileSize: 1024,
            charCount: 500,
            chunkCount: 3,
            status: 'completed',
            createdAt: '',
            updatedAt: '',
          },
        ],
      },
      global: {
        stubs: {
          'a-select': { template: '<div class="a-select-stub"><slot /></div>' },
          'a-select-option': { template: '<div><slot /></div>' },
          'a-switch': {
            props: ['checked'],
            template: '<input type="checkbox" :checked="checked" />',
          },
        },
      },
    })

    // 切换模式为「语义」
    const modeBtns = wrapper.findAll('.mode-seg-btn')
    await modeBtns[1]?.trigger('click')

    // 输入检索词并提交
    const input = wrapper.find('.stitch-query-input')
    await input.setValue('BGE-Reranker')
    await wrapper.find('.stitch-btn.primary').trigger('click')
    await flushPromises()

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'BGE-Reranker',
        knowledgeBaseIds: ['kb-1'],
        mode: 'dense',
        enableRerank: true,
      }),
    )

    expect(wrapper.text()).toContain('双路共振')
    expect(wrapper.text()).toContain('Rerank 92%')
    expect(wrapper.find('mark.chunk-highlight-mark').text()).toBe('BGE-Reranker')

    await wrapper.find('.context-preview-btn').trigger('click')
    expect(wrapper.emitted('open-context')?.[0]).toEqual([mockHit])
  })

  it('命中视觉切片时展示原图缩略图与页码徽章', async () => {
    mockSearch.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: [
        {
          chunkId: 'chunk-vis-1',
          documentId: 'doc-pdf',
          knowledgeBaseId: 'kb-1',
          documentTitle: '性能分析报告',
          content: '[第 5 页] QPS 折线图',
          chunkIndex: 4,
          score: 0.91,
          charCount: 16,
          chunkType: 'visual',
          assetId: 'asset-5',
          visualType: 'chart',
          pageNumber: 5,
          visualAssetUrl: '/knowledge-bases/assets/asset-5?expires=999&signature=sig',
        },
      ],
    } as unknown as Awaited<ReturnType<typeof searchKnowledgeBase>>)

    const wrapper = mount(RetrievalPlayground, {
      props: {
        knowledgeBaseId: 'kb-1',
        documents: [],
      },
      global: {
        stubs: {
          'a-select': { template: '<div class="a-select-stub"><slot /></div>' },
          'a-select-option': { template: '<div><slot /></div>' },
          'a-switch': {
            props: ['checked'],
            template: '<input type="checkbox" :checked="checked" />',
          },
          'a-image': {
            props: ['src', 'alt'],
            template: '<img class="stub-visual-img" :src="src" :alt="alt" />',
          },
        },
      },
    })

    await wrapper.find('.stitch-query-input').setValue('QPS')
    await wrapper.find('.stitch-btn.primary').trigger('click')
    await flushPromises()

    expect(wrapper.find('.stub-visual-img').attributes('src')).toBe(
      '/knowledge-bases/assets/asset-5?expires=999&signature=sig',
    )
    expect(wrapper.text()).toContain('数据图表')
    expect(wrapper.text()).toContain('P.5')
  })
})
