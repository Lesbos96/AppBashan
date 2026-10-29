import { expect, test, type Page } from '@playwright/test'

// Wächst mit jedem Screen ab S3. `onboarded: false` startet wie beim ersten Besuch.
const routes: { name: string; path: string; onboarded?: false; fit?: false; ready?: (page: Page) => Promise<unknown>; steps?: (page: Page) => Promise<unknown> }[] = [
  { name: 'start', path: '/' },
  { name: 'willkommen-1', path: '/willkommen', onboarded: false },
  {
    name: 'willkommen-2',
    path: '/willkommen',
    onboarded: false,
    steps: async (page) => {
      await page.getByRole('button', { name: 'Weiter' }).click()
      await expect(page.getByRole('heading', { name: 'Dein Richtpreis. Sofort.' })).toBeVisible()
    },
  },
  {
    name: 'willkommen-3',
    path: '/willkommen',
    onboarded: false,
    steps: async (page) => {
      await page.getByRole('button', { name: 'Weiter' }).click()
      await page.getByRole('button', { name: 'Weiter' }).click()
      await expect(page.getByRole('heading', { name: 'Ein Partner bestätigt.' })).toBeVisible()
    },
  },
  { name: 'auftraege', path: '/auftraege' },
  { name: 'profil', path: '/profil' },
  { name: 'preise', path: '/profil/preise', fit: false, ready: (page) => expect(page.getByText('Montage & Demontage')).toBeVisible() },
  { name: 'datenschutz', path: '/profil/datenschutz' },
  { name: 'impressum', path: '/profil/impressum' },
  { name: 'miete', path: '/miete' },
  { name: 'fehler', path: '/gibt-es-nicht' },
  { name: 'fundament', path: '/dev/fundament', fit: false },
]

for (const { name, path, onboarded, fit, ready, steps } of routes) {
  test(name, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    if (onboarded !== false) await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    await page.goto(path, { waitUntil: 'networkidle' })
    await ready?.(page)
    await steps?.(page)
    await page.waitForTimeout(700)
    // Fixierte Leisten sitzen sonst mitten im Full-Page-Bild: Fenster auf Seitenhöhe bringen, dann liegen sie unten.
    if (fit !== false) {
      const height = await page.evaluate<number>('document.documentElement.scrollHeight')
      await page.setViewportSize({ width: page.viewportSize()!.width, height })
      await page.waitForTimeout(300)
    }
    await page.screenshot({ path: `tmp/shots/${testInfo.project.name}/${name}.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}
