<template>
  <div class="retrieval-playground">
    <div class="search-controls-card">
      <div class="search-input-row">
        <SearchOutlined class="input-search-icon" />
        <input
          v-model="query"
          type="text"
          placeholder="输入测试问题，检验语义稠密向量、稀疏关键词与 Rerank 精排效果..."
          class="stitch-query-input"
          @keydown.enter="handleSearch"
        />
        <button
          type="button"
          class="stitch-btn primary"
          :disabled="isSearching || !query.trim()"
          @click="handleSearch"
        >
          <SearchOutlined v-if="!isSearching" />
          <LoadingOutlined v-else spin />
          <span>执行检索评测</span>
        </button>
      </div>

      <!-- 紧凑调参条 -->
      <div class="params-toolbar">
        <div class="param-group">
          <span class="param-label">模式</span>
          <div class="mode-segmented" role="tablist" aria-label="检索模式">
            <button
              v-for="opt in modeOptions"
              :key="opt.value"
              type="button"
              :class="['mode-seg-btn', { active: mode === opt.value }]"
              @click="mode = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="param-group">
          <span class="param-label">Top-K</span>
          <a-select v-model:value="limit" size="small" class="param-select-sm">
            <a-select-option :value="3">3 条</a-select-option>
            <a-select-option :value="5">5 条</a-select-option>
            <a-select-option :value="6">6 条</a-select-option>
            <a-select-option :value="8">8 条</a-select-option>
            <a-select-option :value="10">10 条</a-select-option>
          </a-select>
        </div>

        <div class="param-group">
          <span class="param-label">阈值</span>
          <a-select v-model:value="minScore" size="small" class="param-select-md">
            <a-select-option :value="0">不限</a-select-option>
            <a-select-option :value="0.3">≥ 30%</a-select-option>
            <a-select-option :value="0.5">≥ 50%</a-select-option>
            <a-select-option :value="0.7">≥ 70%</a-select-option>
          </a-select>
        </div>

        <div class="param-group">
          <span class="param-label">Rerank 精排</span>
          <a-switch v-model:checked="enableRerank" size="small" />
        </div>

        <div v-if="completedDocuments.length > 0" class="param-group doc-filter-group">
          <span class="param-label">文档范围</span>
          <a-select
            v-model:value="selectedDocIds"
            mode="multiple"
            size="small"
            allow-clear
            :max-tag-count="1"
            placeholder="全部已完成文档"
            class="doc-filter-select"
          >
            <a-select-option v-for="doc in completedDocuments" :key="doc.id" :value="doc.id">
              {{ doc.title }}
            </a-select-option>
          </a-select>
        </div>
      </div>
    </div>

    <!-- 评测结果展示区 -->
    <div class="search-results-viewport">
      <div v-if="isSearching" class="search-skeleton-box">
        <div v-for="i in 3" :key="i" class="result-skeleton-card" />
      </div>

      <div v-else-if="hasSearched && results.length === 0" class="search-empty-box">
        <InboxOutlined class="empty-icon" />
        <p>未召回满足条件的切片，可尝试降低阈值或切换混合模式</p>
      </div>

      <div v-else-if="results.length > 0" class="results-stack">
        <div
          v-for="(res, idx) in results"
          :key="res.chunkId || idx"
          class="result-item-card"
        >
          <div class="res-card-top">
            <div class="res-meta-left">
              <span class="rank-badge font-mono">#{{ idx + 1 }}</span>
              <span class="doc-badge" :title="res.documentTitle">{{ res.documentTitle }}</span>
              <span class="chunk-badge font-mono">切片 #{{ res.chunkIndex + 1 }}</span>
              <span v-if="res.hitSource" :class="['hit-source-badge', res.hitSource]">
                {{ getHitSourceLabel(res.hitSource) }}
              </span>
            </div>
            <div class="res-score-badge font-mono">
              <ThunderboltFilled class="score-icon" />
              <span>置信度 {{ (res.score * 100).toFixed(0) }}%</span>
            </div>
          </div>

          <div v-if="formatSubMetrics(res)" class="res-metrics-strip font-mono">
            <span>{{ formatSubMetrics(res) }}</span>
            <span v-if="res.rerankApplied" class="rerank-flag">BGE-Reranker 已精排</span>
          </div>

          <div class="res-content-box">
            <ChunkVisualPreview
              v-if="res.visualAssetUrl"
              :image-url="res.visualAssetUrl"
              :visual-type="res.visualType"
              :page-number="res.pageNumber"
              :caption="res.documentTitle"
              variant="full"
            />
            <p class="res-text">
              <ChunkHighlightText
                :content="res.content"
                :highlights="res.highlights"
                :keyword="lastExecutedQuery"
              />
            </p>
          </div>

          <div class="res-card-bottom">
            <div class="bottom-left">
              <span class="char-info font-mono">共 {{ res.charCount }} 字符</span>
              <div v-if="res.matchedTerms?.length" class="matched-terms-row">
                <span
                  v-for="term in res.matchedTerms.slice(0, 6)"
                  :key="term"
                  class="matched-term-chip font-mono"
                >
                  {{ term }}
                </span>
              </div>
            </div>
            <button
              type="button"
              class="context-preview-btn"
              @click="emit('open-context', res)"
            >
              <EyeOutlined />
              <span>查看命中上下文</span>
            </button>
          </div>
        </div>
      </div>

      <div v-else class="search-initial-hint">
        <ThunderboltOutlined class="hint-icon" />
        <p>输入问题执行评测，支持双路 RRF 召回对比、Rerank 精排与原文上下文定位</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  SearchOutlined,
  LoadingOutlined,
  InboxOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
  EyeOutlined,
} from '@ant-design/icons-vue'
import { searchKnowledgeBase } from '@/api/knowledge'
import type {
  KnowledgeDocumentItem,
  RagHitSource,
  RagSearchResultItem,
  RetrievalMode,
} from '@/interface/knowledge'
import ChunkHighlightText from './ChunkHighlightText.vue'
import ChunkVisualPreview from './ChunkVisualPreview.vue'

