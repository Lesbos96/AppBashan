import { describe, expect, it } from 'vitest'
import { arrivalText } from '../../src/lib/arrival'

const U = String.fromCharCode(160)
const text = (a: string, b: string) => `Ankunft zwischen ${a} und ${b}${U}Uhr`

describe('arrivalText', () => {
  it('Termin bis Termin + 30 Minuten in Wiener Zeit (Winter und Sommer)', () => {
    expect(arrivalText('2026-11-18T08:00:00Z')).toBe(text('9:00', '9:30'))
    expect(arrivalText(new Date('2026-07-01T06:00:00Z'))).toBe(text('8:00', '8:30'))
  })

  it('Termin kurz vor Mitternacht: Ende am nächsten Tag', () => {
    expect(arrivalText('2026-11-18T22:45:00Z')).toBe(text('23:45', '0:15'))
  })

  it('Zeitumstellung: 30 echte Minuten, nicht 30 Minuten auf der Wanduhr', () => {
    expect(arrivalText('2026-03-29T00:45:00Z')).toBe(text('1:45', '3:15'))
    expect(arrivalText('2026-10-25T00:45:00Z')).toBe(text('2:45', '2:15'))
  })

  it('fehlender oder unlesbarer Termin: kein Text', () => {
    expect(arrivalText(null)).toBeNull()
    expect(arrivalText(undefined)).toBeNull()
    expect(arrivalText('kein Datum')).toBeNull()
  })
})
