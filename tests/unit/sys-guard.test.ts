import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const GUARD = '.claude/hooks/guard.mjs'
function guard(eingabe: unknown, roh?: string) {
  const r = spawnSync(process.execPath, [GUARD], { input: roh ?? JSON.stringify(eingabe), encoding: 'utf8' })
  return { exit: r.status, stderr: r.stderr }
}
const bash = (command: string, tool_name = 'Bash') => guard({ tool_name, tool_input: { command } })
const datei = (file_path: string, agent_type?: string) => guard({ tool_name: 'Write', agent_type, tool_input: { file_path } })

describe('Wächter-Hook guard.mjs: verweigert (Exit 2 mit Grund)', () => {
  it.each([
    'npm run check',
    'npm run check; echo EXIT=$?',
    'cd x && npm run test:rls',
    '& npm run test:e2e',
    'FOO=1 npm run shots',
    'time npm test',
    'npm t',
    'npx vitest run --project unit',
    'vitest run',
    'npx dotenv -e .env.local -- vitest run --project rls',
    'npx playwright test --project=e2e',
  ])('Test am Start-Programm vorbei: %s', (c) => {
    const r = bash(c)
    expect(r.exit).toBe(2)
    expect(r.stderr).toMatch(/npm run t/)
  })
  it.each([
    'npx supabase db push --linked',
    'npx dotenv -e .env.local -- supabase db push --linked --yes',
    'node node_modules/supabase/dist/supabase.js db push',
    'supabase migration repair --status applied 1',
    'npx supabase db reset',
    'supabase db query "delete from public.x" --linked',
    'supabase db query --linked "DROP TABLE x"',
  ])('Datenbank am Gate vorbei: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it.each(['git commit --no-verify -m x', 'git push --no-verify', 'git config core.hooksPath /dev/null', 'python - <<EOF'])('Git-Hooks und Python-stdin: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it.each([
    'echo x > tmp/proof/u1/001-check.log',
    'echo x >> docs/proof/u1/a.log',
    'cat a 1> tmp\\proof\\u1\\b.txt',
    'Set-Content tmp/proof/u1/a.txt x',
    'Out-File docs/proof/u1/a.txt',
    'cp foo tmp/proof/u1/runs.jsonl',
    'Copy-Item foo tmp/proof/u1/003-rls.log',
    'cp foo tmp/proof/u1/db-freigabe-1.md',
    'cp foo tmp/proof/u1-abnahme.md',
    'cp foo tmp/proof/u1/session.json',
  ])('Nachweise fälschen: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it('PowerShell-Werkzeug wird wie Bash geprüft', () => {
    expect(bash('npm run check; "EXIT=$LASTEXITCODE"', 'PowerShell').exit).toBe(2)
  })

  it('Write auf Läufe, Logs, Protokolle und .git', () => {
    for (const p of ['/p/tmp/proof/u1/runs.jsonl', 'C:\\p\\tmp\\proof\\u1\\003-check.log', '/p/tmp/proof/u1/db-antrag-1.json', '/p/tmp/proof/session.json', '/p/tmp/proof/agents.jsonl', '/p/.git/config']) {
      expect(datei(p).exit, p).toBe(2)
      expect(datei(p, 'advisor-report').exit, `${p} (auch advisor-report)`).toBe(2)
    }
  })
  it('Freigabe und Abnahme nur von advisor-report', () => {
    for (const p of ['/p/tmp/proof/u1/db-freigabe-1.md', '/p/tmp/proof/u1-abnahme.md']) {
      expect(datei(p).exit, p).toBe(2)
      expect(datei(p, 'reviewer').exit, `${p} (reviewer)`).toBe(2)
      expect(datei(p, 'advisor-report').exit, `${p} (advisor-report)`).toBe(0)
    }
  })
  it('vorhandene Nachweise in docs/proof sind unveränderlich, neue Pfade nicht betroffen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-'))
    mkdirSync(join(dir, 'docs', 'proof'), { recursive: true })
    const vorhanden = join(dir, 'docs', 'proof', 'a.log')
    writeFileSync(vorhanden, 'x')
    expect(datei(vorhanden).exit).toBe(2)
    expect(datei(join(dir, 'docs', 'proof', 'neu.log')).exit).toBe(0)
  })
})

describe('Wächter-Hook guard.mjs: lässt durch (Exit 0, keine Ausgabe)', () => {
  it.each([
    'npm run t -- check',
    'npm run build',
    'npm run lint',
    'npm run check:deno',
    'npm run db:push',
    'git status',
    'git commit -m "erwähnt npm run check und supabase db push"',
    'grep -c vitest package.json',
    'npx supabase migration list',
    'cp tmp/proof/u1/001-check.log docs/proof/u1/001-check.log',
    'ls tmp/proof/u1',
    'echo ok > tmp/out.txt',
  ])('%s', (c) => {
    const r = bash(c)
    expect(r.exit).toBe(0)
    expect(r.stderr).toBe('')
  })
  it('Dateien außerhalb der Sperrlisten', () => {
    for (const p of ['/p/src/lib/x.ts', '/p/tmp/proof/u1-plan.md', '/p/docs/PROGRESS.md', '/p/tmp/proof/u1/probe.md']) expect(datei(p).exit, p).toBe(0)
  })
  it('Eingabe ohne tool_input wird nicht verweigert', () => {
    expect(guard({ tool_name: 'Read' }).exit).toBe(0)
    expect(guard({}).exit).toBe(0)
  })
})

describe('Wächter-Hook guard.mjs: Absturz sperrt selbst', () => {
  it.each([
    ['leere Eingabe', ''],
    ['kaputtes JSON', '{nicht json'],
  ])('%s → Exit 2 mit „Guard-Fehler“', (_n, roh) => {
    const r = guard(null, roh)
    expect(r.exit).toBe(2)
    expect(r.stderr).toMatch(/Guard-Fehler/)
  })
})
