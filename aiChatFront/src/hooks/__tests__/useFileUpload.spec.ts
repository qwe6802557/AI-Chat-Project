import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileUpload } from '@/hooks/useFileUpload'

const {
  mockUploadFiles,
  mockWarning,
  mockError,
} = vi.hoisted(() => ({
  mockUploadFiles: vi.fn(),
  mockWarning: vi.fn(),
  mockError: vi.fn(),
}))

vi.mock('@/api/chat', () => ({
  uploadFiles: mockUploadFiles,
}))

vi.mock('ant-design-vue', () => ({
  message: {
    warning: mockWarning,
    error: mockError,
  },
}))

const TestHarness = defineComponent({
  setup(_, { expose }) {
    const api = useFileUpload({ autoCompress: false })
    expose(api)
    return () => null
  },
})

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-image files before upload starts', async () => {
    const wrapper = mount(TestHarness)
    const api = wrapper.vm as unknown as {
      addFiles: (files: File[]) => Promise<void>
      files: Array<{ status: string }>
    }

    const pdfFile = new File(['pdf'], 'demo.pdf', { type: 'application/pdf' })
    await api.addFiles([pdfFile])

    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('当前仅支持上传图片'))
    expect(mockUploadFiles).not.toHaveBeenCalled()
    expect(api.files).toHaveLength(0)
  })

  it('uploads image files through fileIds path without generating base64 payload', async () => {
    mockUploadFiles.mockResolvedValue({
      code: 0,
      data: [
        {
          id: 'file-1',
          url: '/files/file-1',
          name: 'demo.png',
          mime: 'image/png',
          sizeBytes: 128,
        },
      ],
      message: 'ok',
    })

    const wrapper = mount(TestHarness)
    const api = wrapper.vm as unknown as {
      addFiles: (files: File[]) => Promise<void>
      files: Array<{
        base64?: string
        status: string
        serverId?: string
        serverUrl?: string
      }>
      getFileIdsForSend: () => string[]
      getUploadedFileInfos: () => Array<{ id: string; url: string; name: string; type: string }>
    }

    const imageFile = new File(['image'], 'demo.png', { type: 'image/png' })
    await api.addFiles([imageFile])

    expect(mockUploadFiles).toHaveBeenCalledTimes(1)
    expect(mockUploadFiles).toHaveBeenCalledWith([expect.any(File)])
    expect(api.files[0]?.base64).toBeUndefined()
    expect(api.files[0]?.status).toBe('uploaded')
    expect(api.getFileIdsForSend()).toEqual(['file-1'])
    expect(api.getUploadedFileInfos()).toEqual([
      {
        id: 'file-1',
        url: 'http://localhost:3000/files/file-1',
        name: 'demo.png',
        type: 'image/png',
      },
    ])
  })
})
