import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mockGetSessionList = vi.fn()
const mockCreateSession = vi.fn()
const mockDeleteSession = vi.fn()
const mockGetSessionMessages = vi.fn()
const mockUpdateSessionTitle = vi.fn()
const mockClearAllSessions = vi.fn()

vi.mock('@/api/chat', () => ({
  getSessionList: mockGetSessionList,
  createSession: mockCreateSession,
  deleteSession: mockDeleteSession,
  getSessionMessages: mockGetSessionMessages,
  updateSessionTitle: mockUpdateSessionTitle,
  clearAllSessions: mockClearAllSessions,
}))

describe('useConversationStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('creates and reuses an empty temporary conversation', async () => {
    const { useConversationStore } = await import('@/stores')
    const store = useConversationStore()

    const firstId = store.createConversation()
    const secondId = store.createConversation()

    expect(firstId).toBe(secondId)
    expect(store.conversations).toHaveLength(1)
    expect(store.currentConversationId).toBe(firstId)
    expect(store.currentConversation?.title).toBe('新对话')
  })

  it('loads session messages and transforms attachments into frontend shape', async () => {
    const { useConversationStore } = await import('@/stores')
    const store = useConversationStore()

    store.conversations = [{
      id: 'session-1',
      title: '会话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: 'session-1',
    }]
    store.currentConversationId = 'session-1'

    mockGetSessionMessages.mockResolvedValue({
      code: 0,
      data: {
        messages: [
          {
            id: 'msg-1',
            userId: 'user-1',
            sessionId: 'session-1',
            userMessage: '你好',
            aiMessage: '世界',
            model: 'GLM-5',
            usage: {
              promptTokens: 1,
              completionTokens: 1,
              totalTokens: 2,
              estimatedInputCost: 0.001,
              estimatedOutputCost: 0.002,
              estimatedTotalCost: 0.003,
            },
            attachments: [
              {
                id: 'att-1',
                url: '/files/att-1',
                name: 'image.png',
                type: 'image/png',
                sizeBytes: 12,
              },
            ],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      },
      message: 'ok',
    })

    const result = await store.loadMessagesForSession('session-1')

    expect(result).toEqual({ hasMore: false, total: 1, totalPages: 1 })
    expect(store.currentConversation?.messages).toHaveLength(2)
    expect(store.currentConversation?.messages[0]).toMatchObject({
      id: 'msg-1-user',
      role: 'user',
      content: '你好',
    })
    expect(store.currentConversation?.messages[0]?.attachments?.[0]).toMatchObject({
      type: 'image',
      name: 'image.png',
      url: 'http://localhost:3000/files/att-1',
      preview: 'http://localhost:3000/files/att-1',
    })
    expect(store.currentConversation?.messages[1]).toMatchObject({
      id: 'msg-1-assistant',
      role: 'assistant',
      content: '世界',
      model: 'GLM-5',
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        estimatedInputCost: 0.001,
        estimatedOutputCost: 0.002,
        estimatedTotalCost: 0.003,
      },
    })
  })

  it('clears all conversations and returns backend deleted count', async () => {
    const { useConversationStore } = await import('@/stores')
    const store = useConversationStore()

    store.conversations = [{
      id: 'session-1',
      title: '会话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: 'session-1',
    }]
    store.currentConversationId = 'session-1'

    mockClearAllSessions.mockResolvedValue({
      code: 0,
      data: {
        deletedCount: 3,
      },
      message: 'ok',
    })

    const result = await store.clearAllConversations('user-1')

    expect(mockClearAllSessions).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(result).toEqual({ deletedCount: 3 })
    expect(store.conversations).toEqual([])
    expect(store.currentConversationId).toBe('')
  })

  it('maps session usage summary from server list response', async () => {
    const { useConversationStore } = await import('@/stores')
    const store = useConversationStore()

    mockGetSessionList.mockResolvedValue({
      code: 0,
      data: [
        {
          id: 'session-1',
          userId: 'user-1',
          title: '会话',
          isArchived: false,
          isDeleted: false,
          lastMessagePreview: '你好',
          lastActiveAt: '2026-01-01T00:00:00.000Z',
          messageCount: 2,
          usageSummary: {
            lastModel: 'GLM-5',
            totalPromptTokens: 100,
            totalCompletionTokens: 40,
            totalTokens: 140,
            totalEstimatedCost: 0.1234,
            totalChargedCredits: 300,
          },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      message: 'ok',
    })
    mockGetSessionMessages.mockResolvedValue({
      code: 0,
      data: {
        messages: [],
        total: 0,
        page: 1,
        pageSize: 5,
        totalPages: 0,
      },
      message: 'ok',
    })

    await store.loadFromServer('user-1')

    expect(store.conversations[0]).toMatchObject({
      id: 'session-1',
      usageSummary: {
        lastModel: 'GLM-5',
        totalPromptTokens: 100,
        totalCompletionTokens: 40,
        totalTokens: 140,
        totalEstimatedCost: 0.1234,
        totalChargedCredits: 300,
      },
    })
  })
})
