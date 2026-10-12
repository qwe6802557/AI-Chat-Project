<template>
  <div class="kb-workbench-layout">
    <AppHeaderNav active-mode="knowledge" />

    <div class="kb-main-container">
      <!-- 顶部信息与全局操作栏 -->
      <header class="kb-header-section">
        <div class="header-left">
          <div class="title-row">
            <DatabaseOutlined class="page-icon" />
            <h1 class="page-title">RAG 知识库工作台</h1>
          </div>
          <p class="page-subtitle">
            基于 PostgreSQL + pgvector 混合双路召回与倒数排名融合 (RRF)，为大模型注入专属私域知识。
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
              :disabled="loadingBases"
              @click="fetchKnowledgeBases"
            >
              <ReloadOutlined :spin="loadingBases" />
            </button>
          </div>

          <div v-if="loadingBases" class="skeleton-list">
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
          <!-- 标签切换：文档管理 / 检索评测 -->
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
            <!-- 拖拽上传区域 -->
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
                accept=".pdf,.docx,.md,.txt"
                @change="handleFileInputChange"
              />
              <CloudUploadOutlined class="upload-icon" />
              <div class="upload-texts">
                <span class="primary-text">
                  {{ isUploading ? '正在极速解析入库并计算 BGE-M3 向量...' : '点击或拖拽文件至此上传解析' }}
                </span>
                <span class="secondary-text">
                  支持 PDF、DOCX、Markdown、TXT 格式，自动按 500 字语义分块与 100 字滑动窗口重叠
                </span>
              </div>
            </div>

            <!-- 文档表格列表 -->
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

              <div v-if="loadingDocs" class="table-loading-skeleton">
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
                    <FileTextOutlined class="doc-icon" />
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
                    <span :class="['status-badge', doc.status]">
                      <CheckCircleOutlined v-if="doc.status === 'completed'" />
                      <SyncOutlined v-else-if="doc.status === 'processing'" spin />
                      <CloseCircleOutlined v-else-if="doc.status === 'failed'" />
                      <ClockCircleOutlined v-else />
                      <span>{{ getStatusLabel(doc.status) }}</span>
                    </span>
                  </div>
                  <div class="col-cell col-actions">
                    <button
                      type="button"
                      class="text-btn"
                      title="预览切片详情"
                      @click="handlePreviewChunks(doc)"
                    >
                      预览切片
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
          <div v-show="activeTab === 'test'" class="tab-panel search-test-panel">
            <div class="search-input-box">
              <div class="search-input-row">
                <SearchOutlined class="input-search-icon" />
                <input
                  v-model="testQuery"
                  type="text"
                  placeholder="输入测试问题，检验语义稠密向量与稀疏关键词的双路 RRF 融合召回..."
                  class="stitch-query-input"
                  @keydown.enter="handleTestSearch"
                />
                <button
                  type="button"
                  class="stitch-btn primary"
                  :disabled="isSearching || !testQuery.trim()"
                  @click="handleTestSearch"
                >
                  <SearchOutlined v-if="!isSearching" />
                  <LoadingOutlined v-else spin />
                  <span>执行检索评测</span>
                </button>
              </div>
            </div>

            <!-- 评测结果列表 -->
            <div class="search-results-viewport">
              <div v-if="isSearching" class="search-skeleton-box">
                <div v-for="i in 3" :key="i" class="result-skeleton-card" />
              </div>

              <div v-else-if="hasSearched && searchResults.length === 0" class="search-empty-box">
                <InboxOutlined class="empty-icon" />
                <p>未召回相关切片，请尝试调整查询词</p>
              </div>

              <div v-else-if="searchResults.length > 0" class="results-stack">
                <div
                  v-for="(res, idx) in searchResults"
                  :key="res.chunkId || idx"
                  class="result-item-card"
                >
                  <div class="res-card-top">
                    <div class="res-meta-left">
                      <span class="rank-badge">#{{ idx + 1 }}</span>
                      <span class="doc-badge">{{ res.documentTitle }}</span>
                      <span class="chunk-badge">切片 #{{ res.chunkIndex + 1 }}</span>
                    </div>
                    <div class="res-score-badge">
                      <ThunderboltFilled class="score-icon" />
                      <span>综合置信度: {{ (res.score * 100).toFixed(0) }}%</span>
                    </div>
                  </div>
                  <div class="res-content-box">
                    <p class="res-text">{{ res.content }}</p>
                  </div>
                  <div class="res-card-bottom">
                    <span class="char-info font-mono">共 {{ res.charCount }} 字符</span>
                  </div>
                </div>
              </div>

              <div v-else class="search-initial-hint">
                <ThunderboltOutlined class="hint-icon" />
                <p>输入问题并点击检索，系统将演示完整的 RAG 双路召回与倒数排名融合过程</p>
              </div>
            </div>
          </div>
        </section>

        <!-- 无选中知识库占位 -->
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

    <!-- 切片预览抽屉 -->
    <a-drawer
      v-model:open="showChunkDrawer"
      title="文档语义切片预览"
      placement="right"
      width="640"
      :destroy-on-close="true"
    >
      <div v-if="previewDoc" class="chunk-drawer-header">
        <h3 class="preview-doc-title">{{ previewDoc.title }}</h3>
        <div class="preview-doc-meta">
          <span>总切片数: {{ previewDoc.chunkCount }}</span>
          <span>总字符数: {{ previewDoc.charCount }}</span>
        </div>
      </div>

      <div v-if="loadingChunks" class="drawer-loading-skeleton">
        <div v-for="i in 5" :key="i" class="chunk-skeleton-item" />
      </div>

      <div v-else-if="chunksList.length === 0" class="drawer-empty">
        <InboxOutlined class="empty-icon" />
        <p>暂无切片数据</p>
      </div>

      <div v-else class="chunk-list-stack">
        <div
          v-for="chunk in chunksList"
          :key="chunk.id"
          class="chunk-card-item"
        >
          <div class="chunk-top-row">
            <span class="chunk-idx font-mono">切片 #{{ chunk.chunkIndex + 1 }}</span>
            <span class="chunk-chars font-mono">{{ chunk.charCount }} 字符</span>
          </div>
          <div class="chunk-content-body font-mono">
            {{ chunk.content }}
          </div>
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  DeleteOutlined,
  CloudUploadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  InboxOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import AppHeaderNav from '@/components/AppHeaderNav.vue'
