import { describe, expect, it } from 'vitest'
import { staffelFee } from '../e2e/backend.ts'

// Kennung ui1-1711-a, fh1-1: Erwartung aus den vier Beispielen in .claude/rules/geld.md (Gesamtpreis → Provision), nicht aus dem Ist-Wert
describe('staffelFee (Mock der E2E-Tests) gegen die Beispiele aus geld.md', () => {
  it.each([
    [300, 36],
    [800, 90],
    [1500, 145],
    [3000, 250],
  ])('Gesamtpreis %i € → Provision %i €', (euro, fee) => {
    expect(staffelFee(euro * 100)).toBe(fee * 100)
  })
})
