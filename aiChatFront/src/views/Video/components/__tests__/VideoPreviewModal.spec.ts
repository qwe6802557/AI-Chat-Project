import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPreviewModal from '../VideoPreviewModal.vue'
import type { VideoGenerationTask } from '@/interface/video'

describe('VideoPreviewModal', () => {
  const mockTask: VideoGenerationTask = {
    id: 'task-preview-1',
    prompt: 'A futuristic floating island with crystal waterfalls',
    modelId: 'wanx2.1-t2v-turbo',
    status: 'success',
    videoUrl: '/videos/media/task-1.mp4',
    aspectRatio: '16:9',
    duration: 5,
    costCredits: 200,
    createdAt: '2026-10-13T01:00:00.000Z',
    updatedAt: '2026-10-13T01:00:10.000Z',
  }

  it('renders theater close button and emits update:open false on click', async () => {
    const wrapper = mount(VideoPreviewModal, {
      props: {
        open: true,
        task: mockTask,
      },
      global: {
        stubs: {
          'a-modal': {
            template: `
              <div class="ant-modal-root" v-if="open">
                <div class="ant-modal-wrap">
                  <div class="ant-modal">
                    <slot />
                  </div>
                </div>
              </div>
            `,
            props: ['open', 'closable'],
          },
        },
      },
    })

    const closeBtn = wrapper.find('.theater-close-btn')
    expect(closeBtn.exists()).toBe(true)

    await closeBtn.trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})
