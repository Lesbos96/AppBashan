// Reine Prüfungen von `quote` (S9a-3): Haltefenster, Preisabgleich, Adressauswahl, Label. Je Sperre: erlaubt UND verweigert mit genauem Ergebnis.
import { describe, expect, it } from 'vitest'
import { pickCandidate, TOLERANCE_M } from '../../supabase/functions/_shared/quote/address.ts'
import { holdAllows, matchesShown, type VersionHold } from '../../supabase/functions/_shared/quote/hold.ts'
import { type Candidate, canonicalLabel, HttpError } from '../../supabase/functions/_shared/route/facts.ts'

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0)
const MIN = 60_000
const replaced = (minutesAgo: number) => new Date(NOW - minutesAgo * MIN).toISOString()
const hold = (over: Partial<VersionHold> = {}): VersionHold => ({ started: true, isCurrent: false, replacedAt: replaced(10), holdMinutes: 30, ...over })

describe('holdAllows: Haltefenster einer ersetzten Preisversion', () => {
  it('aktuelle Version immer; unbekannte oder unveröffentlichte (null) nie', () => {
    expect(holdAllows(hold({ isCurrent: true, replacedAt: null }), NOW)).toBe(true)
    expect(holdAllows(null, NOW)).toBe(false)
  })

  it('ersetzte Version: innerhalb von 30 Minuten erlaubt, ab der Grenze verweigert', () => {
    expect(holdAllows(hold({ replacedAt: replaced(29) }), NOW)).toBe(true)
    expect(holdAllows(hold({ replacedAt: replaced(29.99) }), NOW)).toBe(true)
    expect(holdAllows(hold({ replacedAt: replaced(30) }), NOW)).toBe(false) // genau 30 min: abgelaufen
    expect(holdAllows(hold({ replacedAt: replaced(31) }), NOW)).toBe(false)
  })

  it('künftige oder nie gültige Version nie, auch wenn der Nachfolger jung ist', () => {
    expect(holdAllows(hold({ started: false, replacedAt: replaced(1) }), NOW)).toBe(false)
    expect(holdAllows(hold({ started: false, isCurrent: true, replacedAt: null }), NOW)).toBe(false)
  })

  it('ersetzt ohne Zeitpunkt: verweigert; ohne Einstellung holdMinutes: Fehler setting_missing', () => {
    expect(holdAllows(hold({ replacedAt: null }), NOW)).toBe(false)
    expect(() => holdAllows(hold({ holdMinutes: null }), NOW)).toThrow('setting_missing')
    expect(holdAllows(hold({ isCurrent: true, replacedAt: null, holdMinutes: null }), NOW)).toBe(true) // aktuelle Version braucht die Einstellung nicht
  })

  it('holdMinutes 0: sofort abgelaufen', () => {
    expect(holdAllows(hold({ replacedAt: replaced(0), holdMinutes: 0 }), NOW)).toBe(false)
  })
})

describe('matchesShown: Gleichheit ohne Toleranz', () => {
  const fixed = { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961, lines: [] }
  const range = { kind: 'price', lowCents: 95000, highCents: 155000, lines: [] }
  const offer = { kind: 'offer', reasons: ['special_case', 'route_missing'] }

  it('Festpreis: Gesamtbetrag, low und high müssen stimmen', () => {
    expect(matchesShown(fixed, { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 })).toBe(true)
    expect(matchesShown(fixed, { kind: 'price', totalCents: 68962, lowCents: 68961, highCents: 68961 })).toBe(false)
    expect(matchesShown(fixed, { kind: 'price', totalCents: 68961, lowCents: 68960, highCents: 68961 })).toBe(false)
    expect(matchesShown(fixed, { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68962 })).toBe(false)
    expect(matchesShown(fixed, { kind: 'price', totalCents: null, lowCents: 68961, highCents: 68961 })).toBe(false) // als Spanne gezeigt
  })

  it('Spanne: total null, low und high müssen stimmen', () => {
    expect(matchesShown(range, { kind: 'price', totalCents: null, lowCents: 95000, highCents: 155000 })).toBe(true)
    expect(matchesShown(range, { kind: 'price', totalCents: 95000, lowCents: 95000, highCents: 155000 })).toBe(false) // als Festpreis gezeigt
    expect(matchesShown(range, { kind: 'price', totalCents: null, lowCents: 95000, highCents: 155001 })).toBe(false)
  })

  it('Angebot: Art und Gründe in gleicher Reihenfolge; Preis gezeigt, Angebot berechnet (und umgekehrt) verweigert', () => {
    expect(matchesShown(offer, { kind: 'offer', reasons: ['special_case', 'route_missing'] })).toBe(true)
    expect(matchesShown(offer, { kind: 'offer', reasons: ['route_missing', 'special_case'] })).toBe(false)
    expect(matchesShown(offer, { kind: 'offer', reasons: ['special_case'] })).toBe(false)
    expect(matchesShown(offer, { kind: 'price', totalCents: 1, lowCents: 1, highCents: 1 })).toBe(false)
    expect(matchesShown(fixed, { kind: 'offer', reasons: ['special_case'] })).toBe(false)
  })
})

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  label: 'Stephansplatz 1, 1010 Wien', lat: 48.2086, lon: 16.3731, postcode: '1010', country: 'AUT', layer: 'address', street: 'Stephansplatz', housenumber: '1', locality: 'Wien', ...over,
})
/** Punkt `m` Meter nördlich (1° Breite ≈ 111 195 m). */
const north = (m: number, base = { lat: 48.2086, lon: 16.3731 }) => ({ lat: base.lat + m / 111_195, lon: base.lon })
const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof HttpError) return `${e.status} ${e.code}`
    throw e
  }
  return 'ok'
}

