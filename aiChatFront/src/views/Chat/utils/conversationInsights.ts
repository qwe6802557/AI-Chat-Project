import type {
  Conversation,
  ConversationFilterMode,
  ConversationSortMode,
  ConversationStatsSummary,
} from '@/interface/conversation'

const getTokenTotal = (conversation: Conversation): number => {
  return conversation.usageSummary?.totalTokens || 0
}

const getCostTotal = (conversation: Conversation): number => {
  return conversation.usageSummary?.totalEstimatedCost || 0
}

const getLastModel = (conversation: Conversation): string | null => {
  return conversation.usageSummary?.lastModel || null
}

export const filterConversations = (
  conversations: Conversation[],
  filterMode: ConversationFilterMode,
): Conversation[] => {
  switch (filterMode) {
    case 'with_tokens':
      return conversations.filter((conversation) => getTokenTotal(conversation) > 0)
    case 'with_cost':
      return conversations.filter((conversation) => getCostTotal(conversation) > 0)
    case 'all':
    default:
      return conversations
  }
}

export const sortConversations = (
  conversations: Conversation[],
  sortMode: ConversationSortMode,
): Conversation[] => {
  const sorted = [...conversations]

  switch (sortMode) {
    case 'tokens_desc':
      sorted.sort((a, b) => {
        const diff = getTokenTotal(b) - getTokenTotal(a)
        if (diff !== 0) return diff
        return b.updatedAt - a.updatedAt
      })
      return sorted
    case 'cost_desc':
      sorted.sort((a, b) => {
        const diff = getCostTotal(b) - getCostTotal(a)
        if (diff !== 0) return diff
        return b.updatedAt - a.updatedAt
      })
      return sorted
    case 'recent':
    default:
      sorted.sort((a, b) => b.updatedAt - a.updatedAt)
      return sorted
  }
}

export const buildConversationStatsSummary = (
  visibleConversations: Conversation[],
  allConversations: Conversation[],
): ConversationStatsSummary => {
  const totalTokens = visibleConversations.reduce(
    (sum, conversation) => sum + getTokenTotal(conversation),
    0,
  )
  const totalEstimatedCost = visibleConversations.reduce(
    (sum, conversation) => sum + getCostTotal(conversation),
    0,
  )
  const billableSessions = visibleConversations.filter(
    (conversation) => getCostTotal(conversation) > 0,
  ).length

  const modelUsage = new Map<string, number>()
  visibleConversations.forEach((conversation) => {
    const model = getLastModel(conversation)
    if (!model) return
    modelUsage.set(model, (modelUsage.get(model) || 0) + getTokenTotal(conversation))
  })

  let topModel: string | null = null
  let topModelTokens = -1
  modelUsage.forEach((tokens, model) => {
    if (tokens > topModelTokens) {
      topModel = model
      topModelTokens = tokens
    }
  })

  return {
    totalSessions: allConversations.length,
    visibleSessions: visibleConversations.length,
    billableSessions,
    totalTokens,
    totalEstimatedCost,
    topModel,
  }
}

export interface ModelUsageBreakdownItem {
  model: string
  tokens: number
  sessions: number
  percentage: number
}

/**
 * 统计各模型在已加载会话中的消耗分布（按 Token 优先，零 Token 时回退按会话次数占比）
 */
export const buildModelUsageBreakdown = (
  conversations: Conversation[],
  limit: number = 4,
): ModelUsageBreakdownItem[] => {
  const usageMap = new Map<string, { tokens: number; sessions: number }>()

  conversations.forEach((conversation) => {
    const model = getLastModel(conversation)
    if (!model) return
    const current = usageMap.get(model) || { tokens: 0, sessions: 0 }
    usageMap.set(model, {
      tokens: current.tokens + getTokenTotal(conversation),
      sessions: current.sessions + 1,
    })
  })

  if (usageMap.size === 0) return []

  const entries = Array.from(usageMap.entries()).map(([model, stats]) => ({
    model,
    tokens: stats.tokens,
    sessions: stats.sessions,
  }))

  const totalTokens = entries.reduce((sum, item) => sum + item.tokens, 0)
  const totalSessions = entries.reduce((sum, item) => sum + item.sessions, 0)

  entries.sort((a, b) => {
    if (b.tokens !== a.tokens) return b.tokens - a.tokens
    if (b.sessions !== a.sessions) return b.sessions - a.sessions
    return a.model.localeCompare(b.model)
  })

  return entries.slice(0, Math.max(1, limit)).map((item) => {
    const percentage = totalTokens > 0
      ? Math.round((item.tokens / totalTokens) * 100)
      : totalSessions > 0
        ? Math.round((item.sessions / totalSessions) * 100)
        : 0

    return {
      ...item,
      percentage,
    }
  })
}
