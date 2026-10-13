import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoGallery from '../VideoGallery.vue'
import type { VideoGenerationTask } from '@/interface/video'

describe('VideoGallery', () => {
  const mockTasks: VideoGenerationTask[] = [
    {
      id: 'task-processing-1',
      prompt: 'A cinematic drone shot through misty pine mountains',
      modelId: 'wanx2.1-t2v-turbo',
      status: 'processing',
      aspectRatio: '16:9',
      duration: 5,
      costCredits: 200,
      createdAt: '2026-10-13T01:00:00.000Z',
      updatedAt: '2026-10-13T01:00:10.000Z',
    },
    {
      id: 'task-success-2',
      prompt: 'Cyberpunk neon rain street',
      modelId: 'wanx2.1-t2v-turbo',
      status: 'success',
      videoUrl: '/videos/media/task-2.mp4',
      aspectRatio: '16:9',
      duration: 5,
      costCredits: 200,
      createdAt: '2026-10-13T00:50:00.000Z',
      updatedAt: '2026-10-13T00:51:00.000Z',
    },
  ]

  it('renders in-place processing card and never renders redundant top generating-card', () => {
    const wrapper = mount(VideoGallery, {
      props: {
        tasks: mockTasks,
        isGenerating: true,
        generatingPrompt: 'A cinematic drone shot through misty pine mountains',
        generatingElapsedSeconds: 15,
      },
      global: {
        stubs: {
          'a-tooltip': { template: '<div><slot /></div>' },
          'a-popconfirm': { template: '<div><slot /></div>' },
        },
      },
    })

    // 验证废弃的冗余顶部独立卡片已被彻底消灭
    expect(wrapper.find('.generating-card').exists()).toBe(false)

    // 验证网格内部第一张卡片直接接管生成中态
    const placeholder = wrapper.find('.processing-placeholder')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toContain('万相视频渲染中 · 00:15s')
    expect(placeholder.text()).toContain('上游正在计算扩散帧序列')
  })

  it('renders empty gallery and emits apply-prompt when clicked', async () => {
    const wrapper = mount(VideoGallery, {
      props: {
        tasks: [],
        isGenerating: false,
      },
    })

    expect(wrapper.find('.empty-video-gallery').exists()).toBe(true)
    const promptPills = wrapper.findAll('.sample-prompt-pill')
    expect(promptPills.length).toBeGreaterThan(0)

    await promptPills[0].trigger('click')
    expect(wrapper.emitted('apply-prompt')).toBeTruthy()
  })

  it('wraps task prompt with tooltip and displays prompt text', () => {
    const wrapper = mount(VideoGallery, {
      props: {
        tasks: mockTasks,
      },
      global: {
        stubs: {
          'a-tooltip': {
            template: '<div class="ant-tooltip-stub" :data-title="title"><slot /></div>',
            props: ['title'],
          },
          'a-popconfirm': { template: '<div><slot /></div>' },
        },
      },
    })

    const promptTooltips = wrapper.findAll('.ant-tooltip-stub')
    const match = promptTooltips.find(
      (t) => t.attributes('data-title') === mockTasks[0].prompt,
    )
    expect(match).toBeDefined()
    expect(wrapper.text()).toContain(mockTasks[0].prompt)
  })
})
