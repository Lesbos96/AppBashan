import { describe, expect, it } from 'vitest'
import { formatEuro } from '../../src/lib/money'
import { moneyCases } from './money-cases'

describe('formatEuro', () => {
  it.each(moneyCases)('%i Cent', (cents, expected) => {
    expect(formatEuro(cents)).toBe(expected)
  })

  it.each([0.5, 12.34, NaN, Infinity, 2 ** 53])('lehnt %s ab', (value) => {
    expect(() => formatEuro(value)).toThrow(RangeError)
  })
})
