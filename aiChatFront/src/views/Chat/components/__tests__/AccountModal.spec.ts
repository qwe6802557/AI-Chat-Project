import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUserAccount = vi.fn()

vi.mock('@/api/user', () => ({
  getCurrentUserAccount: mockGetCurrentUserAccount,
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<typeof import('ant-design-vue')>('ant-design-vue')
  return {
    ...actual,
    message: {
      warning: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  }
})

describe('AccountModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('loads and renders recent credit ledger when opened', async () => {
    const { useAuthStore } = await import('@/stores')
    const authStore = useAuthStore()
    authStore.setAuthSession({
      token: 'token-1',
      user: {
        id: 'user-1',
        username: 'tester',
        email: 'tester@example.com',
        role: 'user',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        credits: {
          total: 2000,
          consumed: 0,
          remaining: 2000,
          reserved: 0,
        },
      },
    })

    mockGetCurrentUserAccount.mockResolvedValue({
      code: 0,
      data: {
        user: {
          id: 'user-1',
          username: 'tester',
          credits: {
            total: 2000,
            consumed: 100,
            remaining: 1900,
            reserved: 0,
          },
        },
        recentLedger: {
          items: [
            {
              id: 'ledger-1',
              type: 'grant',
              title: '注册赠送积分',
              description: '新用户注册赠送积分',
              amount: 2000,
              balanceAfter: 2000,
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            {
              id: 'ledger-2',
              type: 'reserve',
              title: '模型消息扣费',
              description: '模型：GLM-5',
              amount: -100,
              balanceAfter: 1900,
              createdAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
          hasMore: false,
        },
      },
      message: 'ok',
    })

    const { default: AccountModal } = await import('../AccountModal.vue')
    const wrapper = mount(AccountModal, {
      props: {
        open: false,
      },
      global: {
        stubs: {
          AvatarUploader: true,
          ChatStatsPanel: true,
          'a-modal': {
            template: '<div class="modal-stub"><slot /></div>',
          },
          'a-progress': true,
          'a-input': true,
          'a-button': {
            template: '<button><slot /></button>',
          },
        },
      },
    })

    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(mockGetCurrentUserAccount).toHaveBeenCalledWith({ ledgerPage: 1, ledgerPageSize: 10 })
    expect(wrapper.text()).toContain('最近积分流水')
    expect(wrapper.text()).toContain('注册赠送积分')
    expect(wrapper.text()).toContain('模型消息扣费')
    expect(wrapper.text()).toContain('+2,000')
    expect(wrapper.text()).toContain('-100')
    expect(authStore.userProfile?.credits?.remaining).toBe(1900)
  }, 15000)

  it('appends next ledger page when clicking load more', async () => {
    const { useAuthStore } = await import('@/stores')
    const authStore = useAuthStore()
    authStore.setAuthSession({
      token: 'token-1',
      user: {
        id: 'user-1',
        username: 'tester',
        email: 'tester@example.com',
        role: 'user',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        credits: {
          total: 2000,
          consumed: 100,
          remaining: 1900,
          reserved: 0,
        },
      },
    })

    mockGetCurrentUserAccount
      .mockResolvedValueOnce({
        code: 0,
        data: {
          user: {
            id: 'user-1',
            username: 'tester',
            credits: {
              total: 2000,
              consumed: 100,
              remaining: 1900,
              reserved: 0,
            },
          },
          recentLedger: {
            items: [
              {
                id: 'ledger-1',
                type: 'grant',
                title: '注册赠送积分',
                description: '新用户注册赠送积分',
                amount: 2000,
                balanceAfter: 2000,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            total: 2,
            page: 1,
            pageSize: 10,
            hasMore: true,
          },
        },
        message: 'ok',
      })
      .mockResolvedValueOnce({
        code: 0,
        data: {
          user: {
            id: 'user-1',
            username: 'tester',
            credits: {
              total: 2000,
              consumed: 100,
              remaining: 1900,
              reserved: 0,
            },
          },
          recentLedger: {
            items: [
              {
                id: 'ledger-2',
                type: 'reserve',
                title: '模型消息扣费',
                description: '模型：GLM-5',
                amount: -100,
                balanceAfter: 1900,
                createdAt: '2026-01-02T00:00:00.000Z',
              },
            ],
            total: 2,
            page: 2,
            pageSize: 10,
            hasMore: false,
          },
        },
        message: 'ok',
      })

    const { default: AccountModal } = await import('../AccountModal.vue')
    const wrapper = mount(AccountModal, {
      props: {
        open: false,
      },
      global: {
        stubs: {
          AvatarUploader: true,
          ChatStatsPanel: true,
          'a-modal': {
            template: '<div class="modal-stub"><slot /></div>',
          },
          'a-progress': true,
          'a-input': true,
          'a-button': {
            props: ['loading'],
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(wrapper.text()).toContain('查看更多')

    await wrapper.find('.ledger-more-btn').trigger('click')
    await flushPromises()

    expect(mockGetCurrentUserAccount).toHaveBeenNthCalledWith(1, {
      ledgerPage: 1,
      ledgerPageSize: 10,
    })
    expect(mockGetCurrentUserAccount).toHaveBeenNthCalledWith(2, {
      ledgerPage: 2,
      ledgerPageSize: 10,
    })
    expect(wrapper.text()).toContain('注册赠送积分')
    expect(wrapper.text()).toContain('模型消息扣费')
  }, 15000)
})
