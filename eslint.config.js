import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'tmp', 'docs', 'supabase/.temp']),
  {
    // Übrige Edge Functions sind Deno-Code und laufen nicht über diese Konfiguration.
    files: ['src/**/*.{ts,tsx}', 'supabase/functions/_shared/pricing/**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['tests/**/*.ts', '*.config.{ts,js}', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
])
