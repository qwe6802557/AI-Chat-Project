/**
 * Axios 请求封装
 */
import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores'
import {clearUserInfo} from "@/utils/common.ts";

// 响应数据接口
export interface ResponseData<T = unknown> {
  code: number
  data: T
  message: string
}

// 创建 axios 实例
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 踩坑: FormData 请求不要手动设置 Content-Type（否则 multipart boundary 丢失，后端 Multer 收不到文件）
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers && typeof (config.headers as any).delete === 'function') {
        (config.headers as any).delete('Content-Type')
      } else if (config.headers) {
        delete (config.headers as any)['Content-Type']
        delete (config.headers as any)['content-type']
      }
    }

    // 确保 headers 存在
    config.headers = config.headers ?? {}

    // 从 authStore 获取 token
    const authStore = useAuthStore()
    const token = authStore.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse<ResponseData>) => {
    const { code, message: msg } = response.data

    // 成功
    if (code === 0) {
      return response.data as never
    } else if (code === 1) {
      // 清除认证状态
      clearUserInfo()
    }

    // 非成功
    message.error(msg || '操作失败')
    return Promise.reject(new Error(msg || '操作失败'))
  },
  (error) => {
    // 错误处理
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 400:
          message.error(data?.message || '请求参数错误')
          break
        case 401:
          message.error('未授权，请重新登录')
          // 清除认证状态
          clearUserInfo()
          break
        case 403:
          message.error('拒绝访问')
          break
        case 404:
          message.error('请求的资源不存在')
          break
        case 500:
          message.error(data?.message || '服务器错误')
          break
        default:
          message.error(data?.message || '网络错误')
      }
    } else if (error.request) {
      message.error('网络连接失败，请检查网络')
    } else {
      message.error(error.message || '请求失败')
    }

    return Promise.reject(error)
  }
)

export default request
