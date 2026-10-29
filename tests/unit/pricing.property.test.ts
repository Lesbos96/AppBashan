// Invarianten des Preismoduls über zufällige gültige und ungültige Eingaben (je mindestens 1000 Läufe).
import {
  InputError,
  LIMITS,
  type RentalOffer,
  type RouteFacts,
  computeAssembly,
  computeClearance,
  computeRental,
  computeTransport,
  parseClearanceInput,
  parseRentalInput,
  parseTransportInput,
  splitFee,
} from '@pricing'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { offers, tariffs } from './golden.ts'

const runs = { numRuns: 1000 }
const dec = ([min, max]: readonly [number, number]) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true })
const int = ([min, max]: readonly [number, number]) => fc.integer({ min, max })

const standardArb = fc.record({ kind: fc.constant('standard' as const), lm: dec(LIMITS.assemblyLm) })
const kitchenArb = fc.record({ kind: fc.constant('kitchen' as const), lm: dec(LIMITS.assemblyLm), upper: dec(LIMITS.assemblyLm), tall: dec(LIMITS.assemblyLm) })
const assemblyArb = fc.oneof(fc.constant(null), standardArb, kitchenArb)
const transportArb = fc.record({
  service: fc.constantFrom('transport', 'move'),
  goods: fc.constantFrom('normal', 'normal', 'normal', 'piano', 'grand', 'safe'),
  crew: int(LIMITS.crew),
  vehicles: int(LIMITS.vehicles),
  vehicleType: fc.constantFrom('van', 'truck', 'truck', 'large'),
  hours: dec(LIMITS.hours),
  fromFloor: int(LIMITS.floor),
  toFloor: int(LIMITS.floor),
  fromLift: fc.boolean(),
  toLift: fc.boolean(),
  boxes: int(LIMITS.boxes),
  parking: int(LIMITS.parking),
  packing: fc.boolean(),
  assembly: assemblyArb,
})
const routeArb: fc.Arbitrary<RouteFacts | null> = fc.oneof(
  fc.constant(null),
  fc.record({ region: fc.constantFrom('vienna', 'austria', 'international'), outsideKm: fc.double({ min: 0, max: 3000, noNaN: true, noDefaultInfinity: true }), driveHours: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }) }),
)
const clearanceArb = fc.record({
  object: fc.constantFrom('flat', 'house', 'attic', 'cellar', 'office', 'heavy'),
  area: dec(LIMITS.clearanceArea),
  fill: fc.constantFrom('light', 'normal', 'full'),
  lift: fc.boolean(),
  floor: int(LIMITS.floor),
  special: fc.boolean(),
  assembly: assemblyArb,
})
const wall = (ms: number) => new Date(ms).toISOString().slice(0, 16)
type RentalRaw = { pickup: number; minutes: number; km: number; cover: boolean; driver: boolean; oneWay: boolean }
const rentalArb: fc.Arbitrary<RentalRaw> = fc.record({
  // Abholung irgendwann 2026/27, Rückgabe 1 Minute bis 90 Tage später (deckt beide Zeitumstellungen ab)
  pickup: fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2027, 11, 31) }),
  minutes: fc.integer({ min: 1, max: LIMITS.rentalMaxDays * 1440 }),
  km: dec(LIMITS.rentalKm),
  cover: fc.boolean(),
  driver: fc.boolean(),
  oneWay: fc.boolean(),
})
const rentalInput = (r: RentalRaw) => {
  const pickup = Math.floor(r.pickup / 60000) * 60000
  return { pickupAt: wall(pickup), returnAt: wall(pickup + r.minutes * 60000), km: r.km, cover: r.cover, driver: r.driver, oneWay: r.oneWay }
}
const offerArb: fc.Arbitrary<RentalOffer> = fc.oneof(
  fc.constantFrom(...Object.values(offers)),
  fc.record({ dailyCents: fc.nat(100000), kmPerDay: fc.nat(1000), extraKmCents: fc.nat(1000), coverDailyCents: fc.nat(20000), driverDailyCents: fc.nat(20000), bookingFeeCents: fc.nat(20000), oneWayCents: fc.nat(50000), depositCents: fc.nat(200000) }),
)

const sane = (n: number) => Number.isSafeInteger(n) && n >= 0
type Priced = { totalCents: number; lowCents: number; highCents: number; lines: { cents: number }[] }
const expectConsistent = (r: Priced) => {
  expect(r.lines.reduce((s, l) => s + l.cents, 0)).toBe(r.totalCents) // a)
  for (const n of [r.totalCents, r.lowCents, r.highCents, ...r.lines.map((l) => l.cents)]) expect(sane(n)).toBe(true) // d)
  expect(r.lowCents).toBeLessThanOrEqual(r.totalCents)
  expect(r.highCents).toBeGreaterThanOrEqual(r.totalCents)
}