defineOptions({
  name: 'RetrievalPlayground',
})

const props = defineProps<{
  knowledgeBaseId: string
  documents: KnowledgeDocumentItem[]
}>()

const emit = defineEmits<{
  'open-context': [item: RagSearchResultItem]
}>()

const modeOptions: Array<{ value: RetrievalMode; label: string }> = [
  { value: 'hybrid', label: '混合' },
  { value: 'dense', label: '语义' },
  { value: 'sparse', label: '关键词' },
]

const query = ref('')
const lastExecutedQuery = ref('')
const mode = ref<RetrievalMode>('hybrid')
const limit = ref(6)
const minScore = ref(0)
const enableRerank = ref(true)
const selectedDocIds = ref<string[]>([])

const isSearching = ref(false)
const hasSearched = ref(false)
const results = ref<RagSearchResultItem[]>([])

const completedDocuments = computed(() =>
  props.documents.filter((doc) => doc.status === 'completed'),
)

watch(
  () => props.knowledgeBaseId,
  () => {
    results.value = []
    hasSearched.value = false
    selectedDocIds.value = []
    lastExecutedQuery.value = ''
  },
)

const handleSearch = async () => {
  const cleanQuery = query.value.trim()
  if (!cleanQuery || !props.knowledgeBaseId) return

  isSearching.value = true
  hasSearched.value = true
  lastExecutedQuery.value = cleanQuery

  try {
    const res = await searchKnowledgeBase({
      query: cleanQuery,
      knowledgeBaseIds: [props.knowledgeBaseId],
      documentIds: selectedDocIds.value.length > 0 ? selectedDocIds.value : undefined,
      limit: limit.value,
      mode: mode.value,
      minScore: minScore.value > 0 ? minScore.value : undefined,
      enableRerank: enableRerank.value,
    })
    results.value = res.data || []
  } catch (err: any) {
    message.error(err.message || '检索评测失败')
  } finally {
    isSearching.value = false
  }
}

const getHitSourceLabel = (source: RagHitSource): string => {
  switch (source) {
    case 'hybrid':
      return '双路共振'
    case 'dense':
      return '语义召回'
    case 'sparse':
      return '字面匹配'
  }
}

