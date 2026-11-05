import { expect, test, type Page } from '@playwright/test'

// Barrierefreiheit (WCAG 2.2 AA): Prüfungen, die das Prüfskript der Nacht vom 2026-11-05 als Funde gemeldet hat (docs/nacht/qualitaet.md).

/** Kontrast zweier `rgb(…)`-Farben nach WCAG. */
function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const [r, g, bl] = c.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

/** Tab bis zum Element mit diesem Namen (höchstens 40 Schritte) und Rahmen des fokussierten Elements. */
async function tabTo(page: Page, name: RegExp) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return el ? (el.getAttribute('aria-label') ?? el.innerText ?? '').trim() : ''
    })
    if (name.test(label)) break
  }
  return page.evaluate(() => {
    const el = document.activeElement!
    const cs = getComputedStyle(el)
    return { label: (el as HTMLElement).innerText, color: cs.outlineColor, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), offset: parseFloat(cs.outlineOffset), background: getComputedStyle(document.body).backgroundColor }
  })
}

test.describe('Fokusrahmen (1.4.11, 2.4.7)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`Rahmen in voller Akzentfarbe, mindestens 3:1 zum Hintergrund (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/profil')
      const ring = await tabTo(page, /Mit E-Mail-Link anmelden/)
      expect(ring.style).toBe('solid')
      expect(ring.width).toBeGreaterThanOrEqual(2)
      expect(contrast(ring.color, ring.background)).toBeGreaterThanOrEqual(3)
    })
  }

  test('Zeilen in Listen mit overflow-hidden: Rahmen liegt innen und wird nicht abgeschnitten', async ({ page }) => {
    await page.goto('/profil')
    const ring = await tabTo(page, /^Datenschutz$/)
    expect(ring.style).toBe('solid')
    expect(ring.offset).toBeLessThan(0)
  })

  test('Onboarding: „Überspringen" auf dunklem Grund mit hellem Rahmen', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('movenow.onboarded'))
    await page.goto('/willkommen')
    const ring = await tabTo(page, /Überspringen/)
    const head = await page.evaluate(() => getComputedStyle(document.querySelector('main > div')!).backgroundColor)
    expect(contrast(ring.color, head)).toBeGreaterThanOrEqual(3)
  })
})
