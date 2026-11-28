import { defineComponent, h } from 'vue'
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

const ASegmentedStub = defineComponent({
  name: 'ASegmented',
  props: {
    value: { type: String, default: 'overview' },
    options: { type: Array as () => Array<{ label: string; value: string }>, default: () => [] },
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        { class: 'segmented-stub' },
        props.options.map((opt) =>
          h(
            'button',
            {
              type: 'button',
              class: ['segmented-opt', `seg-${opt.value}`, { active: props.value === opt.value }],
              onClick: () => emit('update:value', opt.value),
            },
            opt.label,
          ),
        ),
      )
  },
})

const ARadioGroupStub = defineComponent({
  name: 'ARadioGroup',
  props: {
    value: { type: String, default: 'all' },
  },
  emits: ['update:value'],
  setup(_, { slots, emit }) {
    return () =>
      h(
        'div',
        {
          class: 'radio-group-stub',
          onClick: (e: Event) => {
            const target = (e.target as HTMLElement).closest('[data-radio-value]')
            const val = target?.getAttribute('data-radio-value')
            if (val) emit('update:value', val)
          },
        },
        slots.default?.(),
      )
  },
})

const ARadioButtonStub = defineComponent({
  name: 'ARadioButton',
  props: {
    value: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () => h('button', { type: 'button', 'data-radio-value': props.value }, slots.default?.())
  },
})

const ATableStub = defineComponent({
  name: 'ATable',
  props: {
    dataSource: { type: Array as () => Array<Record<string, unknown>>, default: () => [] },
    columns: { type: Array as () => Array<Record<string, unknown>>, default: () => [] },
    pagination: { type: [Object, Boolean], default: false },
  },
  emits: ['change'],
  setup(props, { slots, emit }) {
    return () =>
      h('div', { class: 'a-table-stub' }, [
        ...props.dataSource.map((record, rowIdx) =>
          h(
            'div',
            { key: String(record.id ?? rowIdx), class: 'table-row-stub' },
            props.columns.map((col) =>
              h(
                'div',
                { key: String(col.key), class: `col-${String(col.key)}` },
                slots.bodyCell ? slots.bodyCell({ column: col, record }) : String(record[String(col.dataIndex)] ?? ''),
              ),
            ),
          ),
        ),
        props.pagination && typeof props.pagination === 'object'
          ? h(
              'button',
              {
                type: 'button',
                class: 'table-next-page-btn',
                onClick: () =>
                  emit('change', {
                    current: Number((props.pagination as Record<string, unknown>).current || 1) + 1,
                  }),
              },
              '下一页',
            )
          : null,
      ])
  },
})

const mountAccountModal = async (initialOpen = false) => {
  const { default: AccountModal } = await import('../AccountModal.vue')
  return mount(AccountModal, {
    props: {
      open: initialOpen,
    },
    global: {
      stubs: {
        AvatarUploader: true,
        ChatStatsPanel: true,
        'a-modal': {
          props: ['open', 'title'],
          template: '<div class="modal-stub"><slot /></div>',
        },
        'a-segmented': ASegmentedStub,
        'a-radio-group': ARadioGroupStub,
        'a-radio-button': ARadioButtonStub,
        'a-table': ATableStub,
        'a-tag': {
          template: '<span class="tag-stub"><slot /></span>',
        },
        'a-progress': true,
        'a-input': true,
        'a-button': {
          props: ['loading', 'disabled'],
          emits: ['click'],
          template: '<button type="button" @click="$emit(\'click\', $event)"><slot /></button>',
        },
      },
    },
  })
}

