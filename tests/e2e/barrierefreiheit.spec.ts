import { expect, test, type Page } from '@playwright/test'
import { anonymousPrices, mockQuote, toSummary } from './anfrage-helpers'
import { EMAIL, mockAuth, signInWithCode } from './auth-helpers'
import { weiter } from './dienste-helpers'
import { addPhotos } from './konfigurator-helpers'

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

test.describe('Seitentitel (2.4.2)', () => {
  test('jede Seite hat einen eigenen Titel, auch nach dem Wechsel', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    for (const [path, title] of [
      ['/', 'Start · MoveNow'],
      ['/profil', 'Profil · MoveNow'],
      ['/profil/preise', 'Wie rechnet MoveNow? · MoveNow'],
      ['/profil/datenschutz', 'Datenschutz · MoveNow'],
      ['/anmelden', 'Anmelden · MoveNow'],
      ['/umzug', 'Umzug · MoveNow'],
      ['/montage/termin', 'Montage: Termin · MoveNow'],
      ['/gibt-es-nicht', 'Seite nicht gefunden · MoveNow'],
    ]) {
      await page.goto(path!)
      await expect(page, path).toHaveTitle(title!)
    }
    // Wechsel innerhalb der App
    await page.goto('/')
    await page.getByRole('link', { name: /Entrümpelung/ }).press('Enter')
    await expect(page).toHaveTitle('Entrümpelung · MoveNow')
  })
})

test.describe('Fokus nach Seitenwechsel (2.4.3, 4.1.3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  })

  test('Fokus liegt nach dem Wechsel auf der Überschrift der neuen Seite, nicht auf body', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Umzug/ }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Umzug', level: 1 })).toBeFocused()
    // Tab geht von der Überschrift aus weiter in die Seite
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('main') !== null)).toBe(true)
    // Zurück: wieder die Überschrift der Startseite (die vorige Startseite kann noch im Übergang stehen, daher das fokussierte Element)
    await page.getByRole('link', { name: 'Start' }).press('Enter')
    await expect(page.locator('h1:focus')).toHaveText('Start')
  })

  test('Seite mit nachgeladener Überschrift (Entrümpelung, Richtwert): Fokus kommt nach dem Laden', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Entrümpelung/ }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Was soll geräumt werden?', level: 1 })).toBeFocused()
    await page.getByRole('radio', { name: /^Wohnung/ }).click()
    for (let i = 0; i < 5; i++) await weiter(page).click()
    // Die Ergebnisseite lädt erst die Tarife und zeigt dann ihre Überschrift; sie setzt den Fokus nicht selbst
    await page.getByRole('button', { name: 'Richtwert anzeigen' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Dein erster Preisrahmen.', level: 1 })).toBeFocused()
  })

  test('Erster Aufruf: Fokus bleibt beim Browser (keine Überschrift fokussiert)', async ({ page }) => {
    await page.goto('/profil')
    await expect(page.getByRole('heading', { name: 'Profil', level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  })
})

test.describe('Anmeldung: Fokus beim Schrittwechsel (2.4.3)', () => {
  test('nach „Code senden" im Codefeld, nach „Andere Adresse" wieder im E-Mail-Feld', async ({ page }) => {
    await mockAuth(page)
    await page.goto('/anmelden')
    await page.getByLabel('E-Mail').fill(EMAIL)
    await page.getByRole('button', { name: 'Code senden' }).press('Enter')
    await expect(page.getByLabel('Code')).toBeFocused()
    await page.getByRole('button', { name: 'Andere Adresse' }).press('Enter')
    await expect(page.getByLabel('E-Mail')).toBeFocused()
  })

  test('erster Aufruf: kein automatischer Fokus im E-Mail-Feld', async ({ page }) => {
    await page.goto('/anmelden')
    await expect(page.getByLabel('E-Mail')).toBeVisible()
    await expect(page.getByLabel('E-Mail')).not.toBeFocused()
  })
})

test.describe('Wartezeit nach 429 (4.1.3)', () => {
  test('die Live-Region enthält nur die Meldung, der Zähler läuft daneben', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    await anonymousPrices(page)
    await mockAuth(page)
    await mockQuote(page, () => ({ status: 429, json: { error: 'rate_limited' } }))
    await page.goto('/anmelden')
    await signInWithCode(page)
    await toSummary(page)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Anfrage senden' }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('zu viele Anfragen')
    const before = await alert.innerText()
    await expect(page.getByText(/Noch \d+ s\./)).toBeVisible()
    await page.waitForTimeout(2200)
    expect(await alert.innerText()).toBe(before)
    expect(before).not.toMatch(/Noch \d+ s/)
  })
})

