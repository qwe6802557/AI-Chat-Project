<template>
  <a-modal
    :open="open"
    title="AI 模型运行控制台"
    width="1000px"
    :footer="null"
    destroy-on-close
    @update:open="emit('update:open', $event)"
  >
    <div class="model-manage-container">
      <!-- 顶部工具栏 -->
      <div class="toolbar">
        <div class="filter-group">
          <a-radio-group v-model:value="selectedCategory" button-style="solid" size="small">
            <a-radio-button value="all">全部 ({{ modelList.length }})</a-radio-button>
            <a-radio-button value="chat">对话 ({{ chatCount }})</a-radio-button>
            <a-radio-button value="image">图像 ({{ imageCount }})</a-radio-button>
            <a-radio-button value="video">视频 ({{ videoCount }})</a-radio-button>
            <a-radio-button value="voice">语音 ({{ voiceCount }})</a-radio-button>
          </a-radio-group>

          <a-input-search
            v-model:value="searchKeyword"
            placeholder="搜索模型名称或标识..."
            size="small"
            style="width: 220px;"
            allow-clear
          />
        </div>

        <div class="action-group">
          <a-button
            type="primary"
            size="small"
            :loading="batchTesting"
            @click="handleBatchTest"
          >
            <template #icon><ThunderboltOutlined /></template>
            {{ batchTesting ? `批量测速中 (${testedCount}/${filteredModels.length})...` : '一键全测所有模型' }}
          </a-button>

          <a-button
            size="small"
            :loading="loading"
            @click="fetchModels"
          >
            <template #icon><ReloadOutlined /></template>
            刷新列表
          </a-button>
        </div>
      </div>

      <!-- 模型数据表格 -->
      <a-table
        :data-source="filteredModels"
        :columns="columns"
        :loading="loading"
        row-key="id"
        size="middle"
        :pagination="{ pageSize: 8, showTotal: (total: number) => `共 ${total} 个模型` }"
      >
        <!-- 模型信息列 -->
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'modelName'">
            <div class="model-name-cell">
              <div class="model-title-line">
                <span class="model-display-name">{{ record.modelName }}</span>
                <a-tag v-if="record.isDefault" color="gold" class="default-badge">
                  <StarFilled /> 默认
                </a-tag>
              </div>
              <code class="model-id-code">{{ record.modelId }}</code>
            </div>
          </template>

          <!-- 供应商列 -->
          <template v-else-if="column.key === 'provider'">
            <a-tag color="blue">
              {{ record.provider?.name || '未知供应商' }}
            </a-tag>
          </template>

          <!-- 分类列 -->
          <template v-else-if="column.key === 'category'">
            <a-tag v-if="record.category === 'image'" color="purple">图像生成</a-tag>
            <a-tag v-else-if="record.category === 'video'" color="orange">视频生成</a-tag>
            <a-tag v-else-if="record.category === 'voice'" color="green">语音交互</a-tag>
            <a-tag v-else color="cyan">对话补全</a-tag>
          </template>

          <!-- 启用状态开关 -->
          <template v-else-if="column.key === 'isActive'">
            <a-switch
              :checked="record.isActive"
              :loading="updatingIds.has(record.id)"
              checked-children="启用"
              un-checked-children="停用"
              @change="(checked: boolean | string | number) => handleToggleActive(record, Boolean(checked))"
            />
          </template>

          <!-- 响应速度列 -->
          <template v-else-if="column.key === 'speed'">
            <div class="speed-cell">
              <template v-if="testingIds.has(record.id)">
                <a-spin size="small" />
                <span class="testing-hint">测速中...</span>
              </template>
              <template v-else-if="latencyMap[record.id]">
                <a-tag
                  :color="getLatencyTagColor(latencyMap[record.id])"
                  class="latency-tag"
                >
                  <ThunderboltFilled v-if="latencyMap[record.id].status === 'healthy'" />
                  {{ formatLatencyTag(latencyMap[record.id]) }}
                </a-tag>
              </template>
              <template v-else>
                <span class="untested-text">-</span>
              </template>
            </div>
          </template>

          <!-- 操作列 -->
          <template v-else-if="column.key === 'actions'">
            <div class="action-cell">
              <a-button
                v-if="!record.isDefault"
                type="link"
                size="small"
                :loading="settingDefaultId === record.id"
                class="set-default-btn"
                @click="handleSetDefault(record)"
              >
                设为默认
              </a-button>
              <a-tag v-else color="success" class="current-default-tag">
                当前默认
              </a-tag>

              <a-button
                type="link"
                size="small"
                :loading="testingIds.has(record.id)"
                :disabled="batchTesting"
                @click="handleTestSingle(record)"
              >
                测试
              </a-button>

              <a-button
                type="link"
                size="small"
                :disabled="!latencyMap[record.id]"
                @click="handleViewDetail(record)"
              >
                查看详情
              </a-button>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 测速三维诊断详情子弹层 -->
    <ModelLatencyDetailModal
      v-model:open="showDetailModal"
      :detail="currentDetail"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { message } from 'ant-design-vue'
