import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  // Nur Variablen mit diesem Präfix landen im Client-Bundle (URL und Publishable Key, nie der Secret-Key).
  envPrefix: 'NEXT_PUBLIC_',
  // Testläufe schreiben Berichte und Screenshots nach tmp/; das darf den Dev-Server nicht neu laden.
  server: { watch: { ignored: ['**/tmp/**', '**/docs/**'] } },
  resolve: {
    alias: {
      '@pricing': fileURLToPath(new URL('./supabase/functions/_shared/pricing', import.meta.url)),
      '@commission': fileURLToPath(new URL('./supabase/functions/_shared/commission/csv.ts', import.meta.url)),
      // Die Functions importieren mit npm:-Spezifizierer (Deno); in Vitest löst das Paket aus node_modules auf.
      'npm:imagescript@3.17.0': 'imagescript',
    },
  },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      {
        // Gegen das Dev-Projekt: sequenziell und gepaced wegen der Auth-Rate-Limits.
        test: {
          name: 'rls',
          include: ['tests/rls/**/*.test.ts'],
          globalSetup: ['tests/support/dev-guard-setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          // Das Aufräumen der Wettlauftests (`sweepTestResidue`, ein CLI-Aufruf) ist schnell; die Reserve bleibt für langsame Management-API.
          hookTimeout: 480_000,
        },
      },
    ],
  },
})