test.describe('Geänderter Richtpreis wird angesagt (4.1.3)', () => {
  test('Montage: Statusmeldung trägt den neuen Endbetrag', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    await page.goto('/montage')
    const status = page.getByRole('status').filter({ hasText: 'Richtpreis' })
    await expect(status).toHaveText('Richtpreis 95,74 €')
    await page.getByRole('button', { name: 'Laufmeter erhöhen' }).click()
    await expect(status).not.toHaveText('Richtpreis 95,74 €')
    await expect(status).toHaveText(/^Richtpreis \d{1,3}(\.\d{3})*,\d{2}\s€$/)
    // Die Meldung entspricht dem Betrag im Knopf der Preisleiste
    const button = await page.getByRole('button', { name: /^Richtpreis .*, alle Positionen anzeigen$/ }).getAttribute('aria-label')
    expect(button).toContain((await status.innerText()).replace('Richtpreis ', ''))
  })
})

test.describe('Sichtbarer Text im Namen (2.5.3)', () => {
  test('Fotoknöpfe: Name beginnt mit „Kamera" bzw. „Galerie"', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    await page.goto('/transport')
    for (const visible of ['Kamera', 'Galerie']) {
      const button = page.getByRole('button', { name: new RegExp(`^${visible}\\b`) })
      await expect(button).toHaveCount(1)
      await expect(button).toContainText(visible)
    }
  })
})

test.describe('Foto-Zähler wird angesagt (4.1.3)', () => {
  test('Überschrift und Zähler bilden eine höfliche Live-Region, ohne zweites Element „Fotos"', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    await page.goto('/transport')
    const region = page.locator('[aria-live="polite"][aria-atomic="true"]', { has: page.getByRole('heading', { name: 'Fotos' }) })
    await expect(region).toHaveText(/^Fotos\s*0 von 8$/)
    await addPhotos(page, 2)
    await expect(region).toHaveText(/^Fotos\s*2 von 8$/)
    // Der Shot-Spec sucht „Fotos" exakt: genau ein Treffer
    await expect(page.getByText('Fotos', { exact: true })).toHaveCount(1)
  })
})

test.describe('Überschriften ohne Sprung (1.3.1)', () => {
  /** Ebenen der sichtbaren Überschriften in Dokumentreihenfolge. */
  const levels = (page: Page) => page.locator('main h1, main h2, main h3, main h4').evaluateAll((hs) => hs.filter((h) => (h as HTMLElement).offsetParent !== null).map((h) => Number(h.tagName[1])))

  test('Entrümpelung, letzter Schritt: „Fotos" ist h2 unter dem h1; im Konfigurator h3 unter h2', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    await page.goto('/entruempelung')
    await page.getByRole('radio', { name: /^Wohnung/ }).click()
    for (let i = 0; i < 5; i++) await weiter(page).click()
    await expect(page.getByRole('heading', { name: 'Fotos', level: 2 })).toBeVisible()
    const steps = await levels(page)
    expect(steps.every((l, i) => i === 0 || l <= steps[i - 1]! + 1)).toBe(true)
    await page.goto('/transport')
    await expect(page.getByRole('heading', { name: 'Fotos', level: 3 })).toBeVisible()
  })
})

