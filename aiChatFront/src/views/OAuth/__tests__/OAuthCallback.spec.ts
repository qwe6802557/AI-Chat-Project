import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CallbackPage from '../Callback.vue'
import { handleOAuthCallback } from '@/api/oauth'
import { useAuthStore } from '@/stores'

const { mockRouterReplace, mockCurrentRoute } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockCurrentRoute: {
    value: {
      query: {} as Record<string, unknown>,
    },
  },
}))

vi.mock('vue-router', () => ({
  createRouter: () => ({
    beforeEach: vi.fn(),
    currentRoute: { value: { name: 'oauth-callback' } },
    replace: vi.fn(),
    push: vi.fn(),
  }),
  createWebHistory: vi.fn(() => ({})),
  useRoute: () => mockCurrentRoute.value,
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}))

vi.mock('@/api/oauth', () => ({
  handleOAuthCallback: vi.fn(),
}))

describe('OAuth Callback.vue', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    mockCurrentRoute.value.query = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows error when code is missing in query', async () => {
    mockCurrentRoute.value.query = {}

    const wrapper = mount(CallbackPage, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    expect(handleOAuthCallback).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('未检测到授权临时凭证 Code')
  })

  it('handles successful callback and posts message to window.opener', async () => {
    mockCurrentRoute.value.query = {
      code: 'test-auth-code',
      state: 'test-state-123',
      platform: 'qq',
    }

    const mockPostMessage = vi.fn()
    const mockClose = vi.fn()

    vi.stubGlobal('opener', {
      closed: false,
      postMessage: mockPostMessage,
    })
    vi.stubGlobal('close', mockClose)

    const mockSession = {
      token: 'jwt-token-oauth',
      user: {
        id: 'user-oauth-1',
        username: 'qq_user_test',
        email: null,
        role: 'user',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    }

    vi.mocked(handleOAuthCallback).mockResolvedValueOnce({
      code: 0,
      data: mockSession as any,
      message: 'ok',
    })

    const wrapper = mount(CallbackPage, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    expect(handleOAuthCallback).toHaveBeenCalledWith({
      platform: 'qq',
      code: 'test-auth-code',
      state: 'test-state-123',
    })

    expect(mockPostMessage).toHaveBeenCalledWith(
      {
        type: 'OAUTH_LOGIN_SUCCESS',
        session: mockSession,
      },
      window.location.origin
    )
    expect(wrapper.text()).toContain('授权成功！')
  })

  it('handles callback failure and posts error message to window.opener', async () => {
    mockCurrentRoute.value.query = {
      code: 'invalid-code',
      state: 'invalid-state',
      platform: 'qq',
    }

    const mockPostMessage = vi.fn()
    vi.stubGlobal('opener', {
      closed: false,
      postMessage: mockPostMessage,
    })

    vi.mocked(handleOAuthCallback).mockRejectedValueOnce({
      response: {
        data: {
          message: 'OAuth state 校验失败，可能为跨站伪造请求',
        },
      },
    })

    const wrapper = mount(CallbackPage, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    expect(handleOAuthCallback).toHaveBeenCalled()
    expect(mockPostMessage).toHaveBeenCalledWith(
      {
        type: 'OAUTH_LOGIN_ERROR',
        message: 'OAuth state 校验失败，可能为跨站伪造请求',
      },
      window.location.origin
    )
    expect(wrapper.text()).toContain('授权登录失败')
    expect(wrapper.text()).toContain('OAuth state 校验失败')
  })
})
