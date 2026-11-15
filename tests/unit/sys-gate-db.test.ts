import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { marken, nachtragMarken, offeneMigrationen, parseFreigabe, pruefePush, startMarke, unmarkierteStarts } from '../../scripts/sys/gate-db-lib.mjs'

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
  it('den Modus marke gibt es nicht mehr: der Push schreibt die Marken selbst', () => {
    expect(spawnSync(process.execPath, ['scripts/sys/gate-db.mjs', 'marke'], { encoding: 'utf8' }).status).toBe(2)
    expect(spawnSync(process.execPath, ['scripts/sys/gate-db.mjs', 'marke', '--trocken', '--liste', 'x', '--dir', 'y', '--freigaben', 'z'], { encoding: 'utf8' }).status).toBe(2)
  })
})

describe('M16: Marken nach dem Push binden den Inhalt', () => {
  const v = (version: string, sha256: string) => ({ version, pfad: `supabase/migrations/${version}_x.sql`, sha256 })
  const A = 'a'.repeat(64)
  const B = 'b'.repeat(64)
  const C = 'c'.repeat(64)
  it('angewendete Migration: Marke mit Pfad und freigegebenem SHA-256', () => {
    expect(marken([v('1', A)], [], () => A)).toEqual({ marken: [{ pfad: 'supabase/migrations/1_x.sql', sha256: A }], gruende: [] })
  })
  it('Datei nach der Freigabe geändert (SHA weicht ab): keine Marke und ein Grund', () => {
    const r = marken([v('1', A)], [], () => C)
    expect(r.marken).toEqual([])
    expect(r.gruende.join()).toMatch(/Inhalt hat sich seit der Freigabe geändert/)
  })
  it('Teil-Push (1 angewendet, 2 gescheitert): nur 1 hat eine Marke, 2 bleibt offen', () => {
    const r = marken([v('1', A), v('2', B)], [v('2', B)], (p) => (p.includes('/1_') ? A : B))
    expect(r.marken.map((m) => m.sha256)).toEqual([A])
    expect(r.gruende).toEqual([])
  })
  it('zweiter Versuch nach der Korrektur: die zuvor gescheiterte Migration bekommt ihre Marke', () => {
    expect(marken([v('2', B)], [], () => B).marken).toEqual([{ pfad: 'supabase/migrations/2_x.sql', sha256: B }])
  })
  it('M3: „gesperrt“ neben „frei“ für denselben Pfad und SHA-256 blockiert', () => {
    const f = { modell: 'claude-fable-5-2', dateien: [{ sha: A, pfad: 'a.sql' }], urteil: 'frei', hoch: 0 }
    expect(pruefePush([{ pfad: 'a.sql', sha256: A }], [f, { ...f, urteil: 'gesperrt' }]).ok).toBe(false)
    expect(pruefePush([{ pfad: 'a.sql', sha256: A }], [{ ...f, urteil: 'gesperrt' }, f]).ok).toBe(false)
    expect(pruefePush([{ pfad: 'a.sql', sha256: A }], [f]).ok).toBe(true)
  })
})

