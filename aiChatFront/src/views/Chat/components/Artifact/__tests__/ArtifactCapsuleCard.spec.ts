import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArtifactCapsuleCard from '../ArtifactCapsuleCard.vue'

describe('ArtifactCapsuleCard', () => {
  it('renders artifact title and type pill', () => {
    const wrapper = mount(ArtifactCapsuleCard, {
      props: {
        artifact: {
          identifier: 'test-html',
          type: 'text/html',
          title: '测试仪表盘',
          content: '<h1>Dashboard</h1>',
          isComplete: true,
        },
      },
    })

    expect(wrapper.text()).toContain('测试仪表盘')
    expect(wrapper.text()).toContain('HTML 网页')
    expect(wrapper.text()).toContain('在画布中打开')
  })

  it('renders streaming pill when artifact is incomplete', () => {
    const wrapper = mount(ArtifactCapsuleCard, {
      props: {
        artifact: {
          identifier: 'test-stream',
          type: 'application/vnd.ant.code',
          title: '算法脚本',
          language: 'python',
          content: 'def solve():',
          isComplete: false,
        },
      },
    })

    expect(wrapper.text()).toContain('生成中')
    expect(wrapper.text()).toContain('PYTHON')
  })

  it('emits open event with identifier on click', async () => {
    const wrapper = mount(ArtifactCapsuleCard, {
      props: {
        artifact: {
          identifier: 'click-target',
          type: 'image/svg+xml',
          title: '架构图',
          content: '<svg></svg>',
          isComplete: true,
        },
      },
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('open')).toBeTruthy()
    expect(wrapper.emitted('open')![0]).toEqual(['click-target'])
  })
})
