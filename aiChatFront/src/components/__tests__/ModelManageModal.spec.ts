import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ModelManageModal from '../ModelManageModal.vue'
import type { BackendAiModel } from '@/interface/model'

const { getAllModelsMock, updateModelMock, messageSuccessMock, messageErrorMock } = vi.hoisted(() => ({
  getAllModelsMock: vi.fn(),
  updateModelMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn(),
}))

vi.mock('@/api/model', () => ({
  getAllModels: getAllModelsMock,
  updateModel: updateModelMock,
  setDefaultModel: vi.fn(),
  testModelLatency: vi.fn(),
}))

vi.mock('ant-design-vue', () => ({
  message: {
    success: messageSuccessMock,
    error: messageErrorMock,
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

const sampleModels: BackendAiModel[] = [
  {
    id: 'm-spark',
    modelName: 'Spark-X2.6-4B (轻量开源)',
    modelId: 'spark-x2.6-4b',
    inputPrice: 0,
    outputPrice: 0,
    contextLength: 0,
    maxOutput: 0,
    availability: 100,
    tps: 0,
    isActive: true,
    category: 'chat',
    supportsVision: false,
    visionCapability: 'unsupported',
    visionUnsupportedReason: '讯飞星火当前为纯文本语言通道，不支持视觉图像输入',
    providerId: 'p-iflytek',
    provider: { id: 'p-iflytek', name: 'iFLYTEK', isActive: true },
  },
  {
    id: 'm-gemini',
    modelName: 'Gemini 2.5 Flash',
    modelId: 'gemini-2.5-flash',
    inputPrice: 0,
    outputPrice: 0,
    contextLength: 1048576,
    maxOutput: 65536,
    availability: 99.9,
    tps: 80,
    isActive: true,
    category: 'chat',
    supportsVision: true,
    visionCapability: 'supported',
    providerId: 'p-gemini',
    provider: { id: 'p-gemini', name: 'Gemini', isActive: true },
  },
  {
    id: 'm-image',
    modelName: 'Grok Imagine Image 2.0',
    modelId: 'grok-imagine-image-2.0',
    inputPrice: 0,
    outputPrice: 0,
    contextLength: 0,
    maxOutput: 0,
    availability: 100,
    tps: 0,
    isActive: true,
    category: 'image',
    supportsVision: false,
    visionCapability: 'unsupported',
    providerId: 'p-grok',
    provider: { id: 'p-grok', name: 'Grok2API', isActive: true },
  },
]

const ATableStub = defineComponent({
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        { class: 'a-table-stub' },
        (props.dataSource as BackendAiModel[]).map((record) =>
          h(
            'div',
            { key: record.id, class: 'table-row-stub', 'data-model-id': record.modelId },
            (props.columns as Array<{ key: string }>).map((column) =>
              h(
                'div',
                { key: column.key, 'data-col': column.key },
                slots.bodyCell?.({ column, record }),
              ),
            ),
          ),
        ),
      )
  },
})

const ASwitchStub = defineComponent({
  name: 'ASwitch',
  props: {
    checked: { type: Boolean, default: false },
  },
  emits: ['change'],
  setup(props, { emit }) {
    return () =>
      h('button', {
        type: 'button',
        class: 'a-switch-stub',
        'data-checked': String(props.checked),
        onClick: () => emit('change', !props.checked),
      })
  },
})

describe('ModelManageModal 视觉能力列展示', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAllModelsMock.mockResolvedValue({ code: 0, data: sampleModels })
    updateModelMock.mockResolvedValue({ code: 0, data: {} })
  })

  it('支持视觉的对话模型展示切换开关，纯文本对话与非对话模型展示 -', async () => {
    const wrapper = mount(ModelManageModal, {
      props: { open: true },
      global: {
        stubs: {
          'a-modal': { template: '<div><slot /></div>' },
          'a-radio-group': { template: '<div><slot /></div>' },
          'a-radio-button': { template: '<div><slot /></div>' },
          'a-input-search': true,
          'a-button': { template: '<button><slot /></button>' },
          'a-tag': { template: '<span><slot /></span>' },
          'a-spin': true,
          'a-table': ATableStub,
          'a-switch': ASwitchStub,
          StarFilled: true,
          ModelLatencyDetailModal: true,
        },
      },
    })

    await flushPromises()

    const sparkVisionCell = wrapper.find('[data-model-id="spark-x2.6-4b"] [data-col="supportsVision"]')
    expect(sparkVisionCell.find('.a-switch-stub').exists()).toBe(false)
    expect(sparkVisionCell.text()).toBe('-')
    expect(sparkVisionCell.find('.untested-text').attributes('title')).toContain('纯文本语言通道')

    const geminiVisionCell = wrapper.find('[data-model-id="gemini-2.5-flash"] [data-col="supportsVision"]')
    const geminiSwitch = geminiVisionCell.find('.a-switch-stub')
    expect(geminiSwitch.exists()).toBe(true)
    expect(geminiSwitch.attributes('data-checked')).toBe('true')

    const imageVisionCell = wrapper.find('[data-model-id="grok-imagine-image-2.0"] [data-col="supportsVision"]')
    expect(imageVisionCell.find('.a-switch-stub').exists()).toBe(false)
    expect(imageVisionCell.text()).toBe('-')

    await geminiSwitch.trigger('click')
    await flushPromises()
    expect(updateModelMock).toHaveBeenCalledWith('m-gemini', { supportsVision: false })
  })
})
