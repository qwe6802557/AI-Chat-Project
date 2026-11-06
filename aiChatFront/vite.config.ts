import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Web 模式配置（默认）
// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    vue(),
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
    proxy: {
      '/images/media': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // 构建配置
  build: {
    target: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.ts'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 30000,
  },
}))
