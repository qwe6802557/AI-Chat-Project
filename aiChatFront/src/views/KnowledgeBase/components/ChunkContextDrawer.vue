<template>
  <a-drawer
    v-model:open="visible"
    :title="activeMode === 'context' ? '命中切片上下文预览' : '文档语义切片审阅与治理'"
    placement="right"
    width="680"
    :destroy-on-close="true"
  >
    <!-- 模式一：命中上下文邻接窗预览 -->
    <template v-if="activeMode === 'context'">
      <div v-if="loadingContext && !contextData" class="drawer-loading-skeleton">
        <div v-for="i in 3" :key="i" class="chunk-skeleton-item" />
      </div>

      <div v-else-if="contextData" class="context-view">
        <div class="chunk-drawer-header">
          <div class="header-main-row">
            <h3 class="preview-doc-title">{{ contextData.document.title }}</h3>
            <button type="button" class="switch-mode-btn" @click="switchToFullDocument">
              <UnorderedListOutlined />
              <span>浏览整篇切片</span>
            </button>
          </div>
          <div class="preview-doc-meta font-mono">
            <span>总切片: {{ contextData.document.chunkCount }}</span>
            <span>总字符: {{ contextData.document.charCount }}</span>
            <span>当前窗口: ±{{ contextData.window }} 段</span>
          </div>
        </div>

        <div class="window-expand-row">
          <button
            type="button"
            class="expand-neighbor-btn"
            :disabled="!canExpandPrev || loadingContext"
            @click="expandWindow"
          >
            <UpOutlined />
            <span>{{ canExpandPrev ? '展开上一段上下文' : '已到文档首段' }}</span>
          </button>
        </div>

        <div class="chunk-list-stack">
          <div
            v-for="chunk in contextData.prevChunks"
            :key="chunk.id"
            :class="['chunk-card-item neighbor', { disabled: !isChunkEnabled(chunk) }]"
          >
            <div class="chunk-top-row">
              <div class="chunk-left-meta">
                <span class="chunk-idx font-mono">上文 · 切片 #{{ chunk.chunkIndex + 1 }}</span>
                <span class="chunk-chars font-mono">{{ chunk.charCount }} 字符</span>
              </div>
              <div class="chunk-actions">
                <a-switch
                  size="small"
                  :checked="isChunkEnabled(chunk)"
                  :loading="togglingChunkId === chunk.id"
                  @change="handleToggleEnabled(chunk)"
                />
                <button type="button" class="mini-action-btn" @click="startEdit(chunk)">
                  <EditOutlined />
                </button>
              </div>
            </div>
            <div v-if="editingChunkId === chunk.id" class="edit-box">
              <a-textarea v-model:value="editingContent" :rows="4" />
              <div class="edit-actions">
                <button type="button" class="cancel-edit-btn" @click="cancelEdit">取消</button>
                <button
                  type="button"
                  class="save-edit-btn"
                  :disabled="savingChunkId === chunk.id"
                  @click="saveEdit(chunk)"
                >
                  {{ savingChunkId === chunk.id ? '重算向量中...' : '保存并重算向量' }}
                </button>
              </div>
            </div>
            <div v-else class="chunk-content-body font-mono">
              <ChunkVisualPreview
                v-if="chunk.visualAssetUrl"
                :image-url="chunk.visualAssetUrl"
                :visual-type="chunk.visualType"
                :page-number="chunk.pageNumber"
                variant="full"
              />
              <ChunkHighlightText :content="chunk.content" :keyword="searchQuery" />
            </div>
          </div>

          <!-- 命中目标切片 -->
          <div
            ref="targetCardRef"
            :class="['chunk-card-item target-hit', { disabled: !isChunkEnabled(contextData.targetChunk) }]"
          >
            <div class="chunk-top-row">
              <div class="chunk-left-meta">
                <span class="target-tag">当前命中</span>
                <span class="chunk-idx font-mono">切片 #{{ contextData.targetChunk.chunkIndex + 1 }}</span>
                <span class="chunk-chars font-mono">{{ contextData.targetChunk.charCount }} 字符</span>
              </div>
              <div class="chunk-actions">
                <a-switch
                  size="small"
                  :checked="isChunkEnabled(contextData.targetChunk)"
                  :loading="togglingChunkId === contextData.targetChunk.id"
                  @change="handleToggleEnabled(contextData.targetChunk)"
                />
                <button
                  type="button"
                  class="mini-action-btn"
                  @click="startEdit(contextData.targetChunk)"
                >
                  <EditOutlined />
                </button>
              </div>
            </div>
            <div v-if="editingChunkId === contextData.targetChunk.id" class="edit-box">
              <a-textarea v-model:value="editingContent" :rows="5" />
              <div class="edit-actions">
                <button type="button" class="cancel-edit-btn" @click="cancelEdit">取消</button>
                <button
                  type="button"
                  class="save-edit-btn"
                  :disabled="savingChunkId === contextData.targetChunk.id"
                  @click="saveEdit(contextData.targetChunk)"
                >
                  {{ savingChunkId === contextData.targetChunk.id ? '重算向量中...' : '保存并重算向量' }}
                </button>
              </div>
            </div>
            <div v-else class="chunk-content-body font-mono">
              <ChunkVisualPreview
                v-if="contextData.targetChunk.visualAssetUrl"
                :image-url="contextData.targetChunk.visualAssetUrl"
                :visual-type="contextData.targetChunk.visualType"
                :page-number="contextData.targetChunk.pageNumber"
                variant="full"
              />
              <ChunkHighlightText
                :content="contextData.targetChunk.content"
                :highlights="highlights"
                :keyword="searchQuery"
              />
            </div>
          </div>

          <div
            v-for="chunk in contextData.nextChunks"
            :key="chunk.id"
            :class="['chunk-card-item neighbor', { disabled: !isChunkEnabled(chunk) }]"
          >
            <div class="chunk-top-row">
              <div class="chunk-left-meta">
                <span class="chunk-idx font-mono">下文 · 切片 #{{ chunk.chunkIndex + 1 }}</span>
                <span class="chunk-chars font-mono">{{ chunk.charCount }} 字符</span>
              </div>
              <div class="chunk-actions">
                <a-switch
                  size="small"
                  :checked="isChunkEnabled(chunk)"
                  :loading="togglingChunkId === chunk.id"
                  @change="handleToggleEnabled(chunk)"
                />
                <button type="button" class="mini-action-btn" @click="startEdit(chunk)">
                  <EditOutlined />
                </button>
              </div>
            </div>
            <div v-if="editingChunkId === chunk.id" class="edit-box">
              <a-textarea v-model:value="editingContent" :rows="4" />
              <div class="edit-actions">
                <button type="button" class="cancel-edit-btn" @click="cancelEdit">取消</button>
                <button
                  type="button"
                  class="save-edit-btn"
                  :disabled="savingChunkId === chunk.id"
                  @click="saveEdit(chunk)"
                >
                  {{ savingChunkId === chunk.id ? '重算向量中...' : '保存并重算向量' }}
                </button>
              </div>
            </div>
            <div v-else class="chunk-content-body font-mono">
              <ChunkVisualPreview
                v-if="chunk.visualAssetUrl"
                :image-url="chunk.visualAssetUrl"
                :visual-type="chunk.visualType"
                :page-number="chunk.pageNumber"
                variant="full"
              />
              <ChunkHighlightText :content="chunk.content" :keyword="searchQuery" />
            </div>
          </div>
        </div>

        <div class="window-expand-row">
          <button
            type="button"
            class="expand-neighbor-btn"
            :disabled="!canExpandNext || loadingContext"
            @click="expandWindow"
          >
            <DownOutlined />
            <span>{{ canExpandNext ? '展开下一段上下文' : '已到文档末段' }}</span>
          </button>
        </div>
      </div>
    </template>

    <!-- 模式二：文档完整切片分页浏览与治理 -->
    <template v-else>
      <div v-if="docTarget" class="chunk-drawer-header">
        <div class="header-main-row">
          <h3 class="preview-doc-title">{{ docTarget.title }}</h3>
          <button
            v-if="chunkId && contextData"
            type="button"
            class="switch-mode-btn"
            @click="activeMode = 'context'"
          >
            返回命中上下文
          </button>
        </div>
        <div class="preview-doc-meta font-mono">
          <span>总切片数: {{ docTarget.chunkCount }}</span>
          <span>总字符数: {{ docTarget.charCount }}</span>
        </div>

        <div class="doc-filter-bar">
          <a-input
            v-model:value="keywordInput"
            allow-clear
            placeholder="输入关键词筛选本篇切片..."
            class="chunk-keyword-input"
          >
            <template #prefix><SearchOutlined class="filter-icon" /></template>
          </a-input>
          <label class="enabled-filter-label">
            <a-switch v-model:checked="enabledOnly" size="small" />
            <span>仅看已启用</span>
          </label>
        </div>
      </div>

      <div v-if="loadingDocChunks" class="drawer-loading-skeleton">
        <div v-for="i in 5" :key="i" class="chunk-skeleton-item" />
      </div>

      <div v-else-if="chunks.length === 0" class="drawer-empty">
        <InboxOutlined class="empty-icon" />
        <p>暂无符合条件的切片数据</p>
      </div>

      <div v-else class="chunk-list-stack">
        <div
          v-for="chunk in chunks"
          :key="chunk.id"
          :class="[
            'chunk-card-item',
            {
              'target-hit': chunk.id === chunkId,
              disabled: !isChunkEnabled(chunk),
            },
          ]"
        >
          <div class="chunk-top-row">
            <div class="chunk-left-meta">
              <span v-if="chunk.id === chunkId" class="target-tag">命中</span>
              <span class="chunk-idx font-mono">切片 #{{ chunk.chunkIndex + 1 }}</span>
              <span class="chunk-chars font-mono">{{ chunk.charCount }} 字符</span>
              <span v-if="!isChunkEnabled(chunk)" class="disabled-tag">已停用</span>
            </div>
            <div class="chunk-actions">
              <a-switch
                size="small"
                :checked="isChunkEnabled(chunk)"
                :loading="togglingChunkId === chunk.id"
                title="启用或停用此切片"
                @change="handleToggleEnabled(chunk)"
              />
              <button
                type="button"
                class="mini-action-btn"
                title="编辑正文并重算向量"
                @click="startEdit(chunk)"
              >
                <EditOutlined />
                <span>编辑</span>
              </button>
            </div>
          </div>

          <div v-if="editingChunkId === chunk.id" class="edit-box">
            <a-textarea v-model:value="editingContent" :rows="5" />
            <div class="edit-actions">
              <button type="button" class="cancel-edit-btn" @click="cancelEdit">取消</button>
              <button
                type="button"
                class="save-edit-btn"
                :disabled="savingChunkId === chunk.id"
                @click="saveEdit(chunk)"
              >
                {{ savingChunkId === chunk.id ? '重算向量中...' : '保存并重算向量' }}
              </button>
            </div>
          </div>

          <div v-else class="chunk-content-body font-mono">
            <ChunkVisualPreview
              v-if="chunk.visualAssetUrl"
              :image-url="chunk.visualAssetUrl"
              :visual-type="chunk.visualType"
              :page-number="chunk.pageNumber"
              variant="full"
            />
            <ChunkHighlightText
              :content="chunk.content"
              :highlights="chunk.id === chunkId ? highlights : undefined"
              :keyword="keywordInput"
            />
          </div>
        </div>
      </div>

      <div v-if="totalChunks > 0" class="drawer-pagination">
        <a-pagination
          v-model:current="page"
          v-model:pageSize="pageSize"
          :total="totalChunks"
          size="small"
          show-size-changer
          :page-size-options="['10', '20', '50']"
          @change="fetchDocChunks"
        />
      </div>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  SearchOutlined,
  InboxOutlined,
  EditOutlined,
  UpOutlined,
  DownOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue'