import {
  getKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeDocuments,
  uploadKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeChunks,
  searchKnowledgeBase,
} from '@/api/knowledge'
import type {
  KnowledgeBaseItem,
  KnowledgeDocumentItem,
  KnowledgeChunkItem,
  RagSearchResultItem,
} from '@/interface/knowledge'

defineOptions({
  name: 'KnowledgeBaseWorkbench',
})

const loadingBases = ref(false)
const knowledgeBases = ref<KnowledgeBaseItem[]>([])
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

// 抽屉切片预览
const showChunkDrawer = ref(false)
const previewDoc = ref<KnowledgeDocumentItem | null>(null)
const loadingChunks = ref(false)
const chunksList = ref<KnowledgeChunkItem[]>([])

// 检索评测
const testQuery = ref('')
const isSearching = ref(false)
const hasSearched = ref(false)
const searchResults = ref<RagSearchResultItem[]>([])

const fetchKnowledgeBases = async () => {
  loadingBases.value = true
  try {
    const res = await getKnowledgeBases()
    knowledgeBases.value = res.data || []
    if (knowledgeBases.value.length > 0) {
      if (!currentKb.value || !knowledgeBases.value.some((b) => b.id === currentKb.value?.id)) {
        const firstKb = knowledgeBases.value[0]
        if (firstKb) {
          selectKnowledgeBase(firstKb)
        }
      }
    } else {
      currentKb.value = null
    }
  } catch (err: any) {
    message.error(err.message || '加载知识库失败')
  } finally {
    loadingBases.value = false
  }
}

