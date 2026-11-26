import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'

const {
  mockGetCoreProfile,
  mockUpdateCoreProfile,
  mockGetDailyMemories,
  mockCreateDailyMemory,
  mockDeleteDailyMemory,
  mockTriggerDistillMemories,
  mockMessageSuccess,
  mockMessageError,
} = vi.hoisted(() => ({
  mockGetCoreProfile: vi.fn(),
  mockUpdateCoreProfile: vi.fn(),
  mockGetDailyMemories: vi.fn(),
  mockCreateDailyMemory: vi.fn(),
  mockDeleteDailyMemory: vi.fn(),
  mockTriggerDistillMemories: vi.fn(),
  mockMessageSuccess: vi.fn(),
  mockMessageError: vi.fn(),
}))

vi.mock('@/api/memory', () => ({
  getCoreProfile: mockGetCoreProfile,
  updateCoreProfile: mockUpdateCoreProfile,
  getDailyMemories: mockGetDailyMemories,
  createDailyMemory: mockCreateDailyMemory,
  deleteDailyMemory: mockDeleteDailyMemory,
  triggerDistillMemories: mockTriggerDistillMemories,
}))

vi.mock('ant-design-vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ant-design-vue')>()
  return {
    ...actual,
    message: {
      ...actual.message,
      success: mockMessageSuccess,
      error: mockMessageError,
    },
  }
})

import MemoryVaultDrawer from '../MemoryVaultDrawer.vue'

describe('MemoryVaultDrawer', () => {
  const globalOptions = {
    stubs: {
      'a-drawer': {
        props: ['open'],
        template: '<div v-if="open" class="a-drawer-stub"><slot /></div>',
      },
      'a-input': {
        props: ['value', 'placeholder'],
        emits: ['update:value', 'pressEnter'],
        template:
          '<input class="a-input-stub" :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" @keydown.enter="$emit(\'pressEnter\')" />',
      },
      'a-textarea': {
        props: ['value', 'placeholder'],
        emits: ['update:value'],
        template:
          '<textarea class="a-textarea-stub" :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" />',
      },
      'a-popconfirm': {
        emits: ['confirm'],
        template: '<div class="a-popconfirm-stub" @click="$emit(\'confirm\')"><slot /></div>',
      },
      CloseOutlined: true,
      SyncOutlined: true,
      LoadingOutlined: true,
      CheckOutlined: true,
      DeleteOutlined: true,
      SearchOutlined: true,
      PlusOutlined: true,
    },
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockGetCoreProfile.mockResolvedValue({
      data: {
        id: 'cp-1',
        userId: 'u-1',
        preferences: {},
        facts: {},
        rawSummary: '偏好极简注释与 TypeScript',
        version: 2,
        createdAt: '2026-11-26T00:00:00Z',
        updatedAt: '2026-11-26T00:00:00Z',
      },
    })
    mockGetDailyMemories.mockResolvedValue({
      data: {
        items: [
          {
            id: 'dm-1',
            userId: 'u-1',
            dateKey: '2026-11-26',
            category: 'todo',
            content: '完成移动端记忆工坊同步',
            isArchived: false,
            createdAt: '2026-11-26T01:00:00Z',
            updatedAt: '2026-11-26T01:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('打开抽屉后切换至每日情境展示正确的 todo 分类并与后端语义搜索联动', async () => {
    const wrapper = mount(MemoryVaultDrawer, {
      props: { open: true },
      global: globalOptions,
    })

    await nextTick()
    await nextTick()

    const dailyTabBtn = wrapper.findAll('.tab-btn')[1]!
    await dailyTabBtn.trigger('click')

    const chipsText = wrapper.findAll('.category-chips .filter-chip').map((el) => el.text())
    expect(chipsText).toContain('待办 (todo)')
    expect(chipsText).not.toContain('洞察 (insight)')

    mockGetDailyMemories.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'dm-hit',
            userId: 'u-1',
            dateKey: '2026-11-26',
            category: 'decision',
            content: '启用 pgvector HNSW 索引加速回忆',
            isArchived: false,
            score: 0.912,
            createdAt: '2026-11-26T01:00:00Z',
            updatedAt: '2026-11-26T01:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    })

    await wrapper.find('.a-input-stub').setValue('pgvector 索引')
    await vi.advanceTimersByTimeAsync(320)
    await nextTick()

    expect(mockGetDailyMemories).toHaveBeenLastCalledWith({
      category: undefined,
      keyword: 'pgvector 索引',
      limit: 50,
    })
    expect(wrapper.find('.relevance-tag').text()).toContain('相关度 91%')
  })

  it('支持手动录入新记忆并在后端触发语义去重合并时给予准确提示', async () => {
    mockCreateDailyMemory.mockResolvedValueOnce({
      data: {
        action: 'merged',
        similarity: 0.94,
        item: {
          id: 'dm-1',
          userId: 'u-1',
          dateKey: '2026-11-26',
          category: 'todo',
          content: '上线记忆工坊双端对齐',
          isArchived: false,
          createdAt: '2026-11-26T01:00:00Z',
          updatedAt: '2026-11-26T02:00:00Z',
        },
      },
    })

    const wrapper = mount(MemoryVaultDrawer, {
      props: { open: true },
      global: globalOptions,
    })

    await nextTick()
    await nextTick()

    await wrapper.findAll('.tab-btn')[1]!.trigger('click')
    await wrapper.find('.add-memory-toggle-btn').trigger('click')

    const todoChip = wrapper
      .findAll('.create-category-row .filter-chip')
      .find((el) => el.text().includes('todo'))!
    await todoChip.trigger('click')

    await wrapper.find('.create-memory-card .a-textarea-stub').setValue('上线记忆工坊双端对齐')
    await wrapper.find('.submit-create-btn').trigger('click')
    await nextTick()

    expect(mockCreateDailyMemory).toHaveBeenCalledWith({
      category: 'todo',
      content: '上线记忆工坊双端对齐',
    })
    expect(mockMessageSuccess).toHaveBeenCalledWith('已与高度相似记忆合并更新')
  })

  it('点击遗忘确认后调用 deleteDailyMemory 删除对应条目', async () => {
    mockDeleteDailyMemory.mockResolvedValueOnce({ data: { success: true } })

    const wrapper = mount(MemoryVaultDrawer, {
      props: { open: true },
      global: globalOptions,
    })

    await nextTick()
    await nextTick()

    await wrapper.findAll('.tab-btn')[1]!.trigger('click')
    await wrapper.find('.a-popconfirm-stub').trigger('click')
    await nextTick()

    expect(mockDeleteDailyMemory).toHaveBeenCalledWith('dm-1')
    expect(wrapper.findAll('.daily-memory-card')).toHaveLength(0)
  })
})