import {
  getKnowledgeChunkContext,
  getKnowledgeChunks,
  updateKnowledgeChunk,
} from '@/api/knowledge'
import type {
  ChunkContextResponse,
  HighlightSpan,
  KnowledgeChunkItem,
  KnowledgeDocumentItem,
} from '@/interface/knowledge'
import ChunkHighlightText from './ChunkHighlightText.vue'
import ChunkVisualPreview from './ChunkVisualPreview.vue'

defineOptions({
  name: 'ChunkContextDrawer',
})

const props = defineProps<{
  open: boolean
  mode: 'context' | 'document'
  chunkId?: string | null
  document?: KnowledgeDocumentItem | null
  highlights?: HighlightSpan[]
  searchQuery?: string
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
  'chunk-updated': []
}>()

const visible = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const activeMode = ref<'context' | 'document'>('document')

// 上下文预览状态
const contextData = ref<ChunkContextResponse | null>(null)
const loadingContext = ref(false)
const contextWindow = ref(1)
const targetCardRef = ref<HTMLElement | null>(null)

// 文档切片列表状态
const docTarget = ref<{ id: string; title: string; chunkCount: number; charCount: number } | null>(null)
const chunks = ref<KnowledgeChunkItem[]>([])
const totalChunks = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keywordInput = ref('')
const enabledOnly = ref(false)
const loadingDocChunks = ref(false)