const selectKnowledgeBase = (kb: KnowledgeBaseItem) => {
  currentKb.value = kb
  fetchDocuments(kb.id)
  searchResults.value = []
  hasSearched.value = false
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
    await fetchKnowledgeBases()
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
        await fetchKnowledgeBases()
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
  isUploading.value = true
  try {
    await uploadKnowledgeDocument(currentKb.value.id, file)
    message.success(`文档 "${file.name}" 解析与向量化入库成功`)
    await fetchDocuments(currentKb.value.id)
    await fetchKnowledgeBases()
  } catch (err: any) {
    message.error(err.message || '上传解析失败')
  } finally {
    isUploading.value = false
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
          await fetchKnowledgeBases()
        }
      } catch (err: any) {
        message.error(err.message || '删除失败')
      }
    },
  })
}

const handlePreviewChunks = async (doc: KnowledgeDocumentItem) => {
  previewDoc.value = doc
  showChunkDrawer.value = true
  loadingChunks.value = true
  try {
    const res = await getKnowledgeChunks(doc.id, 1, 100)
    chunksList.value = res.data?.items || (res.data as any)?.list || []
  } catch (err: any) {
    message.error(err.message || '获取切片失败')
  } finally {
    loadingChunks.value = false
  }
}

const handleTestSearch = async () => {
  if (!testQuery.value.trim() || !currentKb.value) return
  isSearching.value = true
  hasSearched.value = true
  try {
    const res = await searchKnowledgeBase({
      query: testQuery.value.trim(),
      knowledgeBaseIds: [currentKb.value.id],
      limit: 6,
    })
    searchResults.value = res.data || []
  } catch (err: any) {
    message.error(err.message || '检索评测失败')
  } finally {
    isSearching.value = false
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'completed':
      return '已完成'
    case 'processing':
      return '解析中'
    case 'failed':
      return '失败'
    default:
      return '等待中'
  }
}

onMounted(() => {
  fetchKnowledgeBases()
})
</script>

<style scoped lang="scss">
.kb-workbench-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #0b0f19;
  color: #f1f5f9;
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  .header-left {
    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;

      .page-icon {
        font-size: 24px;
        color: #3b82f6;
      }

      .page-title {
        font-size: 22px;
        font-weight: 600;
        margin: 0;
        color: #f8fafc;
        letter-spacing: -0.02em;
      }
    }

    .page-subtitle {
      margin: 6px 0 0;
      font-size: 13px;
      color: #94a3b8;
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
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);

    &:hover:not(:disabled) {
      background: #1d4ed8;
      transform: translateY(-1px);
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
}

.kb-sidebar-column {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);

    .column-title {
      font-size: 13px;
      font-weight: 600;
      color: #cbd5e1;
    }

    .icon-action-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
      border-radius: 4px;
      transition: color 0.15s;

      &:hover {
        color: #f8fafc;
      }
    }
  }
}

.kb-cards-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kb-item-card {
  padding: 14px;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(30, 41, 59, 0.7);
  }

  &.active {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.12);
  }

  .card-top {
    display: flex;
    gap: 12px;
    align-items: flex-start;

    .kb-avatar {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .kb-meta {
      flex: 1;
      min-width: 0;

      .kb-name {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: #f1f5f9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .kb-desc {
        display: block;
        font-size: 12px;
        color: #94a3b8;
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
    border-top: 1px solid rgba(255, 255, 255, 0.04);

    .stats-pills {
      display: flex;
      gap: 8px;

      .stat-pill {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.04);
        padding: 2px 6px;
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
        color: #64748b;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: color 0.15s;

        &.danger:hover {
          color: #f87171;
        }
      }
    }
  }
}

.kb-detail-column {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 20px;
  min-height: 600px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  &.empty-selection {
    align-items: center;
    justify-content: center;
    color: #64748b;

    .watermark-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.4;
    }
  }
}

