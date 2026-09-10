import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ImageControlBar from '../ImageControlBar.vue'

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
}

describe('ImageControlBar', () => {
  it('disables submit button when prompt is empty', () => {
    const wrapper = mount(ImageControlBar, {
      global: {
        stubs: globalStubs,
      },
    })

    const submitBtn = wrapper.find('.submit-btn')
    expect(submitBtn.attributes('disabled')).toBeDefined()
    expect(submitBtn.classes()).not.toContain('active')
  })

  it('emits submit event and immediately clears prompt text upon submission', async () => {
    const wrapper = mount(ImageControlBar, {
      props: {
        unitCreditCost: 100,
      },
      global: {
        stubs: globalStubs,
      },
    })

    const textarea = wrapper.find('.prompt-textarea')
    await textarea.setValue('A photorealistic futuristic cyberpunk city')

    const submitBtn = wrapper.find('.submit-btn')
    expect(submitBtn.classes()).toContain('active')

    await submitBtn.trigger('click')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({
      prompt: 'A photorealistic futuristic cyberpunk city',
      model: 'grok-imagine-image-2.0',
      n: 1,
      aspect_ratio: '1:1',
      resolution: '1k',
      quality: 'medium',
    })

    // Prompt must be cleared immediately after submit
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
    expect(submitBtn.classes()).not.toContain('active')
  })

  it('allows filling and clearing prompt via exposed methods', async () => {
    const wrapper = mount(ImageControlBar, {
      global: {
        stubs: globalStubs,
      },
    })

    const vm = wrapper.vm as any
    vm.setFormValues({
      prompt: 'Retro arcade style',
      quality: 'low',
      n: 2,
    })
    await wrapper.vm.$nextTick()

    const textarea = wrapper.find('.prompt-textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Retro arcade style')

    vm.clearPrompt()
    await wrapper.vm.$nextTick()
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('renders stop button when loading and emits stop event on click', async () => {
    const wrapper = mount(ImageControlBar, {
      props: {
        loading: true,
      },
      global: {
        stubs: globalStubs,
      },
    })

    const submitBtn = wrapper.find('.submit-btn')
    expect(submitBtn.attributes('disabled')).toBeUndefined()
    expect(submitBtn.classes()).toContain('stop-mode')
    expect(wrapper.find('.stop-square-icon').exists()).toBe(true)

    await submitBtn.trigger('click')
    expect(wrapper.emitted('stop')).toBeTruthy()
  })
})
