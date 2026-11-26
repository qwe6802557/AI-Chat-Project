import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'

const { mockMessageOpen } = vi.hoisted(() => ({
  mockMessageOpen: vi.fn(),
}))

vi.mock('ant-design-vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ant-design-vue')>()
  return {
    ...actual,
    message: {
      ...actual.message,
      open: mockMessageOpen,
    },
  }
})

import request from '../request'

describe('request 响应拦截器', () => {
  let originalAdapter: AxiosAdapter | typeof request.defaults.adapter

  const mockAdapterResponse = (
    status: number,
    data: unknown,
    headers: Record<string, string> = {}
  ): void => {
    request.defaults.adapter = async (config: InternalAxiosRequestConfig) => ({
      data,
      status,
      statusText: 'OK',
      headers,
      config,
    })
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    mockMessageOpen.mockClear()
    originalAdapter = request.defaults.adapter
  })

  afterEach(() => {
    request.defaults.adapter = originalAdapter
  })

  it('标准成功响应（code === 0）应解包返回响应体', async () => {
    const payload = { code: 0, data: { ok: true }, message: 'ok' }
    mockAdapterResponse(200, payload, { 'content-type': 'application/json' })

    const res = await request.get('/memory/profile')
    expect(res).toEqual(payload)
    expect(mockMessageOpen).not.toHaveBeenCalled()
  })

  it('标准业务错误响应（code !== 0）应提示后端错误信息并 reject', async () => {
    mockAdapterResponse(
      200,
      { code: 1, data: null, message: '参数错误' },
      { 'content-type': 'application/json' }
    )

    await expect(request.get('/memory/profile')).rejects.toThrow('参数错误')
    expect(mockMessageOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        content: '参数错误',
      })
    )
  })

  it('网关回退返回 HTML 页面时应显式提示代理配置或缓存问题', async () => {
    mockAdapterResponse(
      200,
      '<!DOCTYPE html><html><head><title>App</title></head><body></body></html>',
      { 'content-type': 'text/html' }
    )

    await expect(request.get('/memory/profile')).rejects.toThrow(
      '接口返回了 HTML 页面，请检查网关代理配置或强刷清理缓存'
    )
    expect(mockMessageOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        content: '接口返回了 HTML 页面，请检查网关代理配置或强刷清理缓存',
      })
    )
  })

  it('其他非 JSON 文本响应应显式提示非标准 JSON 响应而非操作失败', async () => {
    mockAdapterResponse(200, 'plain text error', { 'content-type': 'text/plain' })

    await expect(request.get('/memory/profile')).rejects.toThrow(
      '接口返回了非标准 JSON 响应，请检查服务或网关代理配置'
    )
    expect(mockMessageOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        content: '接口返回了非标准 JSON 响应，请检查服务或网关代理配置',
      })
    )
  })
})
