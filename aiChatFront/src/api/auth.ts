/**
 * 认证相关 API
 */
import request, { type ResponseData } from '@/utils/request'
import type {
  CaptchaResponse,
  LoginParams,
  LoginResponse,
  RegisterParams,
  SendSmsParams,
  SendEmailParams,
  ResetPasswordParams,
} from '@/interface/auth'

export type {
  CaptchaResponse,
  LoginParams,
  LoginResponse,
  RegisterParams,
  SendSmsParams,
  SendEmailParams,
  ResetPasswordParams,
} from '@/interface/auth'

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
 * 发送邮件验证码
 */
export function sendEmailCode(data: SendEmailParams) {
  return request.post<never, ResponseData<{ message: string; code?: string }>>('/auth/email/send', data)
}

/**
 * 重置密码
 */
export function resetPassword(data: ResetPasswordParams) {
  return request.post<never, ResponseData<{ message: string }>>('/auth/reset-password', data)
}
