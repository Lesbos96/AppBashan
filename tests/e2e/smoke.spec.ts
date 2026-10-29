import { expect, test } from '@playwright/test'
import { collectErrors } from './console'

test('Start lädt ohne Konsolenfehler', async ({ page }) => {
  const errors = collectErrors(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Start', level: 1 })).toBeVisible()
  expect(errors).toEqual([])
})

// Beleg, dass die Erfassung greift: ein absichtlicher Fehler muss sichtbar werden.
test('Erfassung sieht console.error und nicht abgefangene Fehler', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/dev/fundament')
  await page.evaluate(() => {
    console.error('absichtlich')
    setTimeout(() => {
      throw new Error('absichtlich-uncaught')
    })
  })
  await expect.poll(() => errors).toEqual(['absichtlich', 'absichtlich-uncaught'])
})
