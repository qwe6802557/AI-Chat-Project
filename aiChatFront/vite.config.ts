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
    target: false as const,
    minify: 'terser' as const,
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@vue-flow')) return 'vue-flow-vendor'
          if (id.includes('@ant-design/icons-vue')) return 'ant-icons-vendor'
          if (id.includes('ant-design-vue')) return 'antdv-vendor'
          if (id.includes('highlight.js')) return 'hljs-vendor'
          if (id.includes('marked') || id.includes('dompurify')) return 'markdown-vendor'
          if (
            id.includes('node_modules/vue/') ||
            id.includes('node_modules/@vue/') ||
            id.includes('node_modules/pinia/') ||
            id.includes('node_modules/vue-router/')
          ) {
            return 'vue-vendor'
          }
          return undefined
        },
      },
    },
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
