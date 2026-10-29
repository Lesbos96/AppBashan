import { expect, test } from '@playwright/test'

test('Start lädt ohne Konsolenfehler', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'MoveNow' })).toBeVisible()
  expect(errors).toEqual([])
})
