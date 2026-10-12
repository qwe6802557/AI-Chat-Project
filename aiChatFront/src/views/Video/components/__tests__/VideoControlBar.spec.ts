import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VideoControlBar from '../VideoControlBar.vue'

const globalStubs = {
  'a-select': {
    props: ['value', 'dropdownMatchSelectWidth', 'dropdownStyle'],
    emits: ['update:value'],
    template: '<div class="a-select-stub" :data-value="value"><slot /></div>',
  },
  'a-select-option': {
    props: ['value'],
    template: '<div class="a-select-option-stub"><slot /></div>',
  },
  'a-tooltip': {
    props: ['title'],
    template: '<div class="a-tooltip-stub"><slot /></div>',
  },
}

describe('VideoControlBar', () => {
  it('disables submit button when prompt is empty', () => {
    const wrapper = mount(VideoControlBar, {
      global: {
        stubs: globalStubs,
      },
    })

    const submitBtn = wrapper.find('.submit-btn')
    expect(submitBtn.attributes('disabled')).toBeDefined()
    expect(submitBtn.classes()).not.toContain('active')
  })

  it('defaults to text-to-video Wan2.2-T2V-A14B and emits submit event', async () => {
    const wrapper = mount(VideoControlBar, {
      global: {
        stubs: globalStubs,
      },
    })

    expect(wrapper.find('.model-name-text').text()).toBe('Wan2.2-T2V-A14B')
    expect(wrapper.find('.model-badge-tag').text()).toBe('文生视频')

    const textarea = wrapper.find('.prompt-textarea')
    await textarea.setValue('A cinematic drone shot over snow mountains')

    const submitBtn = wrapper.find('.submit-btn')
    expect(submitBtn.classes()).toContain('active')

    await submitBtn.trigger('click')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({
      prompt: 'A cinematic drone shot over snow mountains',
      image: undefined,
      aspect_ratio: '16:9',
    })
  })

  it('switches to image-to-video mode when image is set via setFormValues', async () => {
    const wrapper = mount(VideoControlBar, {
      global: {
        stubs: globalStubs,
      },
    })

    wrapper.vm.setFormValues({
      prompt: 'Animate this character walking forward',
      image: 'https://example.com/character.png',
      aspect_ratio: '9:16',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.model-name-text').text()).toBe('Wan2.2-I2V-A14B')
    expect(wrapper.find('.model-badge-tag').text()).toBe('图生视频')
    expect(wrapper.find('.reference-image-chip').exists()).toBe(true)

    const submitBtn = wrapper.find('.submit-btn')
    await submitBtn.trigger('click')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({
      prompt: 'Animate this character walking forward',
      image: 'https://example.com/character.png',
      aspect_ratio: '9:16',
    })
  })
})