const seedAuthUser = async () => {
  const { useAuthStore } = await import('@/stores')
  const authStore = useAuthStore()
  authStore.setAuthSession({
    token: 'token-1',
    user: {
      id: 'user-1234567890-tail',
      username: 'tester',
      email: 'tester@example.com',
      phone: '13800138000',
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
  return authStore
}

describe('AccountModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('loads summary and renders credit ledger preview when opened', async () => {
    const authStore = await seedAuthUser()

    mockGetCurrentUserAccount.mockResolvedValue({
      code: 0,
      data: {
        user: {
          id: 'user-1234567890-tail',
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
              type: 'capture',
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

    const wrapper = await mountAccountModal(false)
    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(mockGetCurrentUserAccount).toHaveBeenCalledWith({ ledgerPage: 1, ledgerPageSize: 10 })
    expect(wrapper.text()).toContain('tester')
    expect(wrapper.text()).toContain('1,900')
    expect(wrapper.text()).toContain('最近积分流水')
    expect(wrapper.text()).toContain('注册赠送积分')
    expect(wrapper.text()).toContain('模型消息扣费')
    expect(wrapper.text()).toContain('+2,000')
    expect(wrapper.text()).toContain('-100')
    expect(authStore.userProfile?.credits?.remaining).toBe(1900)
  }, 30000)

  it('switches to ledger tab, supports type filtering and table pagination', async () => {
    await seedAuthUser()

    mockGetCurrentUserAccount
      .mockResolvedValueOnce({
        code: 0,
        data: {
          user: {
            id: 'user-1234567890-tail',
            username: 'tester',
            credits: { total: 2000, consumed: 100, remaining: 1900, reserved: 0 },
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
                type: 'capture',
                title: '扣费条目一',
                description: '模型：GLM-5',
                amount: -100,
                balanceAfter: 1900,
                createdAt: '2026-01-02T00:00:00.000Z',
              },
            ],
            total: 12,
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
            id: 'user-1234567890-tail',
            username: 'tester',
            credits: { total: 2000, consumed: 120, remaining: 1880, reserved: 0 },
          },
          recentLedger: {
            items: [
              {
                id: 'ledger-3',
                type: 'capture',
                title: '第二页扣费条目',
                description: '模型：spark-x2.6',
                amount: -20,
                balanceAfter: 1880,
                createdAt: '2026-01-03T00:00:00.000Z',
              },
            ],
            total: 12,
            page: 2,
            pageSize: 10,
            hasMore: false,
          },
        },
        message: 'ok',
      })

    const wrapper = await mountAccountModal(false)
    await wrapper.setProps({ open: true })
    await flushPromises()

    await wrapper.find('.seg-ledger').trigger('click')
    await flushPromises()

    expect(wrapper.find('.ledger-tab-card').attributes('style') ?? '').not.toContain('display: none')
    expect(wrapper.find('.ledger-tab-card').isVisible()).toBe(true)
    expect(wrapper.find('.a-table-stub').text()).toContain('注册赠送积分')
    expect(wrapper.find('.a-table-stub').text()).toContain('扣费条目一')

    await wrapper.find('[data-radio-value="expense"]').trigger('click')
    expect(wrapper.find('.a-table-stub').text()).not.toContain('注册赠送积分')
    expect(wrapper.find('.a-table-stub').text()).toContain('扣费条目一')

    await wrapper.find('[data-radio-value="all"]').trigger('click')
    await wrapper.find('.table-next-page-btn').trigger('click')
    await flushPromises()

    expect(mockGetCurrentUserAccount).toHaveBeenNthCalledWith(1, { ledgerPage: 1, ledgerPageSize: 10 })
    expect(mockGetCurrentUserAccount).toHaveBeenNthCalledWith(2, { ledgerPage: 2, ledgerPageSize: 10 })
    expect(wrapper.find('.a-table-stub').text()).toContain('第二页扣费条目')
  }, 30000)

  it('switches to profile tab cleanly and renders account metadata', async () => {
    await seedAuthUser()
    mockGetCurrentUserAccount.mockResolvedValue({
      code: 0,
      data: {
        user: {
          id: 'user-1234567890-tail',
          username: 'tester',
          credits: { total: 2000, consumed: 0, remaining: 2000, reserved: 0 },
        },
        recentLedger: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      },
      message: 'ok',
    })

    const wrapper = await mountAccountModal(false)
    await wrapper.setProps({ open: true })
    await flushPromises()

    await wrapper.find('.seg-profile').trigger('click')
    expect(wrapper.find('.profile-tab-card').attributes('style') ?? '').not.toContain('display: none')
    expect(wrapper.find('.profile-tab-card').isVisible()).toBe(true)
    expect(wrapper.find('.profile-tab-card').text()).toContain('tester@example.com')
    expect(wrapper.find('.profile-tab-card').text()).toContain('138****8000')
    expect(wrapper.find('.profile-tab-card').text()).toContain('user-1234567890-tail')
  }, 30000)
})
