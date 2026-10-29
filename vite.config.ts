import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Nur Variablen mit diesem Präfix landen im Client-Bundle (URL und Publishable Key, nie der Secret-Key).
  envPrefix: 'NEXT_PUBLIC_',
  resolve: {
    alias: { '@pricing': fileURLToPath(new URL('./supabase/functions/_shared/pricing', import.meta.url)) },
  },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      {
        // Gegen das Dev-Projekt: sequenziell und gepaced wegen der Auth-Rate-Limits.
        test: {
          name: 'rls',
          include: ['tests/rls/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
})
