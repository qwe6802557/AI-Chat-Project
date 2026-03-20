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
 * 登录用户信息
 */
export interface LoginUserInfo {
  id: string
  username: string
  phone: string
  email?: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 登录响应数据
 */
export interface LoginResponse {
  token: string
  user: LoginUserInfo
}

/**
 * 注册请求参数
 */
export interface RegisterParams {
  username: string
  password: string
  email: string
  emailCode: string
  phone?: string
}

/**
 * 发送短信验证码参数
 */
export interface SendSmsParams {
  phone: string
}

/**
 * 发送邮件验证码参数
 */
export interface SendEmailParams {
  email: string
}

/**
 * 重置密码请求参数
 */
export interface ResetPasswordParams {
  email: string
  emailCode: string
  newPassword: string
}
