import { expect, test } from '@playwright/test'

// Wächst mit jedem Screen ab S3.
const routes = [{ name: 'start', path: '/' }]

for (const { name, path } of routes) {
  test(name, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(path)
    await page.screenshot({ path: `tmp/shots/${testInfo.project.name}/${name}.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}
