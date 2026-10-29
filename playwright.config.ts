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
  reporter: [['list'], ['json', { outputFile: 'tmp/reports/playwright.json' }]],
  use: { baseURL: 'http://localhost:5173' },
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
