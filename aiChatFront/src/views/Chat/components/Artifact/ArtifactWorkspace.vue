<template>
  <div
    v-if="isWorkspaceOpen"
    class="artifact-workspace-wrapper"
    :class="{ 'is-maximized': isMaximized }"
  >
    <!-- 左侧可拖拽 Divider 把手（最大化状态下不显示） -->
    <div
      v-if="!isMaximized"
      class="resizer-handle"
      role="separator"
      tabindex="0"
      title="拖拽调节工作区分栏比例"
      @mousedown="startDragging"
    >
      <div class="resizer-line"></div>
    </div>

    <!-- 工作区主体 -->
    <div class="artifact-workspace-panel">
      <!-- 顶栏控制器 -->
      <ArtifactHeader />

      <!-- 主视图区域：预览模式 vs 源码模式 vs 差异对比模式 -->
      <div class="artifact-content-stage">
        <ArtifactSandbox
          v-if="activeTab === 'preview'"
          :content="currentVersion?.content || ''"
          :type="activeArtifact?.type || 'application/vnd.ant.code'"
          :viewport-mode="viewportMode"
        />
        <ArtifactCodeViewer
          v-else-if="activeTab === 'code'"
          :code="currentVersion?.content || ''"
          :language="activeArtifact?.language"
        />
        <ArtifactDiffViewer
          v-else-if="activeTab === 'diff'"
          :artifact="activeArtifact"
          :current-version-index="activeVersionIndex"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useArtifactStore } from '../../stores/useArtifactStore'
import ArtifactHeader from './ArtifactHeader.vue'
import ArtifactSandbox from './ArtifactSandbox.vue'
import ArtifactCodeViewer from './ArtifactCodeViewer.vue'
import ArtifactDiffViewer from './ArtifactDiffViewer.vue'

defineOptions({
  name: 'ArtifactWorkspace',
})

const artifactStore = useArtifactStore()
const {
  isWorkspaceOpen,
  isMaximized,
  viewportMode,
  activeTab,
  activeArtifact,
  currentVersion,
  activeVersionIndex,
} = storeToRefs(artifactStore)

let isDragging = false
let containerWidth = 0

const startDragging = (e: MouseEvent) => {
  e.preventDefault()
  isDragging = true
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'

  // 计算可用工作区分栏容器总宽度（已自动隔离左侧 sidebar）
  const parent = document.querySelector('.chat-workspace-container')
  if (parent) {
    containerWidth = parent.clientWidth
  }

  window.addEventListener('mousemove', handleDragging)
  window.addEventListener('mouseup', stopDragging)
}

const handleDragging = (e: MouseEvent) => {
  if (!isDragging || !containerWidth) return

  const parent = document.querySelector('.chat-workspace-container')
  if (!parent) return

  const rect = parent.getBoundingClientRect()
  const mouseX = e.clientX - rect.left

  // 比例 = 左侧鼠标 X / 总宽度
  const ratio = mouseX / rect.width
  artifactStore.setSplitRatio(ratio)
}

const stopDragging = () => {
  if (!isDragging) return
  isDragging = false
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', handleDragging)
  window.removeEventListener('mouseup', stopDragging)
}

// 监听 Esc 键退出全屏或收起画布
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isWorkspaceOpen.value) {
    if (isMaximized.value) {
      artifactStore.toggleMaximize()
    } else {
      artifactStore.closeWorkspace()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  stopDragging()
})
</script>

<style scoped>
.artifact-workspace-wrapper {
  display: flex;
  height: 100%;
  position: relative;
  background: #ffffff;
  border-left: 1px solid rgba(226, 232, 240, 0.9);
  flex-shrink: 0;
  transition: width 0.15s ease-out;
  box-sizing: border-box;
  overflow: hidden;
  z-index: 20;
}

.artifact-workspace-wrapper.is-maximized {
  position: fixed;
  inset: 0;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 1050;
  border-left: none;
}

.resizer-handle {
  width: 10px;
  margin-left: -5px;
  cursor: col-resize;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resizer-line {
  width: 2px;
  height: 36px;
  background: rgba(148, 163, 184, 0.4);
  border-radius: 999px;
  transition: all 0.2s ease;
}

.resizer-handle:hover .resizer-line {
  width: 3px;
  height: 48px;
  background: #2563eb;
}

.artifact-workspace-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
}

.artifact-content-stage {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
</style>
