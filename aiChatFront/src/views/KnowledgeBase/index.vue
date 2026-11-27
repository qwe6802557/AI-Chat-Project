<template>
  <div class="kb-workbench-layout">
    <div class="kb-main-container">
      <!-- 顶部信息与全局操作栏 -->
      <header class="kb-header-section">
        <div class="header-left">
          <div class="title-row">
            <DatabaseOutlined class="page-icon" />
            <h1 class="page-title">RAG 知识库工作台</h1>
          </div>
          <p class="page-subtitle">
            基于混合双路召回、RRF 融合与 BGE-Reranker 精排，为大模型注入高可信私域知识。
          </p>
        </div>
        <div class="header-actions">
          <button type="button" class="stitch-btn primary" @click="handleOpenCreateModal">
            <PlusOutlined class="btn-icon" />
            <span>新建知识库</span>
          </button>
        </div>
      </header>

      <div class="kb-body-grid">
        <!-- 左侧：知识库卡片列表 -->
        <section class="kb-sidebar-column">
          <div class="column-header">
            <span class="column-title">知识库列表 ({{ knowledgeBases.length }})</span>
            <button
              type="button"
              class="icon-action-btn"
              title="刷新列表"
              :disabled="loadingBases || isRefreshing"
              @click="handleManualRefresh"
            >
              <ReloadOutlined :spin="loadingBases || isRefreshing" />
            </button>
          </div>

          <div v-if="loadingBases && knowledgeBases.length === 0" class="skeleton-list">
            <div v-for="i in 3" :key="i" class="kb-skeleton-card" />
          </div>

          <div v-else-if="knowledgeBases.length === 0" class="empty-kb-box">
            <InboxOutlined class="empty-icon" />
            <p>暂无知识库，点击上方新建</p>
          </div>

          <div v-else class="kb-cards-stack">
            <div
              v-for="kb in knowledgeBases"
              :key="kb.id"
              :class="['kb-item-card', { active: currentKb?.id === kb.id }]"
              @click="selectKnowledgeBase(kb)"
            >
              <div class="card-top">
                <div class="kb-avatar">
                  <DatabaseOutlined />
                </div>
                <div class="kb-meta">
                  <span class="kb-name" :title="kb.name">{{ kb.name }}</span>
                  <span class="kb-desc" :title="kb.description || '暂无描述'">
                    {{ kb.description || '暂无描述' }}
                  </span>
                </div>
              </div>
              <div class="card-bottom">
                <div class="stats-pills">
                  <span class="stat-pill">
                    <FileTextOutlined class="pill-icon" />
                    <span>{{ kb.documentCount }} 文档</span>
                  </span>
                  <span class="stat-pill">
                    <ApartmentOutlined class="pill-icon" />
                    <span>{{ kb.chunkCount }} 切片</span>
                  </span>
                </div>
                <div class="card-actions" @click.stop>
                  <button
                    type="button"
                    class="card-action-icon danger"
                    title="删除知识库"
                    @click="handleDeleteKnowledgeBase(kb)"
                  >
                    <DeleteOutlined />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 右侧：当前知识库详情工作区 -->
        <section v-if="currentKb" class="kb-detail-column">
          <div class="detail-header-tabs">
            <div class="tab-buttons">
              <button
                type="button"
                :class="['tab-pill', { active: activeTab === 'documents' }]"
                @click="activeTab = 'documents'"
              >
                <FileTextOutlined />
                <span>文档管理 ({{ currentDocuments.length }})</span>
              </button>
              <button
                type="button"
                :class="['tab-pill', { active: activeTab === 'test' }]"
                @click="activeTab = 'test'"
              >
                <SearchOutlined />
                <span>混合检索评测</span>
              </button>
            </div>
            <div class="current-kb-indicator">
              <span class="label">当前:</span>
              <span class="name">{{ currentKb.name }}</span>
            </div>
          </div>

          <!-- Tab 1: 文档管理与解析入库 -->
          <div v-show="activeTab === 'documents'" class="tab-panel">
            <div
              class="upload-dropzone"
              :class="{ dragging: isDragging, uploading: isUploading }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleFileDrop"
              @click="triggerDocUpload"
            >
              <input
                ref="docFileInputRef"
                type="file"
                class="hidden-file-input"
                accept=".pdf,.docx,.md,.txt,.png,.jpg,.jpeg,.webp"
                @change="handleFileInputChange"
              />
              <CloudUploadOutlined class="upload-icon" />
              <div class="upload-texts">
                <span class="primary-text">
                  {{ isUploading ? '正在上传文件并加入后台解析队列...' : '点击或拖拽文件至此上传解析' }}
                </span>
                <span class="secondary-text">
                  支持 PDF（含图表智能识别）、DOCX、Markdown、TXT 及 PNG/JPG/WEBP 图片，异步完成视觉提取与 BGE-M3 向量化
                </span>
              </div>
            </div>

            <div class="documents-table-wrapper">
              <div class="table-header-row">
                <span class="col-title col-name">文档名称</span>
                <span class="col-title col-type">类型</span>
                <span class="col-title col-size">大小</span>
                <span class="col-title col-chunks">切片数</span>
                <span class="col-title col-chars">字符数</span>
                <span class="col-title col-status">状态</span>
                <span class="col-title col-actions">操作</span>
              </div>

              <div v-if="loadingDocs && currentDocuments.length === 0" class="table-loading-skeleton">
                <div v-for="i in 4" :key="i" class="table-row-skeleton" />
              </div>

              <div v-else-if="currentDocuments.length === 0" class="table-empty">
                <InboxOutlined class="empty-icon" />
                <p>该知识库暂无文档，请上传文件</p>
              </div>

              <div v-else class="table-body">
                <div
                  v-for="doc in currentDocuments"
                  :key="doc.id"
                  class="table-data-row"
                >
                  <div class="col-cell col-name" :title="doc.title">
                    <PictureOutlined v-if="isImageDoc(doc)" class="doc-icon" />
                    <FileTextOutlined v-else class="doc-icon" />
                    <span class="doc-title-text">{{ doc.title }}</span>
                  </div>
                  <div class="col-cell col-type">
                    <span class="type-tag">{{ doc.fileType.toUpperCase() }}</span>
                  </div>
                  <div class="col-cell col-size font-mono">
                    {{ formatFileSize(doc.fileSize) }}
                  </div>
                  <div class="col-cell col-chunks font-mono">
                    {{ doc.chunkCount }}
                  </div>
                  <div class="col-cell col-chars font-mono">
                    {{ doc.charCount }}
                  </div>
                  <div class="col-cell col-status">
                    <div class="status-cell-inner">
                      <span
                        :class="['status-badge', doc.status]"
                        :title="doc.status === 'failed' ? doc.errorMessage || '解析失败' : undefined"
                      >
                        <CheckCircleOutlined v-if="doc.status === 'completed'" />
                        <SyncOutlined
                          v-else-if="doc.status === 'processing' || doc.status === 'pending'"
                          :spin="doc.status === 'processing'"
                        />
                        <CloseCircleOutlined v-else-if="doc.status === 'failed'" />
                        <ClockCircleOutlined v-else />
                        <span>{{ getStatusText(doc) }}</span>
                      </span>
                      <div
                        v-if="doc.status === 'pending' || doc.status === 'processing'"
                        class="doc-progress-track"
                      >
                        <div
                          class="doc-progress-fill"
                          :style="{ width: `${Math.min(100, Math.max(0, doc.progress ?? 0))}%` }"
                        />
                      </div>
                      <span
                        v-else-if="doc.status === 'failed' && doc.errorMessage"
                        class="doc-error-hint"
                        :title="doc.errorMessage"
                      >
                        {{ doc.errorMessage }}
                      </span>
                    </div>
                  </div>
                  <div class="col-cell col-actions">
                    <button
                      type="button"
                      class="text-btn"
                      :disabled="doc.status !== 'completed'"
                      :title="doc.status === 'completed' ? '预览与治理切片' : '文档解析完成后可预览'"
                      @click="handlePreviewChunks(doc)"
                    >
                      预览切片
                    </button>
                    <button
                      v-if="doc.status === 'failed'"
                      type="button"
                      class="text-btn retry"
                      title="重新解析入库"
                      @click="handleRetryDocument(doc)"
                    >
                      重试
                    </button>
                    <button
                      type="button"
                      class="text-btn danger"
                      title="删除文档"
                      @click="handleDeleteDocument(doc)"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 2: 混合检索评测控制台 -->
          <div v-show="activeTab === 'test'" class="tab-panel">
            <RetrievalPlayground
              :knowledge-base-id="currentKb.id"
              :documents="currentDocuments"
              @open-context="handleOpenHitContext"
            />
          </div>
        </section>

        <section v-else class="kb-detail-column empty-selection">
          <DatabaseOutlined class="watermark-icon" />
          <p>请在左侧选择知识库或新建知识库</p>
        </section>
      </div>
    </div>

    <!-- 新建知识库弹窗 -->
    <a-modal
      v-model:open="showCreateModal"
      title="新建 RAG 知识库"
      :confirm-loading="creating"
      ok-text="确认创建"
      cancel-text="取消"
      @ok="handleConfirmCreate"
    >
      <div class="modal-form">
        <div class="form-field">
          <label class="field-label">知识库名称 <span class="required">*</span></label>
          <a-input
            v-model:value="createForm.name"
            placeholder="例如: 智能投研知识库、产品开发手册"
            maxlength="60"
          />
        </div>
        <div class="form-field">
          <label class="field-label">描述说明</label>
          <a-textarea
            v-model:value="createForm.description"
            placeholder="简要描述知识库覆盖的业务领域与数据类型..."
            :rows="3"
            maxlength="200"
          />
        </div>
      </div>
    </a-modal>

    <!-- 切片上下文预览与治理抽屉 -->
    <ChunkContextDrawer
      v-model:open="showChunkDrawer"
      :mode="drawerMode"
      :chunk-id="drawerChunkId"
      :document="previewDoc"
      :highlights="drawerHighlights"
      @chunk-updated="handleChunkUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onActivated, onDeactivated, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { message, Modal } from 'ant-design-vue'
