import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ChannelCardItem from '../ChannelCardItem.vue'
import type { ChannelInfo } from '@/api/channel'

const { updateInstanceSettingsMock, toggleInstanceMock, messageMock } = vi.hoisted(() => ({
  updateInstanceSettingsMock: vi.fn().mockResolvedValue({ data: {} }),
  toggleInstanceMock: vi.fn().mockResolvedValue({ data: {} }),
  messageMock: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('ant-design-vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ant-design-vue')>()
  return { ...actual, message: messageMock }
})

vi.mock('@/api/channel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/channel')>()
  return {
    ...actual,
    updateInstanceSettings: updateInstanceSettingsMock,
    toggleInstance: toggleInstanceMock,
  }
})

const ANTD_STUBS = {
  'a-button': {
    emits: ['click'],
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>',
  },
  'a-qrcode': { template: '<div />' },
  'a-tooltip': { template: '<div><slot /></div>' },
  'a-tag': { template: '<span><slot /></span>' },
  'a-select': {
    props: ['value'],
    emits: ['update:value'],
    template: '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><slot /></select>',
  },
  'a-select-option': {
    props: ['value'],
    template: '<option :value="value"><slot /></option>',
  },
  'a-input': {
    props: ['value', 'placeholder'],
    emits: ['update:value'],
    template: '<input :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  'a-input-password': {
    props: ['value', 'placeholder'],
    emits: ['update:value'],
    template: '<input type="password" :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  'a-popconfirm': { template: '<div><slot /></div>' },
  'a-spin': { template: '<div><slot /></div>' },
  ChannelAuditModal: { template: '<div />' },
}

describe('ChannelCardItem (wecom_bot)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Bot ID & Secret fields for wecom_bot and saves credentials with workflow binding', async () => {
    const channel: ChannelInfo = {
      id: 'inst-wecom-1',
      channelType: 'wecom_bot',
      name: '企微智能机器人',
      instanceName: '企微研发助理',
      roleId: 'role-1',
      workflowId: 'wf-1',
      isEnabled: false,
      status: 'disconnected',
      credentialsMasked: { botId: 'aib***99', secret: '********' },
    }

    const wrapper = mount(ChannelCardItem, {
      props: {
        channel,
        modelList: [],
        roleList: [{ id: 'role-1', name: '技术助理' }],
        workflowList: [
          {
            id: 'wf-1',
            userId: 'u1',
            name: '巡检诊断工作流',
            status: 'published',
            version: 1,
            draftGraph: { nodes: [], edges: [] },
            createdAt: '',
            updatedAt: '',
          },
        ],
      },
      global: { stubs: ANTD_STUBS },
    })

    const toggleConfigBtn = wrapper.findAll('button').find((b) => b.text().includes('配置'))
    expect(toggleConfigBtn).toBeTruthy()
    await toggleConfigBtn!.trigger('click')

    const botIdInput = wrapper.find('input[placeholder*="aib***99"]')
    const secretInput = wrapper.find('input[type="password"]')
    expect(botIdInput.exists()).toBe(true)
    expect(secretInput.exists()).toBe(true)
    expect(wrapper.text()).toContain('使用长连接')

    await botIdInput.setValue('aib_new_888')
    await secretInput.setValue('sec_new_secret')

    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('保存配置'))
    await saveBtn!.trigger('click')
    await flushPromises()

    expect(updateInstanceSettingsMock).toHaveBeenCalledWith('inst-wecom-1', {
      instanceName: '企微研发助理',
      roleId: 'role-1',
      workflowId: 'wf-1',
      credentials: {
        botId: 'aib_new_888',
        secret: 'sec_new_secret',
      },
    })
  })
})
