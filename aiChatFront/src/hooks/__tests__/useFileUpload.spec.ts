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

  it('rejects unsupported archive or executable files before upload starts', async () => {
    const wrapper = mount(TestHarness)
    const api = wrapper.vm as unknown as {
      addFiles: (files: File[]) => Promise<void>
      files: Array<{ status: string }>
    }

    const zipFile = new File(['zip'], 'archive.zip', { type: 'application/zip' })
    await api.addFiles([zipFile])

    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('不支持的文件格式'))
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
          category: 'image',
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
      getUploadedFileInfos: () => Array<Record<string, unknown>>
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
        category: 'image',
        sizeBytes: 128,
        charCount: null,
        extractedText: null,
        truncated: false,
      },
    ])
  })

  it('uploads PDF and source code documents and preserves extractedText metadata', async () => {
    mockUploadFiles.mockResolvedValue({
      code: 0,
      data: [
        {
          id: 'doc-1',
          url: '/files/doc-1',
          name: 'service.ts',
          mime: 'text/plain',
          category: 'document',
          sizeBytes: 256,
          charCount: 42,
          extractedText: 'export const answer = 42;',
          truncated: false,
        },
      ],
      message: 'ok',
    })

    const wrapper = mount(TestHarness)
    const api = wrapper.vm as unknown as {
      addFiles: (files: File[]) => Promise<void>
      files: Array<{
        type: string
        status: string
        charCount?: number | null
        extractedText?: string | null
      }>
      getFileIdsForSend: () => string[]
      getUploadedFileInfos: () => Array<Record<string, unknown>>
    }

    const tsFile = new File(['export const answer = 42;'], 'service.ts', {
      type: 'video/mp2t',
    })
    await api.addFiles([tsFile])

    expect(mockUploadFiles).toHaveBeenCalledTimes(1)
    expect(api.files[0]?.type).toBe('document')
    expect(api.files[0]?.status).toBe('uploaded')
    expect(api.files[0]?.charCount).toBe(42)
    expect(api.files[0]?.extractedText).toBe('export const answer = 42;')
    expect(api.getFileIdsForSend()).toEqual(['doc-1'])
    expect(api.getUploadedFileInfos()[0]).toMatchObject({
      id: 'doc-1',
      name: 'service.ts',
      category: 'document',
      sizeBytes: 256,
      charCount: 42,
      extractedText: 'export const answer = 42;',
    })
  })
})
