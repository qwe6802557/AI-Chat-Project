import { describe, expect, it, vi } from 'vitest'
import { rasterizeSvgToPng, downloadBlobFile } from '../rasterizeSvg'

describe('rasterizeSvg', () => {
  it('rejects when invalid SVG has no root element', async () => {
    await expect(rasterizeSvgToPng('not-a-svg')).rejects.toThrow('未找到有效的 SVG 根元素')
  })

  it('triggers downloadBlobFile without throwing', () => {
    const fakeBlob = new Blob(['test'], { type: 'text/plain' })
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    expect(() => downloadBlobFile(fakeBlob, 'test.txt')).not.toThrow()

    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(revokeObjectURLSpy).toHaveBeenCalled()

    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })
})
