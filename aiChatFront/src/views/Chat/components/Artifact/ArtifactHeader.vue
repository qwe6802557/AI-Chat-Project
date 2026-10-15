<template>
  <div class="artifact-header-container">
    <!-- 多产物 Tab 切换条（当会话中存在超过 1 个产物时显示） -->
    <div v-if="artifactList.length > 1" class="multi-artifact-tabs">
      <div
        v-for="item in artifactList"
        :key="item.identifier"
        class="artifact-tab-item"
        :class="{ active: item.identifier === activeArtifact?.identifier }"
        @click="artifactStore.openArtifact(item.identifier)"
      >
        <component :is="getTypeIcon(item.type)" class="tab-type-icon" />
        <span class="tab-title">{{ item.title }}</span>
        <span v-if="item.versions.length > 1" class="tab-version-tag">
          v{{ item.versions.length }}
        </span>
      </div>
    </div>

    <!-- 核心工具栏 -->
    <div class="toolbar-row">
      <div class="toolbar-left">
        <div class="artifact-meta">
          <span class="artifact-main-title">{{ activeArtifact?.title || '产物预览' }}</span>
          
          <!-- 版本下拉选择器 -->
          <div v-if="versionOptions.length > 1" class="version-select-wrapper">
            <a-select
              :value="activeVersionIndex"
              :options="versionOptions"
              size="small"
              class="version-select"
              :bordered="false"
              @change="(val: any) => artifactStore.selectVersion(Number(val))"
            />
          </div>
          <span v-else class="version-single-pill">v1</span>
        </div>
      </div>

      <div class="toolbar-center">
        <!-- 预览 / 源码分段切换 -->
        <div class="segmented-control">
          <button
            type="button"
            class="seg-btn"
            :class="{ active: activeTab === 'preview' }"
            @click="artifactStore.setActiveTab('preview')"
          >
            <EyeOutlined class="seg-icon" />
            <span>预览</span>
          </button>
          <button
            type="button"
            class="seg-btn"
            :class="{ active: activeTab === 'code' }"
            @click="artifactStore.setActiveTab('code')"
          >
            <CodeOutlined class="seg-icon" />
            <span>源码</span>
          </button>
          <button
            v-if="hasMultipleVersions"
            type="button"
            class="seg-btn"
            :class="{ active: activeTab === 'diff' }"
            @click="artifactStore.setActiveTab('diff')"
          >
            <DiffOutlined class="seg-icon" />
            <span>差异对比</span>
          </button>
        </div>

        <!-- 视口模拟器（仅在预览 Tab 下展示） -->
        <div v-if="activeTab === 'preview'" class="viewport-device-toggle">
          <button
            type="button"
            class="device-btn"
            :class="{ active: viewportMode === 'responsive' }"
            title="自适应全宽"
            @click="artifactStore.setViewportMode('responsive')"
          >
            <ExpandOutlined />
          </button>
          <button
            type="button"
            class="device-btn"
            :class="{ active: viewportMode === 'desktop' }"
            title="桌面视口 (1200px)"
            @click="artifactStore.setViewportMode('desktop')"
          >
            <LaptopOutlined />
          </button>
          <button
            type="button"
            class="device-btn"
            :class="{ active: viewportMode === 'tablet' }"
            title="平板视口 (768px)"
            @click="artifactStore.setViewportMode('tablet')"
          >
            <TabletOutlined />
          </button>
          <button
            type="button"
            class="device-btn"
            :class="{ active: viewportMode === 'mobile' }"
            title="手机视口 (375px)"
            @click="artifactStore.setViewportMode('mobile')"
          >
            <MobileOutlined />
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <!-- 跨轮次提出修改 -->
        <button
          type="button"
          class="action-btn-iteration"
          title="基于当前版本在输入框预填修改指令"
          @click="handleRequestIteration"
        >
          <EditOutlined class="btn-icon" />
          <span>提出修改</span>
        </button>

        <div class="divider-v"></div>

        <!-- 复制代码 -->
        <button
          type="button"
          class="tool-btn"
          title="复制代码内容"
          @click="handleCopy"
        >
          <CopyOutlined />
        </button>

        <!-- 导出文件（SVG / Mermaid 专属矢量与高清 PNG 双通道下拉） -->
        <a-dropdown v-if="isGraphicArtifact" :trigger="['click']">
          <button
            type="button"
            class="tool-btn"
            title="导出选项"
          >
            <DownloadOutlined />
          </button>
          <template #overlay>
            <a-menu class="export-dropdown-menu">
              <a-menu-item key="source" @click="handleExportSource">
                <FileTextOutlined />
                <span>导出矢量源码 ({{ isMermaid ? '.mmd' : '.svg' }})</span>
              </a-menu-item>
              <a-menu-item key="png" @click="handleExportPng">
                <FileImageOutlined />
                <span>导出高清图片 (.png, 2x Retina)</span>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <button
          v-else
          type="button"
          class="tool-btn"
          title="导出下载"
          @click="handleExportSource"
        >
          <DownloadOutlined />
        </button>

        <div class="divider-v"></div>

        <!-- 全屏最大化切换 -->
        <button
          type="button"
          class="tool-btn"
          :title="isMaximized ? '退出全屏' : '全屏最大化'"
          @click="artifactStore.toggleMaximize()"
        >
          <FullscreenExitOutlined v-if="isMaximized" />
          <FullscreenOutlined v-else />
        </button>

        <!-- 关闭工作区 -->
        <button
          type="button"
          class="tool-btn close-btn"
          title="关闭工作区"
          @click="artifactStore.closeWorkspace()"
        >
          <CloseOutlined />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import {
  CodeOutlined,
  EyeOutlined,
  CopyOutlined,
  DownloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CloseOutlined,
  LaptopOutlined,
  TabletOutlined,
  MobileOutlined,
  ExpandOutlined,
  GlobalOutlined,
  FileImageOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  DiffOutlined,
  EditOutlined,
} from '@ant-design/icons-vue'
import { useArtifactStore } from '../../stores/useArtifactStore'
import { rasterizeSvgToPng, downloadBlobFile } from '../../utils/rasterizeSvg'

