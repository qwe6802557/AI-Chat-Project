<template>
  <div class="artifact-code-viewer">
    <div class="code-viewer-topbar">
      <span class="lang-tag">{{ displayLanguage }}</span>
      <span class="lines-count">{{ lineCount }} 行</span>
    </div>
    <div class="code-scroll-container">
      <div class="line-numbers" aria-hidden="true">
        <span v-for="n in lineCount" :key="n">{{ n }}</span>
      </div>
      <pre class="code-pre"><code class="hljs" :class="`language-${displayLanguage}`" v-html="highlightedCode" /></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

defineOptions({
  name: 'ArtifactCodeViewer',
})

const props = defineProps<{
  code: string
  language?: string
}>()

const displayLanguage = computed(() => {
  if (props.language) return props.language
  // 简易推断
  const text = (props.code || '').trim()
  if (text.startsWith('<svg') || text.includes('</svg>')) return 'xml'
  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.includes('</div>')) return 'html'
  if (text.startsWith('graph ') || text.startsWith('flowchart ') || text.startsWith('sequenceDiagram')) return 'mermaid'
  return 'plaintext'
})

const lineCount = computed(() => {
  if (!props.code) return 1
  return props.code.split('\n').length
})

const highlightedCode = computed(() => {
  const text = props.code || ''
  const lang = displayLanguage.value
  const validLang = hljs.getLanguage(lang) ? lang : 'plaintext'

  try {
    return hljs.highlight(text, {
      language: validLang,
      ignoreIllegals: true,
    }).value
  } catch {
    // 降级使用普通转义
    return escapeHtml(text)
  }
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
</script>

<style scoped>
.artifact-code-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #090d16;
  color: #e2e8f0;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.code-viewer-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
}

.lang-tag {
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.lines-count {
  color: #64748b;
}

.code-scroll-container {
  display: flex;
  flex: 1;
  overflow: auto;
  padding: 12px 0;
}

.code-scroll-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.code-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.code-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.line-numbers {
  display: flex;
  flex-direction: column;
  padding: 0 12px 0 16px;
  text-align: right;
  color: #475569;
  font-size: 12px;
  line-height: 1.6;
  user-select: none;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.code-pre {
  margin: 0;
  padding: 0 16px;
  flex: 1;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.6;
  overflow: visible;
}

.code-pre code {
  background: transparent !important;
  padding: 0 !important;
  font-family: inherit;
  white-space: pre;
}
</style>
