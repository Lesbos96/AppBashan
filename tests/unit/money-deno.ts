// formatEuro unter Deno (Laufzeit der Edge Functions, z. B. Rechnungen): `npm run check:deno`.
import process from 'node:process'
import { formatEuro, formatEuroRounded } from '../../src/lib/money.ts'
import { moneyCases, roundedCases } from './money-cases.ts'

const total = moneyCases.length + roundedCases.length
let failed = 0
for (const [cents, expected, format] of [...moneyCases.map(([c, e]) => [c, e, formatEuro] as const), ...roundedCases.map(([c, e]) => [c, e, formatEuroRounded] as const)]) {
  const actual = format(cents)
  if (actual !== expected) {
    failed++
    console.error(`FAIL ${cents}\n  erwartet ${JSON.stringify(expected)}\n  erhalten ${JSON.stringify(actual)}`)
  }
}
console.log(`Deno: ${total - failed}/${total} Betragsfälle bestanden`)
if (failed > 0) process.exit(1)
