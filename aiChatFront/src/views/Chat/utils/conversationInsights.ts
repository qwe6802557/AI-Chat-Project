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
