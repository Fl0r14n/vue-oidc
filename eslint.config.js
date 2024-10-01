import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import skipFormattingConfig from '@vue/eslint-config-prettier/skip-formatting'


export default [
  {files: ['**/*.{js,mjs,cjs,ts,vue}']},
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  skipFormattingConfig,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    ignores: ['public/', 'dist/', 'lib/dist'],
  },
  {
    rules: {
      semi: ['error', 'never'],
      '@typescript-eslint/no-explicit-any': 'off',
      // '@typescript-eslint/no-unused-expressions': 'off',
      // '@typescript-eslint/no-unused-vars': 'off'
    }
  }
]