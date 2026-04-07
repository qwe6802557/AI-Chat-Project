import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatArea from '../ChatArea.vue'

const uploadMockState = vi.hoisted(() => ({
  files: undefined as any,
  isProcessing: undefined as any,
  canSendFiles: undefined as any,
  addFiles: vi.fn(),
  removeFile: vi.fn(),
  clearFiles: vi.fn(),
  getFileIdsForSend: vi.fn(() => [] as string[]),
  getUploadedFileInfos: vi.fn(() => [] as Array<{ id: string; url: string; name: string; type: string }>),
}))

vi.mock('@/hooks/useFileUpload', async () => {
  const { computed, ref } = await import('vue')

  uploadMockState.files ??= ref<Array<{ id: string; name: string }>>([])
  uploadMockState.isProcessing ??= ref(false)
  uploadMockState.canSendFiles ??= ref(false)

  return {
    IMAGE_UPLOAD_ACCEPT: 'image/png,image/jpeg',
    useFileUpload: () => ({
      files: uploadMockState.files,
      addFiles: uploadMockState.addFiles,
      removeFile: uploadMockState.removeFile,
      clearFiles: uploadMockState.clearFiles,
      getFileIdsForSend: uploadMockState.getFileIdsForSend,
      getUploadedFileInfos: uploadMockState.getUploadedFileInfos,
      hasFiles: computed(() => uploadMockState.files.value.length > 0),
      isProcessing: uploadMockState.isProcessing,
      canSendFiles: uploadMockState.canSendFiles,
    }),
  }
})

const globalStubs = {
  ChatModelSwitcher: {
    template: '<div class="chat-model-switcher-stub" @click="$emit(\'update:selected-model\', \'GLM-5\')" />',
  },
  ChatMessageViewport: {
    template: '<div class="chat-message-viewport-stub" @click="$emit(\'prompt-click\', \'用简单的话解释量子计算\')" />',
  },
  FilePreview: {
    template: '<div class="file-preview-stub" />',
  },
  'a-textarea': {
    props: ['value'],
    emits: ['update:value', 'keydown', 'paste'],
    template: `
      <textarea
        :value="value"
        @input="$emit('update:value', $event.target.value)"
        @keydown="$emit('keydown', $event)"
        @paste="$emit('paste', $event)"
      />
    `,
  },
  'a-button': {
    props: ['disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  transition: false,
}

describe('ChatArea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadMockState.files.value = []
    uploadMockState.isProcessing.value = false
    uploadMockState.canSendFiles.value = false
    uploadMockState.getFileIdsForSend.mockReturnValue([])
    uploadMockState.getUploadedFileInfos.mockReturnValue([])
  })

  it('emits plain text message and clears upload state', async () => {
    const wrapper = mount(ChatArea, {
      props: {
        messages: [],
        loading: false,
        selectedModel: 'GLM-5',
        modelOptions: [{ label: 'GLM-5', value: 'GLM-5', inputPrice: 1.83, outputPrice: 7.32, reserveCredits: 100 }],
      },
      global: {
        stubs: globalStubs,
      },
    })

    await wrapper.find('textarea').setValue('你好')
    await wrapper.findAll('button').at(-1)!.trigger('click')

    const sendEvent = wrapper.emitted('send-message')
    expect(sendEvent?.[0]).toEqual(['你好', undefined])
    expect(uploadMockState.clearFiles).toHaveBeenCalledTimes(1)
  })

  it('emits uploaded fileIds path without base64 payload', async () => {
    uploadMockState.files.value = [{ id: 'local-1', name: 'demo.png' }]
    uploadMockState.canSendFiles.value = true
    uploadMockState.getFileIdsForSend.mockReturnValue(['file-1'])
    uploadMockState.getUploadedFileInfos.mockReturnValue([
      {
        id: 'file-1',
        url: '/files/file-1',
        name: 'demo.png',
        type: 'image/png',
      },
    ])

    const wrapper = mount(ChatArea, {
      props: {
        messages: [],
        loading: false,
        selectedModel: 'GLM-5',
        modelOptions: [{ label: 'GLM-5', value: 'GLM-5', inputPrice: 1.83, outputPrice: 7.32, reserveCredits: 100 }],
      },
      global: {
        stubs: globalStubs,
      },
    })

    await wrapper.findAll('button').at(-1)!.trigger('click')

    const sendEvent = wrapper.emitted('send-message')
    expect(sendEvent?.[0]?.[0]).toBe('')
    expect(sendEvent?.[0]?.[1]).toEqual({
      fileIds: ['file-1'],
      serverFiles: [
        {
          id: 'file-1',
          url: '/files/file-1',
          name: 'demo.png',
          type: 'image/png',
        },
      ],
    })
    expect((sendEvent?.[0]?.[1] as Record<string, unknown>).files).toBeUndefined()
  })

  it('re-emits prompt-click as send-message event', async () => {
    const wrapper = mount(ChatArea, {
      props: {
        messages: [],
        loading: false,
        selectedModel: 'GLM-5',
        modelOptions: [{ label: 'GLM-5', value: 'GLM-5', inputPrice: 1.83, outputPrice: 7.32, reserveCredits: 100 }],
      },
      global: {
        stubs: globalStubs,
      },
    })

    await wrapper.find('.chat-message-viewport-stub').trigger('click')

    expect(wrapper.emitted('send-message')?.[0]).toEqual(['用简单的话解释量子计算'])
  })

  it('disables send button when credits are insufficient', async () => {
    const wrapper = mount(ChatArea, {
      props: {
        messages: [],
        loading: false,
        selectedModel: 'GLM-5',
        modelOptions: [{ label: 'GLM-5', value: 'GLM-5', inputPrice: 1.83, outputPrice: 7.32, reserveCredits: 100 }],
        selectedModelInputPrice: 1.83,
        selectedModelOutputPrice: 7.32,
        selectedModelReserveCredits: 100,
        currentCreditsRemaining: 50,
        hasCreditSnapshot: true,
      },
      global: {
        stubs: globalStubs,
      },
    })

    await wrapper.find('textarea').setValue('你好')

    expect(wrapper.findAll('button').at(-1)?.attributes('disabled')).toBeDefined()
  })
})
