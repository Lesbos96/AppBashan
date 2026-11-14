import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { freigabenAusDir, leseRegister, loeschFreigabe, pruefeLoesch, scanne } from '../../scripts/sys/gate-loesch-lib.mjs'

const sha256Datei = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')

const FX = 'scripts/sys/fixtures/loesch'
const REG = `${FX}/register.json`
const SKRIPT = `${FX}/skript.mjs`
const gate = (...args: string[]) => spawnSync(process.execPath, ['scripts/sys/gate-loesch.mjs', ...args], { encoding: 'utf8' })
const trocken = (frei: string, skript = SKRIPT) => gate('--trocken', '--register', REG, '--freigaben', `${FX}/${frei}`, skript)

describe('Lösch-Gate (Trockenlauf mit Attrappe, nichts wird gestartet)', () => {
  it('ohne Freigabe: blockiert (Exit 1)', () => {
    const r = trocken('leer')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/LÖSCH-GATE BLOCKIERT[\s\S]*keine Freigabe für Pfad und SHA256/)
  })
  it('Skript nach der Freigabe geändert (anderer SHA-256): blockiert', () => {
    const r = trocken('geaendert')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/skript\.mjs: keine Freigabe/)
  })
  it('gebundene Datei nach der Freigabe geändert, Skript unverändert: blockiert', () => {
    const r = trocken('gebunden-geaendert')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/gebunden\.txt: keine Freigabe/)
  })
  it('Urteil gesperrt: blockiert', () => {
    const r = trocken('gesperrt')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Urteil gesperrt/)
  })
  it('Skript nicht im Register: blockiert', () => {
    expect(trocken('frei', 'scripts/sys/fixtures/rot.mjs').status).toBe(1)
  })
  it('passende Freigabe: würde durchlassen (Exit 0), startet nichts, schreibt kein Log', () => {
    const r = trocken('frei')
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/würde durchlassen \(scripts\/sys\/fixtures\/loesch\/skript\.mjs, Trockenlauf, nichts gestartet\)/)
    expect(r.stdout).not.toMatch(/Lauf /)
  })
  it.each([
    ['--register ohne --trocken', ['--register', REG, SKRIPT]],
    ['--freigaben ohne --trocken', ['--freigaben', `${FX}/frei`, SKRIPT]],
    ['--trocken ohne die Optionen', ['--trocken', SKRIPT]],
    ['unbekannte Option', ['--trocken', '--bogus', SKRIPT]],
    ['Pfad mit ..', ['--trocken', '--register', REG, '--freigaben', `${FX}/frei`, '../x.mjs']],
    ['kein .mjs-Skript', ['--trocken', '--register', REG, '--freigaben', `${FX}/frei`, 'tests/support/sweep.ts']],
    ['ohne Argumente', []],
    ['uebernehme ohne Pfad', ['uebernehme']],
    ['uebernehme mit Pfad außerhalb von tmp/proof', ['uebernehme', 'docs/x/loesch-freigabe-1.md']],
    ['uebernehme mit ..', ['uebernehme', 'tmp/proof/../x/loesch-freigabe-1.md']],
    ['uebernehme mit Vorsilbe im Dateinamen (nicht vom Berater geschützt)', ['uebernehme', 'tmp/proof/u1b/vor-loesch-freigabe-2.md']],
    ['uebernehme mit anderer Endung', ['uebernehme', 'tmp/proof/u1b/loesch-freigabe-1.txt']],
  ])('Aufruffehler (Exit 2): %s', (_n, a) => {
    expect(gate(...a).status).toBe(2)
  })
  it('Argumente für das Skript nach dem Pfad (auch --trocken) sind keine Gate-Optionen', () => {
    // run.mjs erlaubt `cmd` nur mit --trocken an erster Stelle; hier: danach gilt --trocken als Skriptargument, das Gate wäre ohne Freigabe blockiert
    const r = gate(SKRIPT, '--trocken')
    expect(r.status).toBe(1)
  })
})

