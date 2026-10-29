// Entrümpelung (calc im Prototyp, Zeile 38; needsVisit Zeile 70; clearVolume Zeile 71).
import { type AssemblyInput, assemblyPrice, parseAssembly } from './assembly.ts'
import { bool, dec, int, oneOf, rec } from './input.ts'
import { LIMITS } from './limits.ts'
import { type Tariffs, money, num, toCents, toLines } from './money.ts'
import type { OfferReason, OfferResult, PriceResult } from './result.ts'

export type ClearanceInput = {
  object: 'flat' | 'house' | 'attic' | 'cellar' | 'office' | 'heavy'
  area: number
  fill: 'light' | 'normal' | 'full'
  lift: boolean
  floor: number
  /** Sonderfall (Gefahrstoffe, Messie o. Ä.) → Besichtigung. */
  special: boolean
  assembly: AssemblyInput | null
}

export function parseClearanceInput(raw: unknown): ClearanceInput {
  const r = rec(raw, 'Entrümpelung')
  return {
    object: oneOf(r, 'object', ['flat', 'house', 'attic', 'cellar', 'office', 'heavy']),
    area: dec(r, 'area', ...LIMITS.clearanceArea),
    fill: oneOf(r, 'fill', ['light', 'normal', 'full']),
    lift: bool(r, 'lift'),
    floor: int(r, 'floor', ...LIMITS.floor),
    special: bool(r, 'special'),
    assembly: r['assembly'] === null ? null : parseAssembly(r['assembly']),
  }
}

export function clearanceOfferReasons(i: ClearanceInput): OfferReason[] {
  const reasons: OfferReason[] = []
  if (i.object === 'office') reasons.push('commercial')
  if (i.object === 'heavy') reasons.push('heavily_loaded')
  if (i.special) reasons.push('special_case')
  return reasons
}

export type ClearancePrice = PriceResult<'clearance' | 'access' | 'assembly'> & {
  /** Geschätztes Räumgut in m³ (Planannahme, keine Messung). */
  volumeM3: number
}

export function computeClearance(t: Tariffs, i: ClearanceInput): ClearancePrice | OfferResult {
  const reasons = clearanceOfferReasons(i)
  if (reasons.length > 0) return { kind: 'offer', reasons }
  const volume = Math.round(i.area * num(t, `clearance.volume_factor.${i.fill}`) * 10) / 10
  const minimum = money(t, 'clearance.minimum')
  const access = i.lift ? 0 : Math.max(0, i.floor - 1) * money(t, 'clearance.floor_surcharge')
  const assembly = assemblyPrice(t, i.assembly)
  const { lines, totalCents } = toLines([
    ['clearance', Math.max(minimum, volume * money(t, 'clearance.rate'))],
    ['access', access],
    ['assembly', assembly],
  ])
  const lowCents = toCents(Math.max(minimum, volume * money(t, 'clearance.rate_low')) + access + assembly)
  const highCents = toCents(Math.max(minimum, volume * money(t, 'clearance.rate_high')) + access + assembly)
  if (lowCents > totalCents || highCents < totalCents) throw new Error('Tarife: rate_low ≤ rate ≤ rate_high verletzt')
  return { kind: 'price', totalCents, lowCents, highCents, lines, volumeM3: volume }
}
