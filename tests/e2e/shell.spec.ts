import { expect, test } from '@playwright/test'
import { collectErrors } from './console'

// Hauptflow nur mit der Tastatur: Onboarding, Tabs, Info-Sheet.
test('Erster Start: Onboarding per Tastatur, danach direkt Start', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/willkommen$/)
  await expect(page.getByRole('heading', { name: 'Alles für deinen Move. In einer App.' })).toBeVisible()
  const next = page.getByRole('button', { name: 'Weiter' })
  await next.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Dein Richtpreis. Sofort.' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Ein Partner bestätigt.' })).toBeVisible()
  await page.getByRole('button', { name: 'Los geht’s' }).press('Enter')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Start', level: 1 })).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/\/$/)
})

test('Überspringen beendet das Onboarding', async ({ page }) => {
  await page.goto('/willkommen')
  await page.getByRole('button', { name: 'Überspringen' }).press('Enter')
  await expect(page).toHaveURL(/\/$/)
})

test.describe('App-Shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  })

  test('Tab-Bar erreicht alle Tabs mit der Tastatur', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    // Phase 1: genau drei Tabs, kein „Miete“ (OPEN_ISSUES S9a-2/S9a-3 „Tab Miete“)
    await expect(nav.getByRole('link')).toHaveText([/Start/, /Aufträge/, /Profil/])
    // gleich verteilt über die ganze Leiste (gemessen, nicht aus dem Bild): gleiche Breiten, der letzte Tab endet am rechten Rand
    const bar = (await nav.boundingBox())!
    const boxes = await Promise.all((await nav.getByRole('link').all()).map(async (l) => (await l.boundingBox())!))
    for (const b of boxes) expect(Math.abs(b.width - boxes[0]!.width)).toBeLessThan(1)
    expect(bar.x + bar.width - (boxes[2]!.x + boxes[2]!.width)).toBeLessThan(16)
    for (const [label, heading] of [
      ['Profil', 'Noch kein Konto'],
      ['Start', 'Was hast du vor?'],
    ]) {
      await nav.getByRole('link', { name: label }).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('Service-Karte öffnet den Flow ohne Tab-Bar, Zurück führt zum Start', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Umzug/ }).press('Enter')
    await expect(page).toHaveURL(/\/umzug$/)
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden()
    await page.getByRole('link', { name: 'Start' }).press('Enter')
    await expect(page).toHaveURL(/\/$/)
  })

  test('Info-Sheet zeigt Tarife aus der Datenbank, ohne Gebühr', async ({ page }) => {
    await page.goto('/profil')
    await page.getByRole('link', { name: 'Wie rechnet MoveNow?' }).press('Enter')
    const sheet = page.getByRole('dialog', { name: 'Wie rechnet MoveNow?' })
    await expect(sheet.getByRole('heading', { name: 'Entrümpelung' })).toBeVisible()
    await expect(sheet).toContainText('55,75 € je Stunde')
    await expect(sheet).toContainText('75,00 € je m³')
    await expect(sheet).toContainText('47,87 € je lfm')
    await expect(sheet.getByRole('link', { name: /Schindler/ }).first()).toHaveAttribute('href', /^https:\/\//)
    const text = await sheet.innerText()
    expect(text).not.toMatch(/15\s?%|Gebühr|Provision|Prototyp/i)
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(page).toHaveURL(/\/profil$/)
    await expect(page.getByRole('link', { name: 'Wie rechnet MoveNow?' })).toBeFocused()
  })

  test('Info-Sheet: Ladefehler zeigt Fehlerzustand mit erneutem Versuch', async ({ page }) => {
    // 400 statt Abbruch: postgrest-js wiederholt Netzwerkfehler und 5xx mit Wartezeit
    await page.route(/current_price_version/, (route) => route.fulfill({ status: 400, json: { message: 'Test' } }))
    await page.goto('/profil/preise')
    await expect(page.getByRole('alert')).toContainText('Die Preise konnten nicht geladen werden')
    await page.unroute(/current_price_version/)
    await page.getByRole('button', { name: 'Erneut versuchen' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Entrümpelung' })).toBeVisible()
  })

  test('Offline-Hinweis erscheint und verschwindet', async ({ page, context }) => {
    await page.goto('/')
    await context.setOffline(true)
    await expect(page.getByRole('status')).toContainText('Du bist offline')
    await context.setOffline(false)
    await expect(page.getByRole('status')).toBeHidden()
  })

  test('Alle Seiten: keine Konsolenfehler, kein horizontaler Überlauf', async ({ page }) => {
    const errors = collectErrors(page)
    for (const path of ['/', '/miete', '/auftraege', '/profil', '/profil/preise', '/profil/datenschutz', '/profil/impressum', '/umzug', '/gibt-es-nicht']) {
      await page.goto(path, { waitUntil: 'networkidle' })
      const overflow = await page.evaluate<boolean>('document.documentElement.scrollWidth > document.documentElement.clientWidth')
      expect(overflow, path).toBe(false)
    }
    expect(errors).toEqual([])
  })

  test('Unbekannte Adresse zeigt die Fehlerseite', async ({ page }) => {
    await page.goto('/gibt-es-nicht')
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    await page.getByRole('button', { name: 'Zum Start' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Start', level: 1 })).toBeVisible()
  })

  test('Datenschutz und Impressum sind als Platzhalter markiert', async ({ page }) => {
    for (const [path, title] of [
      ['/profil/datenschutz', 'Datenschutz'],
      ['/profil/impressum', 'Impressum & AGB'],
    ]) {
      await page.goto(path!)
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
      await expect(page.getByText(/^Platzhalter:/)).toBeVisible()
    }
  })
})