.detail-header-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  .tab-buttons {
    display: flex;
    gap: 8px;

    .tab-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: transparent;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;

      &:hover {
        color: #f1f5f9;
        background: rgba(255, 255, 255, 0.04);
      }

      &.active {
        color: #3b82f6;
        background: rgba(59, 130, 246, 0.12);
        border-color: rgba(59, 130, 246, 0.3);
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
      color: #f1f5f9;
      font-weight: 600;
    }
  }
}

.upload-dropzone {
  border: 2px dashed rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.015);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  margin-bottom: 20px;

  &:hover,
  &.dragging {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.04);
  }

  .upload-icon {
    font-size: 32px;
    color: #3b82f6;
  }

  .upload-texts {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .primary-text {
      font-size: 14px;
      font-weight: 500;
      color: #f8fafc;
    }

    .secondary-text {
      font-size: 12px;
      color: #64748b;
    }
  }
}

.documents-table-wrapper {
  background: rgba(30, 41, 59, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;

  .table-header-row {
    display: grid;
    grid-template-columns: 2fr 80px 90px 80px 90px 100px 140px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
  }

  .table-data-row {
    display: grid;
    grid-template-columns: 2fr 80px 90px 80px 90px 100px 140px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    align-items: center;
    font-size: 13px;
    transition: background 0.15s;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.02);
    }
  }

  .col-name {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;

    .doc-icon {
      color: #60a5fa;
      flex-shrink: 0;
    }

    .doc-title-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #f1f5f9;
      font-weight: 500;
    }
  }

  .type-tag {
    font-size: 11px;
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 6px;
    border-radius: 4px;
    color: #cbd5e1;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;

    &.completed {
      color: #34d399;
    }
    &.processing {
      color: #60a5fa;
    }
    &.failed {
      color: #f87171;
    }
  }

  .col-actions {
    display: flex;
    gap: 12px;

    .text-btn {
      background: transparent;
      border: none;
      color: #3b82f6;
      font-size: 12px;
      cursor: pointer;
      padding: 0;

      &:hover {
        text-decoration: underline;
      }

      &.danger {
        color: #f87171;
      }
    }
  }
}

.search-test-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .search-input-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(30, 41, 59, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 6px 12px;

    .input-search-icon {
      font-size: 16px;
      color: #64748b;
    }

    .stitch-query-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #f8fafc;
      font-size: 14px;

      &::placeholder {
        color: #64748b;
      }
    }
  }

  .search-results-viewport {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .results-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .result-item-card {
      background: rgba(30, 41, 59, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .res-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .res-meta-left {
          display: flex;
          align-items: center;
          gap: 8px;

          .rank-badge {
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
          }

          .doc-badge {
            font-size: 12px;
            font-weight: 600;
            color: #e2e8f0;
          }

          .chunk-badge {
            font-size: 11px;
            color: #94a3b8;
          }
        }

        .res-score-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.1);
          padding: 2px 8px;
          border-radius: 6px;

          .score-icon {
            font-size: 12px;
          }
        }
      }

      .res-content-box {
        background: rgba(0, 0, 0, 0.2);
        padding: 10px 12px;
        border-radius: 6px;
        border-left: 2px solid #3b82f6;

        .res-text {
          font-size: 13px;
          line-height: 1.6;
          color: #cbd5e1;
          margin: 0;
          white-space: pre-wrap;
        }
      }

      .res-card-bottom {
        font-size: 11px;
        color: #64748b;
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
        font-size: 32px;
        opacity: 0.4;
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

.chunk-drawer-header {
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 16px;

  .preview-doc-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 6px;
  }

  .preview-doc-meta {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #64748b;
  }
}

.chunk-list-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .chunk-card-item {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    background: #f8fafc;

    .chunk-top-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
      margin-bottom: 8px;

      .chunk-idx {
        font-weight: 600;
        color: #2563eb;
      }
    }

    .chunk-content-body {
      font-size: 12px;
      line-height: 1.6;
      color: #1e293b;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
}
</style>
