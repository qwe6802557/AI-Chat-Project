<template>
  <div
    class="artifact-capsule-card"
    role="button"
    tabindex="0"
    :title="`在画布中打开产物：${artifact.title}`"
    @click="handleOpen"
    @keydown.enter="handleOpen"
  >
    <div class="capsule-left">
      <div class="icon-badge" :class="getTypeBadgeClass(artifact.type)">
        <component :is="getTypeIcon(artifact.type)" class="type-icon" />
      </div>
      <div class="info-meta">
        <div class="title-row">
          <span class="artifact-title">{{ artifact.title }}</span>
          <span v-if="!artifact.isComplete" class="streaming-pill">
            <LoadingOutlined spin class="pill-spinner" />
            <span>生成中</span>
          </span>
        </div>
        <div class="type-label-row">
          <span class="type-pill">{{ formatTypeLabel(artifact.type, artifact.language) }}</span>
          <span class="identifier-hint">{{ artifact.identifier }}</span>
        </div>
      </div>
    </div>

    <div class="capsule-right">
      <span class="action-text">在画布中打开</span>
      <RightOutlined class="action-icon" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CodeOutlined,
  GlobalOutlined,
  FileImageOutlined,
  ApartmentOutlined,
  RightOutlined,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import { useArtifactStore } from '../../stores/useArtifactStore'
import { getActivePinia } from 'pinia'
import type { ExtractedArtifactTag } from '../../utils/assistantContent'

defineOptions({
  name: 'ArtifactCapsuleCard',
})

const props = defineProps<{
  artifact: ExtractedArtifactTag
}>()

const emit = defineEmits<{
  (e: 'open', identifier: string): void
}>()

const handleOpen = () => {
  if (getActivePinia()) {
    const artifactStore = useArtifactStore()
    artifactStore.openArtifact(props.artifact.identifier)
  }
  emit('open', props.artifact.identifier)
}

const getTypeIcon = (type: string) => {
  if (type.includes('html')) return GlobalOutlined
  if (type.includes('svg')) return FileImageOutlined
  if (type.includes('mermaid')) return ApartmentOutlined
  return CodeOutlined
}

const getTypeBadgeClass = (type: string) => {
  if (type.includes('html')) return 'is-html'
  if (type.includes('svg')) return 'is-svg'
  if (type.includes('mermaid')) return 'is-mermaid'
  return 'is-code'
}

const formatTypeLabel = (type: string, lang?: string) => {
  if (type.includes('html')) return 'HTML 网页'
  if (type.includes('svg')) return 'SVG 矢量图'
  if (type.includes('mermaid')) return 'Mermaid 图表'
  if (lang) return lang.toUpperCase()
  return '代码产物'
}
</script>

<style scoped>
.artifact-capsule-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  margin: 10px 0;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.artifact-capsule-card:hover {
  border-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
}

.artifact-capsule-card:active {
  transform: translateY(0);
}

.capsule-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 16px;
  flex-shrink: 0;
  background: #f1f5f9;
  color: #475569;
}

.icon-badge.is-html {
  background: #eff6ff;
  color: #2563eb;
}

.icon-badge.is-svg {
  background: #f0fdf4;
  color: #16a34a;
}

.icon-badge.is-mermaid {
  background: #faf5ff;
  color: #9333ea;
}

.icon-badge.is-code {
  background: #f8fafc;
  color: #0f172a;
}

.info-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.artifact-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

.streaming-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  font-size: 11px;
  color: #2563eb;
  background: #eff6ff;
  border-radius: 999px;
  font-family: 'JetBrains Mono', monospace;
}

.pill-spinner {
  font-size: 10px;
}

.type-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-pill {
  font-size: 11px;
  color: #64748b;
  font-family: 'JetBrains Mono', monospace;
}

.identifier-hint {
  font-size: 11px;
  color: #94a3b8;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.capsule-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #2563eb;
  flex-shrink: 0;
  padding-left: 8px;
}

.action-icon {
  font-size: 11px;
  transition: transform 0.2s ease;
}

.artifact-capsule-card:hover .action-icon {
  transform: translateX(2px);
}
</style>
