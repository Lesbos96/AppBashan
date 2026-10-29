// Möbeltransport und Umzug (transportRate, transportNeedsQuote, transportCalc im Prototyp, Zeilen 98–100).
import { type AssemblyInput, assemblyPrice, parseAssembly } from './assembly.ts'
import { bool, dec, int, oneOf, rec } from './input.ts'
import { LIMITS } from './limits.ts'
import { type Tariffs, money, num, toCents, toLines } from './money.ts'
import type { OfferReason, OfferResult, PriceResult } from './result.ts'

export type TransportInput = {
  service: 'transport' | 'move'
  goods: 'normal' | 'piano' | 'grand' | 'safe'
  crew: number
  vehicles: number
  vehicleType: 'van' | 'truck' | 'large'
  hours: number
  fromFloor: number
  toFloor: number
  fromLift: boolean
  toLift: boolean
  boxes: number
  parking: number
  packing: boolean
  assembly: AssemblyInput | null
}

/** Fakten aus der Edge Function `route`, nie vom Client. `null` = Route noch nicht berechnet. */
export type RouteFacts = { region: 'vienna' | 'austria' | 'international'; outsideKm: number; driveHours: number }

export function parseTransportInput(raw: unknown): TransportInput {
  const r = rec(raw, 'Transport')
  return {
    service: oneOf(r, 'service', ['transport', 'move']),
    goods: oneOf(r, 'goods', ['normal', 'piano', 'grand', 'safe']),
    crew: int(r, 'crew', ...LIMITS.crew),
    vehicles: int(r, 'vehicles', ...LIMITS.vehicles),
    vehicleType: oneOf(r, 'vehicleType', ['van', 'truck', 'large']),
    hours: dec(r, 'hours', ...LIMITS.hours),
    fromFloor: int(r, 'fromFloor', ...LIMITS.floor),
    toFloor: int(r, 'toFloor', ...LIMITS.floor),
    fromLift: bool(r, 'fromLift'),
    toLift: bool(r, 'toLift'),
    boxes: int(r, 'boxes', ...LIMITS.boxes),
    parking: int(r, 'parking', ...LIMITS.parking),
    packing: bool(r, 'packing'),
    assembly: r['assembly'] === null ? null : parseAssembly(r['assembly']),
  }
}

/** Stundensatz in Euro für Team und Fahrzeuge. */
function hourlyRate(t: Tariffs, crew: number, vehicles: number): number {
  const team = crew <= 4 ? money(t, `team_rate.${crew}`) : money(t, 'team_rate.4') + (crew - 4) * money(t, 'team_rate.extra_person')
  return team + Math.max(0, vehicles - 1) * money(t, 'extra_vehicle_rate')
}

export function transportOfferReasons(i: TransportInput, route: RouteFacts | null): OfferReason[] {
  const reasons: OfferReason[] = []
  if (!route) reasons.push('route_missing')
  if (i.crew < i.vehicles) reasons.push('crew_lt_vehicles')
  if (i.goods !== 'normal') reasons.push('special_goods')
  if (i.vehicleType === 'large') reasons.push('large_truck')
  if (i.packing) reasons.push('packing')
  if (route?.region === 'international') reasons.push('international')
  return reasons
}

export type TransportPrice = PriceResult<'team' | 'travel' | 'mileage' | 'assembly' | 'boxes' | 'parking'> & {
  /** Stundensatz inkl. Zusatzfahrzeuge (für „5 h × 70,80 €"). */
  hourlyRateCents: number
  /** Abgerechnete Stunden (Mindestdauer berücksichtigt). */
  billedHours: number
}

/** Serverfakten sind kein Kundenwert; ungültige Werte sind ein Programmfehler und werfen `Error`. */
function assertRouteFacts(r: RouteFacts): void {
  const ok = (v: number) => Number.isFinite(v) && v >= 0
  if (!['vienna', 'austria', 'international'].includes(r.region) || !ok(r.outsideKm) || !ok(r.driveHours)) throw new Error('Ungültige Routenfakten')
}

export function computeTransport(t: Tariffs, i: TransportInput, route: RouteFacts | null): TransportPrice | OfferResult {
  if (route) assertRouteFacts(route)
  const reasons = transportOfferReasons(i, route)
  if (reasons.length > 0 || !route) {
    const offer: OfferResult = { kind: 'offer', reasons }
    if (i.goods === 'piano') {
      const floors = (i.fromLift ? 0 : i.fromFloor) + (i.toLift ? 0 : i.toFloor)
      offer.pianoGuideCents = toCents(money(t, 'piano.vienna_base') + floors * money(t, 'piano.per_floor'))
    }
    return offer
  }
  const rate = hourlyRate(t, i.crew, i.vehicles)
  const billedHours = Math.max(num(t, i.service === 'move' ? 'min_hours.move' : 'min_hours.transport'), i.hours)
  const away = route.region === 'austria'
  const { lines, totalCents } = toLines([
    ['team', billedHours * rate],
    ['travel', away ? route.driveHours * rate : 0],
    ['mileage', away ? route.outsideKm * money(t, 'outside_km_rate') * i.vehicles : 0],
    ['assembly', assemblyPrice(t, i.assembly)],
    ['boxes', i.boxes * money(t, 'box')],
    ['parking', i.parking * money(t, 'parking_zone')],
  ])
  return { kind: 'price', totalCents, lowCents: totalCents, highCents: totalCents, lines, hourlyRateCents: toCents(rate), billedHours }
}
