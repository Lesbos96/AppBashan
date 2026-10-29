// formatEuro unter Deno (Laufzeit der Edge Functions, z. B. Rechnungen): `npm run check:deno`.
import process from 'node:process'
import { formatEuro } from '../../src/lib/money.ts'
import { moneyCases } from './money-cases.ts'

let failed = 0
for (const [cents, expected] of moneyCases) {
  const actual = formatEuro(cents)
  if (actual !== expected) {
    failed++
    console.error(`FAIL ${cents}\n  erwartet ${JSON.stringify(expected)}\n  erhalten ${JSON.stringify(actual)}`)
  }
}
console.log(`Deno: ${moneyCases.length - failed}/${moneyCases.length} Betragsfälle bestanden`)
if (failed > 0) process.exit(1)