describe('AM5: Startmarke vor dem Push, Nachtrag der Marken nach einem gelungenen Push', () => {
  const m = (version: string, sha256: string) => ({ version, pfad: `supabase/migrations/${version}_x.sql`, sha256 })
  const A = 'a'.repeat(64)
  const B = 'b'.repeat(64)
  it('startMarke bündelt Version, Pfad und SHA-256 der freigegebenen Migrationen', () => {
    const z = startMarke([m('1', A)], '2026-11-15T10:00:00.000Z')
    expect(z).toEqual({ ziel: 'db-push-start', start: '2026-11-15T10:00:00.000Z', migrationen: [m('1', A)] })
  })
  it('unmarkierteStarts: nur Startmarken-Einträge, die keine Marke mit gleichem Pfad und SHA-256 haben', () => {
    const zeilen = [
      startMarke([m('1', A), m('2', B)], 't1'),
      { ziel: 'db-push', start: 't2', migrationen: [{ pfad: 'supabase/migrations/1_x.sql', sha256: A }] },
      { ziel: 'check', nr: 3 },
    ]
    expect(unmarkierteStarts(zeilen)).toEqual([{ ...m('2', B), start: 't1' }])
    expect(unmarkierteStarts([startMarke([m('1', A)], 't1'), { ziel: 'db-push', start: 't2', migrationen: [{ pfad: 'supabase/migrations/1_x.sql', sha256: B }] }])).toEqual([{ ...m('1', A), start: 't1' }]) // Marke mit anderem SHA deckt nicht ab
    expect(unmarkierteStarts([])).toEqual([])
  })
  it('M5: eine überholte Startmarke blockiert nicht (Push 1 mit SHA A scheitert, Datei korrigiert, Push 2 markiert B)', () => {
    const zeilen = [startMarke([m('1', A)], 't1'), startMarke([m('1', B)], 't2'), { ziel: 'db-push', start: 't3', migrationen: [{ pfad: 'supabase/migrations/1_x.sql', sha256: B }] }]
    expect(unmarkierteStarts(zeilen)).toEqual([])
    expect(unmarkierteStarts(zeilen.slice(0, 2))).toEqual([{ ...m('1', B), start: 't2' }]) // ohne Marke bleibt die jüngste offen, nicht die erste
  })
  it('H1: die Attrappe schreibt nie in einen Ordner unter tmp/proof (aufgelöst, ohne Groß/Klein)', () => {
    const a = aufbau(text())
    for (const frei of ['tmp/proof/_attrappe-test', 'TMP\\Proof\\_attrappe-test', './tmp/../tmp/proof/_attrappe-test', 'tmp/proof']) {
      for (const modus of ['antrag', 'nachtrag', 'push']) {
        const r = spawnSync(process.execPath, ['scripts/sys/gate-db.mjs', modus, '--trocken', '--liste', join(a.dir, 'liste.json'), '--dir', a.mig, '--freigaben', frei], { encoding: 'utf8' })
        expect(r.status, `${modus} ${frei}`).toBe(2)
        expect(r.stderr).toMatch(/nicht unter tmp\/proof/)
      }
    }
    expect(existsSync('tmp/proof/_attrappe-test')).toBe(false)
  })
  it('nachtragMarken: nur mit positivem Beleg (Version steht mit remote in der Liste) und unverändertem SHA-256', () => {
    const liste = (remote: string) => ({ migrations: [{ local: '1', remote }] })
    const v = { ...m('1', A), start: 't1' }
    expect(nachtragMarken([v], liste('1'), () => A)).toEqual({ marken: [{ pfad: v.pfad, sha256: A, start: 't1' }], gruende: [], offen: [] })
    expect(nachtragMarken([v], liste(''), () => A)).toEqual({ marken: [], gruende: [], offen: [v] }) // noch nicht angewendet: keine Marke
    expect(nachtragMarken([v], { migrations: [] }, () => A).marken).toEqual([]) // Version fehlt in der Liste: kein Beleg
    expect(nachtragMarken([v], liste('1'), () => B).gruende.join()).toMatch(/Inhalt hat sich seit der Freigabe geändert/)
    expect(nachtragMarken([v], liste('1'), () => { throw new Error('weg') }).gruende.join()).toMatch(/Datei nicht lesbar/)
    expect(() => nachtragMarken([v], { fehler: 1 }, () => A)).toThrow(/Unerwartete Form/)
  })
  const nachtrag = (a: ReturnType<typeof aufbau>, listeRemote: string) => {
    writeFileSync(join(a.dir, 'liste.json'), JSON.stringify({ migrations: [{ local: '20261101100000', remote: '20261101100000' }, { local: '20261201100000', remote: listeRemote }] }))
    return cli(a, 'nachtrag')
  }
  const mitStart = (sha256: string) => {
    const a = aufbau()
    writeFileSync(join(a.frei, 'runs.jsonl'), JSON.stringify(startMarke([{ version: '20261201100000', pfad: a.pfad, sha256 }], '2026-11-01T10:00:00.000Z')) + '\n')
    return a
  }
  const runs = (a: ReturnType<typeof aufbau>) => readFileSync(join(a.frei, 'runs.jsonl'), 'utf8').trim().split('\n').map((z) => JSON.parse(z))
  it('nach einem gelungenen Push ohne Marke schreibt `nachtrag` die Marke, ein zweiter Lauf nichts mehr', () => {
    const a = mitStart(sha(SQL))
    const r = nachtrag(a, '20261201100000')
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/1 Marke\(n\) db-push/)
    expect(runs(a).at(-1)).toMatchObject({ ziel: 'db-push', nachtrag: true, startmarke: ['2026-11-01T10:00:00.000Z'], migrationen: [{ pfad: a.pfad, sha256: sha(SQL) }] })
    expect(Date.parse(runs(a).at(-1).start)).toBeGreaterThan(Date.parse('2026-11-01T10:00:00.000Z')) // Zeitpunkt des Nachtrags: ein rls-Lauf muss danach laufen
    expect(nachtrag(a, '20261201100000').stdout).toMatch(/keine Startmarke ohne Marke/)
    expect(runs(a)).toHaveLength(2)
  })
  it('Migration noch nicht angewendet (remote leer): keine Marke', () => {
    const a = mitStart(sha(SQL))
    expect(nachtrag(a, '').status).toBe(0)
    expect(runs(a)).toHaveLength(1)
  })
  it('Datei nach der Startmarke geändert: keine Marke, Exit 1', () => {
    const a = mitStart(sha('select 9;\n'))
    const r = nachtrag(a, '20261201100000')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Inhalt hat sich seit der Freigabe geändert/)
    expect(runs(a)).toHaveLength(1)
  })
  it('ohne Startmarke: nichts zu tun, nie eine Marke aus dem Nichts', () => {
    const a = aufbau()
    const r = nachtrag(a, '20261201100000')
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/keine Startmarke ohne Marke/)
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
    expect(f).toEqual({ modell: 'claude-fable-5-2', dateien: [{ sha: 'a'.repeat(64), pfad: 'a/b.sql' }], geloescht: [], urteil: 'frei', hoch: 0 })
    expect(parseFreigabe('Geloescht: .githooks/pre-push\nGeloescht: x y\nim Text Geloescht: z').geloescht).toEqual(['.githooks/pre-push'])
    expect(parseFreigabe('Urteil: frei im Text mit mehr').urteil).toBe('')
    expect(Number.isNaN(parseFreigabe('nichts').hoch)).toBe(true)
  })
  it('pruefePush ohne offene Migrationen ist ok', () => {
    expect(pruefePush([], [])).toEqual({ ok: true, gruende: [] })
  })
})
