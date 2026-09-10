import { describe, expect, it, vi } from 'vitest'
import request from '@/utils/request'
import { generateImageApi, getImageHistoryApi } from '../image'

vi.mock('@/utils/request', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('Image API', () => {
  it('generateImageApi calls /images/generations with 180s timeout by default', async () => {
    const mockPost = vi.mocked(request.post)
    mockPost.mockResolvedValueOnce({ code: 0, data: {}, message: 'ok' })

    const params = {
      prompt: 'futuristic cat',
      model: 'grok-imagine-image-2.0',
      n: 1,
    }

    await generateImageApi(params)

    expect(mockPost).toHaveBeenCalledWith(
      '/images/generations',
      params,
      expect.objectContaining({
        timeout: 180000,
      }),
    )
  })

  it('generateImageApi preserves custom config while keeping timeout', async () => {
    const mockPost = vi.mocked(request.post)
    mockPost.mockResolvedValueOnce({ code: 0, data: {}, message: 'ok' })

    const controller = new AbortController()
    const params = {
      prompt: 'cyberpunk warrior',
      model: 'grok-imagine-image-2.0',
    }

    await generateImageApi(params, { signal: controller.signal })

    expect(mockPost).toHaveBeenCalledWith(
      '/images/generations',
      params,
      expect.objectContaining({
        timeout: 180000,
        signal: controller.signal,
      }),
    )
  })

  it('getImageHistoryApi calls /images/history with pagination params', async () => {
    const mockGet = vi.mocked(request.get)
    mockGet.mockResolvedValueOnce({ code: 0, data: { items: [], total: 0 }, message: 'ok' })

    await getImageHistoryApi(2, 10)

    expect(mockGet).toHaveBeenCalledWith('/images/history', {
      params: { page: 2, pageSize: 10 },
    })
  })
})
