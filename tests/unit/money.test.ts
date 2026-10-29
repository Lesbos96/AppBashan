import { expect, it } from 'vitest'
import { formatEuro } from '../../src/lib/money'

const nbsp = String.fromCharCode(160)

it('formatiert Cent wie die Referenz', () => {
  expect(formatEuro(68961)).toBe(`689,61${nbsp}€`)
  expect(formatEuro(117500)).toBe(`1.175,00${nbsp}€`)
  expect(formatEuro(0)).toBe(`0,00${nbsp}€`)
  expect(formatEuro(5)).toBe(`0,05${nbsp}€`)
})
