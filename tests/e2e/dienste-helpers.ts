import { expect, type Page } from '@playwright/test'
import { addPhotos, clickTimes } from './konfigurator-helpers'

export const weiter = (page: Page) => page.getByRole('button', { name: 'Weiter' })

/** Entrümpelung aus dem README bis zum Ergebnis: Wohnung, 60 m², normal möbliert, 3. Stock ohne Lift, 2 Fotos = 1.175,00 €. Erwartet die Seite /entruempelung. */
export async function fillEntruempelungBeispiel(page: Page, photo?: Buffer) {
  await page.getByRole('radio', { name: /^Wohnung/ }).click()
  await weiter(page).click()
  await page.getByRole('button', { name: '60 m²' }).click()
  await weiter(page).click()
  await expect(page.getByRole('radio', { name: /^Normal möbliert/ })).toBeChecked()
  await weiter(page).click()
  await clickTimes(page, 'Stockwerk erhöhen', 3)
  await page.getByRole('switch', { name: 'Lift für die Gegenstände nutzbar' }).click()
  await weiter(page).click()
  await weiter(page).click()
  await addPhotos(page, 2, photo)
  await expect(page.getByText('2 von 8')).toBeVisible()
  await page.getByRole('button', { name: 'Richtwert anzeigen' }).click()
}

/** Küche aus dem README: 3,2 lfm unten, 2,4 oben, 0,6 hoch = 770,40 €. Startwert unten ist 2 lfm. Erwartet die Seite /montage. */
export async function fillKuecheBeispiel(page: Page) {
  await page.getByRole('radio', { name: 'Küche' }).check({ force: true })
  await clickTimes(page, 'Unterschränke erhöhen', 12)
  await clickTimes(page, 'Oberschränke erhöhen', 24)
  await clickTimes(page, 'Hochschränke erhöhen', 6)
}
