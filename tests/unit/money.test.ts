import { describe, expect, it } from 'vitest'
import { formatEuro, formatEuroRounded } from '../../src/lib/money'
import { moneyCases, roundedCases } from './money-cases'

describe('formatEuro', () => {
  it.each(moneyCases)('%i Cent', (cents, expected) => {
    expect(formatEuro(cents)).toBe(expected)
  })

  it.each([0.5, 12.34, NaN, Infinity, 2 ** 53])('lehnt %s ab', (value) => {
    expect(() => formatEuro(value)).toThrow(RangeError)
  })
})

describe('formatEuroRounded', () => {
  it.each(roundedCases)('%i Cent', (cents, expected) => {
    expect(formatEuroRounded(cents)).toBe(expected)
  })

  it.each([-1, 1.5, NaN, Infinity, 2 ** 53])('lehnt %s ab', (value) => {
    expect(() => formatEuroRounded(value)).toThrow(RangeError)
  })
})