// 就地编辑与启停状态
const editingChunkId = ref<string | null>(null)
const editingContent = ref('')
const savingChunkId = ref<string | null>(null)
const togglingChunkId = ref<string | null>(null)

let filterTimer: number | null = null

const isChunkEnabled = (chunk: KnowledgeChunkItem) => chunk.isEnabled !== false

const canExpandPrev = computed(() => {
  if (!contextData.value) return false
  const firstIdx =
    contextData.value.prevChunks[0]?.chunkIndex ?? contextData.value.targetChunk.chunkIndex
  return firstIdx > 0 && contextData.value.window < 5
})

const canExpandNext = computed(() => {
  if (!contextData.value) return false
  const lastChunk =
    contextData.value.nextChunks[contextData.value.nextChunks.length - 1] ??
    contextData.value.targetChunk
  return (
    lastChunk.chunkIndex < contextData.value.document.chunkCount - 1 &&
    contextData.value.window < 5
  )
})

const fetchContext = async (scrollToTarget = false) => {
  if (!props.chunkId) return
  loadingContext.value = true
  try {
    const res = await getKnowledgeChunkContext(props.chunkId, contextWindow.value)
    contextData.value = res.data
    if (scrollToTarget) {
      await nextTick()
      targetCardRef.value?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }
  } catch (err: any) {
    message.error(err.message || '加载切片上下文失败')
  } finally {
    loadingContext.value = false
  }
}

