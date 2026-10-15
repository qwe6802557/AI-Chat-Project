import { describe, expect, it } from 'vitest'
import { computeLineDiff } from '../lineDiff'

describe('computeLineDiff', () => {
  it('returns empty result when both texts are empty', () => {
    const result = computeLineDiff('', '')
    expect(result.lines).toHaveLength(0)
    expect(result.addedCount).toBe(0)
    expect(result.removedCount).toBe(0)
  })

  it('detects all additions when old text is empty', () => {
    const result = computeLineDiff('', 'line 1\nline 2')
    expect(result.addedCount).toBe(2)
    expect(result.removedCount).toBe(0)
    expect(result.lines[0]).toEqual({
      type: 'added',
      newLineNumber: 1,
      content: 'line 1',
    })
    expect(result.lines[1]).toEqual({
      type: 'added',
      newLineNumber: 2,
      content: 'line 2',
    })
  })

  it('detects all removals when new text is empty', () => {
    const result = computeLineDiff('line 1\nline 2', '')
    expect(result.addedCount).toBe(0)
    expect(result.removedCount).toBe(2)
    expect(result.lines[0]).toEqual({
      type: 'removed',
      oldLineNumber: 1,
      content: 'line 1',
    })
  })

  it('identifies identical lines as unchanged', () => {
    const result = computeLineDiff('alpha\nbeta', 'alpha\nbeta')
    expect(result.addedCount).toBe(0)
    expect(result.removedCount).toBe(0)
    expect(result.unchangedCount).toBe(2)
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0].type).toBe('unchanged')
    expect(result.lines[1].type).toBe('unchanged')
  })

  it('detects localized modification between unchanged lines', () => {
    const oldText = 'header\nold content\nfooter'
    const newText = 'header\nnew content\nextra\nfooter'
    const result = computeLineDiff(oldText, newText)

    expect(result.lines[0]).toEqual({
      type: 'unchanged',
      oldLineNumber: 1,
      newLineNumber: 1,
      content: 'header',
    })
    expect(result.lines[1]).toEqual({
      type: 'removed',
      oldLineNumber: 2,
      content: 'old content',
    })
    expect(result.lines[2]).toEqual({
      type: 'added',
      newLineNumber: 2,
      content: 'new content',
    })
    expect(result.lines[3]).toEqual({
      type: 'added',
      newLineNumber: 3,
      content: 'extra',
    })
    expect(result.lines[4]).toEqual({
      type: 'unchanged',
      oldLineNumber: 3,
      newLineNumber: 4,
      content: 'footer',
    })
  })
})
