import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // `t` is the i18n translate function from useLanguage(). A callback that
    // names its parameter `t` shadows it, so every t('...') inside that callback
    // calls the loop item instead — a hard crash that white-screens the app
    // (TabsEditorControl did exactly this and took the editor down whenever a
    // tabs component was selected). Ban the name in the UI tree, where t() is
    // always in scope.
    files: ['src/components/**/*.{js,jsx}', 'src/pages/**/*.{js,jsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: ':function > Identifier.params[name="t"]',
          message: "Don't name a parameter `t` here — it shadows the i18n translate function. Use a descriptive name.",
        },
      ],
    },
  },
])
