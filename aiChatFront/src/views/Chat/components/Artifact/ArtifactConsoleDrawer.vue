<template>
  <div class="artifact-console-drawer" :class="{ 'is-expanded': isExpanded }">
    <!-- 控制台底部常驻状态条 -->
    <div class="console-status-bar" @click="toggleExpanded">
      <div class="status-left">
        <CodeOutlined class="console-icon" />
        <span class="console-title">控制台</span>

        <!-- 错误计数 -->
        <span v-if="errorCount > 0" class="badge-pill error">
          <span class="dot"></span>
          {{ errorCount }} 错误
        </span>

        <!-- 警告计数 -->
        <span v-if="warnCount > 0" class="badge-pill warn">
          <span class="dot"></span>
          {{ warnCount }} 警告
        </span>

        <!-- 普通日志计数 -->
        <span v-if="logCount > 0" class="badge-pill log">
          {{ logCount }} 日志
        </span>

        <span v-if="entries.length === 0" class="badge-pill clean">
          正常
        </span>
      </div>

      <div class="status-right" @click.stop>
        <button
          v-if="entries.length > 0"
          type="button"
          class="btn-clear"
          title="清空控制台日志"
          @click="emit('clear')"
        >
          <ClearOutlined />
          <span>清空</span>
        </button>

        <button
          type="button"
          class="btn-toggle"
          :title="isExpanded ? '收起控制台' : '展开控制台'"
          @click="toggleExpanded"
        >
          <DownOutlined v-if="isExpanded" />
          <UpOutlined v-else />
        </button>
      </div>
    </div>

    <!-- 展开后的日志详细面板 -->
    <div v-if="isExpanded" class="console-panel-body">
      <!-- 过滤器工具条 -->
      <div class="filter-toolbar">
        <div class="filter-tabs">
          <button
            type="button"
            class="filter-btn"
            :class="{ active: activeFilter === 'all' }"
            @click="activeFilter = 'all'"
          >
            全部 ({{ entries.length }})
          </button>
          <button
            type="button"
            class="filter-btn"
            :class="{ active: activeFilter === 'error' }"
            @click="activeFilter = 'error'"
          >
            错误 ({{ errorCount }})
          </button>
          <button
            type="button"
            class="filter-btn"
            :class="{ active: activeFilter === 'warn' }"
            @click="activeFilter = 'warn'"
          >
            警告 ({{ warnCount }})
          </button>
          <button
            type="button"
            class="filter-btn"
            :class="{ active: activeFilter === 'log' }"
            @click="activeFilter = 'log'"
          >
            日志 ({{ logCount }})
          </button>
        </div>
      </div>

      <!-- 日志列表 -->
      <div ref="logContainerRef" class="log-entries-scroll">
        <template v-if="filteredEntries.length > 0">
          <div
            v-for="item in filteredEntries"
            :key="item.id"
            class="log-row"
            :class="`is-${item.level}`"
          >
            <span class="log-time">{{ formatTime(item.time) }}</span>
            <span class="log-level-tag" :class="item.level">{{ item.level.toUpperCase() }}</span>
            <pre class="log-message">{{ item.message }}</pre>
          </div>
        </template>
        <div v-else class="console-empty">
          <CheckCircleOutlined class="empty-icon" />
          <span>{{ entries.length === 0 ? '暂无控制台日志输出' : '当前筛选分类下无日志' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import {
  CodeOutlined,
  ClearOutlined,
  UpOutlined,
  DownOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons-vue'

export interface ConsoleEntry {
  id: string
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
  time: number
}

defineOptions({
  name: 'ArtifactConsoleDrawer',
})

const props = defineProps<{
  entries: ConsoleEntry[]
}>()

const emit = defineEmits<{
  clear: []
}>()

const isExpanded = ref(false)
const activeFilter = ref<'all' | 'error' | 'warn' | 'log'>('all')
const logContainerRef = ref<HTMLDivElement | null>(null)

const errorCount = computed(() => props.entries.filter((e) => e.level === 'error').length)
const warnCount = computed(() => props.entries.filter((e) => e.level === 'warn').length)
const logCount = computed(() => props.entries.filter((e) => e.level === 'log' || e.level === 'info').length)

const filteredEntries = computed(() => {
  if (activeFilter.value === 'all') return props.entries
  if (activeFilter.value === 'error') return props.entries.filter((e) => e.level === 'error')
  if (activeFilter.value === 'warn') return props.entries.filter((e) => e.level === 'warn')
  return props.entries.filter((e) => e.level === 'log' || e.level === 'info')
})

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    scrollToBottom()
  }
}

// 自动滚动到最新日志
const scrollToBottom = () => {
  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  })
}

// 监听新增日志自动随动
watch(
  () => props.entries.length,
  () => {
    if (isExpanded.value) {
      scrollToBottom()
    }
  },
)

const formatTime = (timestamp: number) => {
  const d = new Date(timestamp)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<style scoped>
.artifact-console-drawer {
  display: flex;
  flex-direction: column;
  width: 100%;
  background: #090d16;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace;
  color: #e2e8f0;
  flex-shrink: 0;
  user-select: text;
  z-index: 10;
}

.console-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  padding: 0 12px;
  background: #0f172a;
  cursor: pointer;
  user-select: none;
  font-size: 11px;
}

.console-status-bar:hover {
  background: #1e293b;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.console-icon {
  font-size: 12px;
  color: #94a3b8;
}

.console-title {
  font-weight: 600;
  color: #cbd5e1;
}

.badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

.badge-pill .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.badge-pill.error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.badge-pill.error .dot {
  background: #ef4444;
}

.badge-pill.warn {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
}

.badge-pill.warn .dot {
  background: #f59e0b;
}

.badge-pill.log {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
}

.badge-pill.clean {
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
}

.status-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-clear {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.btn-clear:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
}

.btn-toggle {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
}

.console-panel-body {
  height: 180px;
  display: flex;
  flex-direction: column;
  background: #090d16;
}

.filter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: rgba(15, 23, 42, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.filter-tabs {
  display: flex;
  gap: 4px;
}

.filter-btn {
  background: transparent;
  border: none;
  font-size: 11px;
  color: #64748b;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-btn:hover {
  color: #cbd5e1;
}

.filter-btn.active {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  font-weight: 600;
}

.log-entries-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 6px 12px;
  font-size: 12px;
  line-height: 1.5;
}

.log-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.log-time {
  color: #475569;
  font-size: 11px;
  flex-shrink: 0;
}

.log-level-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 0 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.log-level-tag.error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.log-level-tag.warn {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
}

.log-level-tag.log,
.log-level-tag.info {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
}

.log-message {
  flex: 1;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
  font-size: inherit;
  color: #cbd5e1;
}

.log-row.is-error .log-message {
  color: #fca5a5;
}

.log-row.is-warn .log-message {
  color: #fde68a;
}

.console-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

.empty-icon {
  color: #10b981;
}
</style>
