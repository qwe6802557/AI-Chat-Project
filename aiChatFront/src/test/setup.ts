import { afterEach, vi } from 'vitest'

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
}

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
}

if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn()
}

if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = function scrollTo(options?: ScrollToOptions | number, y?: number) {
    if (typeof options === 'number') {
      this.scrollTop = y ?? options
      return
    }
    this.scrollTop = options?.top ?? this.scrollTop
  }
}

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})
