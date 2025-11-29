<template>
  <div class="forgot-password-container">
    <!-- 左侧背景 -->
    <div class="left-section">
      <div class="background-overlay"></div>

      <!-- Logo -->
      <div class="logo-social-wrapper">
        <div class="logo-section">
          <div class="logo-icon"></div>
          <span class="logo-text">ERJ CHAT</span>
        </div>

        <div class="social-login">
          <div class="social-icon">
            <FacebookOutlined />
          </div>
          <div class="social-icon">
            <InstagramOutlined />
          </div>
          <div class="social-icon">
            <TwitterOutlined />
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧表单 -->
    <div class="right-section">
      <div class="form-wrapper">
        <!-- 标题 -->
        <div class="header-text">
          <h1 class="title">忘记密码</h1>
          <p class="subtitle">请输入您的邮箱地址，通过发送验证码来重置您的密码</p>
        </div>

        <!-- 忘记密码 -->
        <a-form
          :model="formState"
          :rules="rules"
          @finish="handleResetPassword"
          layout="vertical"
          class="forgot-password-form"
          autocomplete="off"
        >
          <!-- 邮箱输入框 -->
          <a-form-item name="email" class="form-item">
            <div class="input-wrapper email-input">
              <MailOutlined class="input-icon" />
              <div v-if="formState.email" class="email-label">邮箱地址</div>
              <a-input
                v-model:value="formState.email"
                placeholder="邮箱地址"
                size="large"
                :class="['custom-input', formState.email ? 'email-filled' : '']"
                autocomplete="off"
                @input="handleEmailInput"
              />
            </div>
          </a-form-item>

          <!-- 验证码输入框 -->
          <a-form-item name="verifyCode" class="form-item">
            <div class="input-wrapper verify-code-wrapper">
              <SafetyOutlined class="input-icon" />
              <a-input
                v-model:value="formState.verifyCode"
                placeholder="验证码"
                size="large"
                class="custom-input verify-code-input"
                autocomplete="off"
                maxlength="6"
              />
              <a-button
                :disabled="!canSendCode || countdown > 0"
                :loading="sendingCode"
                @click="handleSendCode"
                class="send-code-button"
              >
                {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
              </a-button>
            </div>
          </a-form-item>

          <!-- 新密码输入框 -->
          <a-form-item name="newPassword" class="form-item">
            <div class="input-wrapper">
              <LockOutlined class="input-icon" />
              <a-input-password
                v-model:value="formState.newPassword"
                placeholder="新密码"
                size="large"
                class="custom-input"
                autocomplete="new-password"
              />
            </div>
          </a-form-item>

          <!-- 确认密码输入框 -->
          <a-form-item name="confirmPassword" class="form-item">
            <div class="input-wrapper">
              <LockOutlined class="input-icon" />
              <a-input-password
                v-model:value="formState.confirmPassword"
                placeholder="确认新密码"
                size="large"
                class="custom-input"
                autocomplete="new-password"
              />
            </div>
          </a-form-item>

          <!-- 重置密码按钮 -->
          <a-form-item class="form-item">
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              :loading="loading"
              class="reset-button"
            >
              重置密码
              <RightOutlined />
            </a-button>
          </a-form-item>
        </a-form>

        <!-- 底部返回登录 -->
        <div class="footer-text">
          <span class="footer-label">已经想起密码？</span>
          <a class="footer-link" @click="handleGoToLogin">返回登录</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  FacebookOutlined,
  InstagramOutlined,
  TwitterOutlined,
  MailOutlined,
  LockOutlined,
  SafetyOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import { sendEmailCode, resetPassword } from '@/api/auth'

// 定义组件名称
defineOptions({
  name: 'ForgotPasswordPage'
})

const router = useRouter()
const loading = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const canSendCode = ref(false)

// 表单数据
const formState = reactive({
  email: '',
  verifyCode: '',
  newPassword: '',
  confirmPassword: '',
})

// 表单验证规则
const rules = {
  email: [
    { required: true, message: '请输入您的邮箱!', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确!', trigger: 'blur' },
  ],
  verifyCode: [
    { required: true, message: '请输入验证码!', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为6位数字!', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码!', trigger: 'blur' },
    { min: 6, message: '密码不能少于6位!', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码!', trigger: 'blur' },
    {
      validator: (_rule: never, value: string) => {
        if (value !== formState.newPassword) {
          return Promise.reject('两次输入的密码不一致!')
        }
        return Promise.resolve()
      },
      trigger: 'blur',
    },
  ],
}

// 验证邮箱格式
const handleEmailInput = () => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  canSendCode.value = emailPattern.test(formState.email)
}

// 发送验证码
const handleSendCode = async () => {
  if (!canSendCode.value || countdown.value > 0) return

  sendingCode.value = true
  try {
    // 发送验证码
    const res = await sendEmailCode({ email: formState.email })

    message.success('验证码已发送到您的邮箱!')

    // 开发环境下显示验证码
    if (import.meta.env.DEV && res.data?.code) {
      message.info(`开发模式 - 验证码: ${res.data.code}`, 5)
      console.log('验证码:', res.data.code)
    }

    // 倒计时
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (err: unknown) {
    console.log('发送验证码失败:', err)
  } finally {
    sendingCode.value = false
  }
}

// 重置密码
const handleResetPassword = async () => {
  loading.value = true
  try {
    await resetPassword({
      email: formState.email,
      emailCode: formState.verifyCode,
      newPassword: formState.newPassword,
    })

    message.success('密码重置成功! 请重新登录')

    // 跳转登录
    setTimeout(() => {
      router.push({ name: 'login' })
    }, 1000)
  } catch (err: unknown) {
    console.log('重置密码失败:', err)
  } finally {
    loading.value = false
  }
}

// 返回登录
const handleGoToLogin = () => {
  router.push('/login')
}
</script>

<style scoped lang="scss">
.forgot-password-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* 左侧背景 */
.left-section {
  position: relative;
  width: 655px;
  height: 100%;
  background: linear-gradient(180deg, rgba(49, 49, 49, 0.3) 0%, rgba(0, 0, 0, 0.55) 100%),
    url('https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80');
  background-size: cover;
  background-position: center;

  .background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, rgba(49, 49, 49, 0.3) 0%, rgba(0, 0, 0, 0.55) 100%);
  }

  .logo-social-wrapper {
    position: absolute;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 364px;
    z-index: 10;

    .logo-section {
      display: flex;
      align-items: center;
      gap: 17px;

      .logo-icon {
        width: 42px;
        height: 41px;
        background: #d8d8d8;
        border: 4.56px solid #ffffff;
        border-radius: 50%;
      }

      .logo-text {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        font-size: 38px;
        line-height: 46px;
        letter-spacing: 0.01em;
        color: #ffffff;
        text-shadow:
          0 2px 10px rgba(0, 0, 0, 0.3),
          0 0 20px rgba(21, 112, 239, 0.4),
          0 0 30px rgba(83, 177, 253, 0.3);
        background: linear-gradient(135deg, #ffffff 0%, #53B1FD 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
      }
    }

    .social-login {
      display: flex;
      gap: 12px;

      .social-icon {
        width: 34px;
        height: 34px;
        background: #ffffff;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: #858888;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
      }
    }
  }
}

/* 右侧表单 */
.right-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  padding: 40px;

  .form-wrapper {
    width: 100%;
    max-width: 458px;
    display: flex;
    flex-direction: column;
    gap: 38px;

    .header-text {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .title {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        font-size: 32px;
        line-height: 44px;
        color: #101828;
        margin: 0;
      }

      .subtitle {
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: #667085;
        margin: 0;
      }
    }

    .forgot-password-form {
      display: flex;
      flex-direction: column;
      gap: 26px;

      .form-item {
        margin-bottom: 0;
      }

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;

        .input-icon {
          position: absolute;
          left: 20px;
          font-size: 20px;
          color: #98a2b3;
          z-index: 10;
          pointer-events: none;
          transition: color 0.3s ease;
        }

        :deep(.custom-input) {
          height: 64px;
          background: #f2f4f7;
          border: none;
          border-radius: 10px;
          padding-left: 61px;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 16px;
          color: #101828;

          &::placeholder {
            color: #98a2b3;
          }

          &:focus,
          &:hover {
            background: #f2f4f7;
            border-color: #53b1fd;
            box-shadow: none;
          }
        }

        &.email-input {
          .email-label {
            position: absolute;
            top: -7px;
            left: 23px;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            font-size: 12px;
            line-height: 16px;
            color: #3c4071;
            background: #ffffff;
            padding: 0 4px;
            z-index: 2;
          }

          :deep(.email-filled) {
            border: 3px solid #53b1fd;
            background: #ffffff;
            color: #101828;
            font-size: 18px;
            padding-left: 65px;
          }
        }

        // 验证码输入框样式
        &.verify-code-wrapper {
          position: relative;

          :deep(.verify-code-input) {
            padding-right: 140px;
          }

          .send-code-button {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            height: 48px;
            padding: 0 20px;
            background: #1570ef;
            border: none;
            border-radius: 6px;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            font-size: 14px;
            color: #ffffff;
            cursor: pointer;
            transition: all 0.3s ease;
            z-index: 10;

            &:hover:not(:disabled) {
              background: #0f5fd1;
              transform: translateY(-50%) scale(1.02);
            }

            &:active:not(:disabled) {
              transform: translateY(-50%) scale(0.98);
            }

            &:disabled {
              background: #98a2b3;
              cursor: not-allowed;
              opacity: 0.6;
            }

            &:deep(.ant-btn-loading-icon) {
              margin-right: 8px;
            }
          }
        }

        :deep(.ant-input-password) {
          height: 64px;
          background: #f2f4f7;
          border: none;
          border-radius: 10px;
          padding-left: 61px;

          .ant-input {
            background: transparent;
            border: none;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            font-size: 16px;
            color: #101828;

            &::placeholder {
              color: #98a2b3;
            }
          }

          &:focus,
          &:hover {
            background: #f2f4f7;
            border-color: #53b1fd;
          }
        }

        &:hover .input-icon,
        &:focus-within .input-icon {
          color: #53b1fd;
        }
      }

      .reset-button {
        width: 100%;
        height: 56px;
        background: #1570ef;
        border: none;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: 18px;
        line-height: 28px;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
        transition: all 0.3s;

        &:hover {
          background: #1366d9;
          transform: translateY(-2px);
          box-shadow: 0px 4px 8px 0px rgba(16, 24, 40, 0.1);
        }

        &:active {
          transform: translateY(0);
        }
      }
    }

    .footer-text {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 34px;
      border-top: 1px solid #d0d5dd;

      .footer-label {
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: 16px;
        color: #475467;
      }

      .footer-link {
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: 16px;
        color: #2e90fa;
        cursor: pointer;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
          background: #ffffff;
        }
      }
    }
  }
}

/* 响应式 */
@media (max-width: 1200px) {
  .left-section {
    width: 400px;
  }
}

@media (max-width: 768px) {
  .forgot-password-container {
    flex-direction: column;
  }

  .left-section {
    width: 100%;
    height: 200px;

    .logo-social-wrapper {
      gap: 40px;
      bottom: 20px;
    }
  }

  .right-section {
    padding: 20px;

    .form-wrapper {
      max-width: 100%;
    }
  }
}
</style>
