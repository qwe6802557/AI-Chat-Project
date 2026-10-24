<template>
  <a-modal
    :open="open"
    :title="`模型测速与诊断详情 - ${detail?.modelName || '未知'}`"
    width="680px"
    :footer="null"
    destroy-on-close
    @update:open="emit('update:open', $event)"
  >
    <div v-if="detail" class="detail-container">
      <!-- 基础元数据 -->
      <div class="meta-section">
        <div class="meta-item">
          <span class="meta-label">模型标识:</span>
          <code class="meta-code">{{ detail.modelId }}</code>
        </div>
        <div class="meta-item">
          <span class="meta-label">供应商:</span>
          <a-tag color="blue">{{ detail.providerName }}</a-tag>
        </div>
        <div class="meta-item">
          <span class="meta-label">模型类别:</span>
          <a-tag v-if="detail.category === 'image'" color="purple">图像生成</a-tag>
          <a-tag v-else-if="detail.category === 'video'" color="orange">视频生成</a-tag>
          <a-tag v-else-if="detail.category === 'voice'" color="green">语音交互</a-tag>
          <a-tag v-else color="cyan">对话补全</a-tag>
        </div>
        <div class="meta-item">
          <span class="meta-label">运行健康度:</span>
          <a-tag v-if="detail.status === 'healthy'" color="success">健康 (极速)</a-tag>
          <a-tag v-else-if="detail.status === 'slow'" color="warning">较慢 (响应延迟偏高)</a-tag>
          <a-tag v-else-if="detail.status === 'timeout'" color="error">超时 (15s 无响应)</a-tag>
          <a-tag v-else color="error">异常报错</a-tag>
        </div>
      </div>

      <!-- 全链路三维延迟指标卡片 -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">握手连接耗时 (Connect)</div>
          <div class="metric-value">{{ detail.connectTimeMs }}<span class="unit">ms</span></div>
          <div class="metric-desc">TCP/SSL握手与HTTP响应头建立时间</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">首字延迟 (TTFT)</div>
          <div class="metric-value" :class="ttftColorClass">
            {{ detail.firstTokenMs }}<span class="unit">ms</span>
          </div>
          <div class="metric-desc">上游流式返回首个有效Token耗时</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">完整往返总耗时 (Total)</div>
          <div class="metric-value" :class="totalColorClass">
            {{ formatDuration(detail.totalTimeMs) }}
          </div>
          <div class="metric-desc">微探针完成全部交互的总耗时</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">HTTP 响应状态码</div>
          <div class="metric-value" :class="{ 'status-error': detail.httpStatus >= 400 }">
            {{ detail.httpStatus }}
          </div>
          <div class="metric-desc">{{ detail.httpStatus === 200 ? '上游通信正常' : '网关返回非 200 状态' }}</div>
        </div>
      </div>

      <!-- 异常报错提示 -->
      <div v-if="detail.errorMessage" class="error-section">
        <div class="section-title text-danger">
          <WarningOutlined />
          <span>错误详细诊断</span>
        </div>
        <pre class="error-pre">{{ detail.errorMessage }}</pre>
      </div>

      <!-- 真实返回样本 -->
      <div v-if="detail.sampleOutput" class="sample-section">
        <div class="section-title">
          <CodeOutlined />
          <span>模型返回文本样本</span>
        </div>
        <pre class="sample-pre">{{ detail.sampleOutput }}</pre>
      </div>

      <!-- 底部栏 -->
      <div class="modal-footer-info">
        <span class="test-time">
          测速时间: {{ formatTime(detail.testedAt) }}
        </span>
        <a-button type="primary" @click="emit('update:open', false)">关闭</a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { WarningOutlined, CodeOutlined } from '@ant-design/icons-vue'
import type { ModelLatencyResult } from '@/interface/model'

const props = defineProps<{
  open: boolean
  detail: ModelLatencyResult | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const ttftColorClass = computed(() => {
  if (!props.detail || props.detail.firstTokenMs === 0) return 'text-danger'
  if (props.detail.firstTokenMs < 1500) return 'text-success'
  if (props.detail.firstTokenMs < 4000) return 'text-warning'
  return 'text-danger'
})

const totalColorClass = computed(() => {
  if (!props.detail) return ''
  if (props.detail.totalTimeMs < 2500) return 'text-success'
  if (props.detail.totalTimeMs < 6000) return 'text-warning'
  return 'text-danger'
})

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const formatTime = (isoStr?: string): string => {
  if (!isoStr) return '-'
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('zh-CN', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return isoStr
  }
}
</script>

<style scoped>
.detail-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.meta-section {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 20px;
  padding: 12px 16px;
  background-color: var(--color-bg-secondary, #f8fafc);
  border-radius: 8px;
  border: 1px solid var(--color-border, #e2e8f0);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.meta-label {
  color: var(--color-text-secondary, #64748b);
}

.meta-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  background-color: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  color: #0f172a;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.metric-card {
  padding: 12px 14px;
  background: var(--color-bg-container, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.metric-title {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #1e293b;
}

.metric-value .unit {
  font-size: 13px;
  font-weight: 400;
  margin-left: 2px;
  color: #64748b;
}

.metric-desc {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

.text-success {
  color: #10b981 !important;
}

.text-warning {
  color: #f59e0b !important;
}

.text-danger {
  color: #ef4444 !important;
}

.status-error {
  color: #ef4444 !important;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.error-pre {
  background-color: #fef2f2;
  border: 1px solid #fee2e2;
  color: #991b1b;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow-y: auto;
  margin: 0;
}

.sample-pre {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #334155;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
  margin: 0;
}

.modal-footer-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.test-time {
  font-size: 12px;
  color: #94a3b8;
}
</style>
