import { readFileSync } from 'node:fs'
import {
  InputError,
  type RentalOffer,
  type RouteFacts,
  type Tariffs,
  computeAssembly,
  computeClearance,
  computeRental,
  computeTransport,
  parseClearanceInput,
  parseRentalInput,
  parseTransportInput,
  splitFee,
  toLines,
} from '@pricing'
import { describe, expect, it } from 'vitest'

// Tarife aus dem Seed: dieselben Werte wie in price_config, ein Schlüssel-Tippfehler im Modul fällt hier auf.
const seed = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8')
const tariffs: Tariffs = Object.fromEntries([...seed.matchAll(/\(1, '([\w.]+)', ([\d.]+),/g)].map((m) => [m[1]!, Number(m[2])]))
const rates = { feeRate: 0.15, vatRate: 0.2 }

// sampleOffers (Prototyp Zeile 26) in Cent, wie im Seed.
const offers: Record<string, RentalOffer> = {
  small: { dailyCents: 7900, kmPerDay: 100, extraKmCents: 35, coverDailyCents: 1900, driverDailyCents: 900, bookingFeeCents: 0, oneWayCents: 4900, depositCents: 30000 },
  medium: { dailyCents: 9900, kmPerDay: 150, extraKmCents: 40, coverDailyCents: 2400, driverDailyCents: 1000, bookingFeeCents: 1000, oneWayCents: 5900, depositCents: 50000 },
  large: { dailyCents: 12900, kmPerDay: 200, extraKmCents: 45, coverDailyCents: 2900, driverDailyCents: 1200, bookingFeeCents: 0, oneWayCents: 7900, depositCents: 70000 },
}

type S = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- Prototyp-state
const assemblyOf = (s: S) => (s.mount ? (s.kind === 'kitchen' ? { kind: 'kitchen' as const, lm: s.lm, upper: s.upper, tall: s.tall } : { kind: 'standard' as const, lm: s.lm }) : null)
const routeOf = (s: S): RouteFacts | null => (s.route === null ? null : { region: s.moveRegion, outsideKm: s.outsideKm, driveHours: s.driveHours })
const transportOf = (s: S) =>
  parseTransportInput({ service: s.service, goods: s.goods, crew: s.crew, vehicles: s.vehicles, vehicleType: s.vehicleType, hours: s.hours, fromFloor: s.fromFloor, toFloor: s.toFloor, fromLift: s.fromLift, toLift: s.toLift, boxes: s.boxes, parking: s.parking, packing: s.packing, assembly: assemblyOf(s) })
const clearanceOf = (s: S) =>
  parseClearanceInput({ object: s.object, area: s.area, fill: s.fill, lift: s.lift, floor: s.floor, special: !!s.special, assembly: assemblyOf(s) })
const wall = (d: string, t: string) => `${d}T${t}`
const rentalOf = (s: S) => {
  const pickupAt = s.date ? wall(s.date, s.pickTime) : '2026-06-10T09:00'
  const returnAt = s.date ? wall(s.returnDate, s.returnTime) : new Date(Date.UTC(2026, 5, 10 + s.days, 9)).toISOString().slice(0, 16)
  return { pickupAt, returnAt, km: s.km, cover: !!s.cover, driver: !!s.driver, oneWay: s.returnStation === 'other' }
}
const cents = (euro: number) => Math.round(euro * 100)

// Echte Halb-Cent-Fälle: der Prototyp rundet per Float (11150 × 0,15 = 1672,5 → 1672), das Modul half-up (siehe PRICING.md).
const halfCent: Record<number, { feeCents: number; feeNetCents: number; feeVatCents: number; payoutCents: number }> = {
  11150: { feeCents: 1673, feeNetCents: 1394, feeVatCents: 279, payoutCents: 9477 },
}
function expectFee(totalCents: number, expected: S) {
  const exact = halfCent[totalCents] ?? { feeCents: cents(expected.fee), feeNetCents: cents(expected.feeNet), feeVatCents: cents(expected.feeVat), payoutCents: cents(expected.partner) }
  expect(splitFee(totalCents, rates)).toMatchObject(exact)
}

type Golden = { name: string; state: S; expected: S }
const golden = JSON.parse(readFileSync(new URL('./fixtures/prototype-golden.json', import.meta.url), 'utf8')) as Golden[]

describe('Golden-Fixtures aus dem Prototyp', () => {
  it('hat mindestens 40 Fälle', () => expect(golden.length).toBeGreaterThanOrEqual(40))

  for (const { name, state, expected } of golden) {
    it(name, () => {
      const s = state
      if (s.service === 'rent') {
        const input = rentalOf(s)
        if (input.returnAt <= input.pickupAt) {
          // Prototyp rechnet mit mindestens 1 Tag; das Modul lehnt eine Rückgabe vor der Abholung ab.
          expect(() => parseRentalInput(input)).toThrow(InputError)
          return
        }
        const r = computeRental(offers[s.van]!, parseRentalInput(input))
        expect(r.totalCents).toBe(cents(expected.total))
        expect(r.days).toBe(expected.days)
        expect(r.depositCents).toBe(cents(expected.deposit))
        expect(r.lines.reduce((sum, l) => sum + l.cents, 0)).toBe(r.totalCents)
        expectFee(r.totalCents, expected)
        return
      }
      let r
      if (s.service === 'assembly') r = computeAssembly(tariffs, assemblyOf({ ...s, mount: true })!)
      else if (s.service === 'clear') r = computeClearance(tariffs, clearanceOf(s))
      else r = computeTransport(tariffs, transportOf(s), routeOf(s))

      if (expected.needsVisit || expected.needsQuote) {
        expect(r.kind).toBe('offer')
        return
      }
      expect(r.kind).toBe('price')
      if (r.kind !== 'price') return
      expect(r.totalCents).toBe(cents(expected.total))
      expect(r.lowCents).toBe(cents(expected.low))
      expect(r.highCents).toBe(cents(expected.high))
      expect(r.lines.reduce((sum, l) => sum + l.cents, 0)).toBe(r.totalCents)
      if (s.service === 'clear') expect((r as { volumeM3: number }).volumeM3).toBe(expected.volume)
      expectFee(r.totalCents, expected)
    })
  }
})

describe('Preisbeispiele aus docs/reference/design/README.md', () => {
  it('Umzug: 689,61 € → Gebühr 103,44, netto 86,20, USt. 17,24, Partner 586,17', () => {
    const r = computeTransport(
      tariffs,
      parseTransportInput({ service: 'move', goods: 'normal', crew: 3, vehicles: 1, vehicleType: 'van', hours: 5, fromFloor: 0, toFloor: 0, fromLift: true, toLift: true, boxes: 20, parking: 1, packing: false, assembly: { kind: 'standard', lm: 3 } }),
      { region: 'vienna', outsideKm: 0, driveHours: 0 },
    )
    expect(r).toMatchObject({ kind: 'price', totalCents: 68961, hourlyRateCents: 7080, billedHours: 5 })
    if (r.kind === 'price') expect(r.lines).toEqual([
      { key: 'team', cents: 35400 },
      { key: 'assembly', cents: 14361 },
      { key: 'boxes', cents: 7200 },
      { key: 'parking', cents: 12000 },
    ])
    expect(splitFee(68961, rates)).toEqual({ totalCents: 68961, feeCents: 10344, feeNetCents: 8620, feeVatCents: 1724, payoutCents: 58617 })
  })

  it('Entrümpelung: 1.175,00 €, Spanne 950–1.550 €, Gebühr 176,25 €', () => {
    const r = computeClearance(tariffs, parseClearanceInput({ object: 'flat', area: 60, fill: 'normal', lift: false, floor: 3, special: false, assembly: null }))
    expect(r).toMatchObject({ kind: 'price', totalCents: 117500, lowCents: 95000, highCents: 155000, volumeM3: 15 })
    expect(splitFee(117500, rates).feeCents).toBe(17625)
  })

  it('Küche 3,2 / 2,4 / 0,6 lfm: 770,40 €', () => {
    expect(computeAssembly(tariffs, { kind: 'kitchen', lm: 3.2, upper: 2.4, tall: 0.6 }).totalCents).toBe(77040)
  })

  it('Cargo Van, 2 Tage, 350 km, Schutzpaket: 276,00 €, Kaution 500,00 € separat', () => {
    const r = computeRental(offers.medium!, parseRentalInput({ pickupAt: '2026-06-10T09:00', returnAt: '2026-06-12T09:00', km: 350, cover: true, driver: false, oneWay: false }))
    expect(r).toMatchObject({ totalCents: 27600, depositCents: 50000, days: 2, includedKm: 300 })
    expect(splitFee(27600, rates).feeCents).toBe(4140)
  })

  it('Vermieter-Beispiel: 99 € → Gebühr 14,85, netto 12,38, USt. 2,47, Vermieter 84,15', () => {
    expect(splitFee(9900, rates)).toEqual({ totalCents: 9900, feeCents: 1485, feeNetCents: 1238, feeVatCents: 247, payoutCents: 8415 })
  })
})

describe('Plattformgebühr', () => {
  it('rundet halbe Cent half-up (Ganzzahlrechnung, nicht Float)', () => {
    expect(splitFee(10010, rates).feeCents).toBe(1502) // 1501,5
    expect(splitFee(10, rates).feeCents).toBe(2) // 1,5
  })

  it('Gebühr + Auszahlung = Gesamtpreis, netto + USt. = Gebühr', () => {
    for (let total = 0; total <= 20000; total += 7) {
      const s = splitFee(total, rates)
      expect(s.feeCents + s.payoutCents).toBe(total)
      expect(s.feeNetCents + s.feeVatCents).toBe(s.feeCents)
    }
  })

  it('nimmt den Satz als Parameter', () => {
    expect(splitFee(10000, { feeRate: 0.1, vatRate: 0.2 }).feeCents).toBe(1000)
    expect(splitFee(10000, { feeRate: 0, vatRate: 0.2 }).feeCents).toBe(0)
  })

  it('lehnt ungültige Sätze und Beträge ab', () => {
    expect(() => splitFee(100, { feeRate: 1, vatRate: 0.2 })).toThrow()
    expect(() => splitFee(100, { feeRate: -0.1, vatRate: 0.2 })).toThrow()
    expect(() => splitFee(100, { feeRate: 0.123456, vatRate: 0.2 })).toThrow()
    expect(() => splitFee(100, { feeRate: Number.NaN, vatRate: 0.2 })).toThrow()
    expect(() => splitFee(100.5, rates)).toThrow()
    expect(() => splitFee(-1, rates)).toThrow()
  })
})

describe('Preiszeilen und Kundenansicht', () => {
  it('Zeilen ergeben immer das Total, jede Zeile liegt unter 1 Cent am exakten Wert', () => {
    const cases: [string, number][][] = [
      [['a', 0.005], ['b', 0.005], ['c', 0.005]],
      [['a', 195.125], ['b', 143.61], ['c', 72], ['d', 33.335]],
      [['a', 10.004], ['b', 20.004], ['c', 30.004]],
    ]
    for (const euros of cases) {
      const { lines, totalCents } = toLines(euros)
      expect(lines.reduce((s, l) => s + l.cents, 0)).toBe(totalCents)
      for (const l of lines) expect(Math.abs(l.cents - euros.find(([k]) => k === l.key)![1] * 100)).toBeLessThan(1)
    }
  })

  it('Kundenergebnisse enthalten weder Gebühr noch Auszahlung noch Kaution im Total', () => {
    const t = computeTransport(tariffs, transportOf({ service: 'move', goods: 'normal', crew: 2, vehicles: 1, vehicleType: 'van', hours: 4, fromFloor: 0, toFloor: 0, fromLift: true, toLift: true, boxes: 0, parking: 0, packing: false }), { region: 'vienna', outsideKm: 0, driveHours: 0 })
    const c = computeClearance(tariffs, parseClearanceInput({ object: 'flat', area: 30, fill: 'light', lift: true, floor: 0, special: false, assembly: null }))
    const m = computeRental(offers.large!, parseRentalInput({ pickupAt: '2026-06-10T09:00', returnAt: '2026-06-11T09:00', km: 10, cover: false, driver: false, oneWay: false }))
    for (const r of [t, c, computeAssembly(tariffs, { kind: 'standard', lm: 3 })]) expect(JSON.stringify(r)).not.toMatch(/fee|payout|platform/i)
    expect(JSON.stringify(m)).not.toMatch(/fee|payout|platform/i)
    expect(m.totalCents).toBe(12900) // ohne Kaution 700 €
  })
})

describe('Angebotspflicht', () => {
  const base = { service: 'transport', goods: 'normal', crew: 2, vehicles: 1, vehicleType: 'van', hours: 3, fromFloor: 0, toFloor: 0, fromLift: true, toLift: true, boxes: 0, parking: 0, packing: false, assembly: null }
  const vienna: RouteFacts = { region: 'vienna', outsideKm: 0, driveHours: 0 }
  const reasons = (patch: object, route: RouteFacts | null = vienna) => {
    const r = computeTransport(tariffs, parseTransportInput({ ...base, ...patch }), route)
    return r.kind === 'offer' ? r.reasons : []
  }

  it('Route fehlt, international, Spezialgut, Groß-LKW, Einpackservice, weniger Personen als Fahrzeuge', () => {
    expect(reasons({}, null)).toEqual(['route_missing'])
    expect(reasons({}, { region: 'international', outsideKm: 0, driveHours: 0 })).toEqual(['international'])
    expect(reasons({ goods: 'grand' })).toEqual(['special_goods'])
    expect(reasons({ vehicleType: 'large' })).toEqual(['large_truck'])
    expect(reasons({ packing: true })).toEqual(['packing'])
    expect(reasons({ crew: 1, vehicles: 2 })).toEqual(['crew_lt_vehicles'])
    expect(reasons({ goods: 'safe', packing: true, vehicleType: 'large' }, null)).toEqual(['route_missing', 'special_goods', 'large_truck', 'packing'])
  })

  it('Klavier: Preisorientierung 180 € + 24 € je Etage ohne Lift, kein Preis', () => {
    const r = computeTransport(tariffs, parseTransportInput({ ...base, goods: 'piano', fromFloor: 3, fromLift: false, toFloor: 2, toLift: true }), vienna)
    expect(r).toEqual({ kind: 'offer', reasons: ['special_goods'], pianoGuideCents: 18000 + 3 * 2400 })
  })

  it('Entrümpelung: Gewerbe, stark belastet und Sonderfall → Besichtigung ohne Preis', () => {
    const c = { object: 'flat', area: 50, fill: 'normal', lift: true, floor: 0, special: false, assembly: null }
    expect(computeClearance(tariffs, parseClearanceInput({ ...c, object: 'office' }))).toEqual({ kind: 'offer', reasons: ['commercial'] })
    expect(computeClearance(tariffs, parseClearanceInput({ ...c, object: 'heavy', special: true }))).toEqual({ kind: 'offer', reasons: ['heavily_loaded', 'special_case'] })
  })
})

describe('Tarife und Eingaben', () => {
  const base = { service: 'transport', goods: 'normal', crew: 2, vehicles: 1, vehicleType: 'van', hours: 3, fromFloor: 0, toFloor: 0, fromLift: true, toLift: true, boxes: 0, parking: 0, packing: false, assembly: null }
  const vienna: RouteFacts = { region: 'vienna', outsideKm: 0, driveHours: 0 }

  it('fehlender Tarifschlüssel und Geldtarif mit Nachkommastellen werfen', () => {
    const without: Record<string, number> = { ...tariffs }
    delete without.box
    expect(() => computeTransport(without, parseTransportInput({ ...base, boxes: 1 }), vienna)).toThrow('Tarif fehlt: box')
    expect(() => computeTransport({ ...tariffs, box: 360.5 }, parseTransportInput({ ...base, boxes: 1 }), vienna)).toThrow('ganze Cent')
  })

  it('ungültige Routenfakten, Tarife und Preiszeilen werfen statt NaN zu liefern', () => {
    const i = parseTransportInput({ ...base, boxes: 1 })
    for (const bad of [{ region: 'mars' }, { outsideKm: Number.NaN }, { driveHours: -1 }, { outsideKm: Number.POSITIVE_INFINITY }]) {
      expect(() => computeTransport(tariffs, i, { ...vienna, region: 'austria', ...bad } as RouteFacts), JSON.stringify(bad)).toThrow('Routenfakten')
    }
    expect(() => computeTransport({ ...tariffs, box: -360 }, i, vienna)).toThrow('Tarif fehlt')
    expect(() => toLines([['a', Number.NaN]])).toThrow()
    expect(() => toLines([['a', -1]])).toThrow()
    expect(() => splitFee(2 ** 52, rates)).toThrow()
  })

  it('Mietangebot mit ungültigen Werten wirft', () => {
    const input = parseRentalInput({ pickupAt: '2026-06-10T09:00', returnAt: '2026-06-11T09:00', km: 0, cover: false, driver: false, oneWay: false })
    expect(() => computeRental({ ...offers.small!, dailyCents: 79.5 }, input)).toThrow()
    expect(() => computeRental({ ...offers.small!, depositCents: -1 }, input)).toThrow()
  })

  it('parse verwirft unbekannte Schlüssel und prüft Enums, Grenzen und Typen', () => {
    const parsed = parseTransportInput({ ...base, region: 'international', outsideKm: 1, estimate_cents: 1, description: 'x' })
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(base).sort())
    for (const bad of [{ crew: 0 }, { crew: 9 }, { crew: 1.5 }, { vehicles: 4 }, { hours: 0 }, { hours: Number.NaN }, { goods: 'gold' }, { boxes: -1 }, { packing: 'yes' }, { assembly: { kind: 'x', lm: 1 } }]) {
      expect(() => parseTransportInput({ ...base, ...bad }), JSON.stringify(bad)).toThrow(InputError)
    }
    expect(() => parseTransportInput(null)).toThrow(InputError)
    expect(() => parseTransportInput([])).toThrow(InputError)
  })

  it('Miete: Rückgabe nach Abholung, gültiges Datum, höchstens 90 Tage', () => {
    const ok = { pickupAt: '2026-06-10T09:00', returnAt: '2026-06-11T09:00', km: 0, cover: false, driver: false, oneWay: false }
    for (const bad of [{ returnAt: '2026-06-10T09:00' }, { returnAt: '2026-06-09T09:00' }, { returnAt: '2026-02-30T09:00' }, { returnAt: '2026-06-11' }, { returnAt: '2026-09-09T09:01' }, { km: -1 }, { cover: 1 }]) {
      expect(() => parseRentalInput({ ...ok, ...bad }), JSON.stringify(bad)).toThrow(InputError)
    }
    expect(parseRentalInput({ ...ok, returnAt: '2026-09-08T09:00' })).toBeTruthy()
  })

  it('Miete über die Sommerzeitumstellung: 2 Tage, nicht 3', () => {
    const r = computeRental(offers.small!, parseRentalInput({ pickupAt: '2026-10-24T09:00', returnAt: '2026-10-26T09:00', km: 0, cover: false, driver: false, oneWay: false }))
    expect(r.days).toBe(2)
    expect(r.totalCents).toBe(15800)
  })
})