const fetchDocChunks = async () => {
  if (!docTarget.value?.id) return
  loadingDocChunks.value = true
  try {
    const res = await getKnowledgeChunks(docTarget.value.id, page.value, pageSize.value, {
      keyword: keywordInput.value.trim() || undefined,
      enabledOnly: enabledOnly.value,
    })
    chunks.value = res.data?.items || []
    totalChunks.value = res.data?.total ?? chunks.value.length
  } catch (err: any) {
    message.error(err.message || '获取切片列表失败')
  } finally {
    loadingDocChunks.value = false
  }
}

const initializeDrawer = () => {
  editingChunkId.value = null
  contextWindow.value = 1
  activeMode.value = props.mode

  if (props.mode === 'context' && props.chunkId) {
    contextData.value = null
    fetchContext(true)
    return
  }

  if (props.document) {
    docTarget.value = {
      id: props.document.id,
      title: props.document.title,
      chunkCount: props.document.chunkCount,
      charCount: props.document.charCount,
    }
    page.value = 1
    keywordInput.value = ''
    enabledOnly.value = false
    fetchDocChunks()
  }
}

watch(
  () => [props.open, props.mode, props.chunkId, props.document?.id] as const,
  ([isOpen]) => {
    if (isOpen) {
      initializeDrawer()
    }
  },
)

watch(keywordInput, () => {
  if (!visible.value || activeMode.value !== 'document') return
  if (filterTimer) window.clearTimeout(filterTimer)
  filterTimer = window.setTimeout(() => {
    page.value = 1
    fetchDocChunks()
  }, 300)
})

watch(enabledOnly, () => {
  if (!visible.value || activeMode.value !== 'document') return
  page.value = 1
  fetchDocChunks()
})

onBeforeUnmount(() => {
  if (filterTimer) window.clearTimeout(filterTimer)
})

const expandWindow = () => {
  if (contextWindow.value >= 5) return
  contextWindow.value += 1
  fetchContext(false)
}

const switchToFullDocument = () => {
  if (!contextData.value) return
  const doc = contextData.value.document
  docTarget.value = {
    id: doc.id,
    title: doc.title,
    chunkCount: doc.chunkCount,
    charCount: doc.charCount,
  }
  page.value = Math.floor(contextData.value.targetChunk.chunkIndex / pageSize.value) + 1
  keywordInput.value = ''
  enabledOnly.value = false
  activeMode.value = 'document'
  fetchDocChunks()
}

