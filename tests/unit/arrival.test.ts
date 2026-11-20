import { describe, expect, it } from 'vitest'
import { arrivalText, windowLabel, windowTimes } from '../../src/lib/arrival'

const U = String.fromCharCode(160)
const text = (a: number, b: number) => `Ankunft zwischen ${a} und ${b}${U}Uhr`

describe('arrivalText', () => {
  it('zeigt das gewählte Zeitfenster, für beide Seiten gleich', () => {
    for (const side of ['kunde', 'firma'] as const) {
      expect(arrivalText('morning', side)).toBe(text(8, 11))
      expect(arrivalText('midday', side)).toBe(text(11, 14))
      expect(arrivalText('afternoon', side)).toBe(text(14, 18))
    }
  })

  it('flexibel: kein Fenster, Hinweis je Seite', () => {
    expect(arrivalText('flexible', 'kunde')).toBe('Die Firma nennt dir die genaue Uhrzeit.')
    expect(arrivalText('flexible', 'firma')).toBe('Kunde ist flexibel – Uhrzeit mit dem Kunden abstimmen.')
  })

  it('fehlendes oder unbekanntes Fenster: kein Text', () => {
    expect(arrivalText(null, 'kunde')).toBeNull()
    expect(arrivalText(undefined, 'firma')).toBeNull()
    expect(arrivalText('abends', 'kunde')).toBeNull()
  })
})

describe('Fensterzeiten (eine Quelle)', () => {
  it('windowTimes: Uhrzeiten mit geschütztem Leerzeichen, flexibel ab 8 Uhr', () => {
    expect(windowTimes('morning')).toBe(`8 bis 11${U}Uhr`)
    expect(windowTimes('midday')).toBe(`11 bis 14${U}Uhr`)
    expect(windowTimes('afternoon')).toBe(`14 bis 18${U}Uhr`)
    expect(windowTimes('flexible')).toBe(['ganzer', 'Tag', 'ab', '8', 'Uhr'].join(U))
  })

  it('windowLabel: Name und Uhrzeiten, flexibel ohne Namen', () => {
    expect(windowLabel('morning')).toBe(`Vormittag, 8 bis 11${U}Uhr`)
    expect(windowLabel('midday')).toBe(`Mittag, 11 bis 14${U}Uhr`)
    expect(windowLabel('afternoon')).toBe(`Nachmittag, 14 bis 18${U}Uhr`)
    expect(windowLabel('flexible')).toBe(['ganzer', 'Tag', 'ab', '8', 'Uhr'].join(U))
  })

  it('fehlendes, unbekanntes oder geerbtes Fenster: null', () => {
    for (const w of [null, undefined, '', 'abends', 'toString', 'constructor']) {
      expect(windowTimes(w)).toBeNull()
      expect(windowLabel(w)).toBeNull()
      expect(arrivalText(w, 'kunde')).toBeNull()
    }
  })
})