describe('Lösch-Gate: Selbstprüfung eines Moduls (tests/support/sweep.ts)', () => {
  const alt = process.env.MV_LAUF
  afterEach(() => {
    if (alt === undefined) delete process.env.MV_LAUF
    else process.env.MV_LAUF = alt
  })
  const url = pathToFileURL(resolve(SKRIPT)).href
  const mit = (dir: string) => ({ register: REG, freigaben: () => freigabenAusDir(`${FX}/${dir}`) })
  it('außerhalb des Start-Programms (MV_LAUF fehlt): Fehler', () => {
    delete process.env.MV_LAUF
    expect(() => loeschFreigabe(url, mit('frei'))).toThrow(/MV_LAUF/)
  })
  it('im Lauf, mit passender Freigabe: kein Fehler', () => {
    process.env.MV_LAUF = 'u1b/1'
    expect(() => loeschFreigabe(url, mit('frei'))).not.toThrow()
  })
  it.each(['leer', 'geaendert', 'gebunden-geaendert', 'gesperrt'])('Freigabe %s: Fehler (Löschen blockiert)', (dir) => {
    process.env.MV_LAUF = 'u1b/1'
    expect(() => loeschFreigabe(url, mit(dir))).toThrow(/LÖSCH-GATE BLOCKIERT/)
  })
  it('Datei nicht im Register: Fehler', () => {
    process.env.MV_LAUF = 'u1b/1'
    expect(() => loeschFreigabe(pathToFileURL(resolve('scripts/sys/fixtures/rot.mjs')).href, mit('frei'))).toThrow(/steht nicht im Register/)
  })
  it('pruefeLoesch wirft bei fehlender Datei (fail-closed)', () => {
    expect(() => pruefeLoesch(['gibt/es/nicht.mjs'], [])).toThrow()
  })
})

describe('Lösch-Gate: Lauf-Log (Lauf-ID und Zahlen)', () => {
  it('schreibt eine Zeile in tmp/proof/<schritt>/loesch-lauf.jsonl', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loesch-log-'))
    spawnSync('git', ['init', '-q'], { cwd: dir })
    writeFileSync(join(dir, 'x.txt'), 'inhalt\n')
    const lib = pathToFileURL(resolve('scripts/sys/gate-loesch-lib.mjs')).href
    writeFileSync(join(dir, 'l.mjs'), `import { loeschLog } from '${lib}'\nloeschLog('x.txt', { geloescht: 3 }, { final: true })\nloeschLog('x.txt', { geloescht: 4 })\n`)
    const r = spawnSync(process.execPath, ['l.mjs'], { cwd: dir, encoding: 'utf8', env: { ...process.env, MV_LAUF: 'u1b/7', MV_LOESCH_LAUF: '' } })
    expect(r.status).toBe(0)
    const schritt = readdirSync(join(dir, 'tmp/proof'))[0]!
    const zeilen = readFileSync(join(dir, 'tmp/proof', schritt, 'loesch-lauf.jsonl'), 'utf8').trim().split('\n').map((z) => JSON.parse(z))
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toMatchObject({ pfad: 'x.txt', lauf: 'u1b/7', zahlen: { geloescht: 3 }, final: true })
    expect(zeilen[0].sha256).toBe(sha256Datei(join(dir, 'x.txt')))
    expect(zeilen[0].laufId).toMatch(/^[0-9a-f-]{36}$/)
    expect(zeilen[1].zahlen).toEqual({ geloescht: 4 })
  })
})

