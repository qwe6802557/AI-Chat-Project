import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArtifactSandbox from '../ArtifactSandbox.vue'

describe('ArtifactSandbox', () => {
  it('renders sandboxed iframe for html content', () => {
    const wrapper = mount(ArtifactSandbox, {
      props: {
        type: 'text/html',
        content: '<h1>Hello Sandbox</h1>',
        viewportMode: 'responsive',
      },
    })

    const iframe = wrapper.find('iframe.sandbox-iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('sandbox')).toBe('allow-scripts allow-modals')
    expect(iframe.attributes('srcdoc')).toContain('<h1>Hello Sandbox</h1>')
  })

  it('renders svg stage for svg content with sanitization', () => {
    const wrapper = mount(ArtifactSandbox, {
      props: {
        type: 'image/svg+xml',
        content: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
        viewportMode: 'responsive',
      },
    })

    expect(wrapper.find('.svg-stage').exists()).toBe(true)
    expect(wrapper.html()).toContain('<circle cx="50" cy="50" r="40"')
  })

  it('applies device viewport styles correctly for mobile mode', () => {
    const wrapper = mount(ArtifactSandbox, {
      props: {
        type: 'text/html',
        content: '<p>Mobile Content</p>',
        viewportMode: 'mobile',
      },
    })

    const stage = wrapper.find('.viewport-stage')
    expect(stage.attributes('style')).toContain('375px')
  })
})
