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
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Anfragen eines Service Workers sähe die Mock-Schicht (tests/e2e/backend.ts) nicht; die App registriert heute keinen
    serviceWorkers: 'block',
    // Nur wenn gesetzt: ein vorinstalliertes Chromium statt des von Playwright verwalteten (z. B. Cloud-Container mit anderer Browserversion).
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    // Tests laufen nur gegen die Mock-Schicht (tests/e2e/backend.ts): Platzhalter statt echter Werte, `.invalid` löst nie auf.
    // Umgebungsvariablen gehen in Vite vor `.env.local`; ein wiederverwendeter Dev-Server behält seine Werte, die Mock-Schicht fängt trotzdem alles ab.
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_platzhalter' },
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
