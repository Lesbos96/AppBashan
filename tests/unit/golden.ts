// Golden-Fälle aus dem Prototyp (tests/unit/fixtures/prototype-golden.json). Läuft unter Vitest (pricing.test.ts) und
// unter Deno (golden-deno.ts): Beide vergleichen `actual()` des Moduls mit `expected` aus dem Prototyp.
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
} from '../../supabase/functions/_shared/pricing/index.ts'

// Tarife aus dem Seed: dieselben Werte wie in price_config, ein Schlüssel-Tippfehler im Modul fällt hier auf.
const seed = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8')
export const tariffs: Tariffs = Object.fromEntries([...seed.matchAll(/\(1, '([\w.]+)', ([\d.]+),/g)].map((m) => [m[1]!, Number(m[2])]))
export const rates = { feeRate: 0.15, vatRate: 0.2 }

// sampleOffers (Prototyp Zeile 26) in Cent, wie im Seed.
export const offers: Record<string, RentalOffer> = {
  small: { dailyCents: 7900, kmPerDay: 100, extraKmCents: 35, coverDailyCents: 1900, driverDailyCents: 900, bookingFeeCents: 0, oneWayCents: 4900, depositCents: 30000 },
  medium: { dailyCents: 9900, kmPerDay: 150, extraKmCents: 40, coverDailyCents: 2400, driverDailyCents: 1000, bookingFeeCents: 1000, oneWayCents: 5900, depositCents: 50000 },
  large: { dailyCents: 12900, kmPerDay: 200, extraKmCents: 45, coverDailyCents: 2900, driverDailyCents: 1200, bookingFeeCents: 0, oneWayCents: 7900, depositCents: 70000 },
}

type S = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- Prototyp-state
const assemblyOf = (s: S) => (s.mount ? (s.kind === 'kitchen' ? { kind: 'kitchen' as const, lm: s.lm, upper: s.upper, tall: s.tall } : { kind: 'standard' as const, lm: s.lm }) : null)
const routeOf = (s: S): RouteFacts | null => (s.route === null ? null : { region: s.moveRegion, outsideKm: s.outsideKm, driveHours: s.driveHours })
export const transportOf = (s: S) =>
  parseTransportInput({ service: s.service, goods: s.goods, crew: s.crew, vehicles: s.vehicles, vehicleType: s.vehicleType, hours: s.hours, fromFloor: s.fromFloor, toFloor: s.toFloor, fromLift: s.fromLift, toLift: s.toLift, boxes: s.boxes, parking: s.parking, packing: s.packing, assembly: assemblyOf(s) })
const clearanceOf = (s: S) =>
  parseClearanceInput({ object: s.object, area: s.area, fill: s.fill, lift: s.lift, floor: s.floor, special: !!s.special, assembly: assemblyOf(s) })
const rentalOf = (s: S) => {
  const pickupAt = s.date ? `${s.date}T${s.pickTime}` : '2026-06-10T09:00'
  const returnAt = s.date ? `${s.returnDate}T${s.returnTime}` : new Date(Date.UTC(2026, 5, 10 + s.days, 9)).toISOString().slice(0, 16)
  return { pickupAt, returnAt, km: s.km, cover: !!s.cover, driver: !!s.driver, oneWay: s.returnStation === 'other' }
}
const cents = (euro: number) => Math.round(euro * 100)

// Echte Halb-Cent-Fälle: der Prototyp rundet per Float (11150 × 0,15 = 1672,5 → 1672), das Modul half-up (siehe PRICING.md).
const halfCent: Record<number, ReturnType<typeof splitFee>> = {
  11150: { totalCents: 11150, feeCents: 1673, feeNetCents: 1394, feeVatCents: 279, payoutCents: 9477 },
}
const protoFee = (e: S, totalCents: number) =>
  halfCent[totalCents] ?? { totalCents, feeCents: cents(e.fee), feeNetCents: cents(e.feeNet), feeVatCents: cents(e.feeVat), payoutCents: cents(e.partner) }

/** Sortierte Schlüssel, damit JSON.stringify (Deno-Lauf) beider Seiten unabhängig von der Literal-Reihenfolge vergleichbar ist. */
const pack = (p: { kind: string; totalCents?: number; lowCents?: number; highCents?: number; lineSum?: number; volumeM3?: number; days?: number; depositCents?: number; fee?: unknown; error?: string }) =>
  Object.fromEntries(Object.entries(p).sort(([a], [b]) => a.localeCompare(b)))

type Golden = { name: string; state: S; expected: S }
const golden = JSON.parse(readFileSync(new URL('./fixtures/prototype-golden.json', import.meta.url), 'utf8')) as Golden[]

export type GoldenCase = { name: string; actual: () => unknown; expected: unknown }

export function goldenCases(): GoldenCase[] {
  return golden.map(({ name, state: s, expected: e }): GoldenCase => {
    if (s.service === 'rent') {
      const input = rentalOf(s)
      if (input.returnAt <= input.pickupAt) {
        // Prototyp rechnet mit mindestens 1 Tag; das Modul lehnt eine Rückgabe vor der Abholung ab.
        return {
          name,
          expected: pack({ kind: 'error', error: 'InputError' }),
          actual: () => {
            try {
              parseRentalInput(input)
              return pack({ kind: 'no error' })
            } catch (err) {
              return pack({ kind: 'error', error: err instanceof InputError ? 'InputError' : String(err) })
            }
          },
        }
      }
      return {
        name,
        expected: pack({ kind: 'price', totalCents: cents(e.total), lineSum: cents(e.total), days: e.days, depositCents: cents(e.deposit), fee: protoFee(e, cents(e.total)) }),
        actual: () => {
          const r = computeRental(offers[s.van]!, parseRentalInput(input))
          return pack({ kind: r.kind, totalCents: r.totalCents, lineSum: r.lines.reduce((sum, l) => sum + l.cents, 0), days: r.days, depositCents: r.depositCents, fee: splitFee(r.totalCents, rates) })
        },
      }
    }
    const compute = () =>
      s.service === 'assembly' ? computeAssembly(tariffs, assemblyOf({ ...s, mount: true })!) : s.service === 'clear' ? computeClearance(tariffs, clearanceOf(s)) : computeTransport(tariffs, transportOf(s), routeOf(s))
    if (e.needsVisit || e.needsQuote) {
      return { name, expected: pack({ kind: 'offer' }), actual: () => pack({ kind: compute().kind }) }
    }
    return {
      name,
      expected: pack({ kind: 'price', totalCents: cents(e.total), lowCents: cents(e.low), highCents: cents(e.high), lineSum: cents(e.total), volumeM3: s.service === 'clear' ? e.volume : undefined, fee: protoFee(e, cents(e.total)) }),
      actual: () => {
        const r = compute()
        if (r.kind !== 'price') return pack({ kind: r.kind })
        return pack({ kind: r.kind, totalCents: r.totalCents, lowCents: r.lowCents, highCents: r.highCents, lineSum: r.lines.reduce((sum, l) => sum + l.cents, 0), volumeM3: s.service === 'clear' ? (r as { volumeM3: number }).volumeM3 : undefined, fee: splitFee(r.totalCents, rates) })
      },
    }
  })
}
