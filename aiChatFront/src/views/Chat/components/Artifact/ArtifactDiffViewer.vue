<template>
  <div class="artifact-diff-viewer">
    <!-- 顶部版本对比控制栏 -->
    <div class="diff-viewer-topbar">
      <div class="diff-version-picker">
        <span class="picker-label">基准:</span>
        <a-select
          v-model:value="baseVersionIndex"
          :options="versionSelectOptions"
          size="small"
          class="version-dropdown"
          :bordered="false"
        />

        <span class="picker-arrow">➔</span>

        <span class="picker-label">对比:</span>
        <a-select
          v-model:value="targetVersionIndex"
          :options="versionSelectOptions"
          size="small"
          class="version-dropdown"
          :bordered="false"
        />
      </div>

      <!-- 差异统计 Pills -->
      <div class="diff-stats-pills">
        <span class="diff-pill added">
          +{{ diffResult.addedCount }}
        </span>
        <span class="diff-pill removed">
          -{{ diffResult.removedCount }}
        </span>
        <span class="diff-pill unchanged">
          {{ diffResult.unchangedCount }} 行未变
        </span>
      </div>
    </div>

    <!-- 差异行展示区域 -->
    <div v-if="hasDifferences" class="diff-scroll-container">
      <div
        v-for="(line, index) in diffResult.lines"
        :key="index"
        class="diff-line-row"
        :class="`is-${line.type}`"
      >
        <!-- 旧行号 -->
        <span class="line-num old-num">
          {{ line.type === 'added' ? '' : line.oldLineNumber }}
        </span>
        <!-- 新行号 -->
        <span class="line-num new-num">
          {{ line.type === 'removed' ? '' : line.newLineNumber }}
        </span>
        <!-- 差异标志 -->
        <span class="diff-marker">
          {{ line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ' }}
        </span>
        <!-- 代码正文 -->
        <pre class="diff-code-text">{{ line.content }}</pre>
      </div>
    </div>

    <!-- 无差异提示 -->
    <div v-else class="diff-empty-state">
      <CheckCircleOutlined class="empty-icon" />
      <span class="empty-title">选中的两个版本代码完全一致</span>
      <span class="empty-desc">未检测到任何增删或改动行</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CheckCircleOutlined } from '@ant-design/icons-vue'
import { computeLineDiff } from '../../utils/lineDiff'
import type { ArtifactItem } from '../../types/artifact'

defineOptions({
  name: 'ArtifactDiffViewer',
})

const props = defineProps<{
  artifact: ArtifactItem | null
  currentVersionIndex: number
}>()

const baseVersionIndex = ref<number>(0)
const targetVersionIndex = ref<number>(0)

// 响应父级版本序号与产物版本变化
watch(
  () => [props.artifact, props.currentVersionIndex],
  () => {
    const art = props.artifact
    if (!art || !art.versions || art.versions.length === 0) {
      baseVersionIndex.value = 0
      targetVersionIndex.value = 0
      return
    }

    const maxIdx = art.versions.length - 1
    const currentIdx = Math.min(Math.max(0, props.currentVersionIndex), maxIdx)
    targetVersionIndex.value = currentIdx

    // 基准版本默认为 target 的前一个版本，若 target 为 0 则基准为 0，target 设为 1（若有多版本）
    if (currentIdx > 0) {
      baseVersionIndex.value = currentIdx - 1
    } else if (art.versions.length > 1) {
      baseVersionIndex.value = 0
      targetVersionIndex.value = 1
    } else {
      baseVersionIndex.value = 0
    }
  },
  { immediate: true },
)

const versionSelectOptions = computed(() => {
  const art = props.artifact
  if (!art || !art.versions) return []
  return art.versions.map((v, idx) => ({
    label: `v${v.version}${idx === art.versions.length - 1 ? ' (最新)' : ''}`,
    value: idx,
  }))
})

const baseVersionContent = computed(() => {
  const art = props.artifact
  if (!art || !art.versions || art.versions.length === 0) return ''
  const item = art.versions[baseVersionIndex.value]
  return item ? item.content : ''
})

const targetVersionContent = computed(() => {
  const art = props.artifact
  if (!art || !art.versions || art.versions.length === 0) return ''
  const item = art.versions[targetVersionIndex.value]
  return item ? item.content : ''
})

const diffResult = computed(() => {
  return computeLineDiff(baseVersionContent.value, targetVersionContent.value)
})

const hasDifferences = computed(() => {
  return diffResult.value.addedCount > 0 || diffResult.value.removedCount > 0
})
</script>

<style scoped>
.artifact-diff-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #090d16;
  color: #e2e8f0;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace;
}

.diff-viewer-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  flex-shrink: 0;
  gap: 12px;
}

.diff-version-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.picker-label {
  color: #94a3b8;
  font-size: 12px;
}

.picker-arrow {
  color: #64748b;
  font-size: 11px;
}

.version-dropdown {
  min-width: 96px;
  background: rgba(30, 41, 59, 0.8);
  border-radius: 6px;
  color: #e2e8f0;
}

:deep(.version-dropdown .ant-select-selector) {
  color: #e2e8f0 !important;
  font-size: 12px !important;
}

.diff-stats-pills {
  display: flex;
  align-items: center;
  gap: 6px;
}

.diff-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.diff-pill.added {
  color: #10b981;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.diff-pill.removed {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.diff-pill.unchanged {
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.05);
  font-weight: 400;
}

.diff-scroll-container {
  flex: 1;
  overflow: auto;
  padding: 8px 0;
  font-size: 12px;
  line-height: 1.6;
}

.diff-line-row {
  display: flex;
  align-items: stretch;
  min-height: 22px;
  user-select: text;
}

.diff-line-row:hover {
  filter: brightness(1.15);
}

.diff-line-row.is-added {
  background: rgba(16, 185, 129, 0.12);
}

.diff-line-row.is-removed {
  background: rgba(239, 68, 68, 0.12);
}

.diff-line-row.is-unchanged {
  background: transparent;
}

.line-num {
  display: inline-block;
  width: 44px;
  text-align: right;
  padding-right: 8px;
  color: #475569;
  user-select: none;
  flex-shrink: 0;
  font-size: 11px;
}

.diff-line-row.is-added .line-num.new-num {
  color: #10b981;
}

.diff-line-row.is-removed .line-num.old-num {
  color: #ef4444;
}

.diff-marker {
  display: inline-block;
  width: 22px;
  text-align: center;
  font-weight: 700;
  user-select: none;
  flex-shrink: 0;
}

.diff-line-row.is-added .diff-marker {
  color: #10b981;
}

.diff-line-row.is-removed .diff-marker {
  color: #ef4444;
}

.diff-line-row.is-unchanged .diff-marker {
  color: transparent;
}

.diff-code-text {
  flex: 1;
  margin: 0;
  padding: 0 12px 0 4px;
  white-space: pre;
  word-break: normal;
  overflow-x: visible;
  font-family: inherit;
  font-size: inherit;
  color: #e2e8f0;
}

.diff-line-row.is-added .diff-code-text {
  color: #a7f3d0;
}

.diff-line-row.is-removed .diff-code-text {
  color: #fca5a5;
}

.diff-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8px;
  color: #94a3b8;
}

.empty-icon {
  font-size: 32px;
  color: #10b981;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
}

.empty-desc {
  font-size: 12px;
  color: #64748b;
}
</style>
