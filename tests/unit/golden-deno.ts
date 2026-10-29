// Golden-Fälle unter Deno (Laufzeit der Edge Functions): `npm run check:deno`.
import process from 'node:process'
import { goldenCases } from './golden.ts'

const cases = goldenCases()
let failed = 0
for (const c of cases) {
  const actual = JSON.stringify(c.actual())
  const expected = JSON.stringify(c.expected)
  if (actual !== expected) {
    failed++
    console.error(`FAIL ${c.name}\n  erwartet ${expected}\n  erhalten ${actual}`)
  }
}
console.log(`Deno: ${cases.length - failed}/${cases.length} Golden-Fälle bestanden`)
if (failed > 0 || cases.length < 40) process.exit(1)
