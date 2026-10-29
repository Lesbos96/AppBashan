// Transportermiete (rentCalc im Prototyp, Zeile 40). Kaution und Kraftstoff sind nie Teil des Gesamtpreises.
import { InputError, bool, dec, rec } from './input.ts'
import { toLines } from './money.ts'
import type { PriceResult } from './result.ts'

/** Mietangebot aus `rental_offers` (Server lädt es per id, Status approved); Geldwerte in Cent. */
export type RentalOffer = {
  dailyCents: number
  kmPerDay: number
  extraKmCents: number
  coverDailyCents: number
  driverDailyCents: number
  bookingFeeCents: number
  oneWayCents: number
  depositCents: number
}

export type RentalInput = {
  /** Wanduhrzeit `YYYY-MM-DDTHH:mm`, ohne Zeitzone (Sommerzeit spielt keine Rolle). */
  pickupAt: string
  returnAt: string
  km: number
  cover: boolean
  driver: boolean
  oneWay: boolean
}

const MAX_DAYS = 90
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

function minutesOf(s: unknown, key: string): number {
  const m = typeof s === 'string' ? WALL_CLOCK.exec(s) : null
  if (!m) throw new InputError(`${key}: Format YYYY-MM-DDTHH:mm erwartet`)
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number]
  const ms = Date.UTC(y, mo - 1, d, h, mi)
  const back = new Date(ms)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || back.getUTCHours() !== h) {
    throw new InputError(`${key}: kein gültiges Datum`)
  }
  return ms / 60000
}

export function parseRentalInput(raw: unknown): RentalInput {
  const r = rec(raw, 'Miete')
  const input: RentalInput = {
    pickupAt: r['pickupAt'] as string,
    returnAt: r['returnAt'] as string,
    km: dec(r, 'km', 0, 10000),
    cover: bool(r, 'cover'),
    driver: bool(r, 'driver'),
    oneWay: bool(r, 'oneWay'),
  }
  rentalDays(input)
  return input
}

/** Angebrochene Tage zählen voll, mindestens ein Tag. */
export function rentalDays({ pickupAt, returnAt }: Pick<RentalInput, 'pickupAt' | 'returnAt'>): number {
  const minutes = minutesOf(returnAt, 'returnAt') - minutesOf(pickupAt, 'pickupAt')
  if (minutes <= 0) throw new InputError('Rückgabe muss nach der Abholung liegen')
  const days = Math.ceil(minutes / 1440)
  if (days > MAX_DAYS) throw new InputError(`Mietdauer höchstens ${MAX_DAYS} Tage`)
  return days
}

export type RentalPrice = PriceResult<'rental' | 'extra_km' | 'cover' | 'driver' | 'one_way' | 'booking'> & {
  days: number
  includedKm: number
  /** Kaution: separat, nicht im Gesamtpreis. */
  depositCents: number
}

export function computeRental(o: RentalOffer, i: RentalInput): RentalPrice {
  for (const [k, v] of Object.entries(o)) if (!Number.isInteger(v) || v < 0) throw new Error(`Mietangebot ungültig: ${k}`)
  const days = rentalDays(i)
  const includedKm = days * o.kmPerDay
  const { lines, totalCents } = toLines([
    ['rental', (o.dailyCents / 100) * days],
    ['extra_km', Math.max(0, i.km - includedKm) * (o.extraKmCents / 100)],
    ['cover', i.cover ? (o.coverDailyCents / 100) * days : 0],
    ['driver', i.driver ? (o.driverDailyCents / 100) * days : 0],
    ['one_way', i.oneWay ? o.oneWayCents / 100 : 0],
    ['booking', o.bookingFeeCents / 100],
  ])
  return { kind: 'price', totalCents, lowCents: totalCents, highCents: totalCents, lines, days, includedKm, depositCents: o.depositCents }
}
