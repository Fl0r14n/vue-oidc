import pluginVitest from '@vitest/eslint-plugin'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import { globalIgnores } from 'eslint/config'

export default defineConfigWithVueTs(
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/public/**']),
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*']
  },
  skipFormatting,
  {
    rules: {
      semi: ['error', 'never'],
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
