import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores'
import LoginPage from '../Login/index.vue'
import RegisterPage from '../Register/index.vue'

const {
  routerPush,
  currentRoute,
  mockGetCaptcha,
  mockLogin,
  mockRegister,
  mockMessageSuccess,
  mockMessageError,
  mockMessageInfo,
} = vi.hoisted(() => ({
  routerPush: vi.fn(),
  currentRoute: { value: { query: {} as Record<string, unknown> } },
  mockGetCaptcha: vi.fn(),
  mockLogin: vi.fn(),
  mockRegister: vi.fn(),
  mockMessageSuccess: vi.fn(),
  mockMessageError: vi.fn(),
  mockMessageInfo: vi.fn(),
}))

vi.mock('vue-router', () => ({
  createRouter: () => ({
    beforeEach: vi.fn(),
    currentRoute: { value: { name: 'login' } },
    replace: vi.fn(),
    push: vi.fn(),
  }),
  createWebHistory: vi.fn(() => ({})),
  useRouter: () => ({
    push: routerPush,
    currentRoute,
  }),
}))

vi.mock('@/api/auth', () => ({
  getCaptcha: mockGetCaptcha,
  login: mockLogin,
  register: mockRegister,
  sendEmailCode: vi.fn(),
  resetPassword: vi.fn(),
}))

vi.mock('@/api/oauth', () => ({
  getOAuthAuthorizeUrl: vi.fn(),
  handleOAuthCallback: vi.fn(),
}))

vi.mock('ant-design-vue', () => ({
  message: {
    success: mockMessageSuccess,
    error: mockMessageError,
    info: mockMessageInfo,
  },
}))

const globalStubs = {
  'a-form': true,
  'a-form-item': true,
  'a-input': true,
  'a-input-password': true,
  'a-button': true,
  'a-checkbox': true,
}

describe('auth page action chains', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    currentRoute.value.query = {}
    mockGetCaptcha.mockResolvedValue({
      code: 0,
      data: {
        captchaId: 'captcha-1',
        captchaImage: 'data:image/png;base64,xxx',
      },
      message: 'ok',
    })
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('login page writes auth session and redirects to chat on success', async () => {
    mockLogin.mockResolvedValue({
      code: 0,
      data: {
        token: 'token-1',
        user: {
          id: 'user-1',
          username: 'tester',
          email: 'tester@example.com',
          role: 'user',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      message: 'ok',
    })

    const wrapper = mount(LoginPage, {
      shallow: true,
      global: {
        plugins: [pinia],
        stubs: globalStubs,
      },
    })

    await flushPromises()

    const vm = wrapper.vm as any
    vm.formState.username = 'tester'
    vm.formState.password = 'password123'
    vm.formState.captcha = '1234'
    vm.formState.remember = true

    await vm.handleLogin()

    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(true)
    expect(store.userId).toBe('user-1')
    expect(store.username).toBe('tester')
    expect(store.rememberedUsername).toBe('tester')
    expect(routerPush).toHaveBeenCalledWith('/chat')
  })

  it('login page allows logging in with email and preserves input in remembered credentials', async () => {
    mockLogin.mockResolvedValue({
      code: 0,
      data: {
        token: 'token-email',
        user: {
          id: 'user-email-1',
          username: 'account_name',
          email: 'my_email@example.com',
          role: 'user',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      message: 'ok',
    })

    const wrapper = mount(LoginPage, {
      shallow: true,
      global: {
        plugins: [pinia],
        stubs: globalStubs,
      },
    })

    await flushPromises()

    const vm = wrapper.vm as any
    // 校验规则已更新为 用户名或邮箱
    expect(vm.rules.username[0].message).toBe('请输入用户名或邮箱!')

    vm.formState.username = 'my_email@example.com'
    vm.formState.password = 'password123'
    vm.formState.captcha = '1234'
    vm.formState.remember = true

    await vm.handleLogin()

    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'my_email@example.com',
      })
    )

    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(true)
    expect(store.rememberedUsername).toBe('my_email@example.com')
    expect(routerPush).toHaveBeenCalledWith('/chat')
  })

  it('login page handles OAUTH_LOGIN_SUCCESS message and navigates to chat', async () => {
    const wrapper = mount(LoginPage, {
      shallow: true,
      global: {
        plugins: [pinia],
        stubs: globalStubs,
      },
    })

    await flushPromises()

    const oauthPayload = {
      token: 'oauth-jwt-token',
      user: {
        id: 'oauth-user-id',
        username: 'qq_oauth_user',
        email: null,
        role: 'user',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    }

    // 触发 window message 事件
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          type: 'OAUTH_LOGIN_SUCCESS',
          session: oauthPayload,
        },
      })
    )

    await flushPromises()

    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(true)
    expect(store.userId).toBe('oauth-user-id')
    expect(store.username).toBe('qq_oauth_user')
    expect(routerPush).toHaveBeenCalledWith('/chat')
    wrapper.unmount()
  })

  it('register page writes auth session and redirects after timeout', async () => {
    vi.useFakeTimers()

    mockRegister.mockResolvedValue({
      code: 0,
      data: {
        token: 'token-2',
        user: {
          id: 'user-2',
          username: 'new-user',
          email: 'new@example.com',
          role: 'user',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      message: 'ok',
    })

    const wrapper = mount(RegisterPage, {
      shallow: true,
      global: {
        plugins: [pinia],
        stubs: globalStubs,
      },
    })

    const vm = wrapper.vm as any
    vm.formState.name = 'new-user'
    vm.formState.password = 'password123'
    vm.formState.email = 'new@example.com'
    vm.formState.verifyCode = '123456'

    await vm.handleRegister()

    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(true)
    expect(store.userId).toBe('user-2')
    expect(store.username).toBe('new-user')

    vi.advanceTimersByTime(1000)
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({ name: 'chat' })
  })
})
