<template>
  <div class="oauth-callback-container">
    <div class="callback-card">
      <div v-if="loading" class="status-box">
        <div class="spinner"></div>
        <h3>正在完成第三方账号授权...</h3>
        <p>安全交换登录凭据中，请稍候</p>
      </div>

      <div v-else-if="success" class="status-box success">
        <div class="status-icon">✓</div>
        <h3>授权成功！</h3>
        <p>正在自动同步登录状态，窗口即将关闭...</p>
      </div>

      <div v-else class="status-box error">
        <div class="status-icon">✕</div>
        <h3>授权登录失败</h3>
        <p class="error-detail">{{ errorMessage }}</p>
        <button class="retry-btn" @click="handleClose">关闭窗口</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { handleOAuthCallback } from '@/api/oauth'
import { useAuthStore } from '@/stores'

defineOptions({
  name: 'OAuthCallbackPage'
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const success = ref(false)
const errorMessage = ref('')

const handleClose = () => {
  if (window.opener) {
    window.close()
  } else {
    router.replace('/login')
  }
}

onMounted(async () => {
  const code = route.query.code as string
  const state = (route.query.state as string) || ''
  const platform = (route.query.platform as string) || 'qq'

  if (!code) {
    loading.value = false
    errorMessage.value = '未检测到授权临时凭证 Code，授权已取消或已失效'
    return
  }

  try {
    const res = await handleOAuthCallback({
      platform,
      code,
      state,
    })

    success.value = true
    loading.value = false

    // 若存在父窗口，跨窗口通知
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: 'OAUTH_LOGIN_SUCCESS',
          session: res.data,
        },
        window.location.origin
      )
      setTimeout(() => {
        window.close()
      }, 500)
    } else {
      // 若是单页面直跳模式
      authStore.setAuthSession(res.data)
      setTimeout(() => {
        router.replace('/chat')
      }, 500)
    }
  } catch (error: any) {
    loading.value = false
    success.value = false
    errorMessage.value =
      error?.response?.data?.message || error?.message || '第三方授权校验失败，请重试'

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: 'OAUTH_LOGIN_ERROR',
          message: errorMessage.value,
        },
        window.location.origin
      )
    }
  }
})
</script>

<style scoped>
.oauth-callback-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f6fa;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.callback-card {
  width: 100%;
  max-width: 400px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  padding: 40px 30px;
  text-align: center;
}

.status-box h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2329;
  margin: 16px 0 8px 0;
}

.status-box p {
  font-size: 13px;
  color: #8f959e;
  margin: 0;
}

.spinner {
  width: 44px;
  height: 44px;
  margin: 0 auto;
  border: 3px solid #e5e6eb;
  border-top-color: #12b7f5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
}

.status-box.success .status-icon {
  background: #e8ffea;
  color: #00b42a;
}

.status-box.error .status-icon {
  background: #ffece8;
  color: #f53f3f;
}

.error-detail {
  color: #f53f3f !important;
  margin: 12px 0 20px 0 !important;
}

.retry-btn {
  height: 36px;
  padding: 0 24px;
  border-radius: 6px;
  font-size: 13px;
  background: #f2f3f5;
  color: #4e5969;
  border: none;
  cursor: pointer;
  margin-top: 16px;
}

.retry-btn:hover {
  background: #e5e6eb;
}
</style>
