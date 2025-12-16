/**
 * Markdown 渲染工具
 * marked.js + highlight.js 流式渲染文本
 */

import { marked, type Tokens } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

// ---配置marked---

// 自定义渲染器
const renderer = new marked.Renderer()

// 代码块渲染
renderer.code = ({ text, lang }: Tokens.Code): string => {
  const language = lang || ''
  const validLanguage = hljs.getLanguage(language) ? language : 'plaintext'

  try {
    const highlighted = hljs.highlight(text, {
      language: validLanguage,
      ignoreIllegals: true,
    }).value

    return `<pre class="code-block"><div class="code-header"><span class="code-language">${language || 'code'}</span><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent)">复制</button></div><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`
  } catch {
    // 高亮失败返回原始代码
    return `<pre class="code-block"><div class="code-header"><span class="code-language">${language || 'code'}</span><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent)">复制</button></div><code>${escapeHtml(text)}</code></pre>`
  }
}

// 行内代码渲染
renderer.codespan = ({ text }: Tokens.Codespan): string => {
  return `<code class="inline-code">${escapeHtml(text)}</code>`
}

// 链接渲染
renderer.link = ({ href, title, text }: Tokens.Link): string => {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`
}

// 表格渲染
renderer.table = ({ header, rows }: Tokens.Table): string => {
  const headerHtml = header
    .map((cell) => `<th>${cell.text}</th>`)
    .join('')

  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${cell.text}</td>`).join('')}</tr>`
    )
    .join('')

  return `<div class="table-wrapper"><table class="markdown-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
}

// marked选项
marked.setOptions({
  renderer,
  breaks: true, // 支持单个换行符转换为 <br>
  gfm: true, // 启用GitHub风格Markdown
})

// --- 工具函数 ---

/**
 * HTML 转义函数
 */
function escapeHtml(html: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return html.replace(/[&<>"']/g, (m) => map[m] || m)
}

/**
 * 检查内容是否可以安全渲染
 * 用于混合渲染策略，检测不完整的 Markdown 块
 */
export function canRenderSafely(content: string): boolean {
  // 检查代码块完整性
  const codeBlockMatches = content.match(/```/g) || []
  if (codeBlockMatches.length % 2 !== 0) {
    return false // 代码块不完整
  }

  // 检查行内代码完整性
  const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '')
  const inlineCodeMatches = contentWithoutCodeBlocks.match(/`/g) || []
  if (inlineCodeMatches.length % 2 !== 0) {
    return false // 行内代码不完整
  }

  // 检查加粗/斜体完整性
  const boldMatches = contentWithoutCodeBlocks.match(/\*\*/g) || []
  if (boldMatches.length % 2 !== 0) {
    return false // 加粗不完整
  }

  // 检查表格完整性
  const lines = content.split('\n')
  const lastLine = lines[lines.length - 1]?.trim() || ''

  // 如果最后一行以 | 开头但不以 | 结尾可能表格不完整
  if (lastLine.startsWith('|') && !lastLine.endsWith('|')) {
    return false
  }

  return true
}

/**
 * 渲染 Markdown 为 HTML
 */
export function renderMarkdown(content: string): string {
  if (!content) return ''

  try {
    const html = marked.parse(content) as string
    return html
  } catch (error) {
    console.error('Markdown 渲染失败:', error)
    return `<p>${escapeHtml(content)}</p>`
  }
}

/**
 * 流式渲染 Markdown
 * 使用混合渲染策略：
 * - 当内容完整时-进行完整渲染
 * - 当内容不完整时-返回上一次的渲染结果 + 原始文本
 */
export function renderStreamingMarkdown(
  content: string,
  previousHtml: string = ''
): {
  html: string
  isComplete: boolean
} {
  if (!content) {
    return { html: '', isComplete: true }
  }

  const isComplete = canRenderSafely(content)

  if (isComplete) {
    // 完整进行完整渲染
    return {
      html: renderMarkdown(content),
      isComplete: true,
    }
  } else {
    // 不完整尝试渲染已完整的部分
    // 找到最后一个完整的段落/块
    const lastCompleteIndex = findLastCompleteBlock(content)

    if (lastCompleteIndex > 0) {
      const completeContent = content.substring(0, lastCompleteIndex)
      const incompleteContent = content.substring(lastCompleteIndex)

      return {
        html:
          renderMarkdown(completeContent) +
          `<span class="streaming-text">${escapeHtml(incompleteContent)}</span>`,
        isComplete: false,
      }
    }

    // 无法分割返回之前的 HTML 加上当前原始文本
    if (previousHtml) {
      return {
        html: previousHtml,
        isComplete: false,
      }
    }

    // 没有之前的 HTML返回转义后的原始文本
    return {
      html: `<span class="streaming-text">${escapeHtml(content)}</span>`,
      isComplete: false,
    }
  }
}

/**
 * 找到最后一个完整的 Markdown 块的位置
 */
function findLastCompleteBlock(content: string): number {
  // 从后向前查找-找到最后一个完整的段落分隔符（两个换行）
  const doubleNewlinePattern = /\n\n/g
  let lastIndex = 0
  let match

  while ((match = doubleNewlinePattern.exec(content)) !== null) {
    const substring = content.substring(0, match.index + 2)
    if (canRenderSafely(substring)) {
      lastIndex = match.index + 2
    }
  }

  // 如果没有找到段落分隔符-尝试找单个换行
  if (lastIndex === 0) {
    const singleNewlinePattern = /\n/g
    while ((match = singleNewlinePattern.exec(content)) !== null) {
      const substring = content.substring(0, match.index + 1)
      if (canRenderSafely(substring)) {
        lastIndex = match.index + 1
      }
    }
  }

  return lastIndex
}

/**
 * 简单渲染-不进行完整性检查-用于非流式场景
 */
export function renderMarkdownSimple(content: string): string {
  return renderMarkdown(content)
}

// 导出 hljs 用于手动高亮-可选
export { hljs }