describe('Lösch-Register: Vollständigkeit', () => {
  const reg = leseRegister()
  const bekannt = [...Object.keys(reg.skripte), ...Object.keys(reg.ausgenommen)]
  it('jede Datei mit Lösch-, Status- oder Dev-Muster steht im Register oder unter ausgenommen (mit Grund)', () => {
    expect(scanne().filter((p) => !bekannt.includes(p))).toEqual([])
  })
  it('Register und Ausnahmen überschneiden sich nicht, alle Dateien existieren', () => {
    expect(Object.keys(reg.skripte).filter((p) => p in reg.ausgenommen)).toEqual([])
    for (const p of [...bekannt, ...Object.values(reg.skripte).flat()]) expect(() => sha256Datei(p), p).not.toThrow()
  })
  it('jede Ausnahme trägt einen Grund und den SHA-256 der Datei: eine Änderung macht den Test rot', () => {
    for (const [p, e] of Object.entries(reg.ausgenommen)) {
      expect(e.grund.length, p).toBeGreaterThan(10)
      expect(sha256Datei(p), `${p} hat sich seit der Ausnahme geändert: Register prüfen und SHA-256 nachführen (Abnahme nötig)`).toBe(e.sha256)
    }
  })
  it('scanne findet Löschmuster und lässt Harmloses aus', () => {
    const w = mkdtempSync(join(tmpdir(), 'loesch-scan-'))
    for (const d of ['scripts', 'tests/support']) mkdirSync(join(w, d), { recursive: true })
    writeFileSync(join(w, 'scripts/a.mjs'), "await db.query('delete from x')\n")
    writeFileSync(join(w, 'scripts/b.mjs'), 'console.log("nur lesen")\n')
    writeFileSync(join(w, 'tests/support/c.ts'), "await service.from('x').delete().eq('a', 1)\n")
    writeFileSync(join(w, 'tests/support/d.ts'), 'export const x = 1\n')
    expect(scanne(w)).toEqual(['scripts/a.mjs', 'tests/support/c.ts'])
  })
  // Bindung der Abhängigkeiten (Fable H1): ein Registerskript darf nur Dateien importieren, die es bindet oder die unkritisch sind. Ein neuer Import bricht den Test, bis er geprüft ist.
  const UNKRITISCH = ['scripts/dev-guard.mjs', 'scripts/sys/gate-loesch-lib.mjs', 'tests/support/owner.ts', 'tests/support/db.ts', 'supabase/functions/_shared/pricing/index.ts']
  it.each(Object.entries(reg.skripte))('%s importiert nur gebundene oder unkritische Dateien', (p, bindet) => {
    const text = readFileSync(p, 'utf8')
    const importe = [...text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => join(dirname(p), m[1]!).replace(/\\/g, '/'))
    expect(importe.filter((i) => !bindet.includes(i) && !UNKRITISCH.includes(i))).toEqual([])
  })
})

describe('tests/support/sweep.ts: Freigabe vor dem ersten Löschen', () => {
  const text = readFileSync('tests/support/sweep.ts', 'utf8')
  it('beide Funktionen prüfen die Freigabe als Erstes, in sweepTestResidue vor dem try (auch bei final)', () => {
    const rest = text.slice(text.indexOf('export function sweepTestResidue'))
    expect(rest.indexOf('loeschFreigabe(import.meta.url)')).toBeGreaterThan(-1)
    expect(rest.indexOf('loeschFreigabe(import.meta.url)')).toBeLessThan(rest.indexOf('try {'))
    expect(text.slice(text.indexOf('export async function sweepReceiptObjects'), text.indexOf('export function sweepTestResidue'))).toMatch(/\{\n {2}loeschFreigabe\(import\.meta\.url\)/)
  })
  it('admin muss eine UUID sein, Obergrenze gegen ein zu weites Muster', () => {
    expect(text).toMatch(/if \(!UUID\.test\(admin\)\) throw/)
    expect(text).toMatch(/> \$\{MAX_LOESCHEN\}/)
  })
  it('importiert nur die erwarteten Dateien und die Marker aus marker.ts', () => {
    const importe = [...text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1])
    expect(importe.sort()).toEqual(['../../scripts/dev-guard.mjs', '../../scripts/sys/gate-loesch-lib.mjs', './db.ts', './marker.ts', './owner.ts'])
    expect(readFileSync('tests/support/marker.ts', 'utf8')).toMatch(/export const FIRM_MAIL_RE[\s\S]*export const COVER_FIRM/)
  })
})
