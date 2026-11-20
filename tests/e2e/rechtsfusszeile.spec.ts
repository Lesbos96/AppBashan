import type { Page } from '@playwright/test'
import { expect, test } from './backend'
import { mockRoute } from './konfigurator-helpers'

/*
 * ui3: Rechtsfußzeile (Impressum · AGB · Datenschutz) in den Buchungsflows. Sie steht am Ende der Seite und liegt nicht unter der
 * fixierten Aktionsleiste; jeder Link ist antippbar (Treffertest an der Mitte). Zeilen mit Stepper brechen bei 320 px um, statt Label und Wert zu überlagern.
 */

const flows = [
  { path: '/transport', ready: 'Was muss mit?' },
  { path: '/umzug', ready: 'Was muss mit?' },
  { path: '/montage', ready: undefined },
  { path: '/entruempelung', ready: 'Was soll geräumt werden?' },
] as const

async function open(page: Page, path: string, ready?: string) {
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await mockRoute(page)
  await page.goto(path)
  if (ready) await expect(page.getByRole('heading', { name: ready })).toBeVisible()
}

for (const { path, ready } of flows) {
  test(`${path}: Rechtsfußzeile am Seitenende, nicht von der Aktionsleiste verdeckt`, { tag: '@breit' }, async ({ page }) => {
    await open(page, path, ready)
    const nav = page.getByRole('navigation', { name: 'Rechtliches' })
    await expect(nav).toBeAttached()
    await nav.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    for (const name of ['Impressum', 'AGB', 'Datenschutz']) {
      const link = nav.getByRole('link', { name })
      await expect(link).toBeVisible()
      const box = (await link.boundingBox())!
      expect(box.height, `${name}: Ziel mindestens 44 px`).toBeGreaterThanOrEqual(44)
      const hit = await link.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return top !== null && el.contains(top)
      })
      expect(hit, `${name} liegt frei, nicht unter einer fixierten Leiste`).toBe(true)
    }
  })
}

test('320 px: Zeilen mit Stepper überlagern sich nicht und die Seite scrollt nicht seitlich', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await open(page, '/umzug', 'Was muss mit?')
  const overlaps = await page.evaluate(() => {
    const hits: string[] = []
    for (const out of document.querySelectorAll('main li output')) {
      const row = out.closest('li')!
      const a = out.getBoundingClientRect()
      for (const part of row.querySelectorAll(':scope > span')) {
        // Rechtecke des Textes selbst: ein auf Breite 0 gequetschtes Label läuft sichtbar über
        const range = document.createRange()
        range.selectNodeContents(part)
        for (const b of range.getClientRects()) {
          if (b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) hits.push(`${part.textContent} / ${out.textContent}`)
        }
      }
    }
    return hits
  })
  expect(overlaps).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
