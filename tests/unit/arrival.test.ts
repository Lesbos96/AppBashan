import { describe, expect, it } from 'vitest'
import { arrivalText } from '../../src/lib/arrival'

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
