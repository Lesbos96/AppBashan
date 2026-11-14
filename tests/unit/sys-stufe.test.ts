import { describe, expect, it } from 'vitest'
import { stufeAus } from '../../scripts/sys/stufe.mjs'

describe('Risikostufe aus Pfaden (Arbeitssystem)', () => {
  it.each([
    [['docs/PROGRESS.md', 'docs/ROADMAP.md'], 'R0'],
    [['src/screens/Start.tsx', 'tests/e2e/start.spec.ts'], 'R1'],
    [['src/lib/draft.ts', 'tests/unit/draft.test.ts', 'scripts/golive-check.mjs'], 'R2'],
    [['supabase/migrations/20261114100000_x.sql'], 'R3'],
    [['src/lib/money.ts'], 'R3'],
    [['tests/rls/a.test.ts'], 'R3'],
    [['scripts/sys/run.mjs'], 'R3'],
    [['.githooks/pre-push'], 'R3'],
    [['tests/unit/sys-guard.test.ts'], 'R3'],
    [['CLAUDE.md'], 'R3'],
    [['package.json'], 'R3'],
    [['docs/reference/design/tokens.json'], 'R1'],
    [['public/icon.svg'], 'R2'],
  ])('%j → %s', (pfade, soll) => {
    expect(stufeAus(pfade)).toBe(soll)
  })

  it('R3-Pfade schlagen die Markdown-Regel (.md unter .claude oder supabase ist nicht R0)', () => {
    expect(stufeAus(['.claude/agents/advisor.md'])).toBe('R3')
    expect(stufeAus(['supabase/functions/README.md'])).toBe('R3')
  })

  it('die höchste Stufe gewinnt, unbekannte Pfade zählen als R3', () => {
    expect(stufeAus(['docs/a.md', 'src/screens/A.tsx', 'src/lib/draft.ts'])).toBe('R2')
    expect(stufeAus(['docs/a.md', 'etwas/Unbekanntes.xyz'])).toBe('R3')
  })

  it('Backslash-Pfade (Windows) werden wie Schrägstriche behandelt', () => {
    expect(stufeAus(['supabase\\migrations\\x.sql'])).toBe('R3')
  })
})
