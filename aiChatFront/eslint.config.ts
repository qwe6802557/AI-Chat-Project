import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/dist-electron/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  // Electron 文件特殊配置
  {
    name: 'app/electron-files',
    files: ['electron/**/*.ts'],
    rules: {
      // Electron 文件中允许使用 import.meta
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
)
