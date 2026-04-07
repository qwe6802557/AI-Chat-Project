import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const mockPush = vi.fn()
let mockQuery: Record<string, string> = {}

vi.mock('vue-router', () => ({
  createRouter: vi.fn(() => ({
    beforeEach: vi.fn(),
    currentRoute: { value: { name: 'account' } },
    replace: vi.fn(),
    push: vi.fn(),
  })),
  createWebHistory: vi.fn(() => ({})),
  useRouter: () => ({
    push: mockPush,
  }),
  useRoute: () => ({
    query: mockQuery,
  }),
}))

vi.mock('../../Chat/components/AccountModal.vue', () => ({
  default: defineComponent({
    name: 'AccountModalStub',
    template: '<div class="account-modal-inline-stub" />',
  }),
}))

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockQuery = {}
  })

  it('returns to chat route from query target', async () => {
    mockQuery = { from: '/chat' }

    const { default: AccountPage } = await import('../index.vue')
    const wrapper = mount(AccountPage, {
    })

    await wrapper.find('.back-button').trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/chat')
    expect(sessionStorage.getItem('accountPageBackTarget')).toBe('/chat')
  }, 15000)

  it('returns to stored route after refresh when query is missing', async () => {
    sessionStorage.setItem('accountPageBackTarget', '/chat')

    const { default: AccountPage } = await import('../index.vue')
    const wrapper = mount(AccountPage, {
    })

    await wrapper.find('.back-button').trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/chat')
  }, 15000)
})
