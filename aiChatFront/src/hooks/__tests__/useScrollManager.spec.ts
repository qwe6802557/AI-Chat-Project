import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { useScrollManager } from '../useScrollManager'

const waitForRaf = async () => {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
}

const setScrollMetrics = (
  element: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number }
) => {
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => metrics.scrollHeight,
  })
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => metrics.clientHeight,
  })
  element.scrollTop = metrics.scrollTop
}

const Harness = defineComponent({
  setup(_, { expose }) {
    const containerRef = ref<HTMLElement | null>(null)
    const api = useScrollManager(containerRef)
    expose({
      ...api,
      getElement: () => containerRef.value,
    })

    return () =>
      h('div', { ref: containerRef, style: 'height: 100px; overflow: auto;' }, [
        h('div', { style: 'height: 1000px;' }),
      ])
  },
})

describe('useScrollManager', () => {
  it('toggles user scrolling state based on distance from bottom', async () => {
    const wrapper = mount(Harness)
    const api = wrapper.vm as unknown as {
      isUserScrolling: boolean
      showScrollButton: boolean
      getElement: () => HTMLElement | null
    }

    const element = api.getElement()
    expect(element).not.toBeNull()
    await nextTick()
    await waitForRaf()

    setScrollMetrics(element!, {
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 120,
    })
    element!.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(api.isUserScrolling).toBe(true)
    expect(api.showScrollButton).toBe(true)

    setScrollMetrics(element!, {
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 420,
    })
    element!.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(api.isUserScrolling).toBe(false)
  })

  it('scrolls to bottom and restores auto follow without visibility hack', async () => {
    const wrapper = mount(Harness)
    const api = wrapper.vm as unknown as {
      isUserScrolling: boolean
      scrollToBottom: (smooth?: boolean) => void
      getElement: () => HTMLElement | null
    }

    const element = api.getElement()
    expect(element).not.toBeNull()
    await nextTick()
    await waitForRaf()

    setScrollMetrics(element!, {
      scrollHeight: 600,
      clientHeight: 100,
      scrollTop: 0,
    })
    element!.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(api.isUserScrolling).toBe(true)

    api.scrollToBottom(false)
    await nextTick()
    await waitForRaf()

    expect(element!.scrollTop).toBe(600)
    expect(api.isUserScrolling).toBe(false)
  })
})