import {
  ThunderboltOutlined,
  ThunderboltFilled,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import { getAllModels, updateModel, setDefaultModel, testModelLatency } from '@/api/model'
import type { BackendAiModel, ModelLatencyResult } from '@/interface/model'
import ModelLatencyDetailModal from './ModelLatencyDetailModal.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

// 表格列定义
const columns = [
  {
    title: '模型名称 / ID',
    dataIndex: 'modelName',
    key: 'modelName',
    ellipsis: true,
  },
  {
    title: '供应商',
    key: 'provider',
    width: 140,
  },
  {
    title: '类型',
    key: 'category',
    width: 100,
  },
  {
    title: '状态开关',
    key: 'isActive',
    width: 110,
    align: 'center' as const,
  },
  {
    title: '响应速度',
    key: 'speed',
    width: 130,
    align: 'center' as const,
  },
  {
    title: '操作',
    key: 'actions',
    width: 230,
    align: 'center' as const,
  },
]

// 状态数据
const loading = ref(false)
const modelList = ref<BackendAiModel[]>([])
const selectedCategory = ref<'all' | 'chat' | 'image' | 'video' | 'voice'>('all')
const searchKeyword = ref('')

const updatingIds = reactive(new Set<string>())
const testingIds = reactive(new Set<string>())
const latencyMap = reactive<Record<string, ModelLatencyResult>>({})

const batchTesting = ref(false)
const settingDefaultId = ref<string | null>(null)

const sortModelList = () => {
  modelList.value.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1
    if (!a.isDefault && b.isDefault) return 1
    const sortA = a.sortOrder ?? 999
    const sortB = b.sortOrder ?? 999
    if (sortA !== sortB) return sortA - sortB
    return (a.modelName || a.modelId).localeCompare(b.modelName || b.modelId, 'zh-CN')
  })
}
const testedCount = ref(0)

const showDetailModal = ref(false)
const currentDetail = ref<ModelLatencyResult | null>(null)

// 数量统计
const chatCount = computed(() => modelList.value.filter(m => (m.category || 'chat') === 'chat').length)
const imageCount = computed(() => modelList.value.filter(m => m.category === 'image').length)
const videoCount = computed(() => modelList.value.filter(m => m.category === 'video').length)
const voiceCount = computed(() => modelList.value.filter(m => m.category === 'voice').length)

// 过滤后的模型列表
const filteredModels = computed(() => {
  return modelList.value.filter(m => {
    // 分类筛选
    if (selectedCategory.value !== 'all') {
      const cat = m.category || 'chat'
      if (cat !== selectedCategory.value) return false
    }
    // 关键字搜索
    if (searchKeyword.value.trim()) {
      const kw = searchKeyword.value.trim().toLowerCase()
      const matchName = m.modelName?.toLowerCase().includes(kw)
      const matchId = m.modelId?.toLowerCase().includes(kw)
      const matchProvider = m.provider?.name?.toLowerCase().includes(kw)
      if (!matchName && !matchId && !matchProvider) return false
    }
    return true
  })
})

// 获取模型全量数据
const fetchModels = async () => {
  loading.value = true
  try {
    const res = await getAllModels(true)
    if (res && res.code === 0 && Array.isArray(res.data)) {
      modelList.value = res.data
      sortModelList()
    } else {
      message.error(res?.message || '获取模型列表失败')
    }
  } catch (err: any) {
    message.error(err?.message || '获取模型列表网络异常')
  } finally {
    loading.value = false
  }
}

