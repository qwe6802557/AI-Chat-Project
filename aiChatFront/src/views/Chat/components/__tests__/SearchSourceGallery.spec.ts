import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SearchSourceGallery from '../SearchSourceGallery.vue'

describe('SearchSourceGallery', () => {
  it('does not render when sources are empty and not searching', () => {
    const wrapper = mount(SearchSourceGallery, {
      props: {
        sources: [],
      },
    })

    expect(wrapper.find('.search-source-gallery').exists()).toBe(false)
  })

  it('renders searching indicator and query when searchStatus is searching', () => {
    const wrapper = mount(SearchSourceGallery, {
      props: {
        sources: [],
        searchStatus: 'searching',
        searchQuery: '2026世界人工智能大会',
      },
    })

    expect(wrapper.find('.searching-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('正在深度联网检索中...')
    expect(wrapper.text()).toContain('2026世界人工智能大会')
  })

  it('renders source cards gallery when sources are provided', () => {
    const mockSources = [
      {
        id: 1,
        title: '人工智能大会官网',
        url: 'https://example.com/ai-event',
        snippet: '大会将于下周开幕',
        sitename: 'AI官方',
      },
      {
        id: 2,
        title: '科技时报报道',
        url: 'https://techtimes.org/news/123',
        snippet: '全新AI模型发布',
      },
    ]

    const wrapper = mount(SearchSourceGallery, {
      props: {
        sources: mockSources,
        searchStatus: 'done',
      },
    })

    expect(wrapper.find('.sources-container').exists()).toBe(true)
    expect(wrapper.text()).toContain('参考了 2 个网页来源')

    const cards = wrapper.findAll('.source-card')
    expect(cards.length).toBe(2)

    expect(cards[0].attributes('href')).toBe('https://example.com/ai-event')
    expect(cards[0].text()).toContain('AI官方')
    expect(cards[0].text()).toContain('人工智能大会官网')
    expect(cards[0].text()).toContain('1')

    expect(cards[1].attributes('href')).toBe('https://techtimes.org/news/123')
    expect(cards[1].text()).toContain('techtimes.org')
    expect(cards[1].text()).toContain('科技时报报道')
    expect(cards[1].text()).toContain('2')
  })

  it('falls back to default icon on image load error', async () => {
    const mockSources = [
      {
        id: 1,
        title: '示例网站',
        url: 'https://example.com',
        snippet: '简介',
        icon: 'https://example.com/favicon.ico',
      },
    ]

    const wrapper = mount(SearchSourceGallery, {
      props: {
        sources: mockSources,
      },
    })

    const img = wrapper.find('.site-icon')
    expect(img.exists()).toBe(true)

    await img.trigger('error')
    expect(wrapper.find('.site-icon').exists()).toBe(false)
    expect(wrapper.find('.site-icon-fallback').exists()).toBe(true)
  })
})
