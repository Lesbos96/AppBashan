// Deploy aus der Kopie (H-B, M-B): kein Schreibzugriff im Repository, cwd = Kopie, Ref aus der Konstante, config.toml Pflicht.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEV_REF } from '../../scripts/dev-ref.mjs'
import { createDeployer, realDeployDeps } from '../../scripts/redproof-deploy.mjs'

const REPO = resolve('/repo')
const TMP = resolve('/tmp-root')
function fake(opts: { files?: Record<string, string>; devFiles?: Record<string, string>; inRepo?: boolean } = {}) {
  const files = opts.files ?? { 'supabase/functions/_shared/quote/handler.ts': 'a\r\nif (x) throw\r\n', 'supabase/config.toml': 'verify_jwt = false\n' }
  const writes: string[] = []
  const runs: { args: string[]; cwd: string }[] = []
  const fs = new Map<string, string>()
  const d: any = {
    repoRoot: REPO, tmpRoot: TMP,
    run: (args: string[], { cwd }: { cwd: string }) => {
      runs.push({ args, cwd })
      if (args[1] === 'download') for (const [p, t] of Object.entries(opts.devFiles ?? {})) fs.set(join(cwd, p), t)
      return ''
    },
    gitList: () => Object.keys(files),
    gitShow: (_c: string, p: string) => { if (!(p in files)) throw new Error('nicht da'); return Buffer.from(files[p]!) },
    mkdtemp: (prefix: string) => join(opts.inRepo ? REPO : TMP, `${prefix}1`),
    write: (p: string, buf: Buffer) => { writes.push(p); fs.set(p, buf.toString()) },
    read: (p: string) => Buffer.from(fs.get(p) ?? ''), exists: (p: string) => fs.has(p) || [...fs.keys()].some((k) => k.startsWith(`${p}/`) || k.startsWith(`${p}\\`)),
    list: (dir: string) => [...fs.keys()].filter((k) => k.startsWith(dir)), rm: () => {},
  }
  return { d, writes, runs, fs }
}

