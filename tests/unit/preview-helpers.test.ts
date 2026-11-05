import { InputError, num } from '@pricing'
import { describe, expect, it } from 'vitest'
import { dayText, shortDayText, utc } from '../../src/screens/anfrage/format'
import { fills, objectOf, objects } from '../../src/screens/entruempelung/options'
import { initialClearance, initialDraft, initialFlow } from '../../src/lib/flow'
import { formatEuro } from '../../src/lib/money'
import {
  assemblyText,
  clearanceFields,
  clearanceLineText,
  floorText,
  hoursText,
  lmText,
  minHours,
  previewAssembly,
  previewClearance,
  previewTransport,
  shownOf,
  toTariffs,
} from '../../src/lib/preview'
import { tariffs } from './golden.ts'

describe('Textbausteine der Vorschau', () => {
  it('Zahlen mit Dezimalkomma, Erdgeschoss und Stockwerke', () => {
    expect(hoursText(5)).toBe('5 h')
    expect(hoursText(2.5)).toBe('2,5 h')
    expect(lmText(3.2)).toBe('3,2 lfm')
    expect(floorText(0)).toBe('Erdgeschoss')
    expect(floorText(1)).toBe('1. Stock')
    expect(floorText(20)).toBe('20. Stock')
  })

  it('toTariffs lässt Quellenzeilen (Einheit ref) weg', () => {
    expect(toTariffs({ rows: [{ key: 'a', value: 1, unit: 'eur' }, { key: 'src', value: 0, unit: 'ref' }] })).toEqual({ a: 1 })
  })

  it('Mindestdauer je Service aus den Tarifen', () => {
    expect(minHours(tariffs, 'move')).toBe(num(tariffs, 'min_hours.move'))
    expect(minHours(tariffs, 'transport')).toBe(num(tariffs, 'min_hours.transport'))
  })

  it('Montage-Zeile: Mindestmenge bei Standardmöbeln, Küche mit allen Maßen', () => {
    const min = num(tariffs, 'assembly.min_lfm')
    expect(assemblyText({ kind: 'standard', lm: 0, upper: 0, tall: 0 }, tariffs)).toBe(`Standardmöbel · ${lmText(min)} × ${formatEuro(num(tariffs, 'assembly.rate_per_lfm'))}`)
    expect(assemblyText({ kind: 'kitchen', lm: 3.2, upper: 2.4, tall: 0.6 }, tariffs)).toBe(`Küche · 3,2 lfm unten, 2,4 lfm oben, 0,6 lfm hoch · Grundbetrag ${formatEuro(num(tariffs, 'kitchen.base'))}`)
  })
})

