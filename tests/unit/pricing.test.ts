import { cents } from '@pricing'
import { expect, it } from 'vitest'

it('cents rundet halbe Cent wie der Prototyp', () => {
  expect(cents(1.005)).toBe(1.01)
  expect(cents(0.1 + 0.2)).toBe(0.3)
})
