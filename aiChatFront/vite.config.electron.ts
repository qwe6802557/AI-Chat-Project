import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import electron from 'vite-plugin-electron/simple'

// Electron 模式配置
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    electron({
      main: {
        // 主进程入口文件
        entry: 'electron/main.ts',
      },
      preload: {
        // 预加载脚本
        input: 'electron/preload.ts',
      },
      // 渲染进程使用 Node.js API
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // 开发服务器配置
  server: {
    port: 5173,
    strictPort: false,
  },
  // 构建配置
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

