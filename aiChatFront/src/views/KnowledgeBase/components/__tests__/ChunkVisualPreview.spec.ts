import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChunkVisualPreview from '../ChunkVisualPreview.vue'

describe('ChunkVisualPreview', () => {
  it('渲染视觉类型标签、页码徽章及视觉模型直连状态', () => {
    const wrapper = mount(ChunkVisualPreview, {
      props: {
        imageUrl: '/knowledge-bases/assets/asset-1?expires=999&signature=abc',
        visualType: 'chart',
        pageNumber: 4,
        visualInjected: true,
        caption: '系统吞吐量对比图',
        variant: 'full',
      },
      global: {
        stubs: {
          'a-image': {
            props: ['src', 'alt'],
            template: '<img class="stub-a-image" :src="src" :alt="alt" />',
          },
        },
      },
    })

    const img = wrapper.find('.stub-a-image')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/knowledge-bases/assets/asset-1?expires=999&signature=abc')
    expect(wrapper.text()).toContain('数据图表')
    expect(wrapper.text()).toContain('P.4')
    expect(wrapper.text()).toContain('原图已直连视觉模型')
  })

  it('无 imageUrl 时不渲染卡片内容', () => {
    const wrapper = mount(ChunkVisualPreview, {
      props: {
        imageUrl: '',
      },
      global: {
        stubs: {
          'a-image': { template: '<img />' },
        },
      },
    })

    expect(wrapper.find('.chunk-visual-preview').exists()).toBe(false)
  })
})
