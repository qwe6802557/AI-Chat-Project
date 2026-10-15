import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getKnowledgeBases } from '@/api/knowledge'
import type { KnowledgeBaseItem } from '@/interface/knowledge'

export const useKnowledgeStore = defineStore('knowledge', () => {
  const knowledgeBases = ref<KnowledgeBaseItem[]>([])
  const loading = ref(false)
  const isRefreshing = ref(false)
  const lastFetched = ref<number>(0)
  const currentKbId = ref<string | null>(null)

  // 过滤出启用的知识库列表
  const activeBases = computed(() =>
    knowledgeBases.value.filter((item) => item.isActive !== false)
  )

  // 当前选中的知识库实体
  const currentKb = computed(() => {
    if (!currentKbId.value && knowledgeBases.value.length > 0) {
      return knowledgeBases.value[0]
    }
    return knowledgeBases.value.find((b) => b.id === currentKbId.value) || null
  })

  /**
   * SWR (Stale-While-Revalidate) 模式拉取知识库列表
   * @param force 是否强制跳过缓存刷新
   * @param silent 是否静默刷新（有数据时绝不出现全屏/全区域 loading 闪烁）
   */
  async function fetchKnowledgeBases(force = false, silent = true) {
    const now = Date.now()
    const hasCache = knowledgeBases.value.length > 0
    const isFresh = now - lastFetched.value < 30000

    if (!force && hasCache && isFresh) {
      return knowledgeBases.value
    }

    if (!hasCache && !silent) {
      loading.value = true
    } else {
      isRefreshing.value = true
    }

    try {
      const res = await getKnowledgeBases()
      const list = res.data || []
      knowledgeBases.value = list
      lastFetched.value = Date.now()

      if (currentKbId.value && !list.some((b) => b.id === currentKbId.value)) {
        currentKbId.value = list[0]?.id || null
      }
      return list
    } catch {
      return knowledgeBases.value
    } finally {
      loading.value = false
      isRefreshing.value = false
    }
  }

  function setCurrentKbId(id: string | null) {
    currentKbId.value = id
  }

  function updateLocalBase(kb: KnowledgeBaseItem) {
    const idx = knowledgeBases.value.findIndex((b) => b.id === kb.id)
    if (idx >= 0) {
      knowledgeBases.value[idx] = { ...knowledgeBases.value[idx], ...kb }
    } else {
      knowledgeBases.value.unshift(kb)
    }
  }

  function removeLocalBase(id: string) {
    knowledgeBases.value = knowledgeBases.value.filter((b) => b.id !== id)
    if (currentKbId.value === id) {
      currentKbId.value = knowledgeBases.value[0]?.id || null
    }
  }

  return {
    knowledgeBases,
    activeBases,
    currentKbId,
    currentKb,
    loading,
    isRefreshing,
    lastFetched,
    fetchKnowledgeBases,
    setCurrentKbId,
    updateLocalBase,
    removeLocalBase,
  }
})
