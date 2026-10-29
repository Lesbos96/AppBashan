// Montage / Demontage (mountPrice im Prototyp, Zeile 32) und der Service „Montage".
import { type Raw, dec, oneOf, rec } from './input.ts'
import { type Tariffs, money, num, toLines } from './money.ts'
import type { PriceResult } from './result.ts'

export type AssemblyInput =
  | { kind: 'standard'; lm: number }
  | { kind: 'kitchen'; lm: number; upper: number; tall: number }

export function parseAssembly(raw: unknown): AssemblyInput {
  const r: Raw = rec(raw, 'Montage')
  const kind = oneOf(r, 'kind', ['standard', 'kitchen'])
  const lm = dec(r, 'lm', 0, 50)
  return kind === 'standard' ? { kind, lm } : { kind, lm, upper: dec(r, 'upper', 0, 50), tall: dec(r, 'tall', 0, 50) }
}

/** Montagepreis in Euro, ungerundet. */
export function assemblyPrice(t: Tariffs, a: AssemblyInput | null): number {
  if (!a) return 0
  if (a.kind === 'standard') return Math.max(num(t, 'assembly.min_lfm'), a.lm) * money(t, 'assembly.rate_per_lfm')
  return money(t, 'kitchen.base') + a.lm * money(t, 'kitchen.lower_per_lfm') + a.upper * money(t, 'kitchen.upper_per_lfm') + a.tall * money(t, 'kitchen.tall_per_lfm')
}

/** Service „Montage" allein. */
export function computeAssembly(t: Tariffs, a: AssemblyInput): PriceResult<'assembly'> {
  const price = assemblyPrice(t, a)
  const { lines, totalCents } = toLines([['assembly', price]])
  return { kind: 'price', totalCents, lowCents: totalCents, highCents: totalCents, lines }
}