import {
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
  FileTextOutlined,
  PictureOutlined,
  ApartmentOutlined,
  DeleteOutlined,
  CloudUploadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons-vue'
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeDocuments,
  uploadKnowledgeDocument,
  retryKnowledgeDocument,
  deleteKnowledgeDocument,
  subscribeKnowledgeDocumentEvents,
} from '@/api/knowledge'
import { useKnowledgeStore } from '@/stores'
import type {
  DocumentProgressStreamEvent,
  HighlightSpan,
  KnowledgeBaseItem,
  KnowledgeDocumentItem,
  RagSearchResultItem,
} from '@/interface/knowledge'
import RetrievalPlayground from './components/RetrievalPlayground.vue'
import ChunkContextDrawer from './components/ChunkContextDrawer.vue'

defineOptions({
  name: 'KnowledgeBaseWorkbench',
})

const knowledgeStore = useKnowledgeStore()
const { knowledgeBases, loading: loadingBases, isRefreshing } = storeToRefs(knowledgeStore)
const currentKb = ref<KnowledgeBaseItem | null>(null)

const activeTab = ref<'documents' | 'test'>('documents')
const loadingDocs = ref(false)
const currentDocuments = ref<KnowledgeDocumentItem[]>([])

const isDragging = ref(false)
const isUploading = ref(false)
const docFileInputRef = ref<HTMLInputElement | null>(null)

