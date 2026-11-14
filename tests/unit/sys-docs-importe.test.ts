import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DOCS_IMPORTE } from '../../scripts/sys/fingerabdruck.mjs'
import { MUSS_ABNAHME } from '../../scripts/sys/fertig.mjs'

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? dateien(p) : /\.(ts|tsx|mjs)$/.test(n) ? [p] : []
  })
}

describe('Importe aus docs/ gehören in den Fingerabdruck', () => {
  it('jeder Import aus docs/ in src/ und tests/ steht in DOCS_IMPORTE (sonst ändert die Datei die App, aber keinen Fingerabdruck)', () => {
    const funde = new Set<string>()
    for (const f of [...dateien('src'), ...dateien('tests')]) {
      for (const m of readFileSync(f, 'utf8').matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]*docs\/[^'"]+)['"]/g)) {
        funde.add((m[1] ?? '').replace(/^(\.\.\/)+/, ''))
      }
    }
    for (const f of funde) expect(DOCS_IMPORTE, `${f} fehlt in DOCS_IMPORTE (scripts/sys/fingerabdruck.mjs)`).toContain(f)
  })
})

describe('Mindestmenge der Abnahme', () => {
  it.each(['scripts/sys/run.mjs', '.claude/hooks/guard.mjs', '.claude/settings.json', '.githooks/pre-push', 'package.json', 'supabase/functions/quote/index.ts', 'src/lib/money.ts'])('%s muss genannt werden', (p) => {
    expect(MUSS_ABNAHME.test(p)).toBe(true)
  })
  it.each(['scripts/sys/fixtures/rot.mjs', 'scripts/sys/fertig.d.mts', 'src/screens/Start.tsx', 'docs/x.md'])('%s nicht', (p) => {
    expect(MUSS_ABNAHME.test(p)).toBe(false)
  })
})