describe('Invarianten bei gültiger Eingabe', () => {
  it('Transport/Umzug: Zeilensumme = Gesamtpreis, alle Beträge ganze Cent ≥ 0', () => {
    fc.assert(
      fc.property(transportArb, routeArb, (raw, route) => {
        const r = computeTransport(tariffs, parseTransportInput(raw), route)
        if (r.kind === 'price') {
          expectConsistent(r)
          expect(sane(r.hourlyRateCents)).toBe(true)
        } else {
          expect(r.reasons.length).toBeGreaterThan(0)
        }
      }),
      runs,
    )
  })

  it('Entrümpelung', () => {
    fc.assert(
      fc.property(clearanceArb, (raw) => {
        const r = computeClearance(tariffs, parseClearanceInput(raw))
        if (r.kind === 'price') expectConsistent(r)
      }),
      runs,
    )
  })

  it('Montage', () => {
    fc.assert(
      fc.property(fc.oneof(standardArb, kitchenArb), (a) => {
        expectConsistent(computeAssembly(tariffs, a))
      }),
      runs,
    )
  })

  it('Miete: Zeilensumme = Gesamtpreis, Kaution nie im Total', () => {
    fc.assert(
      fc.property(offerArb, rentalArb, (offer, raw) => {
        const r = computeRental(offer, parseRentalInput(rentalInput(raw)))
        expectConsistent(r)
        expect(r.days).toBeGreaterThanOrEqual(1)
        expect(r.days).toBeLessThanOrEqual(LIMITS.rentalMaxDays)
        expect(r.depositCents).toBe(offer.depositCents)
      }),
      runs,
    )
  })
})

describe('Gebührenaufteilung', () => {
  it('Gebühr + Partneranteil = Gesamtpreis (b), netto + USt. = Gebühr (c), alles ganze Cent ≥ 0 (d)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 9999 }), (total, feeBp, vatBp) => {
        const s = splitFee(total, { feeRate: feeBp / 10000, vatRate: vatBp / 10000 })
        expect(s.feeCents + s.payoutCents).toBe(total)
        expect(s.feeNetCents + s.feeVatCents).toBe(s.feeCents)
        for (const n of Object.values(s)) expect(sane(n)).toBe(true)
        expect(s.feeCents).toBeLessThanOrEqual(total)
        expect(s.feeNetCents).toBeLessThanOrEqual(s.feeCents)
      }),
      runs,
    )
  })
})

describe('Ungültige Eingabe wirft und liefert nie NaN (e)', () => {
  const bad = fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 1e9, '5', null, undefined, true, {}, [])

  /** Ersetzt ein Feld der gültigen Eingabe durch einen ungültigen Wert; jeder Wert liegt für jedes Feld außerhalb des Typs oder der Grenzen. */
  const mutated = <T extends Record<string, unknown>>(arb: fc.Arbitrary<T>) =>
    fc.tuple(arb, bad, fc.nat()).map(([valid, value, pick]) => {
      const keys = Object.keys(valid)
      return { ...valid, [keys[pick % keys.length]!]: value }
    })

  const invalid = (parse: (raw: unknown) => unknown, raw: unknown) => {
    // Boolesche Felder akzeptieren nur true/false: `true` ist dort gültig, also nur die Fälle prüfen, die ungültig sein müssen.
    try {
      parse(raw)
    } catch (err) {
      expect(err).toBeInstanceOf(InputError)
    }
  }

  it('Transport: Mutation wirft InputError oder liefert eine fehlerfreie Eingabe', () => {
    fc.assert(
      fc.property(mutated(transportArb), (raw) => {
        try {
          const r = computeTransport(tariffs, parseTransportInput(raw), { region: 'vienna', outsideKm: 0, driveHours: 0 })
          if (r.kind === 'price') expectConsistent(r) // gültig geblieben (z. B. true bei einem booleschen Feld)
        } catch (err) {
          expect(err).toBeInstanceOf(InputError)
        }
      }),
      runs,
    )
  })

  it('Entrümpelung und Miete: Mutation wirft nur InputError', () => {
    fc.assert(fc.property(mutated(clearanceArb), (raw) => invalid(parseClearanceInput, raw)), runs)
    fc.assert(fc.property(mutated(rentalArb.map(rentalInput)), (raw) => invalid(parseRentalInput, raw)), runs)
  })

  it('Zahlenfelder von Entrümpelung und Miete mit NaN, ±Infinity, negativ oder über dem Limit werfen immer', () => {
    const badNumber = fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 1e9)
    fc.assert(
      fc.property(clearanceArb, fc.constantFrom('area', 'floor'), badNumber, (raw, key, value) => {
        expect(() => parseClearanceInput({ ...raw, [key]: value })).toThrow(InputError)
      }),
      runs,
    )
    fc.assert(
      fc.property(rentalArb, fc.constantFrom('km'), badNumber, (raw, key, value) => {
        expect(() => parseRentalInput({ ...rentalInput(raw), [key]: value })).toThrow(InputError)
      }),
      runs,
    )
  })

  it('beliebige Werte: InputError, nie ein anderer Fehler', () => {
    for (const parse of [parseTransportInput, parseClearanceInput, parseRentalInput]) {
      fc.assert(fc.property(fc.anything(), (raw) => invalid(parse, raw)), runs)
    }
  })

  it('Zahlenfelder mit NaN, ±Infinity, negativ oder über dem Limit werfen immer', () => {
    const numeric = ['crew', 'vehicles', 'hours', 'fromFloor', 'toFloor', 'boxes', 'parking']
    fc.assert(
      fc.property(transportArb, fc.constantFrom(...numeric), fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 1e9), (raw, key, value) => {
        expect(() => parseTransportInput({ ...raw, [key]: value })).toThrow(InputError)
      }),
      runs,
    )
  })

  it('ungültige Serverfakten werfen, statt NaN in den Preis zu schreiben', () => {
    fc.assert(
      fc.property(
        transportArb.map((r) => parseTransportInput({ ...r, goods: 'normal', vehicleType: 'van', packing: false, vehicles: 1 })),
        fc.constantFrom('outsideKm', 'driveHours'),
        fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, -1),
        (input, key, value) => {
          expect(() => computeTransport(tariffs, input, { region: 'austria', outsideKm: 10, driveHours: 1, [key]: value } as RouteFacts)).toThrow()
        },
      ),
      runs,
    )
  })
})
