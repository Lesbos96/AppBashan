import { defineConfig, devices } from '@playwright/test'

const sizes = [
  [390, 844],
  [430, 932],
  [768, 1024],
  [1280, 800],
] as const
const schemes = ['light', 'dark'] as const

export default defineConfig({
  testDir: 'tests',
  outputDir: 'tmp/playwright',
  // ponytail: 2 Worker, weil acht parallele Chromium-Starts hier das 30-s-Setup reißen; in CI anheben
  workers: 2,
  // Der Umzug-Test klickt über 30 Mal und braucht 17–29 s; 30 s Standard lassen unter Last keinen Puffer
  timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: 'tmp/reports/playwright.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4180',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Anfragen eines Service Workers sähe die Mock-Schicht (tests/e2e/backend.ts) nicht; die App registriert heute keinen
    serviceWorkers: 'block',
    // Nur wenn gesetzt: ein vorinstalliertes Chromium statt des von Playwright verwalteten (z. B. Cloud-Container mit anderer Browserversion).
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  webServer: {
    // Fertiger Build statt Dev-Server: Der Dev-Server liefert jede Seite als rund 150 Einzelmodule, und unter Windows scheiterte im
    // Volllauf gelegentlich eines davon (net::ERR_NO_BUFFER_SPACE); dann startete die App nie (S9i3-7). Der Build braucht wenige Chunks.
    // NODE_ENV=development behält den Entwicklungsstand der App (React-Warnungen, /dev/fundament), nur gebündelt.
    // Eigener Port und keine Wiederverwendung: ein laufender `npm run dev` (5173) oder `vite preview` (4173) wird nie mitgetestet.
    command: 'npx vite build --outDir tmp/e2e-dist --logLevel warn && npx vite preview --host 127.0.0.1 --port 4180 --strictPort --outDir tmp/e2e-dist',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: false,
    timeout: 180_000,
    // Tests laufen nur gegen die Mock-Schicht (tests/e2e/backend.ts): Platzhalter statt echter Werte, `.invalid` löst nie auf.
    // Umgebungsvariablen gehen in Vite vor `.env*`-Dateien und werden beim Build eingesetzt.
    env: { NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_platzhalter' },
  },
  projects: [
    // Handy (Breite der Referenz) und Desktop; Screenshot und Trace nur bei Fehlschlag (oben), Ablage unter tmp/playwright/
    {
      name: 'e2e',
      testMatch: 'e2e/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    },
    {
      name: 'e2e-desktop',
      testMatch: 'e2e/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
    },
    ...sizes.flatMap(([width, height]) =>
      schemes.map((colorScheme) => ({
        name: `shots-${width}-${colorScheme}`,
        testMatch: 'shots/**/*.spec.ts',
        use: { ...devices['Desktop Chrome'], viewport: { width, height }, deviceScaleFactor: 2, colorScheme },
      })),
    ),
  ],
})
