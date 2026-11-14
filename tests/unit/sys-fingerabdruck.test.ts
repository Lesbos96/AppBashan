import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const MODUL = pathToFileURL(resolve('scripts/sys/fingerabdruck.mjs')).href

describe('Fingerabdruck je Suite (in einem Wegwerf-Repo)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fp-'))
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' })
  const fp = (suite: string) =>
    execFileSync(process.execPath, ['--input-type=module', '-e', `import { fingerabdruck } from ${JSON.stringify(MODUL)}; console.log(fingerabdruck(${JSON.stringify(suite)}))`], { cwd: dir, encoding: 'utf8' }).trim()
  const schreibe = (pfad: string, inhalt: string) => {
    mkdirSync(join(dir, pfad, '..'), { recursive: true })
    writeFileSync(join(dir, pfad), inhalt)
    git('add', '-A')
  }
  git('init', '-q')
  git('config', 'user.email', 't@t')
  git('config', 'user.name', 't')
  const start: Record<string, string> = { 'src/a.ts': '1', 'tests/rls/r.test.ts': '1', 'supabase/migrations/1_x.sql': '1', 'docs/x.md': '1', 'package.json': '{}', 'CLAUDE.md': '1' }
  for (const [p, i] of Object.entries(start)) schreibe(p, i)

  it('Doku-Änderungen ändern keinen Fingerabdruck (check ist „alles außer docs und Markdown“)', () => {
    const vorher = ['check', 'rls', 'e2e'].map(fp)
    schreibe('docs/x.md', '2')
    schreibe('CLAUDE.md', '2')
    expect(['check', 'rls', 'e2e'].map(fp)).toEqual(vorher)
  })
  it('Änderung unter src ändert check und e2e, nicht rls', () => {
    const v = { check: fp('check'), rls: fp('rls'), e2e: fp('e2e') }
    schreibe('src/a.ts', '2')
    expect(fp('check')).not.toBe(v.check)
    expect(fp('e2e')).not.toBe(v.e2e)
    expect(fp('rls')).toBe(v.rls)
  })
  it('Änderung an einer Migration ändert check und rls, nicht e2e', () => {
    const v = { check: fp('check'), rls: fp('rls'), e2e: fp('e2e') }
    schreibe('supabase/migrations/1_x.sql', '2')
    expect(fp('check')).not.toBe(v.check)
    expect(fp('rls')).not.toBe(v.rls)
    expect(fp('e2e')).toBe(v.e2e)
  })
  it('gleicher Stand, gleicher Hash; package.json zählt für alle drei', () => {
    expect(fp('check')).toBe(fp('check'))
    const v = ['check', 'rls', 'e2e'].map(fp)
    schreibe('package.json', '{"a":1}')
    expect(['check', 'rls', 'e2e'].map(fp).every((h, i) => h !== v[i])).toBe(true)
  })
})
