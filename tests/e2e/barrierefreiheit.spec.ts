import { expect, test, type Page } from '@playwright/test'
import { anonymousPrices, toSummary } from './anfrage-helpers'
import { weiter } from './dienste-helpers'

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

/**
 * Tab (bzw. Umschalt+Tab) durch die Seite: Welche fokussierten Elemente überlappen eine fixierte Leiste (Kopf-, Aktions-, Preis-, Tab-Leiste)?
 * Gemessen per getBoundingClientRect, Leisten sind fixierte Elemente unter halber Fensterhöhe, die das Element nicht enthalten.
 */
async function coveredWhileTabbing(page: Page, key: 'Tab' | 'Shift+Tab', steps: number) {
  const covered = new Set<string>()
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press(key)
    const hit = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const r = el.getBoundingClientRect()
      for (const bar of document.querySelectorAll('body *')) {
        if (getComputedStyle(bar).position !== 'fixed' || bar.contains(el)) continue
        const b = bar.getBoundingClientRect()
        if (b.height === 0 || b.height > innerHeight / 2) continue
        const y = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)
        const x = Math.min(r.right, b.right) - Math.max(r.left, b.left)
        if (y > 1 && x > 1) return `${el.tagName.toLowerCase()} „${((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').slice(0, 40)}"`
      }
      return null
    })
    if (hit) covered.add(hit)
  }
  return [...covered]
}

/** Seitenübergang beendet: genau ein `main`, die Seite ohne Transformation (sonst sind fixierte Leisten an die Seite gebunden). */
async function settled(page: Page) {
  await expect(page.locator('main')).toHaveCount(1)
  await page.waitForFunction(() => getComputedStyle(document.querySelector('main')!.parentElement!).transform === 'none')
}

test.describe('Fokus nicht verdeckt (2.4.11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  })

  test('Umzug-Konfigurator: kein fokussiertes Element unter Kopf- oder Preisleiste', async ({ page }) => {
    await page.goto('/umzug')
    await expect(page.getByRole('heading', { name: 'Was muss mit?' })).toBeVisible()
    await settled(page)
    expect(await coveredWhileTabbing(page, 'Tab', 45)).toEqual([])
    expect(await coveredWhileTabbing(page, 'Shift+Tab', 45)).toEqual([])
  })

  test('Zusammenfassung: Kontaktfelder und Einwilligung nicht unter den Leisten', async ({ page }) => {
    await anonymousPrices(page)
    await toSummary(page)
    await settled(page)
    await page.evaluate(() => {
      ;(document.activeElement as HTMLElement | null)?.blur()
      window.scrollTo(0, 0)
    })
    expect(await coveredWhileTabbing(page, 'Tab', 25)).toEqual([])
    expect(await coveredWhileTabbing(page, 'Shift+Tab', 25)).toEqual([])
  })

  test('Start: Mietkarte nicht unter der Tab-Leiste', async ({ page }) => {
    await page.goto('/')
    await settled(page)
    expect(await coveredWhileTabbing(page, 'Tab', 12)).toEqual([])
  })
})

test.describe('Fokus in Freitextfeldern sichtbar (2.4.7)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  })

  /** Rahmen am umgebenden Label, solange das Textfeld den Fokus hat. */
  const labelRing = (page: Page, name: RegExp) =>
    page.getByLabel(name).evaluate((el) => {
      const cs = getComputedStyle(el.closest('label')!)
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }
    })

  test('Transport: „Gegenstände & Umfang"', async ({ page }) => {
    await page.goto('/transport')
    await page.getByLabel(/Gegenstände & Umfang/).focus()
    const ring = await labelRing(page, /Gegenstände & Umfang/)
    expect(ring.style).toBe('solid')
    expect(ring.width).toBeGreaterThanOrEqual(2)
  })

  test('Entrümpelung: „Was sollten wir noch wissen?"', async ({ page }) => {
    await page.goto('/entruempelung')
    await page.getByRole('radio', { name: /^Wohnung/ }).click()
    for (let i = 0; i < 5; i++) await weiter(page).click()
    await page.getByLabel(/Was sollten wir noch wissen/).focus()
    const ring = await labelRing(page, /Was sollten wir noch wissen/)
    expect(ring.style).toBe('solid')
    expect(ring.width).toBeGreaterThanOrEqual(2)
  })
})
