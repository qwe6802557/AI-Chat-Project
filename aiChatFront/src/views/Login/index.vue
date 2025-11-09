<template>
  <div class="login-container">
    <!-- 左侧背景 -->
    <div class="left-section">
      <div class="background-overlay"></div>

      <!-- Logo -->
      <div class="logo-social-wrapper">
        <div class="logo-section">
          <div class="logo-icon"></div>
          <span class="logo-text">AI CHAT</span>
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

    <!-- 右侧表单区域 -->
    <div class="right-section">
      <div class="form-wrapper">
        <!-- 标题 -->
        <div class="header-text">
          <h1 class="title">登录</h1>
          <p class="subtitle">欢迎! 请登录您的账号</p>
        </div>

        <!-- 登录表单 -->
        <a-form
          :model="formState"
          :rules="rules"
          @finish="handleLogin"
          layout="vertical"
          class="login-form"
        >
          <!-- 用户名 -->
          <a-form-item name="username" class="form-item">
            <div class="input-wrapper">
              <UserOutlined class="input-icon" />
              <a-input
                v-model:value="formState.username"
                placeholder="用户名"
                size="large"
                class="custom-input"
              />
            </div>
          </a-form-item>

          <!-- 密码 -->
          <a-form-item name="password" class="form-item">
            <div class="input-wrapper">
              <LockOutlined class="input-icon" />
              <a-input-password
                v-model:value="formState.password"
                placeholder="密码"
                size="large"
                class="custom-input"
              />
            </div>
          </a-form-item>

          <!-- 记住和忘记密码 -->
          <div class="form-options">
            <a-checkbox v-model:checked="formState.remember">记住我</a-checkbox>
            <a class="forgot-password" @click="handleForgotPassword">忘记密码?</a>
          </div>

          <!-- 登录 -->
          <a-form-item class="form-item">
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              :loading="loading"
              class="login-button"
            >
              登录
              <RightOutlined />
            </a-button>
          </a-form-item>
        </a-form>

        <!-- 注册 -->
        <div class="footer-text">
          <span class="footer-label">还没有账号?</span>
          <a class="footer-link" @click="handleGoToRegister">注册账号</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  FacebookOutlined,
  InstagramOutlined,
  TwitterOutlined,
  UserOutlined,
  LockOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'

// 定义组件名称
defineOptions({
  name: 'LoginPage'
})

const router = useRouter()
const loading = ref(false)

// 表单数据
const formState = reactive({
  username: '',
  password: '',
  remember: false,
})

// 初始化
onMounted(() => {
  const usernameFromQuery = router.currentRoute.value.query.username as string
  if (usernameFromQuery) {
    formState.username = usernameFromQuery
  } else {
    const rememberedUsername = localStorage.getItem('rememberedUsername')
    if (rememberedUsername) {
      formState.username = rememberedUsername
      formState.remember = true
    }
  }
})

// 表单验证规则
const rules = {
  username: [
    { required: true, message: '请输入用户名!', trigger: 'blur' },
    { min: 3, message: '用户名不能少于3位!', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码!', trigger: 'blur' },
    { min: 6, message: '密码不能小于6位!', trigger: 'blur' },
  ],
}

// 登录处理
const handleLogin = async () => {
  loading.value = true
  try {
    // 调用后端 API
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 模拟登录
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('username', formState.username)

    // 保存到localStorage
    if (formState.remember) {
      localStorage.setItem('rememberedUsername', formState.username)
    } else {
      localStorage.removeItem('rememberedUsername')
    }

    message.success('登录成功!')

    // 跳转到之前的页面或聊天页
    const redirect = router.currentRoute.value.query.redirect as string
    router.push(redirect || '/chat')
  } catch (err) {
    console.log(err)
    message.error('登录失败!请检查凭证')
  } finally {
    loading.value = false
  }
}

// 忘记密码
const handleForgotPassword = () => {
  message.info('忘记密码开发中!')
}

// 跳转到注册
const handleGoToRegister = () => {
  router.push('/register')
}
</script>

<style scoped lang="scss">
.login-container {
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
        /* 可选：添加渐变效果 */
        background: linear-gradient(135deg, #ffffff 0%, #53B1FD 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        /* 添加描边效果增强可见性 */
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

    .login-form {
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
          pointer-events: none; // 防止图标阻挡输入框点击
          transition: color 0.3s ease; // 添加过渡效果
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

        // 当输入框获得焦点或悬停时，图标颜色变化
        &:hover .input-icon,
        &:focus-within .input-icon {
          color: #53b1fd;
        }
      }

      .form-options {
        display: flex;
        justify-content: space-between;
        align-items: center;

        :deep(.ant-checkbox-wrapper) {
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 16px;
          color: #475467;
        }

        .forgot-password {
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

      .login-button {
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
  .login-container {
    flex-direction: column;
  }

  .left-section {
    width: 100%;
    height: 200px;

    .logo-social-wrapper {
      gap: 40px;
      bottom: 20px;
    }

    .menu-bar {
      top: 20px;
      left: 20px;
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