const showCreateModal = ref(false)
const creating = ref(false)
const createForm = reactive({
  name: '',
  description: '',
})

// 切片预览 / 上下文抽屉状态
const showChunkDrawer = ref(false)
const drawerMode = ref<'context' | 'document'>('document')
const drawerChunkId = ref<string | null>(null)
const drawerHighlights = ref<HighlightSpan[] | undefined>(undefined)
const previewDoc = ref<KnowledgeDocumentItem | null>(null)

let documentEventHandle: { abort: () => void } | null = null

const stopDocumentEventStream = () => {
  if (documentEventHandle) {
    documentEventHandle.abort()
    documentEventHandle = null
  }
}

const applyDocumentEvent = (event: DocumentProgressStreamEvent) => {
  if (event.type === 'error') return

  if (event.type === 'snapshot') {
    if (currentKb.value?.id !== event.knowledgeBaseId) return
    const snapshotMap = new Map(event.documents.map((d) => [d.documentId, d]))
    currentDocuments.value = currentDocuments.value.map((doc) => {
      const snap = snapshotMap.get(doc.id)
      if (!snap) return doc
      return {
        ...doc,
        status: snap.status,
        stage: snap.stage,
        progress: snap.progress,
        chunkCount: snap.chunkCount ?? doc.chunkCount,
        charCount: snap.charCount ?? doc.charCount,
        errorMessage: snap.errorMessage ?? undefined,
      }
    })
    return
  }

  if (currentKb.value?.id !== event.knowledgeBaseId) return

  const targetIdx = currentDocuments.value.findIndex((d) => d.id === event.documentId)
  if (targetIdx === -1) {
    void fetchDocuments(event.knowledgeBaseId)
  } else {
    const existing = currentDocuments.value[targetIdx]
    if (existing) {
      currentDocuments.value[targetIdx] = {
        ...existing,
        status: event.status,
        stage: event.stage,
        progress: event.progress,
        processedChunks: event.processedChunks,
        totalChunks: event.totalChunks,
        processedVisuals: event.processedVisuals,
        totalVisuals: event.totalVisuals,
        chunkCount: event.chunkCount ?? existing.chunkCount,
        charCount: event.charCount ?? existing.charCount,
        errorMessage: event.errorMessage ?? undefined,
      }
    }
  }

  if (event.type === 'completed') {
    void fetchKnowledgeBases(true, true)
  }
}