defineOptions({
  name: 'ArtifactHeader',
})

const artifactStore = useArtifactStore()
const {
  artifactList,
  activeArtifact,
  activeVersionIndex,
  isMaximized,
  viewportMode,
  activeTab,
  currentVersion,
} = storeToRefs(artifactStore)

const hasMultipleVersions = computed(() => {
  return (activeArtifact.value?.versions?.length || 0) > 1
})

const versionOptions = computed(() => {
  const art = activeArtifact.value
  if (!art || !art.versions) return []
  return art.versions.map((v, index) => ({
    label: `v${v.version}${index === art.versions.length - 1 ? ' (最新)' : ''}`,
    value: index,
  }))
})

const getTypeIcon = (type: string) => {
  if (type.includes('html')) return GlobalOutlined
  if (type.includes('svg')) return FileImageOutlined
  if (type.includes('mermaid')) return ApartmentOutlined
  return CodeOutlined
}

const handleCopy = async () => {
  const content = currentVersion.value?.content || ''
  if (!content) return

  try {
    await navigator.clipboard.writeText(content)
    message.success('产物源码已复制到剪贴板')
  } catch {
    message.error('复制失败，请手动选择复制')
  }
}

const handleRequestIteration = () => {
  if (!activeArtifact.value) return
  artifactStore.requestIteration(activeArtifact.value.identifier)
  message.success('已将当前产物修改提示词填入输入框，请补充修改要求后发送')
}

const isGraphicArtifact = computed(() => {
  const type = (activeArtifact.value?.type || '').toLowerCase()
  const content = (currentVersion.value?.content || '').trim()
  return (
    type.includes('svg') ||
    type.includes('mermaid') ||
    content.startsWith('<svg') ||
    content.startsWith('graph ') ||
    content.startsWith('flowchart ')
  )
})

const isMermaid = computed(() => {
  const type = (activeArtifact.value?.type || '').toLowerCase()
  const content = (currentVersion.value?.content || '').trim()
  return type.includes('mermaid') || content.startsWith('graph ') || content.startsWith('flowchart ')
})

const handleExportSource = () => {
  const art = activeArtifact.value
  const version = currentVersion.value
  if (!art || !version) return

  const content = version.content || ''
  let extension = 'txt'
  let mimeType = 'text/plain;charset=utf-8'

  const lang = (version.language || art.language || '').toLowerCase()
  const type = art.type.toLowerCase()

  const extMap: Record<string, { ext: string; mime: string }> = {
    html: { ext: 'html', mime: 'text/html;charset=utf-8' },
    svg: { ext: 'svg', mime: 'image/svg+xml;charset=utf-8' },
    mermaid: { ext: 'mmd', mime: 'text/vnd.mermaid;charset=utf-8' },
    markdown: { ext: 'md', mime: 'text/markdown;charset=utf-8' },
    md: { ext: 'md', mime: 'text/markdown;charset=utf-8' },
    typescript: { ext: 'ts', mime: 'text/typescript;charset=utf-8' },
    ts: { ext: 'ts', mime: 'text/typescript;charset=utf-8' },
    javascript: { ext: 'js', mime: 'text/javascript;charset=utf-8' },
    js: { ext: 'js', mime: 'text/javascript;charset=utf-8' },
    python: { ext: 'py', mime: 'text/x-python;charset=utf-8' },
    py: { ext: 'py', mime: 'text/x-python;charset=utf-8' },
    json: { ext: 'json', mime: 'application/json;charset=utf-8' },
    css: { ext: 'css', mime: 'text/css;charset=utf-8' },
    vue: { ext: 'vue', mime: 'text/x-vue;charset=utf-8' },
    sql: { ext: 'sql', mime: 'text/x-sql;charset=utf-8' },
    go: { ext: 'go', mime: 'text/x-go;charset=utf-8' },
    rust: { ext: 'rs', mime: 'text/x-rust;charset=utf-8' },
    java: { ext: 'java', mime: 'text/x-java;charset=utf-8' },
  }

  if (type.includes('html')) {
    extension = 'html'
    mimeType = 'text/html;charset=utf-8'
  } else if (type.includes('svg')) {
    extension = 'svg'
    mimeType = 'image/svg+xml;charset=utf-8'
  } else if (type.includes('mermaid')) {
    extension = 'mmd'
    mimeType = 'text/plain;charset=utf-8'
  } else if (extMap[lang]) {
    extension = extMap[lang].ext
    mimeType = extMap[lang].mime
  }

  const filename = `${art.identifier}-v${version.version}.${extension}`
  const blob = new Blob([content], { type: mimeType })
  downloadBlobFile(blob, filename)
  message.success(`已导出文件：${filename}`)
}