describe('pickCandidate: Adressauswahl am Client-Punkt', () => {
  it('hausnummerngenauer Kandidat am Punkt: gewählt', () => {
    const c = cand()
    expect(pickCandidate([c], { lat: c.lat, lon: c.lon })).toBe(c)
    expect(pickCandidate([cand({ layer: 'venue' })], { lat: c.lat, lon: c.lon }).layer).toBe('venue')
  })

  it(`Grenze ${TOLERANCE_M} m: innerhalb gewählt, außerhalb address_mismatch`, () => {
    const c = cand()
    expect(code(() => pickCandidate([c], north(TOLERANCE_M - 1)))).toBe('ok')
    expect(code(() => pickCandidate([c], north(TOLERANCE_M + 2)))).toBe('422 address_mismatch')
    expect(code(() => pickCandidate([], { lat: c.lat, lon: c.lon }))).toBe('422 address_mismatch')
  })

  it('nur Straße oder Ort ohne Hausnummer in der Nähe: address_imprecise', () => {
    const p = { lat: 48.2086, lon: 16.3731 }
    expect(code(() => pickCandidate([cand({ layer: 'street', housenumber: null })], p))).toBe('422 address_imprecise')
    expect(code(() => pickCandidate([cand({ layer: 'locality', street: null, housenumber: null })], p))).toBe('422 address_imprecise')
    expect(code(() => pickCandidate([cand({ layer: 'address', housenumber: null })], p))).toBe('422 address_imprecise')
    expect(code(() => pickCandidate([cand({ layer: 'address', street: null })], p))).toBe('422 address_imprecise')
  })

  it('Reihenfolge: zuerst Ebene/Hausnummer, dann der nächste; ein näherer Straßenkandidat verdrängt den genauen nicht', () => {
    const p = { lat: 48.2086, lon: 16.3731 }
    const street = cand({ layer: 'street', housenumber: null, ...north(1), label: 'Straße' })
    const near = cand({ ...north(10), housenumber: '2' })
    const nearer = cand({ ...north(5), housenumber: '3' })
    expect(pickCandidate([street, near, nearer], p)).toBe(nearer)
    expect(pickCandidate([near, nearer, street], p)).toBe(nearer)
    // ein genauer Kandidat außerhalb der Toleranz zählt nicht: übrig bleibt die Straße → ungenau
    expect(code(() => pickCandidate([street, cand({ ...north(80) })], p))).toBe('422 address_imprecise')
  })
})

describe('canonicalLabel', () => {
  it('„Straße Nr, PLZ Ort“ aus den Teilen, nicht das Anbieter-Label', () => {
    expect(canonicalLabel(cand({ label: 'Stephansplatz 1, Innere Stadt, Wien, Österreich' }))).toBe('Stephansplatz 1, 1010 Wien')
  })
  it('ohne PLZ nur mit Ort; ohne beides nur Straße und Nummer; ohne Straße oder Nummer das Anbieter-Label', () => {
    expect(canonicalLabel(cand({ postcode: null }))).toBe('Stephansplatz 1, Wien')
    expect(canonicalLabel(cand({ postcode: null, locality: null }))).toBe('Stephansplatz 1')
    expect(canonicalLabel(cand({ housenumber: null, label: 'Stephansplatz, Wien' }))).toBe('Stephansplatz, Wien')
    expect(canonicalLabel(cand({ street: null, label: 'Irgendwo' }))).toBe('Irgendwo')
  })
})
