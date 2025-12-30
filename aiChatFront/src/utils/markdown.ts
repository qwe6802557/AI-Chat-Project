/**
 * Markdown 渲染工具
 * marked.js + highlight.js 流式渲染文本
 */

import { marked, type Tokens } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'
import DOMPurify from "dompurify";

// ---配置marked---

export interface RenderMarkdownOptions {
  /**
   * 是否启用代码高亮
   * - 流式渲染关闭-减少主线程压力
   */
  highlightCode?: boolean
}

function createRenderer(options: RenderMarkdownOptions) {
  const renderer = new marked.Renderer()

  // 代码块渲染
  renderer.code = ({ text, lang }: Tokens.Code): string => {
    const language = lang || ''
    const languageLabel = escapeHtml(language || 'code')

    if (options.highlightCode === false) {
      return `<pre class="code-block"><div class="code-header"><span class="code-language">${languageLabel}</span></div><code>${escapeHtml(text)}</code></pre>`
    }

    const validLanguage = hljs.getLanguage(language) ? language : 'plaintext'

    try {
      const highlighted = hljs.highlight(text, {
        language: validLanguage,
        ignoreIllegals: true,
      }).value

      return `<pre class="code-block"><div class="code-header"><span class="code-language">${languageLabel}</span><button class="copy-btn" type="button">复制</button></div><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`
    } catch {
      // 高亮失败返回原始代码
      return `<pre class="code-block"><div class="code-header"><span class="code-language">${languageLabel}</span><button class="copy-btn" type="button">复制</button></div><code>${escapeHtml(text)}</code></pre>`
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

  return renderer
}

const rendererWithHighlight = createRenderer({ highlightCode: true })
const rendererPlain = createRenderer({ highlightCode: false })

// marked基础选项
marked.setOptions({
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
 * 用于混合渲染策略-检测不完整的Markdown块
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

  // 不再对表格做“行尾必须是 |”的完整性判断：
  // - GFM 表格行尾的 `|` 是可选的
  // - 流式输出中，行尾经常处于“正在输入”状态，强行判不完整会导致渲染在 table / 纯文本之间来回切换（闪烁）

  return true
}

/**
 * 渲染 Markdown 为 HTML
 */
export function renderMarkdown(
  content: string,
  options: RenderMarkdownOptions = {}
): string {
  if (!content) return ''

  try {
    const renderer = options.highlightCode === false ? rendererPlain : rendererWithHighlight
    const html = marked.parse(content, { renderer }) as string
    return DOMPurify.sanitize(html)  // 引入DOMPurify防止xss攻击
  } catch (error) {
    console.error('Markdown 渲染失败:', error)
    return DOMPurify.sanitize(`<p>${escapeHtml(content)}</p>`)
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
  previousHtml: string = '',
  options: RenderMarkdownOptions = {}
): {
  html: string
  isComplete: boolean
} {
  if (!content) {
    return { html: '', isComplete: true }
  }

  const isComplete = canRenderSafely(content)
  const highlightCode = options.highlightCode !== false

  if (isComplete) {
    // 完整进行完整渲染
    return {
      html: renderMarkdown(content, { highlightCode }),
      isComplete: true,
    }
  } else {
    // 不完整尝试渲染已完整的部分
    // 找到最后一个完整的段落/块
    const lastCompleteIndex = findLastCompleteBlock(content)

    // --- 特殊场景：未闭合代码块（```）---
    // marked 对未闭合 fence 可能只当作纯文本，流式体验较差；
    // 这里将最后一个未闭合 fence 之后的内容渲染为 <pre><code>，实现“流式阶段也实时带 Markdown 样式”。
    const fenceMatches = content.match(/```/g) || []
    const hasOpenFence = fenceMatches.length % 2 !== 0
    if (hasOpenFence) {
      const lastFenceIndex = content.lastIndexOf('```')
      const beforeFence = lastFenceIndex > 0 ? content.slice(0, lastFenceIndex) : ''
      const afterFence = content.slice(lastFenceIndex + 3)
      const firstNewlineIndex = afterFence.indexOf('\n')

      const language = (firstNewlineIndex === -1 ? afterFence : afterFence.slice(0, firstNewlineIndex)).trim()
      const codeText = firstNewlineIndex === -1 ? '' : afterFence.slice(firstNewlineIndex + 1)

      const prefixHtml = beforeFence
        ? renderStreamingMarkdown(beforeFence, '', { highlightCode }).html
        : ''

      const languageLabel = escapeHtml(language || 'code')
      const codeHtml = `<pre class="code-block"><div class="code-header"><span class="code-language">${languageLabel}</span></div><code>${escapeHtml(codeText)}</code></pre>`

      return {
        html: DOMPurify.sanitize(prefixHtml + codeHtml),
        isComplete: false,
      }
    }

    // --- 特殊场景：流式表格最后一行未闭合（|...）---
    // 现象：表格每新增一行时，最后一行未结束会被当成纯文本，导致“表格样式 ↔ 打字机纯文本”来回切换，视觉闪烁。
    // 方案：检测到“表格块正在输出”时，将最后一行未闭合内容也渲染进 <table> 的最后一行，保持结构稳定。
    const lines = content.split('\n')
    let lastNonEmptyIndex = lines.length - 1
    while (lastNonEmptyIndex >= 0 && (lines[lastNonEmptyIndex]?.trim() || '') === '') {
      lastNonEmptyIndex--
    }

    const lastLineTrimmed = lastNonEmptyIndex >= 0 ? (lines[lastNonEmptyIndex]?.trim() || '') : ''
    const isIncompleteTableRow =
      lastLineTrimmed.startsWith('|') &&
      lastLineTrimmed.includes('|') &&
      !lastLineTrimmed.endsWith('|')

    if (isIncompleteTableRow) {
      const tableDelimiterPattern =
        /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/

      const splitTableCells = (rowLine: string): string[] => {
        let text = rowLine.trim()
        if (text.startsWith('|')) text = text.slice(1)
        if (text.endsWith('|')) text = text.slice(0, -1)
        return text.split('|').map(cell => cell.trim())
      }

      // 从末尾向上找到当前表格的分隔行（---）
      let delimiterIndex = -1
      for (let i = lastNonEmptyIndex - 1; i >= 1; i--) {
        const delimiterLine = (lines[i]?.trim() || '')
        if (!tableDelimiterPattern.test(delimiterLine)) continue

        const headerLine = (lines[i - 1]?.trim() || '')
        if (!headerLine || !headerLine.includes('|')) continue

        // 分隔行之后到末尾必须都是“表格行”（允许最后一行未闭合）
        let isValidTableTail = true
        for (let j = i + 1; j <= lastNonEmptyIndex; j++) {
          const row = (lines[j]?.trim() || '')
          if (!row || !row.includes('|')) {
            isValidTableTail = false
            break
          }
        }

        if (isValidTableTail) {
          delimiterIndex = i
          break
        }
      }

      if (delimiterIndex !== -1) {
        const headerIndex = delimiterIndex - 1
        const prefixContent = headerIndex > 0 ? lines.slice(0, headerIndex).join('\n') : ''
        const prefixHtml = prefixContent ? renderMarkdown(prefixContent, { highlightCode }) : ''

        const headerCells = splitTableCells(lines[headerIndex] || '')
        const columnCount = headerCells.length

        if (columnCount > 0) {
          const bodyLines = lines.slice(delimiterIndex + 1, lastNonEmptyIndex + 1)
          const bodyRows = bodyLines.map((rowLine) => {
            const cells = splitTableCells(rowLine)
            if (cells.length < columnCount) {
              return cells.concat(Array.from({ length: columnCount - cells.length }, () => ''))
            }
            return cells.slice(0, columnCount)
          })

          const theadHtml = headerCells.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')
          const tbodyHtml = bodyRows
            .map((cells, rowIndex) => {
              const isLastRow = rowIndex === bodyRows.length - 1
              return `<tr>${cells
                .map((cell) => {
                  const text = escapeHtml(cell)
                  return `<td>${isLastRow ? `<span class="streaming-text">${text}</span>` : text}</td>`
                })
                .join('')}</tr>`
            })
            .join('')

          const tableHtml =
            `<div class="table-wrapper"><table class="markdown-table">` +
            `<thead><tr>${theadHtml}</tr></thead>` +
            `<tbody>${tbodyHtml}</tbody>` +
            `</table></div>`

          return {
            html: DOMPurify.sanitize(prefixHtml + tableHtml),
            isComplete: false,
          }
        }
      }
    }

    if (lastCompleteIndex > 0) {
      const completeContent = content.substring(0, lastCompleteIndex)
      const incompleteContent = content.substring(lastCompleteIndex)

      return {
        html:
          renderMarkdown(completeContent, { highlightCode }) +
          `<span class="streaming-text">${escapeHtml(incompleteContent)}</span>`,
        isComplete: false,
      }
    }

    // 无法分割时-直接返回转义后的原始文本（避免卡住）
    return {
      html: `<span class="streaming-text">${DOMPurify.sanitize(escapeHtml(content))}</span>`,
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