const startDocumentEventStream = (kbId: string) => {
  stopDocumentEventStream()
  documentEventHandle = subscribeKnowledgeDocumentEvents(kbId, {
    onEvent: applyDocumentEvent,
  })
}

const selectKnowledgeBase = (kb: KnowledgeBaseItem) => {
  if (currentKb.value?.id !== kb.id) {
    currentDocuments.value = []
  }
  currentKb.value = kb
  void fetchDocuments(kb.id)
  startDocumentEventStream(kb.id)
}

const fetchKnowledgeBases = async (force = false, silent = true) => {
  if (knowledgeBases.value.length > 0 && !currentKb.value) {
    const firstKb = knowledgeBases.value[0]
    if (firstKb) {
      selectKnowledgeBase(firstKb)
    }
  }
  const list = await knowledgeStore.fetchKnowledgeBases(force, silent)
  if (list && list.length > 0) {
    if (!currentKb.value || !list.some((b) => b.id === currentKb.value?.id)) {
      const firstKb = list[0]
      if (firstKb) {
        selectKnowledgeBase(firstKb)
      }
    } else {
      const updated = list.find((b) => b.id === currentKb.value?.id)
      if (updated) currentKb.value = updated
    }
  } else if (!list || list.length === 0) {
    currentKb.value = null
  }
}

const handleManualRefresh = async () => {
  await fetchKnowledgeBases(true, false)
}

const fetchDocuments = async (kbId: string) => {
  loadingDocs.value = true
  try {
    const res = await getKnowledgeDocuments(kbId)
    currentDocuments.value = res.data || []
  } catch (err: any) {
    message.error(err.message || '加载文档列表失败')
  } finally {
    loadingDocs.value = false
  }
}