describe('createDeployer', () => {
  it('Kopie nur aus git show, gelockert durch Textersatz, kein Schreibzugriff im Repository', () => {
    const t = fake()
    const dir = createDeployer(t.d).exportCommit('abc', { file: 'supabase/functions/_shared/quote/handler.ts', from: 'if (x) throw', to: 'if (false) throw' })
    expect(t.writes.every((p) => p.startsWith(TMP))).toBe(true)
    expect(t.writes.some((p) => p.includes(join('supabase', '.temp')))).toBe(false)
    expect(t.fs.get(join(dir, 'supabase/functions/_shared/quote/handler.ts'))).toContain('if (false) throw')
    expect(t.fs.has(join(dir, 'supabase/config.toml'))).toBe(true)
  })
  it('Deploy: cwd = Kopie, --project-ref = DEV_REF, Function quote, ohne Docker (--use-api)', () => {
    const t = fake()
    const dep = createDeployer(t.d)
    dep.deploy(dep.exportCommit('abc'))
    expect(t.runs[0]!.args).toEqual(['functions', 'deploy', 'quote', '--use-api', '--project-ref', DEV_REF])
    expect(t.runs[0]!.cwd.startsWith(TMP)).toBe(true)
  })
  it('Kopie im Repository oder ohne config.toml → Fehler vor dem Deploy', () => {
    expect(() => createDeployer(fake({ inRepo: true }).d).exportCommit('abc')).toThrow(/Repository/)
    expect(() => createDeployer(fake({ files: { 'supabase/functions/x.ts': 'x' } }).d).exportCommit('abc')).toThrow(/config\.toml/)
    const t = fake({ inRepo: true })
    expect(() => createDeployer(t.d).deploy(join(REPO, 'x'))).toThrow(/Repository/)
    expect(t.runs).toHaveLength(0)
  })
  it('Muster fehlt → Fehler, nichts geschrieben als Kopie ohne Änderung', () => {
    expect(() => createDeployer(fake().d).exportCommit('abc', { file: 'supabase/functions/_shared/quote/handler.ts', from: 'nicht da', to: 'x' })).toThrow(/Muster nicht gefunden/)
  })
  it('Download nur in ein Verzeichnis außerhalb des Repositories; Vergleich ohne CR-Unterschiede', () => {
    const same = fake({ devFiles: { 'supabase/functions/_shared/quote/handler.ts': 'a\nif (x) throw\n' } })
    const ok = createDeployer(same.d).matches('abc')
    expect(ok).toMatchObject({ same: true, files: 1 })
    expect(same.runs[0]!.args).toEqual(['functions', 'download', 'quote', '--use-api', '--project-ref', DEV_REF])
    expect(same.runs[0]!.cwd.startsWith(TMP)).toBe(true)
    const other = fake({ devFiles: { 'supabase/functions/_shared/quote/handler.ts': 'a\nif (false) throw\n' } })
    expect(createDeployer(other.d).matches('abc')).toMatchObject({ same: false, diff: ['_shared/quote/handler.ts: abweichend'] })
    expect(() => createDeployer(fake({ inRepo: true }).d).download()).toThrow(/Repository/)
  })
  it('Etappe 3: jede Datei, auf die config.toml per content_path verweist, kommt in die Kopie (sonst scheitert der Deploy mit ENOENT)', () => {
    const list = realDeployDeps().gitList('HEAD')
    const toml = execFileSync('git', ['show', 'HEAD:supabase/config.toml'], { encoding: 'utf8' })
    const refs = [...toml.matchAll(/^content_path\s*=\s*"\.\/(.+)"/gm)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    for (const r of refs) expect(list).toContain(r)
  })
  it('Einstellungen: ACTIVE und verify_jwt wie config.toml des Commits (nur lesend: functions list)', () => {
    const toml = '[functions.route]\nverify_jwt = true\n\n[functions.quote]\n# verify_jwt = true\nverify_jwt = false\n\n[functions.photo-cleanup]\nverify_jwt = true\n'
    const mk = (list: unknown, config = toml) => {
      const t = fake({ files: { 'supabase/config.toml': config } })
      const run = t.d.run
      t.d.run = (args: string[], o: { cwd: string }) => { run(args, o); return JSON.stringify(list) }
      return { t, dep: createDeployer(t.d) }
    }
    const fn = { slug: 'quote', status: 'ACTIVE', verify_jwt: false, import_map: false, entrypoint_path: 'file:///tmp/user_fn_x_1/source/supabase/functions/quote/index.ts' }
    const ok = mk([fn])
    expect(ok.dep.settingsMatch('abc')).toBe(true)
    expect(ok.t.runs[0]!.args).toEqual(['functions', 'list', '-o', 'json', '--project-ref', DEV_REF])
    expect(mk({ functions: [fn] }).dep.settingsMatch('abc')).toBe(true) // Objektform wird auch angenommen
    expect(() => mk({ data: [fn] }).dep.settingsMatch('abc')).toThrow(/unbekannte Form/)
    expect(mk([{ ...fn, verify_jwt: true }]).dep.settingsMatch('abc')).toBe(false)
    expect(mk([{ ...fn, status: 'REMOVED' }]).dep.settingsMatch('abc')).toBe(false)
    expect(mk([{ ...fn, import_map: true }]).dep.settingsMatch('abc')).toBe(false)
    expect(mk([{ ...fn, entrypoint_path: 'file:///x/source/supabase/functions/photo-cleanup/index.ts' }]).dep.settingsMatch('abc')).toBe(false)
    expect(mk([]).dep.settingsMatch('abc')).toBe(false)
    // verify_jwt fehlt im Abschnitt → CLI-Standard true; auskommentierter Wert zählt nicht
    expect(mk([{ ...fn, verify_jwt: true }], '[functions.quote]\n# verify_jwt = false\n').dep.settingsMatch('abc')).toBe(true)
    expect(mk([fn], '[functions.quote]\n# verify_jwt = false\n').dep.settingsMatch('abc')).toBe(false)
  })
  it('nichts geladen → nicht gleich', () => {
    expect(createDeployer(fake({ devFiles: {} }).d).matches('abc')).toMatchObject({ same: false })
  })
})
