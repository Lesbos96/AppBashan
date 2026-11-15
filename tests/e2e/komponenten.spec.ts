import { expect, test } from './backend'
import { collectErrors } from './console'

test('Komponenten per Tastatur bedienbar', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/dev/fundament')

  // Segmented Control: Pfeiltaste wählt die nächste Option
  const group = page.getByRole('radiogroup', { name: 'Segmented Control' })
  await group.getByRole('radio', { name: 'Möbel' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(group.getByRole('radio', { name: 'Klavier' })).toBeChecked()

  // Stepper und Schalter
  await page.getByRole('button', { name: 'Mehr' }).press('Enter')
  await expect(page.getByRole('group', { name: 'Personen' }).getByRole('status')).toHaveText('4')
  const off = page.getByRole('switch', { name: 'Schalter B' })
  await off.press('Space')
  await expect(off).toBeChecked()

  // Sheet: öffnet als Dialog, Esc schließt
  await page.getByRole('button', { name: 'Bottom Sheet öffnen' }).press('Enter')
  const sheet = page.getByRole('dialog', { name: 'Beispiel-Sheet' })
  await expect(sheet).toBeVisible()
  await page.screenshot({ path: 'tmp/shots/sheet.png' })
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  expect(errors).toEqual([])
})

test('Touch-Ziele, Beträge und Tab-Bar', { tag: '@breit' }, async ({ page }) => {
  await page.goto('/dev/fundament')

  for (const el of [
    page.getByRole('button', { name: 'Mehr' }),
    page.getByRole('button', { name: 'Weniger' }),
    page.getByRole('switch', { name: 'Schalter A' }),
    page.getByRole('link', { name: 'Start' }).first(),
  ]) {
    const box = await el.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }

  // Betrag bricht nie um, die lange Beschreibung daneben schon
  const amount = page.getByText('689,61 €', { exact: true }).first()
  await expect(amount).toHaveCSS('white-space', 'nowrap')

  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Miete' })).toHaveAttribute('aria-current', 'page')
})