const handleOpenCreateModal = () => {
  createForm.name = ''
  createForm.description = ''
  showCreateModal.value = true
}

const handleConfirmCreate = async () => {
  if (!createForm.name.trim()) {
    message.warning('请输入知识库名称')
    return
  }
  creating.value = true
  try {
    const res = await createKnowledgeBase({
      name: createForm.name.trim(),
      description: createForm.description.trim(),
    })
    message.success('知识库创建成功')
    showCreateModal.value = false
    await fetchKnowledgeBases(true, true)
    if (res.data) {
      selectKnowledgeBase(res.data)
    }
  } catch (err: any) {
    message.error(err.message || '创建失败')
  } finally {
    creating.value = false
  }
}

const handleDeleteKnowledgeBase = (kb: KnowledgeBaseItem) => {
  Modal.confirm({
    title: '确认删除知识库',
    content: `删除知识库 "${kb.name}" 将同时清空其下所有文档和向量切片，且不可恢复。确认继续？`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteKnowledgeBase(kb.id)
        message.success('知识库删除成功')
        if (currentKb.value?.id === kb.id) {
          currentKb.value = null
        }
        await fetchKnowledgeBases(true, true)
      } catch (err: any) {
        message.error(err.message || '删除失败')
      }
    },
  })
}

const triggerDocUpload = () => {
  if (isUploading.value) return
  docFileInputRef.value?.click()
}

const handleFileInputChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    uploadDocFile(file)
    target.value = ''
  }
}

const handleFileDrop = (e: DragEvent) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    uploadDocFile(file)
  }
}

const uploadDocFile = async (file: File) => {
  if (!currentKb.value) {
    message.warning('请先选择知识库')
    return
  }
  const targetKbId = currentKb.value.id
  isUploading.value = true
  try {
    const res = await uploadKnowledgeDocument(targetKbId, file)
    if (res.data && currentKb.value?.id === targetKbId) {
      const idx = currentDocuments.value.findIndex((d) => d.id === res.data.id)
      if (idx >= 0) {
        currentDocuments.value[idx] = res.data
      } else {
        currentDocuments.value = [res.data, ...currentDocuments.value]
      }
    }
    message.success(`文档 "${file.name}" 已上传，正在后台排队解析`)
  } catch (err: unknown) {
    message.error(err instanceof Error ? err.message : '上传失败')
  } finally {
    isUploading.value = false
  }
}

const handleRetryDocument = async (doc: KnowledgeDocumentItem) => {
  try {
    const res = await retryKnowledgeDocument(doc.id)
    if (res.data) {
      const idx = currentDocuments.value.findIndex((d) => d.id === doc.id)
      if (idx >= 0) {
        currentDocuments.value[idx] = res.data
      }
    }
    message.success(`已重新加入解析队列: ${doc.title}`)
  } catch (err: unknown) {
    message.error(err instanceof Error ? err.message : '重试失败')
  }
}

