/**
 * 认证相关 API
 */
import request, { type ResponseData } from '@/utils/request'

/**
 * 验证码响应接口
 */
export interface CaptchaResponse {
  captchaId: string
  captchaImage: string
}

/**
 * 登录请求参数
 */
export interface LoginParams {
  username: string
  password: string
  captcha: string
  captchaId: string
}

/**
 * 登录响应数据
 */
export interface LoginResponse {
  token: string
  user: {
    id: string
    username: string
    phone: string
    email?: string
    role: string
    isActive: boolean
    createdAt: string
    updatedAt: string
  }
}

/**
 * 注册请求参数
 */
export interface RegisterParams {
  username: string
  password: string
  phone: string
  smsCode: string
  email?: string
}

/**
 * 发送短信验证码参数
 */
export interface SendSmsParams {
  phone: string
}

/**
 * 重置密码请求参数
 */
export interface ResetPasswordParams {
  phone: string
  smsCode: string
  newPassword: string
}

/**
 * 获取图片验证码
 */
export function getCaptcha() {
  return request.get<never, ResponseData<CaptchaResponse>>('/auth/captcha')
}

/**
 * 用户登录
 */
export function login(data: LoginParams) {
  return request.post<never, ResponseData<LoginResponse>>('/auth/login', data)
}

/**
 * 用户注册
 */
export function register(data: RegisterParams) {
  return request.post<never, ResponseData<LoginResponse>>('/auth/register', data)
}

/**
 * 发送短信验证码
 */
export function sendSmsCode(data: SendSmsParams) {
  return request.post<never, ResponseData<{ message: string; code?: string }>>('/auth/sms/send', data)
}

/**
 * 重置密码
 */
export function resetPassword(data: ResetPasswordParams) {
  return request.post<never, ResponseData<{ message: string }>>('/auth/reset-password', data)
}

