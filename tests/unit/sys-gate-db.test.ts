import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { offeneMigrationen, parseFreigabe, pruefePush } from '../../scripts/sys/gate-db-lib.mjs'

const SQL = 'select 1;\n'
const sha = (t: string) => createHash('sha256').update(t).digest('hex')

function aufbau(freigabe?: (pfad: string, s: string) => string, sql = SQL) {
  const dir = mkdtempSync(join(tmpdir(), 'gatedb-'))
  const mig = join(dir, 'migrations')
  const frei = join(dir, 'freigaben')
  mkdirSync(mig)
  mkdirSync(frei)
  writeFileSync(join(mig, '20261201100000_x.sql'), sql)
  writeFileSync(join(dir, 'liste.json'), JSON.stringify({ migrations: [{ local: '20261101100000', remote: '20261101100000' }, { local: '20261201100000', remote: '' }] }))
  const pfad = join(mig, '20261201100000_x.sql').replace(/\\/g, '/')
  if (freigabe) writeFileSync(join(frei, 'db-freigabe-1.md'), freigabe(pfad, sha(SQL)))
  return { dir, mig, frei, pfad }
}
const cli = (a: ReturnType<typeof aufbau>, modus = 'push', extra: string[] = ['--trocken']) =>
  spawnSync(process.execPath, ['scripts/sys/gate-db.mjs', modus, ...extra, '--liste', join(a.dir, 'liste.json'), '--dir', a.mig, '--freigaben', a.frei], { encoding: 'utf8' })
const text = (modell = 'claude-fable-5-2', urteil = 'Urteil: frei', hoch = 'Offene Findings hoch: 0') => (pfad: string, s: string) => `Modell: ${modell}\nSHA256: ${s} ${pfad}\n${urteil}\n${hoch}\n`

describe('Datenbank-Gate (Trockenlauf mit Attrappe, keine DB, kein Push)', () => {
  it('ohne Freigabe: blockiert (Exit 1)', () => {
    const r = cli(aufbau())
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/GATE-DB BLOCKIERT[\s\S]*keine Freigabe/)
  })
  it('Freigabe mit anderem SHA-256 (Datei nach der Freigabe geändert): blockiert', () => {
    const r = cli(aufbau(text(), 'select 2;\n'))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/keine Freigabe für Pfad und SHA256/)
  })
  it('Freigabe für anderen Pfad: blockiert', () => {
    expect(cli(aufbau((_p, s) => `Modell: claude-fable-5-2\nSHA256: ${s} anderer/pfad.sql\nUrteil: frei\nOffene Findings hoch: 0\n`)).status).toBe(1)
  })
  it.each([
    ['Urteil gesperrt', text('claude-fable-5-2', 'Urteil: gesperrt')],
    ['Modell nicht Fable', text('claude-sonnet-5-5')],
    ['offene hohe Findings', text('claude-fable-5-2', 'Urteil: frei', 'Offene Findings hoch: 1')],
    ['zwei Urteilszeilen', (p: string, s: string) => `${text()(p, s)}Urteil: gesperrt\n`],
    ['Urteilszeile fehlt', (p: string, s: string) => `Modell: claude-fable-5-2\nSHA256: ${s} ${p}\nOffene Findings hoch: 0\n`],
  ])('%s: blockiert', (_n, f) => {
    expect(cli(aufbau(f)).status).toBe(1)
  })
  it('passende Freigabe: würde durchlassen (Exit 0)', () => {
    const r = cli(aufbau(text()))
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/würde durchlassen \(1 offene/)
  })
  it('antrag schreibt Pfad und Hash, zweiter Antrag überschreibt nicht', () => {
    const a = aufbau()
    expect(cli(a, 'antrag').stdout).toMatch(/db-antrag-1\.json/)
    expect(cli(a, 'antrag').stdout).toMatch(/db-antrag-2\.json/)
  })
  it('Attrappe-Optionen ohne --trocken: Exit 2, nie ein Push-Pfad', () => {
    expect(cli(aufbau(text()), 'push', []).status).toBe(2)
  })
  it.each([
    ['unbekannte Form der Liste', '{"fehler":"x"}'],
    ['Einträge ohne local (umbenannte Felder)', '{"migrations":[{"version":"20261201100000","applied":false}]}'],
    ['leere Liste trotz vorhandener Migrationsdatei', '{"migrations":[]}'],
    ['Datei fehlt in der Liste', '{"migrations":[{"local":"20261101100000","remote":"20261101100000"}]}'],
  ])('fail-closed (Exit 1): %s', (_n, inhalt) => {
    const a = aufbau(text())
    writeFileSync(join(a.dir, 'liste.json'), inhalt)
    const r = cli(a)
    expect(r.status).toBe(1)
    expect(r.stdout).not.toMatch(/würde durchlassen/)
  })
  it('--trocken ohne die drei Optionen: Exit 2', () => {
    expect(spawnSync(process.execPath, ['scripts/sys/gate-db.mjs', 'push', '--trocken'], { encoding: 'utf8' }).status).toBe(2)
  })
  it('marke gibt es nur gegen die echte Datenbank, nicht als Attrappe', () => {
    expect(spawnSync(process.execPath, ['scripts/sys/gate-db.mjs', 'marke', '--trocken', '--liste', 'x', '--dir', 'y', '--freigaben', 'z'], { encoding: 'utf8' }).status).toBe(2)
  })
})

describe('Datenbank-Gate: reine Logik', () => {
  it('offen = lokal vorhanden, remote leer', () => {
    const a = aufbau()
    const o = offeneMigrationen(JSON.parse('{"migrations":[{"local":"20261201100000","remote":""},{"local":"20261101100000","remote":"20261101100000"}]}'), a.mig)
    expect(o).toHaveLength(1)
    expect(o[0]?.sha256).toBe(sha(SQL))
  })
  it('parseFreigabe liest streng zeilenverankert', () => {
    const f = parseFreigabe(`Modell: claude-fable-5-2\nSHA256: ${'A'.repeat(64)} a/b.sql\nUrteil: frei\nOffene Findings hoch: 0\n`)
    expect(f).toEqual({ modell: 'claude-fable-5-2', dateien: [{ sha: 'a'.repeat(64), pfad: 'a/b.sql' }], urteil: 'frei', hoch: 0 })
    expect(parseFreigabe('Urteil: frei im Text mit mehr').urteil).toBe('')
    expect(Number.isNaN(parseFreigabe('nichts').hoch)).toBe(true)
  })
  it('pruefePush ohne offene Migrationen ist ok', () => {
    expect(pruefePush([], [])).toEqual({ ok: true, gruende: [] })
  })
})
