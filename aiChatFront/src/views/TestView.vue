<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'

const count = ref(0)

const handleClick = () => {
  count.value++
  message.success(`点击次数: ${count.value}`)
}

// 检测是否在 Electron 环境中
const isElectron = ref(!!window.electronAPI)
const electronInfo = ref({
  platform: '',
  versions: {
    node: '',
    chrome: '',
    electron: '',
  },
})

if (window.electronAPI) {
  electronInfo.value = {
    platform: window.electronAPI.platform,
    versions: window.electronAPI.versions,
  }
}
</script>

<template>
  <div class="test-container">
    <a-card title="ERJ Chat 测试页面" style="max-width: 800px; margin: 40px auto">
      <!-- Electron 环境检测 -->
      <a-alert
        v-if="isElectron"
        message="运行在 Electron 环境"
        type="success"
        show-icon
        style="margin-bottom: 20px"
      />
      <a-alert
        v-else
        message="运行在 Web 浏览器环境"
        type="info"
        show-icon
        style="margin-bottom: 20px"
      />

      <!-- 系统信息 -->
      <a-descriptions
        v-if="isElectron"
        title="系统信息"
        bordered
        :column="1"
        style="margin-bottom: 20px"
      >
        <a-descriptions-item label="平台">{{ electronInfo.platform }}</a-descriptions-item>
        <a-descriptions-item label="Node.js 版本">{{
          electronInfo.versions.node
        }}</a-descriptions-item>
        <a-descriptions-item label="Chrome 版本">{{
          electronInfo.versions.chrome
        }}</a-descriptions-item>
        <a-descriptions-item label="Electron 版本">{{
          electronInfo.versions.electron
        }}</a-descriptions-item>
      </a-descriptions>

      <!-- Ant Design Vue 组件测试 -->
      <a-divider>Ant Design Vue 组件测试</a-divider>

      <a-space direction="vertical" style="width: 100%" :size="16">
        <!-- 按钮测试 -->
        <a-card size="small" title="按钮组件">
          <a-space>
            <a-button type="primary" @click="handleClick">主要按钮</a-button>
            <a-button>默认按钮</a-button>
            <a-button type="dashed">虚线按钮</a-button>
            <a-button type="link">链接按钮</a-button>
            <a-button danger>危险按钮</a-button>
          </a-space>
          <div style="margin-top: 10px">点击次数: {{ count }}</div>
        </a-card>

        <!-- 输入框测试 -->
        <a-card size="small" title="输入框组件">
          <a-input placeholder="请输入内容" style="margin-bottom: 10px" />
          <a-textarea placeholder="多行文本输入" :rows="3" />
        </a-card>

        <!-- 标签测试 -->
        <a-card size="small" title="标签组件">
          <a-space>
            <a-tag color="blue">蓝色标签</a-tag>
            <a-tag color="green">绿色标签</a-tag>
            <a-tag color="red">红色标签</a-tag>
            <a-tag color="orange">橙色标签</a-tag>
          </a-space>
        </a-card>

        <!-- 进度条测试 -->
        <a-card size="small" title="进度条组件">
          <a-progress :percent="30" />
          <a-progress :percent="50" status="active" />
          <a-progress :percent="70" status="exception" />
          <a-progress :percent="100" />
        </a-card>
      </a-space>
    </a-card>
  </div>
</template>

<style scoped>
.test-container {
  padding: 20px;
  min-height: 100vh;
  background: #f0f2f5;
}
</style>

