/**
 * 行级文本差异对比算法（基于 LCS 与公共前后缀快剪）
 * 严格遵循 stitch-design-taste 与 karpathy-guidelines
 */

export type DiffType = 'added' | 'removed' | 'unchanged'

export interface DiffLine {
  type: DiffType
  oldLineNumber?: number
  newLineNumber?: number
  content: string
}

export interface DiffResult {
  lines: DiffLine[]
  addedCount: number
  removedCount: number
  unchangedCount: number
}

/**
 * 计算两个版本文本之间的行级差异
 */
export function computeLineDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText ? oldText.split(/\r?\n/) : []
  const newLines = newText ? newText.split(/\r?\n/) : []
  const n = oldLines.length
  const m = newLines.length

  if (n === 0 && m === 0) {
    return { lines: [], addedCount: 0, removedCount: 0, unchangedCount: 0 }
  }

  // 1. 公共前后缀快速剪枝
  let start = 0
  while (start < n && start < m && oldLines[start] === newLines[start]) {
    start++
  }

  let oldEnd = n - 1
  let newEnd = m - 1
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--
    newEnd--
  }

  // 中间差异区域计算 LCS
  const midOld = oldLines.slice(start, oldEnd + 1)
  const midNew = newLines.slice(start, newEnd + 1)
  const dp: number[][] = Array.from({ length: midOld.length + 1 }, () =>
    new Array(midNew.length + 1).fill(0)
  )

  for (let i = 0; i < midOld.length; i++) {
    for (let j = 0; j < midNew.length; j++) {
      if (midOld[i] === midNew[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const resultLines: DiffLine[] = []
  let addedCount = 0
  let removedCount = 0
  let unchangedCount = 0

  // 1. 添加公共前缀
  for (let i = 0; i < start; i++) {
    resultLines.push({
      type: 'unchanged',
      oldLineNumber: i + 1,
      newLineNumber: i + 1,
      content: oldLines[i],
    })
    unchangedCount++
  }

  // 2. 回溯中间 LCS 差异
  const midDiff: DiffLine[] = []
  let i = midOld.length
  let j = midNew.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && midOld[i - 1] === midNew[j - 1]) {
      midDiff.unshift({
        type: 'unchanged',
        oldLineNumber: start + i,
        newLineNumber: start + j,
        content: midOld[i - 1],
      })
      unchangedCount++
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      midDiff.unshift({
        type: 'added',
        newLineNumber: start + j,
        content: midNew[j - 1],
      })
      addedCount++
      j--
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      midDiff.unshift({
        type: 'removed',
        oldLineNumber: start + i,
        content: midOld[i - 1],
      })
      removedCount++
      i--
    }
  }
  resultLines.push(...midDiff)

  // 3. 添加公共后缀
  const suffixLen = n - 1 - oldEnd
  for (let k = 0; k < suffixLen; k++) {
    const oldIdx = oldEnd + 1 + k
    const newIdx = newEnd + 1 + k
    resultLines.push({
      type: 'unchanged',
      oldLineNumber: oldIdx + 1,
      newLineNumber: newIdx + 1,
      content: oldLines[oldIdx],
    })
    unchangedCount++
  }

  return {
    lines: resultLines,
    addedCount,
    removedCount,
    unchangedCount,
  }
}