test.describe('Fehlerseite (1.3.1, 2.4.6)', () => {
  test('hat genau eine h1 mit dem Fehler', async ({ page }) => {
    await page.goto('/gibt-es-nicht')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seite nicht gefunden')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })
})

test.describe('Textkontrast der Adressmarker (1.4.3)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`Marker „A" und „B" mindestens 4,5:1 (${scheme})`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/umzug')
      for (const [row, letter] of [['Abholung', 'A'], ['Ziel', 'B']] as const) {
        // Der Marker ist aria-hidden und steht daher nicht im Namen des Knopfs
        const marker = page.getByRole('button', { name: new RegExp(`^${row}`) }).locator('span', { hasText: new RegExp(`^${letter}$`) })
        const { color, background } = await marker.evaluate((el) => {
          const cs = getComputedStyle(el)
          return { color: cs.color, background: cs.backgroundColor }
        })
        expect(contrast(color, background), `${letter} ${scheme}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

test.describe('Textabstände (1.4.12)', () => {
  const spacing = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }'
  /** Elemente in der Preisleiste, deren Text abgeschnitten ist (overflow ≠ visible und Inhalt größer als die Box). */
  const clipped = (page: Page) =>
    page.getByRole('button', { name: /anzeigen$/ }).evaluate((bar) =>
      [bar, ...bar.querySelectorAll('*')]
        .filter((e) => {
          const cs = getComputedStyle(e)
          return (cs.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) || (cs.overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1)
        })
        .map((e) => (e as HTMLElement).innerText),
    )

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  })

  test('Preisleiste: Betrag nicht abgeschnitten (Montage)', async ({ page }) => {
    await page.goto('/montage')
    await expect(page.getByRole('button', { name: /^Richtpreis/ })).toBeVisible()
    await page.addStyleTag({ content: spacing })
    expect(await clipped(page)).toEqual([])
  })

  test('Preisleiste: „Persönliches Angebot" nicht abgeschnitten (Umzug mit Klavier)', async ({ page }) => {
    await page.goto('/umzug')
    await page.getByRole('radio', { name: 'Klavier' }).check({ force: true })
    await expect(page.getByRole('button', { name: 'Persönliches Angebot, Details anzeigen' })).toBeVisible()
    await page.addStyleTag({ content: spacing })
    expect(await clipped(page)).toEqual([])
  })
})

test.describe('Onboarding: neue Seite wird angesagt (4.1.3)', () => {
  test('Titel und Text stehen in einer höflichen Live-Region, der Fokus bleibt auf „Weiter"', async ({ page }) => {
    await page.goto('/willkommen')
    const region = page.locator('[aria-live="polite"]', { has: page.getByRole('heading', { level: 1 }) })
    await expect(region).toHaveCount(1)
    await page.getByRole('button', { name: 'Weiter' }).press('Enter')
    await expect(region.getByRole('heading', { level: 1 })).toHaveText('Dein Richtpreis. Sofort.')
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeFocused()
  })
})

test.describe('Fokus nach Seitenwechsel: kein Wegziehen (2.4.3)', () => {
  test('setzt der Nutzer den Fokus vor dem Nachladen der Überschrift woandershin, bleibt er dort', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    // Tarife verzögert: die Entrümpelung zeigt ihre Überschrift erst nach dem Laden
    await page.route(/\/rest\/v1\/price_config/, async (r) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await r.continue()
    })
    await page.goto('/entruempelung')
    await page.getByRole('radio', { name: /^Wohnung/ }).click()
    for (let i = 0; i < 5; i++) await weiter(page).click()
    // Die Richtwert-Seite lädt die Tarife neu und setzt den Fokus nicht selbst (anders als der Wizard)
    await page.getByRole('button', { name: 'Richtwert anzeigen' }).press('Enter')
    await expect(page.getByRole('status').filter({ hasText: 'Preise laden' })).toBeVisible()
    // Ein Element außerhalb der Seite (wie die Tab-Leiste) bekommt den Fokus, bevor die Überschrift da ist
    await page.evaluate(() => {
      const b = document.createElement('button')
      b.id = 'aussen'
      b.textContent = 'Außen'
      document.body.append(b)
      b.focus()
    })
    await expect(page.getByRole('heading', { name: 'Dein erster Preisrahmen.', level: 1 })).toBeVisible()
    await page.waitForTimeout(300)
    await expect(page.locator('#aussen')).toBeFocused()
  })
})

test.describe('Kontaktfelder: Pflicht und Fehlerhinweis (3.3.1, 3.3.2)', () => {
  test('Pflichtfelder sind markiert; ungültige Eingabe zeigt nach dem Verlassen einen verknüpften Hinweis', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    await anonymousPrices(page)
    await toSummary(page)
    for (const label of ['Name', 'Telefon', 'Mailadresse']) await expect(page.getByLabel(label)).toHaveAttribute('aria-required', 'true')
    await expect(page.getByLabel('Stiege / Tür')).not.toHaveAttribute('aria-required', 'true')
    // Gültige Werte aus fillContact: kein Hinweis
    await expect(page.getByText(/^Prüfe die/)).toHaveCount(0)
    const phone = page.getByLabel('Telefon')
    await phone.fill('12')
    // Während der Eingabe noch kein Hinweis
    await expect(page.getByText('Prüfe die Telefonnummer, sie braucht mindestens 5 Ziffern.')).toHaveCount(0)
    await phone.press('Tab')
    const hint = page.getByText('Prüfe die Telefonnummer, sie braucht mindestens 5 Ziffern.')
    await expect(hint).toBeVisible()
    await expect(phone).toHaveAttribute('aria-invalid', 'true')
    await expect(phone).toHaveAttribute('aria-describedby', (await hint.getAttribute('id'))!)
    await phone.fill('+43 660 1234567')
    await expect(hint).toHaveCount(0)
    await expect(phone).not.toHaveAttribute('aria-invalid', 'true')
  })
})
