// OPEN_ISSUES S8b-Abschluss: „4,8 km · innerhalb Wiens“ brach bei 390/430 px nach „innerhalb“ um.
import { describe, expect, it } from 'vitest'
import { routeText } from '../../src/screens/anfrage/format'

const nbsp = String.fromCharCode(160)

describe('Streckentext in Termin und Zusammenfassung', () => {
  it('innerhalb Wiens: Zahl+Einheit und „innerhalb Wiens“ mit geschütztem Leerzeichen, Umbruch nur am Mittelpunkt', () => {
    const t = routeText({ distanceKm: 4.84, outsideKm: 0 })
    expect(t).toBe(`4,8${nbsp}km · innerhalb${nbsp}Wiens`)
    // die einzigen normalen Leerzeichen stehen um den Mittelpunkt
    expect(t.split(' ')).toEqual([`4,8${nbsp}km`, '·', `innerhalb${nbsp}Wiens`])
  })

  it('außerhalb Wiens: beide Kilometerangaben zusammengehalten', () => {
    expect(routeText({ distanceKm: 196.1, outsideKm: 186.5 })).toBe(`196,1${nbsp}km · 186,5${nbsp}km außerhalb${nbsp}Wiens`)
  })

  it('eine Nachkommastelle mit Komma', () => {
    expect(routeText({ distanceKm: 0, outsideKm: 0.04 })).toBe(`0,0${nbsp}km · 0,0${nbsp}km außerhalb${nbsp}Wiens`)
  })
})
