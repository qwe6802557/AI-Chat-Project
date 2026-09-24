import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageGallery from '../ImageGallery.vue'
import type { ImageGenerationTask } from '@/interface/image'

describe('ImageGallery', () => {
  const mockTasks: ImageGenerationTask[] = [
    {
      id: 'task-1',
      userId: 'user-1',
      prompt: 'A cute futuristic cat',
      modelId: 'grok-imagine-image-2.0',
      aspectRatio: '1:1',
      resolution: '1k',
      quality: 'medium',
      numGenerations: 1,
      imageUrls: ['/images/media/task-1_0.png'],
      costCredits: 100,
      status: 'success',
      createdAt: '2026-09-24T09:00:00.000Z',
      updatedAt: '2026-09-24T09:00:05.000Z',
    },
    {
      id: 'task-2',
      userId: 'user-1',
      prompt: 'A cyber punk city',
      modelId: 'grok-imagine-image-2.0',
      aspectRatio: '16:9',
      resolution: '2k',
      quality: 'high',
      numGenerations: 1,
      imageUrls: [],
      costCredits: 100,
      status: 'failed',
      errorMessage: 'Service timeout',
      createdAt: '2026-09-24T09:05:00.000Z',
      updatedAt: '2026-09-24T09:05:30.000Z',
    },
  ]

  it('renders task cards and delete button for each task', () => {
    const wrapper = mount(ImageGallery, {
      props: {
        tasks: mockTasks,
      },
    })

    const cards = wrapper.findAll('.task-card')
    expect(cards).toHaveLength(2)

    const deleteBtns = wrapper.findAll('.action-text-btn.danger-btn')
    expect(deleteBtns).toHaveLength(2)
    expect(deleteBtns[0].text()).toContain('删除记录')
  })

  it('emits reuse when clicking reuse button', async () => {
    const wrapper = mount(ImageGallery, {
      props: {
        tasks: mockTasks,
      },
    })

    const reuseBtns = wrapper.findAll('.action-text-btn')
    // reuse button is the second button in action-buttons
    const reuseBtn = reuseBtns.find((b) => b.text().includes('复用参数'))
    expect(reuseBtn).toBeDefined()
    await reuseBtn?.trigger('click')

    expect(wrapper.emitted('reuse')).toBeTruthy()
    expect(wrapper.emitted('reuse')?.[0]).toEqual([mockTasks[0]])
  })

  it('renders loading spinner on delete button when deletingTaskId matches', () => {
    const wrapper = mount(ImageGallery, {
      props: {
        tasks: mockTasks,
        deletingTaskId: 'task-1',
      },
    })

    const deleteBtns = wrapper.findAll('.action-text-btn.danger-btn')
    expect(deleteBtns[0].attributes('disabled')).toBeDefined()
    expect(deleteBtns[1].attributes('disabled')).toBeUndefined()
  })

  it('renders empty gallery when tasks list is empty', () => {
    const wrapper = mount(ImageGallery, {
      props: {
        tasks: [],
      },
    })

    expect(wrapper.find('.empty-gallery').exists()).toBe(true)
    expect(wrapper.text()).toContain('开启你的创意画作')
  })
})
