import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArtifactDiffViewer from '../ArtifactDiffViewer.vue'
import type { ArtifactItem } from '../../../types/artifact'

describe('ArtifactDiffViewer', () => {
  const mockArtifact: ArtifactItem = {
    identifier: 'diff-demo',
    title: '差异测试组件',
    type: 'text/html',
    createdAt: 1000,
    updatedAt: 2000,
    versions: [
      {
        version: 1,
        content: 'line 1\nold line 2\nline 3',
        createdAt: 1000,
      },
      {
        version: 2,
        content: 'line 1\nnew line 2\nline 3\nline 4',
        createdAt: 2000,
      },
    ],
  }

  it('renders diff lines and statistics pills correctly', () => {
    const wrapper = mount(ArtifactDiffViewer, {
      props: {
        artifact: mockArtifact,
        currentVersionIndex: 1,
      },
    })

    // 统计药丸：新增 2 行 (new line 2, line 4)，删除 1 行 (old line 2)，2 行未变 (line 1, line 3)
    expect(wrapper.text()).toContain('+2')
    expect(wrapper.text()).toContain('-1')
    expect(wrapper.text()).toContain('2 行未变')

    // 检查内容与标记
    expect(wrapper.find('.diff-line-row.is-added').exists()).toBe(true)
    expect(wrapper.find('.diff-line-row.is-removed').exists()).toBe(true)
    expect(wrapper.text()).toContain('old line 2')
    expect(wrapper.text()).toContain('new line 2')
    expect(wrapper.text()).toContain('line 4')
  })

  it('shows empty state when compared versions are identical', () => {
    const identicalArtifact: ArtifactItem = {
      identifier: 'identical-demo',
      title: '完全一致组件',
      type: 'text/html',
      createdAt: 1000,
      updatedAt: 2000,
      versions: [
        {
          version: 1,
          content: 'same line 1\nsame line 2',
          createdAt: 1000,
        },
        {
          version: 2,
          content: 'same line 1\nsame line 2',
          createdAt: 2000,
        },
      ],
    }

    const wrapper = mount(ArtifactDiffViewer, {
      props: {
        artifact: identicalArtifact,
        currentVersionIndex: 1,
      },
    })

    expect(wrapper.text()).toContain('选中的两个版本代码完全一致')
    expect(wrapper.find('.diff-empty-state').exists()).toBe(true)
  })
})
