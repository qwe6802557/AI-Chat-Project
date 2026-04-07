import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import Sidebar from '../Sidebar.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useRoute: () => ({
    fullPath: '/chat',
  }),
}))

vi.mock('ant-design-vue', () => ({
  Modal: {
    confirm: vi.fn(),
  },
  message: {
    info: vi.fn(),
  },
}))

describe('Sidebar', () => {
  it('does not render cumulative charged credits in conversation list', () => {
    const wrapper = mount(Sidebar, {
      props: {
        conversations: [
          {
            id: 'session-1',
            title: '会话一',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            sessionId: 'session-1',
            usageSummary: {
              lastModel: 'GLM-5',
              totalPromptTokens: 100,
              totalCompletionTokens: 50,
              totalTokens: 150,
              totalEstimatedCost: 0.03,
              totalChargedCredits: 300,
            },
          },
        ],
        currentConversationId: 'session-1',
      },
      global: {
        stubs: {
          AboutModal: true,
          'a-button': {
            template: '<button><slot /></button>',
          },
          'a-dropdown': {
            template: '<div><slot /><slot name="overlay" /></div>',
          },
          'a-menu': {
            template: '<div><slot /></div>',
          },
          'a-menu-item': {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    expect(wrapper.text()).not.toContain('已扣 300 积分')
  })
})