// 切换模型开关
const handleToggleActive = async (record: BackendAiModel, newActive: boolean) => {
  updatingIds.add(record.id)
  const previousStatus = record.isActive
  // 乐观更新
  record.isActive = newActive

  try {
    const res = await updateModel(record.id, { isActive: newActive })
    if (res && res.code === 0) {
      message.success(`已${newActive ? '启用' : '停用'}模型: ${record.modelName}`)
    } else {
      record.isActive = previousStatus
      message.error(res?.message || '修改状态失败')
    }
  } catch (err: any) {
    record.isActive = previousStatus
    message.error(err?.message || '修改状态接口异常')
  } finally {
    updatingIds.delete(record.id)
  }
}

// 设为系统默认模型
const handleSetDefault = async (record: BackendAiModel) => {
  settingDefaultId.value = record.id
  try {
    const res = await setDefaultModel(record.id)
    if (res && res.code === 0) {
      message.success(`已将 ${record.modelName} 设为系统默认模型`)
      const category = record.category || 'chat'
      modelList.value.forEach(m => {
        if ((m.category || 'chat') === category) {
          m.isDefault = (m.id === record.id)
          if (m.id === record.id) {
            m.isActive = true
            m.sortOrder = 0
          }
        }
      })
      sortModelList()
    } else {
      message.error(res?.message || '设置默认模型失败')
    }
  } catch (err: any) {
    message.error(err?.message || '设置默认模型接口异常')
  } finally {
    settingDefaultId.value = null
  }
}

// 单模型测速
const handleTestSingle = async (record: BackendAiModel) => {
  testingIds.add(record.id)
  try {
    const res = await testModelLatency(record.id)
    if (res && res.code === 0 && res.data) {
      latencyMap[record.id] = res.data
    } else {
      message.warning(res?.message || '测速未返回有效数据')
    }
  } catch (err: any) {
    message.error(err?.message || '测速请求异常')
  } finally {
    testingIds.delete(record.id)
  }
}

// 一键全测
const handleBatchTest = async () => {
  if (batchTesting.value) return
  const targets = filteredModels.value
  if (targets.length === 0) {
    message.info('当前视图中无可用模型进行测速')
    return
  }

  batchTesting.value = true
  testedCount.value = 0

  for (const model of targets) {
    testingIds.add(model.id)
    try {
      const res = await testModelLatency(model.id)
      if (res && res.code === 0 && res.data) {
        latencyMap[model.id] = res.data
      }
    } catch {
      // 容错继续测试下一个
    } finally {
      testingIds.delete(model.id)
      testedCount.value++
    }
  }

  batchTesting.value = false
  message.success(`批量测速完成，共测试 ${targets.length} 个模型`)
}

// 打开诊断详情
const handleViewDetail = (record: BackendAiModel) => {
  const detail = latencyMap[record.id]
  if (detail) {
    currentDetail.value = detail
    showDetailModal.value = true
  }
}

// 格式化测速结果标签
const formatLatencyTag = (result: ModelLatencyResult): string => {
  if (result.status === 'timeout') return '超时 15s'
  if (result.status === 'error') return `错误 ${result.httpStatus || ''}`
  if (result.totalTimeMs < 1000) return `${result.totalTimeMs}ms`
  return `${(result.totalTimeMs / 1000).toFixed(2)}s`
}

// 获取测速标签颜色
const getLatencyTagColor = (result: ModelLatencyResult): string => {
  if (result.status === 'healthy') return 'success'
  if (result.status === 'slow') return 'warning'
  return 'error'
}

// 监听弹窗打开时加载数据
watch(
  () => props.open,
  (val) => {
    if (val) {
      fetchModels()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.model-manage-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 420px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 4px 0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-title-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.default-badge {
  font-size: 11px;
  line-height: 18px;
  padding: 0 4px;
}

.current-default-tag {
  font-size: 12px;
  padding: 0 6px;
}

.set-default-btn {
  padding: 0 4px;
}

.model-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-display-name {
  font-weight: 500;
  color: #1e293b;
}

.model-id-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #64748b;
}

.speed-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.testing-hint {
  font-size: 12px;
  color: #64748b;
  margin-left: 4px;
}

.untested-text {
  color: #94a3b8;
  font-size: 14px;
}

.latency-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-weight: 600;
}

.action-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
</style>