const handleExportPng = async () => {
  const art = activeArtifact.value
  const version = currentVersion.value
  if (!art || !version) return

  let svgString = ''
  if (isMermaid.value) {
    const svgEl = document.querySelector('.generic-preview-stage svg')
    svgString = svgEl ? svgEl.outerHTML : ''
    if (!svgString) {
      message.warning('Mermaid 图表尚在渲染中，请稍候重试导出')
      return
    }
  } else {
    svgString = version.content || ''
  }

  try {
    message.loading({ content: '正在生成 2x 高清 PNG 图片...', key: 'export-png' })
    const pngBlob = await rasterizeSvgToPng(svgString, { scale: 2, backgroundColor: '#ffffff' })
    const filename = `${art.identifier}-v${version.version}-2x.png`
    downloadBlobFile(pngBlob, filename)
    message.success({ content: `已成功导出高清图片：${filename}`, key: 'export-png' })
  } catch (err: any) {
    message.error({ content: `导出图片失败：${err?.message || '未知错误'}`, key: 'export-png' })
  }
}
</script>

<style scoped>
.artifact-header-container {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-bottom: 1px solid rgba(226, 232, 240, 0.85);
  flex-shrink: 0;
}

.multi-artifact-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px 0 12px;
  background: #f8fafc;
  overflow-x: auto;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
}

.multi-artifact-tabs::-webkit-scrollbar {
  height: 2px;
}

.artifact-tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: #64748b;
  background: transparent;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  user-select: none;
}

.artifact-tab-item:hover {
  color: #0f172a;
  background: rgba(241, 245, 249, 0.8);
}

.artifact-tab-item.active {
  color: #2563eb;
  background: #ffffff;
  font-weight: 600;
  box-shadow: 0 -1px 2px rgba(15, 23, 42, 0.04);
}

.tab-type-icon {
  font-size: 13px;
}

.tab-title {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-version-tag {
  font-size: 10px;
  padding: 1px 4px;
  background: #f1f5f9;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.artifact-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.artifact-main-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.version-select-wrapper {
  background: #f1f5f9;
  border-radius: 6px;
  padding: 0 4px;
}

.version-select {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #475569;
  min-width: 80px;
}

.version-single-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 10px;
}

.segmented-control {
  display: flex;
  background: #f1f5f9;
  padding: 2px;
  border-radius: 8px;
}

.seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.seg-btn:hover {
  color: #0f172a;
}

.seg-btn.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.seg-icon {
  font-size: 12px;
}

.viewport-device-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  background: #f1f5f9;
  padding: 2px;
  border-radius: 8px;
}

.device-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 13px;
  color: #64748b;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.device-btn:hover {
  color: #0f172a;
}

.device-btn.active {
  background: #ffffff;
  color: #2563eb;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn-iteration {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn-iteration:hover {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.35);
  color: #4338ca;
}

.action-btn-iteration:active {
  transform: scale(0.98);
}

.action-btn-iteration .btn-icon {
  font-size: 12px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  font-size: 14px;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-btn:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.tool-btn:active {
  transform: translateY(1px);
}

.tool-btn.close-btn:hover {
  color: #ef4444;
  background: #fee2e2;
}

.divider-v {
  width: 1px;
  height: 16px;
  background: rgba(226, 232, 240, 0.9);
  margin: 0 4px;
}

:deep(.export-dropdown-menu) {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
}

:deep(.export-dropdown-menu .ant-dropdown-menu-item) {
  color: #cbd5e1;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

:deep(.export-dropdown-menu .ant-dropdown-menu-item:hover) {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}
</style>
