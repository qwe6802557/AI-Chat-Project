<template>
  <div class="mock-auth-container">
    <div class="mock-auth-card">
      <div class="header">
        <div class="qq-logo">
          <svg viewBox="0 0 1024 1024" width="36" height="36">
            <path
              fill="#12B7F5"
              d="M824.8 613.7c-7.2-55.5-34.7-98.2-61-160-14-33-31-65-38-100-11.4-57.1-8-121.2-34-173.5C642.5 86.4 564.1 48 480 48s-162.5 38.4-211.8 132.2c-26 52.3-22.6 116.4-34 173.5-7 35-24 67-38 100-26.3 61.8-53.8 104.5-61 160-8.2 63.3 15.3 118.4 52.4 156.4 16.9 17.3 37.8 29.5 60.4 35.9-2 20.3-4.7 41.6-7.3 64.2-4.4 37.8-8.8 77.2-4.1 113.8 5.5 43.1 31.9 44 65.4 44 49.6 0 104.3-25.1 146-52 24.3-15.7 45.4-33.1 63-49.8 17.6 16.7 38.7 34.1 63 49.8 41.7 26.9 96.4 52 146 52 33.5 0 59.9-0.9 65.4-44 4.7-36.6 0.3-76-4.1-113.8-2.6-22.6-5.3-43.9-7.3-64.2 22.6-6.4 43.5-18.6 60.4-35.9 37.1-38 60.6-93.1 52.4-156.4z"
            />
          </svg>
        </div>
        <div class="header-text">
          <h2>QQ 互联快捷登录</h2>
          <span class="sub">开发者沙盒测试环境</span>
        </div>
      </div>

      <div class="app-profile">
        <div class="avatar-box">
          <img src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" alt="QQ Avatar" />
        </div>
        <div class="user-meta">
          <div class="nickname">QQ体验用户 (沙盒)</div>
          <div class="app-name">正在申请授权登录：<strong>AI-Chat 智能平台</strong></div>
        </div>
      </div>

      <div class="scope-box">
        <div class="scope-title">该网站将获得以下权限：</div>
        <label class="scope-item">
          <input type="checkbox" checked disabled />
          <span>访问您的昵称、头像、性别等公开信息</span>
        </label>
      </div>

      <div class="sandbox-hint">
        💡 提示：当前网站处于无域名/沙盒联调模式。点击下方「同意并授权」即可自动模拟完整的 QQ 官方授权闭环，进入系统并获赠 2000 积分！
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click="handleAuthorize">
          同意并授权
        </button>
        <button class="btn btn-default" @click="handleCancel">
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

defineOptions({
  name: 'MockAuthorizePage'
})

const route = useRoute()
const router = useRouter()

const handleAuthorize = () => {
  const state = (route.query.state as string) || 'mock_state'
  const platform = (route.query.platform as string) || 'qq'
  const randomSuffix = Math.random().toString(36).slice(2, 8)
  const mockCode = `mock_code_${randomSuffix}`

  router.replace({
    path: '/oauth/callback',
    query: {
      platform,
      code: mockCode,
      state,
    }
  })
}

const handleCancel = () => {
  if (window.opener) {
    window.close()
  } else {
    router.replace('/login')
  }
}
</script>

<style scoped>
.mock-auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f6fa;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.mock-auth-card {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  padding: 30px;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.header-text h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2329;
  margin: 0;
}

.header-text .sub {
  font-size: 12px;
  color: #8f959e;
}

.app-profile {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 24px 0 20px 0;
  padding: 14px 16px;
  background: #f7f8fa;
  border-radius: 8px;
}

.avatar-box img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.user-meta .nickname {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}

.user-meta .app-name {
  font-size: 12px;
  color: #646a73;
  margin-top: 4px;
}

.scope-box {
  margin-bottom: 20px;
}

.scope-title {
  font-size: 13px;
  color: #646a73;
  margin-bottom: 10px;
}

.scope-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #1f2329;
  cursor: pointer;
}

.sandbox-hint {
  font-size: 12px;
  line-height: 1.6;
  color: #0275d8;
  background: #e8f4fd;
  border: 1px solid #c2e0fc;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 24px;
}

.actions {
  display: flex;
  gap: 12px;
}

.btn {
  flex: 1;
  height: 40px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #12b7f5;
  color: #ffffff;
}

.btn-primary:hover {
  background: #0ea1d8;
}

.btn-default {
  background: #f2f3f5;
  color: #4e5969;
}

.btn-default:hover {
  background: #e5e6eb;
}
</style>