const formatSubMetrics = (item: RagSearchResultItem): string => {
  const parts: string[] = []
  if (item.rerankApplied && typeof item.rerankScore === 'number') {
    parts.push(`Rerank ${(item.rerankScore * 100).toFixed(0)}%`)
  }
  if (typeof item.denseScore === 'number') {
    parts.push(`Dense ${(item.denseScore * 100).toFixed(0)}% (#${item.denseRank ?? '-'})`)
  }
  if (typeof item.sparseRank === 'number') {
    parts.push(`Sparse (#${item.sparseRank})`)
  }
  return parts.join(' · ')
}
</script>

<style scoped lang="scss">
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.retrieval-playground {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-controls-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 6px 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
  }

  .input-search-icon {
    font-size: 16px;
    color: #94a3b8;
  }

  .stitch-query-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #0f172a;
    font-size: 14px;

    &::placeholder {
      color: #94a3b8;
    }
  }
}

.stitch-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  white-space: nowrap;

  &.primary {
    background: #2563eb;
    color: #ffffff;

    &:hover:not(:disabled) {
      background: #1d4ed8;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.params-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;

  .param-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    .param-label {
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      white-space: nowrap;
    }
  }

  .doc-filter-group {
    flex: 1;
    min-width: 180px;

    .doc-filter-select {
      width: 100%;
      max-width: 260px;
    }
  }
}

.param-select-sm {
  width: 78px;
}

.param-select-md {
  width: 92px;
}

.mode-segmented {
  display: inline-flex;
  background: #e2e8f0;
  padding: 2px;
  border-radius: 6px;
  gap: 2px;

  .mode-seg-btn {
    border: none;
    background: transparent;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;

    &.active {
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }
  }
}

.search-results-viewport {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-skeleton-box {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .result-skeleton-card {
    height: 112px;
    border-radius: 10px;
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
}

.results-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: border-color 0.15s;

  &:hover {
    border-color: #cbd5e1;
  }

  .res-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .res-meta-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex-wrap: wrap;

      .rank-badge {
        background: #eff6ff;
        color: #2563eb;
        border: 1px solid #dbeafe;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .doc-badge {
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chunk-badge {
        font-size: 11px;
        color: #64748b;
      }

      .hit-source-badge {
        font-size: 11px;
        font-weight: 500;
        padding: 1px 7px;
        border-radius: 4px;
        border: 1px solid transparent;

        &.hybrid {
          background: #eef2ff;
          color: #3730a3;
          border-color: #c7d2fe;
        }
        &.dense {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }
        &.sparse {
          background: #fef3c7;
          color: #92400e;
          border-color: #fde68a;
        }
      }
    }

    .res-score-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      color: #059669;
      background: #ecfdf5;
      border: 1px solid #d1fae5;
      padding: 2px 8px;
      border-radius: 6px;

      .score-icon {
        font-size: 11px;
        color: #10b981;
      }
    }
  }

  .res-metrics-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: #64748b;
    padding: 0 2px;

    .rerank-flag {
      color: #0f172a;
      background: #f1f5f9;
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
  }

  .res-content-box {
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    border-left: 3px solid #2563eb;
    padding: 10px 12px;
    border-radius: 6px;

    .res-text {
      font-size: 13px;
      line-height: 1.65;
      color: #334155;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  .res-card-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .bottom-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .char-info {
        font-size: 11px;
        color: #94a3b8;
      }

      .matched-terms-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;

        .matched-term-chip {
          font-size: 10.5px;
          color: #78350f;
          background: #fef3c7;
          border: 1px solid #fde68a;
          padding: 0 6px;
          border-radius: 4px;
        }
      }
    }

    .context-preview-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #0f172a;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;

      &:hover {
        background: #eff6ff;
        border-color: #93c5fd;
        color: #1d4ed8;
      }
    }
  }
}

.search-initial-hint,
.search-empty-box {
  padding: 48px;
  text-align: center;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .hint-icon,
  .empty-icon {
    font-size: 36px;
    color: #cbd5e1;
  }
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
