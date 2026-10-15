<template>
  <div class="artifact-sandbox-container" :class="[`viewport-${viewportMode}`, { 'dark-theme': isDarkCanvas }]">
    <!-- 中间滚动舞台区域 -->
    <div class="viewport-stage-scroll-area">
      <div class="viewport-stage" :style="stageStyle">
        <!-- 1. HTML 渲染（采用严格隔离沙箱 iframe） -->
        <iframe
          v-if="isHtml"
          ref="iframeRef"
          class="sandbox-iframe"
          :srcdoc="safeHtmlSrcdoc"
          sandbox="allow-scripts allow-modals"
          title="Artifact Sandbox"
        />

        <!-- 2. SVG 矢量图形渲染 -->
        <div v-else-if="isSvg" class="svg-stage">
          <div class="svg-wrapper" v-html="sanitizedSvg" />
        </div>

        <!-- 3. Mermaid 图表或其它产物降级渲染 -->
        <div v-else class="generic-preview-stage">
          <div class="generic-content" v-html="genericHtml" />
        </div>
      </div>
    </div>

    <!-- 运行时虚拟控制台（仅在 HTML 交互渲染时挂载于底部） -->
    <ArtifactConsoleDrawer
      v-if="isHtml"
      :entries="consoleEntries"
      @clear="clearConsole"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import DOMPurify from 'dompurify'
import { renderMarkdown } from '@/utils/markdown'
import type { ViewportMode, ArtifactType } from '../../types/artifact'
import ArtifactConsoleDrawer, { type ConsoleEntry } from './ArtifactConsoleDrawer.vue'

defineOptions({
  name: 'ArtifactSandbox',
})

const props = defineProps<{
  content: string
  type: ArtifactType
  viewportMode: ViewportMode
}>()

const isDarkCanvas = ref(false)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const consoleEntries = ref<ConsoleEntry[]>([])
let logIdCounter = 0

const CONSOLE_INTERCEPTOR_SCRIPT = `<script>
(function() {
  function serializeArg(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
    if (arg instanceof Error) return arg.stack || arg.message || String(arg);
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }

  function sendLog(level, args) {
    try {
      var serialized = Array.prototype.slice.call(args).map(serializeArg).join(' ');
      window.parent.postMessage({
        type: 'artifact-console-log',
        level: level,
        message: serialized,
        time: Date.now()
      }, '*');
    } catch(e) {}
  }

  var origLog = console.log;
  var origWarn = console.warn;
  var origError = console.error;
  var origInfo = console.info;

  console.log = function() {
    sendLog('log', arguments);
    if (origLog) origLog.apply(console, arguments);
  };
  console.warn = function() {
    sendLog('warn', arguments);
    if (origWarn) origWarn.apply(console, arguments);
  };
  console.error = function() {
    sendLog('error', arguments);
    if (origError) origError.apply(console, arguments);
  };
  console.info = function() {
    sendLog('info', arguments);
    if (origInfo) origInfo.apply(console, arguments);
  };

  window.addEventListener('error', function(e) {
    sendLog('error', [e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '')]);
  });

  window.addEventListener('unhandledrejection', function(e) {
    sendLog('error', ['Unhandled Promise Rejection: ' + serializeArg(e.reason)]);
  });
})();
<\/script>`

const isHtml = computed(() => {
  return props.type.includes('html') || props.content.trim().startsWith('<!DOCTYPE') || props.content.trim().startsWith('<html')
})

const isSvg = computed(() => {
  return props.type.includes('svg') || props.content.trim().startsWith('<svg')
})

/**
 * 包装并注入轻量安全、重置样式与控制台监控的 HTML srcdoc
 */
const safeHtmlSrcdoc = computed(() => {
  let raw = props.content || ''
  if (!raw.includes('<html') && !raw.includes('<body')) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${CONSOLE_INTERCEPTOR_SCRIPT}
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
${raw}
</body>
</html>`
  }

  if (raw.includes('<head>')) {
    return raw.replace('<head>', `<head>\n${CONSOLE_INTERCEPTOR_SCRIPT}`)
  } else if (raw.includes('<html>')) {
    return raw.replace('<html>', `<html>\n<head>${CONSOLE_INTERCEPTOR_SCRIPT}</head>`)
  } else {
    return `${CONSOLE_INTERCEPTOR_SCRIPT}\n${raw}`
  }
})

const handleWindowMessage = (e: MessageEvent) => {
  if (e.data && e.data.type === 'artifact-console-log') {
    logIdCounter++
    consoleEntries.value.push({
      id: `log-${logIdCounter}-${Date.now()}`,
      level: e.data.level || 'log',
      message: String(e.data.message || ''),
      time: e.data.time || Date.now(),
    })
  }
}

const clearConsole = () => {
  consoleEntries.value = []
}

// 切换产物内容时清空旧控制台日志
watch(
  () => props.content,
  () => {
    clearConsole()
  },
)

onMounted(() => {
  window.addEventListener('message', handleWindowMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleWindowMessage)
})

/**
 * 清洗过滤后的 SVG
 */
const sanitizedSvg = computed(() => {
  return DOMPurify.sanitize(props.content || '', {
    USE_PROFILES: { svg: true, svgFilters: true },
  })
})

/**
 * 泛型/Mermaid 预览 HTML
 */
const genericHtml = computed(() => {
  if (props.type.includes('mermaid')) {
    // 包裹为 markdown 代码块交给全局 marked 渲染
    return renderMarkdown('```mermaid\n' + props.content + '\n```')
  }
  return renderMarkdown(props.content)
})

/**
 * 根据模拟视口模式计算舞台尺寸
 */
const stageStyle = computed(() => {
  switch (props.viewportMode) {
    case 'mobile':
      return {
        width: '375px',
        height: '667px',
        maxWidth: '100%',
        maxHeight: '100%',
        boxShadow: '0 12px 36px rgba(15, 23, 42, 0.16)',
        borderRadius: '24px',
        border: '8px solid #0f172a',
      }
    case 'tablet':
      return {
        width: '768px',
        height: '920px',
        maxWidth: '100%',
        maxHeight: '100%',
        boxShadow: '0 12px 36px rgba(15, 23, 42, 0.12)',
        borderRadius: '16px',
        border: '6px solid #1e293b',
      }
    case 'desktop':
      return {
        width: '1200px',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
        borderRadius: '8px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
      }
    case 'responsive':
    default:
      return {
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        borderRadius: '0',
        border: 'none',
      }
  }
})
</script>

<style scoped>
.artifact-sandbox-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f8fafc;
  background-image: radial-gradient(rgba(203, 213, 225, 0.45) 1px, transparent 0);
  background-size: 16px 16px;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.viewport-stage-scroll-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex: 1;
  overflow: auto;
  padding: 16px;
  box-sizing: border-box;
}

.artifact-sandbox-container.viewport-responsive {
  background-image: none;
}

.artifact-sandbox-container.viewport-responsive .viewport-stage-scroll-area {
  padding: 0;
}

.viewport-stage {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  flex-shrink: 0;
  margin: auto;
}

.sandbox-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
  display: block;
}

.svg-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 24px;
}

.svg-wrapper {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.svg-wrapper :deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
}

.generic-preview-stage {
  padding: 24px;
  overflow: auto;
  width: 100%;
  height: 100%;
}
</style>
