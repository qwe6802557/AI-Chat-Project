import { describe, expect, it } from 'vitest'
import {
  buildConversationStatsSummary,
  buildModelUsageBreakdown,
  filterConversations,
  sortConversations,
} from '../conversationInsights'
import type { Conversation } from '@/interface/conversation'

const createConversation = (
  id: string,
  usageSummary?: Conversation['usageSummary'],
  updatedAt: number = 0,
): Conversation => ({
  id,
  title: id,
  messages: [],
  usageSummary,
  createdAt: updatedAt,
  updatedAt,
  sessionId: id,
})

describe('conversationInsights', () => {
  const conversations: Conversation[] = [
    createConversation(
      'session-a',
      {
        lastModel: 'GLM-5',
        totalPromptTokens: 100,
        totalCompletionTokens: 50,
        totalTokens: 150,
        totalEstimatedCost: 0.12,
      },
      3,
    ),
    createConversation(
      'session-b',
      {
        lastModel: 'GPT-5.4',
        totalPromptTokens: 300,
        totalCompletionTokens: 100,
        totalTokens: 400,
        totalEstimatedCost: 1.5,
      },
      2,
    ),
    createConversation('session-c', undefined, 1),
  ]

  it('filters conversations by token or cost usage', () => {
    expect(filterConversations(conversations, 'with_tokens').map((item) => item.id)).toEqual([
      'session-a',
      'session-b',
    ])
    expect(filterConversations(conversations, 'with_cost').map((item) => item.id)).toEqual([
      'session-a',
      'session-b',
    ])
    expect(filterConversations(conversations, 'all')).toHaveLength(3)
  })

  it('sorts conversations by recent, token and cost', () => {
    expect(sortConversations(conversations, 'recent').map((item) => item.id)).toEqual([
      'session-a',
      'session-b',
      'session-c',
    ])
    expect(sortConversations(conversations, 'tokens_desc').map((item) => item.id)).toEqual([
      'session-b',
      'session-a',
      'session-c',
    ])
    expect(sortConversations(conversations, 'cost_desc').map((item) => item.id)).toEqual([
      'session-b',
      'session-a',
      'session-c',
    ])
  })

  it('builds conversation stats summary for visible conversations', () => {
    const visibleConversations = filterConversations(conversations, 'with_tokens')
    expect(buildConversationStatsSummary(visibleConversations, conversations)).toEqual({
      totalSessions: 3,
      visibleSessions: 2,
      billableSessions: 2,
      totalTokens: 550,
      totalEstimatedCost: 1.62,
      topModel: 'GPT-5.4',
    })
  })

  it('builds model usage breakdown sorted by token usage descending', () => {
    expect(buildModelUsageBreakdown(conversations)).toEqual([
      { model: 'GPT-5.4', tokens: 400, sessions: 1, percentage: 73 },
      { model: 'GLM-5', tokens: 150, sessions: 1, percentage: 27 },
    ])

    const zeroTokenConversations: Conversation[] = [
      createConversation('z1', {
        lastModel: 'spark-x2.6',
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalChargedCredits: 0,
      }),
      createConversation('z2', {
        lastModel: 'spark-x2.6',
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalChargedCredits: 0,
      }),
      createConversation('z3', {
        lastModel: 'glm-4',
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalChargedCredits: 0,
      }),
    ]
    expect(buildModelUsageBreakdown(zeroTokenConversations)).toEqual([
      { model: 'spark-x2.6', tokens: 0, sessions: 2, percentage: 67 },
      { model: 'glm-4', tokens: 0, sessions: 1, percentage: 33 },
    ])
  })
})