const syncUpdatedChunk = (updated: KnowledgeChunkItem) => {
  chunks.value = chunks.value.map((c) => (c.id === updated.id ? updated : c))
  if (contextData.value) {
    if (contextData.value.targetChunk.id === updated.id) {
      contextData.value.targetChunk = updated
    }
    contextData.value.prevChunks = contextData.value.prevChunks.map((c) =>
      c.id === updated.id ? updated : c,
    )
    contextData.value.nextChunks = contextData.value.nextChunks.map((c) =>
      c.id === updated.id ? updated : c,
    )
  }
}

const handleToggleEnabled = async (chunk: KnowledgeChunkItem) => {
  togglingChunkId.value = chunk.id
  const nextEnabled = !isChunkEnabled(chunk)
  try {
    const res = await updateKnowledgeChunk(chunk.id, { isEnabled: nextEnabled })
    syncUpdatedChunk(res.data)
    message.success(nextEnabled ? '切片已恢复参与召回' : '切片已停用')
    emit('chunk-updated')
  } catch (err: any) {
    message.error(err.message || '更新切片状态失败')
  } finally {
    togglingChunkId.value = null
  }
}

const startEdit = (chunk: KnowledgeChunkItem) => {
  editingChunkId.value = chunk.id
  editingContent.value = chunk.content
}

const cancelEdit = () => {
  editingChunkId.value = null
  editingContent.value = ''
}

const saveEdit = async (chunk: KnowledgeChunkItem) => {
  const trimmed = editingContent.value.trim()
  if (!trimmed) {
    message.warning('切片正文不能为空')
    return
  }

  savingChunkId.value = chunk.id
  try {
    const res = await updateKnowledgeChunk(chunk.id, { content: trimmed })
    syncUpdatedChunk(res.data)
    editingChunkId.value = null
    message.success('切片正文已更新并重算向量')
    emit('chunk-updated')
  } catch (err: any) {
    message.error(err.message || '保存切片失败')
  } finally {
    savingChunkId.value = null
  }
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

.chunk-drawer-header {
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 14px;

  .header-main-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .preview-doc-title {
    font-size: 16px;
    font-weight: 600;
    color: #0f172a;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-doc-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    font-size: 12px;
    color: #64748b;
  }
}

.switch-mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    border-color: #2563eb;
    color: #2563eb;
  }
}

.doc-filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;

  .chunk-keyword-input {
    flex: 1;
  }

  .filter-icon {
    color: #94a3b8;
  }

  .enabled-filter-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #475569;
    white-space: nowrap;
    cursor: pointer;
  }
}

.window-expand-row {
  display: flex;
  justify-content: center;
  margin: 8px 0;

  .expand-neighbor-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    font-size: 12px;
    color: #475569;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 6px;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: #2563eb;
      color: #2563eb;
      background: #eff6ff;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.drawer-loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .chunk-skeleton-item {
    height: 84px;
    border-radius: 8px;
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
}

.drawer-empty {
  padding: 48px;
  text-align: center;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .empty-icon {
    font-size: 32px;
    color: #cbd5e1;
  }
}

.chunk-list-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chunk-card-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  background: #f8fafc;
  transition: border-color 0.2s, opacity 0.2s;

  &.neighbor {
    background: #ffffff;
  }

  &.target-hit {
    background: #eff6ff;
    border-color: #93c5fd;
    border-left: 4px solid #2563eb;
  }

  &.disabled {
    opacity: 0.58;
  }

  .chunk-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #64748b;
    margin-bottom: 8px;

    .chunk-left-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .target-tag {
      background: #2563eb;
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .chunk-idx {
      font-weight: 600;
      color: #1d4ed8;
    }

    .disabled-tag {
      color: #dc2626;
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 0 5px;
      border-radius: 4px;
    }

    .chunk-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .chunk-content-body {
    font-size: 12px;
    line-height: 1.65;
    color: #1e293b;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.mini-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #475569;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    border-color: #2563eb;
    color: #2563eb;
  }
}

.edit-box {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;

    .cancel-edit-btn,
    .save-edit-btn {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
    }

    .cancel-edit-btn {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #475569;
    }

    .save-edit-btn {
      background: #2563eb;
      border: 1px solid #1d4ed8;
      color: #ffffff;

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  }
}

.drawer-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