describe('Vorschau Entrümpelung und Montage', () => {
  const flat = { ...initialClearance, object: 'flat' as const, area: 60, fill: 'normal' as const }

  it('ohne gewähltes Objekt wirft die Vorschau (Seite zeigt den Fehlerzustand), Montage nur mit Haken', () => {
    expect(() => previewClearance(tariffs, initialClearance)).toThrow(InputError)
    expect(clearanceFields({ ...flat, assembly: false }).assembly).toBeNull()
    expect(clearanceFields({ ...flat, assembly: true, draft: { kind: 'kitchen', lm: 1, upper: 2, tall: 3 } }).assembly).toEqual({ kind: 'kitchen', lm: 1, upper: 2, tall: 3 })
  })

  it('Wohnung ergibt eine Spanne; shownOf meldet sie ohne Gesamtpreis', () => {
    const p = previewClearance(tariffs, flat)
    expect(p.state).toBe('price')
    if (p.state !== 'price') return
    expect(p.price.lowCents).toBeLessThan(p.price.highCents)
    expect(shownOf(p)).toEqual({ kind: 'price', totalCents: null, lowCents: p.price.lowCents, highCents: p.price.highCents })
  })

  it('Gewerbe und stark belastete Räume führen zum Angebot', () => {
    for (const object of ['office', 'heavy'] as const) {
      const p = previewClearance(tariffs, { ...flat, object })
      expect(p.state).toBe('offer')
      expect(shownOf(p)).toMatchObject({ kind: 'offer', reasons: [expect.any(String)] })
    }
  })

  it('Montage ist immer ein Festpreis (low = high = total)', () => {
    const p = previewAssembly(tariffs, initialDraft)
    expect(p.state).toBe('price')
    if (p.state !== 'price') return
    expect(shownOf(p)).toEqual({ kind: 'price', totalCents: p.price.totalCents, lowCents: p.price.totalCents, highCents: p.price.totalCents })
  })

  it('Zeilentexte: Mindestpreis bei kleiner Menge, Etagen ohne Lift ab dem 2. Stock', () => {
    const small = { ...flat, area: 1, fill: 'light' as const }
    const p = previewClearance(tariffs, small)
    if (p.state !== 'price') throw new Error('Preis erwartet')
    expect(clearanceLineText('clearance', p.price, small, tariffs).detail).toMatch(/· Mindestpreis$/)
    const big = previewClearance(tariffs, { ...flat, area: 200 })
    if (big.state !== 'price') throw new Error('Preis erwartet')
    expect(clearanceLineText('clearance', big.price, { ...flat, area: 200 }, tariffs).detail).toMatch(new RegExp(`× ${formatEuro(num(tariffs, 'clearance.rate'))}$`))
    expect(clearanceLineText('access', p.price, { ...flat, floor: 2 }, tariffs).detail).toBe(`1 Etage ohne Lift × ${formatEuro(num(tariffs, 'clearance.floor_surcharge'))}`)
    expect(clearanceLineText('access', p.price, { ...flat, floor: 4 }, tariffs).detail).toMatch(/^3 Etagen ohne Lift/)
    expect(clearanceLineText('access', p.price, { ...flat, floor: 0 }, tariffs).detail).toMatch(/^0 Etagen/)
  })

  it('shownOf bei einem Angebot kopiert die Gründe (keine geteilte Referenz)', () => {
    const p = previewTransport(tariffs, 'transport', { ...initialFlow, goods: 'piano' })
    expect(p.state).toBe('offer')
    const s = shownOf(p)
    if (s.kind !== 'offer' || p.state !== 'offer') throw new Error('Angebot erwartet')
    expect(s.reasons).toEqual([...p.offer.reasons])
    expect(s.reasons).not.toBe(p.offer.reasons)
  })
})

describe('Datum in der Anfrage (Kalendertag, nie Zeitpunkt)', () => {
  // format.ts formatiert mit timeZone: 'UTC'; nachweislich gleich unter TZ=Pacific/Auckland und TZ=America/Los_Angeles (Nachtlauf, docs/nacht/testabdeckung.md)
  it('formatiert de-AT als Kalendertag (UTC-basiert)', () => {
    expect(utc('2026-11-13')).toBe(Date.UTC(2026, 10, 13))
    expect(dayText('2026-11-13')).toBe('Freitag, 13. November 2026')
    expect(shortDayText('2026-11-13')).toMatch(/^Fr\.?, 13\. Nov\.?$/)
    expect(dayText('2027-01-01')).toBe('Freitag, 1. Jänner 2027') // de-AT: Jänner
    expect(dayText(null)).toBe('')
    expect(shortDayText(null)).toBe('')
  })
})

describe('Auswahl der Entrümpelung', () => {
  it('jede Objektart und jeder Füllgrad ist genau einmal da und passt zum Flow', () => {
    expect(objects.map((o) => o.value)).toEqual(['flat', 'house', 'attic', 'cellar', 'office', 'heavy'])
    expect(fills.map((f) => f.value)).toEqual(['light', 'normal', 'full'])
    expect(objectOf({ ...initialClearance, object: 'cellar' })?.label).toBe('Keller')
    expect(objectOf(initialClearance)).toBeUndefined()
  })
})
