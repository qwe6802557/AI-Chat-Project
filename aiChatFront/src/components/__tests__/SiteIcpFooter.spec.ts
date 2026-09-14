import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SiteIcpFooter from '../SiteIcpFooter.vue'

describe('SiteIcpFooter', () => {
  it('renders ICP record number and valid link to MIIT', () => {
    const wrapper = mount(SiteIcpFooter)
    const link = wrapper.find('a.icp-link')

    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('蜀ICP备2026054363号-1')
    expect(link.attributes('href')).toBe('https://beian.miit.gov.cn/')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
  })
})
