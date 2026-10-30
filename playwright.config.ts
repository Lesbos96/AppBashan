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
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'e2e',
      testMatch: 'e2e/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
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