const handleDeleteDocument = (doc: KnowledgeDocumentItem) => {
  Modal.confirm({
    title: '删除文档',
    content: `确认删除文档 "${doc.title}" 及其所有切片？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteKnowledgeDocument(doc.id)
        message.success('文档删除成功')
        if (currentKb.value) {
          await fetchDocuments(currentKb.value.id)
          await fetchKnowledgeBases(true, true)
        }
      } catch (err: any) {
        message.error(err.message || '删除失败')
      }
    },
  })
}

const handlePreviewChunks = (doc: KnowledgeDocumentItem) => {
  if (doc.status !== 'completed') return
  drawerMode.value = 'document'
  drawerChunkId.value = null
  drawerHighlights.value = undefined
  previewDoc.value = doc
  showChunkDrawer.value = true
}

const handleOpenHitContext = (item: RagSearchResultItem) => {
  drawerMode.value = 'context'
  drawerChunkId.value = item.chunkId
  drawerHighlights.value = item.highlights
  previewDoc.value = null
  showChunkDrawer.value = true
}

const handleChunkUpdated = async () => {
  if (currentKb.value) {
    await fetchDocuments(currentKb.value.id)
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isImageDoc = (doc: KnowledgeDocumentItem): boolean => {
  return ['png', 'jpg', 'jpeg', 'webp'].includes((doc.fileType || '').toLowerCase())
}

const getStatusText = (doc: KnowledgeDocumentItem): string => {
  if (doc.status === 'completed') return '已完成'
  if (doc.status === 'failed') return '失败'
  const pct = Math.min(100, Math.max(0, doc.progress ?? 0))
  switch (doc.stage) {
    case 'parsing':
      return `提取内容 ${pct}%`
    case 'vision_extracting':
      if (doc.totalVisuals) {
        return `视觉解析 ${doc.processedVisuals ?? 0}/${doc.totalVisuals} (${pct}%)`
      }
      return `视觉解析 ${pct}%`
    case 'chunking':
      return `语义切片 ${pct}%`
    case 'embedding':
      if (doc.totalChunks) {
        return `向量化 ${doc.processedChunks ?? 0}/${doc.totalChunks} (${pct}%)`
      }
      return `向量化 ${pct}%`
    case 'saving':
      return `写入索引 ${pct}%`
    case 'queued':
    default:
      return doc.status === 'processing' ? `解析中 ${pct}%` : '排队中'
  }
}

onMounted(() => {
  void fetchKnowledgeBases()
})

onActivated(() => {
  void fetchKnowledgeBases()
  if (currentKb.value && !documentEventHandle) {
    startDocumentEventStream(currentKb.value.id)
  }
})

onDeactivated(() => {
  stopDocumentEventStream()
})

onBeforeUnmount(() => {
  stopDocumentEventStream()
})
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

.kb-workbench-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background-color: #f8fafc;
  color: #1e293b;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.kb-main-container {
  flex: 1;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.kb-header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid #e2e8f0;

  .header-left {
    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;

      .page-icon {
        font-size: 24px;
        color: #2563eb;
      }

      .page-title {
        font-size: 22px;
        font-weight: 600;
        margin: 0;
        color: #0f172a;
        letter-spacing: -0.02em;
      }
    }

    .page-subtitle {
      margin: 6px 0 0;
      font-size: 13px;
      color: #64748b;
    }
  }
}

.stitch-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid transparent;

  &.primary {
    background: #2563eb;
    color: #ffffff;
    box-shadow: 0 1px 2px rgba(37, 99, 235, 0.15);

    &:hover:not(:disabled) {
      background: #1d4ed8;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
    }
    &:active:not(:disabled) {
      transform: translateY(1px);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.kb-body-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  align-items: start;

  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
}

.kb-sidebar-column {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 12px;

  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px 8px;
    border-bottom: 1px solid #f1f5f9;

    .column-title {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }

    .icon-action-btn {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.15s;

      &:hover {
        color: #0f172a;
        background: #f1f5f9;
      }
    }
  }
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .kb-skeleton-card {
    height: 84px;
    border-radius: 10px;
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
}

.empty-kb-box {
  padding: 40px 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .empty-icon {
    font-size: 32px;
    color: #cbd5e1;
  }
}

.kb-cards-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kb-item-card {
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: #93c5fd;
    background: #f8fafc;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  }

  &.active {
    border-color: #2563eb;
    background: #eff6ff;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);

    .card-top .kb-avatar {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }

    .card-top .kb-meta .kb-name {
      color: #1d4ed8;
    }

    .card-bottom .stats-pills .stat-pill {
      background: #ffffff;
      border-color: #bfdbfe;
      color: #2563eb;
    }
  }

  .card-top {
    display: flex;
    gap: 12px;
    align-items: flex-start;

    .kb-avatar {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #dbeafe;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      transition: all 0.2s;
    }

    .kb-meta {
      flex: 1;
      min-width: 0;

      .kb-name {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .kb-desc {
        display: block;
        font-size: 12px;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 2px;
      }
    }
  }

  .card-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #f1f5f9;

    .stats-pills {
      display: flex;
      gap: 8px;

      .stat-pill {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 500;
        color: #64748b;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 2px 7px;
        border-radius: 4px;

        .pill-icon {
          font-size: 11px;
        }
      }
    }

    .card-actions {
      .card-action-icon {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.15s;

        &.danger:hover {
          color: #ef4444;
          background: #fef2f2;
        }
      }
    }
  }
}

.kb-detail-column {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  min-height: 620px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 20px;

  &.empty-selection {
    align-items: center;
    justify-content: center;
    color: #64748b;
    padding: 80px 24px;

    .watermark-icon {
      font-size: 56px;
      margin-bottom: 16px;
      color: #cbd5e1;
    }

    p {
      font-size: 14px;
      margin: 0;
    }
  }
}

.detail-header-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;

  .tab-buttons {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 20px;
    gap: 2px;

    .tab-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 16px;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;

      &:hover {
        color: #0f172a;
      }

      &.active {
        color: #0f172a;
        background: #ffffff;
        font-weight: 500;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      }
    }
  }

  .current-kb-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;

    .label {
      color: #64748b;
    }
    .name {
      color: #0f172a;
      font-weight: 600;
    }
  }
}

.upload-dropzone {
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  margin-bottom: 20px;

  &:hover,
  &.dragging {
    border-color: #2563eb;
    background: #eff6ff;
  }

  .upload-icon {
    font-size: 32px;
    color: #2563eb;
  }

  .upload-texts {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .primary-text {
      font-size: 14px;
      font-weight: 500;
      color: #0f172a;
    }

    .secondary-text {
      font-size: 12px;
      color: #64748b;
    }
  }
}

.documents-table-wrapper {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);

  .table-header-row {
    display: grid;
    grid-template-columns: 2fr 68px 80px 68px 80px 180px 145px;
    padding: 10px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
  }

  .table-loading-skeleton {
    .table-row-skeleton {
      height: 48px;
      border-bottom: 1px solid #f1f5f9;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
  }

  .table-empty {
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

    p {
      font-size: 13px;
      margin: 0;
    }
  }

  .table-data-row {
    display: grid;
    grid-template-columns: 2fr 68px 80px 68px 80px 180px 145px;
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    align-items: center;
    font-size: 13px;
    transition: background 0.15s;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: #f8fafc;
    }
  }

  .col-name {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;

    .doc-icon {
      color: #2563eb;
      flex-shrink: 0;
    }

    .doc-title-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #0f172a;
      font-weight: 500;
    }
  }

  .type-tag {
    font-size: 11px;
    font-weight: 500;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 2px 6px;
    border-radius: 4px;
    color: #475569;
  }

  .status-cell-inner {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;

    &.completed {
      color: #059669;
      font-weight: 500;
    }
    &.pending {
      color: #64748b;
    }
    &.processing {
      color: #2563eb;
      font-weight: 500;
    }
    &.failed {
      color: #dc2626;
    }
  }

  .doc-progress-track {
    width: 100%;
    height: 4px;
    background: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;

    .doc-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #38bdf8);
      border-radius: 999px;
      transition: width 0.25s ease;
    }
  }

  .doc-error-hint {
    font-size: 11px;
    color: #dc2626;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-actions {
    display: flex;
    gap: 12px;

    .text-btn {
      background: transparent;
      border: none;
      color: #2563eb;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      padding: 0;

      &:hover:not(:disabled) {
        text-decoration: underline;
      }

      &:disabled {
        color: #94a3b8;
        cursor: not-allowed;
      }

      &.retry {
        color: #d97706;
      }

      &.danger {
        color: #dc2626;
      }
    }
  }
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.hidden-file-input {
  display: none;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 0;

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .field-label {
      font-size: 13px;
      font-weight: 500;
      color: #334155;

      .required {
        color: #ef4444;
      }
    }
  }
}
</style>
