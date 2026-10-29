import type { Page } from '@playwright/test'

/** Sammelt console.error und nicht abgefangene Fehler der Seite; Tests prüfen am Ende `expect(errors).toEqual([])`. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}
