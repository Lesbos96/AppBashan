import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')

describe('Test-Startprogramm run.mjs', () => {
  const root = mkdtempSync(join(tmpdir(), 'run-'))
  const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/sys/run.mjs', ...args], { encoding: 'utf8', env: { ...process.env, PROOF_ROOT: root } })
  const ordner = () => join(root, readdirSync(root)[0] ?? '')

  it('ein absichtlich roter Befehl ergibt EXIT ungleich 0 im Prozess und im Log, Kopf mit Hash, Sauber-Angabe und Befehl', () => {
    const r = run('cmd', 'node', 'scripts/sys/fixtures/rot.mjs')
    expect(r.status).toBe(3)
    expect(r.stdout).toMatch(/EXIT=3\s*$/)
    const log = readFileSync(join(ordner(), '001-cmd.log'), 'utf8')
    const zeilen = log.split('\n')
    expect(zeilen[0]).toMatch(/^Commit: [0-9a-f]{40}$/)
    expect(zeilen[1]).toMatch(/^Arbeitsbaum sauber: (ja|nein)$/)
    expect(zeilen[2]).toBe('Befehl: node scripts/sys/fixtures/rot.mjs')
    expect(log).toContain('rot\n')
    expect(log).toMatch(/\nEXIT=3\s*$/)
    const zeile = JSON.parse(readFileSync(join(ordner(), 'runs.jsonl'), 'utf8').trim())
    expect(zeile).toMatchObject({ nr: 1, ziel: 'cmd', exit: 3, befehl: 'node scripts/sys/fixtures/rot.mjs' })
    expect(zeile.logSha).toBe(sha(join(ordner(), '001-cmd.log')))
  })

  it('ein zweiter Lauf überschreibt das erste Log nicht', () => {
    const vorher = sha(join(ordner(), '001-cmd.log'))
    const r = run('cmd', 'node', 'scripts/sys/fixtures/rot.mjs')
    expect(r.status).toBe(3)
    expect(existsSync(join(ordner(), '002-cmd.log'))).toBe(true)
    expect(sha(join(ordner(), '001-cmd.log'))).toBe(vorher)
    expect(readFileSync(join(ordner(), 'runs.jsonl'), 'utf8').trim().split('\n')).toHaveLength(2)
  })

  it.each([
    ['cmd', 'npx', 'vitest', 'run'],
    ['cmd', 'node', 'scripts/sys/../x.mjs'],
    ['cmd', 'node', 'src/main.tsx'],
    ['cmd', 'node', 'scripts/sys/fertig.mjs'],
    ['cmd', 'node', 'scripts/sys/fertig.mjs', '--pre-push'],
    ['cmd', 'node', 'scripts/sys/gate-db.mjs', 'push'],
    ['cmd', 'node', 'scripts/sys/bericht.mjs'],
    ['cmd', 'node', 'scripts/sys/run.mjs', 'check'],
    ['cmd', 'node', 'scripts/sys/fixtures/../fertig.mjs', '--nur-pruefen'],
    ['cmd'],
    ['unbekannt'],
  ])('verbotenes Ziel %j: Exit 2, kein Log', (...args) => {
    const vorher = readdirSync(ordner()).length
    expect(run(...args).status).toBe(2)
    expect(readdirSync(ordner()).length).toBe(vorher)
  })
})

describe('Lauf-Sperre von run.mjs', () => {
  const neuerRoot = () => mkdtempSync(join(tmpdir(), 'sperre-'))
  const run = (root: string) => spawnSync(process.execPath, ['scripts/sys/run.mjs', 'cmd', 'node', 'scripts/sys/fixtures/rot.mjs'], { encoding: 'utf8', env: { ...process.env, PROOF_ROOT: root } })
  const sperre = (root: string, inhalt: object) => writeFileSync(join(root, 'lauf.lock'), JSON.stringify(inhalt))
  const tot = () => spawnSync(process.execPath, ['--version']).pid as number // beendeter Kindprozess: seine PID gehört keinem Prozess mehr

  it('lebende PID: Abbruch mit Exit 2, kein Log, Sperre unverändert', () => {
    const root = neuerRoot()
    sperre(root, { pid: process.pid })
    const r = run(root)
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/Lauf aktiv/)
    expect(readdirSync(root)).toEqual(['lauf.lock'])
    expect(JSON.parse(readFileSync(join(root, 'lauf.lock'), 'utf8'))).toEqual({ pid: process.pid })
  })

  it('tote PID von run.mjs, aber lebender Testkind (verwaister Lauf): Abbruch mit Exit 2', () => {
    const root = neuerRoot()
    sperre(root, { pid: tot(), kind: process.pid })
    expect(run(root).status).toBe(2)
    expect(readdirSync(root)).toEqual(['lauf.lock'])
  })

  it('unlesbare Sperre zählt als aktiv', () => {
    const root = neuerRoot()
    writeFileSync(join(root, 'lauf.lock'), '')
    expect(run(root).status).toBe(2)
    expect(readdirSync(root)).toEqual(['lauf.lock'])
  })

  it('Sperre eines beendeten Prozesses wird freigegeben: der Lauf läuft (Exit 3 des Fixtures) und räumt die Sperre ab', () => {
    const root = neuerRoot()
    sperre(root, { pid: tot(), kind: tot() })
    expect(run(root).status).toBe(3)
    expect(readdirSync(root).sort()).not.toContain('lauf.lock')
    expect(readdirSync(join(root, readdirSync(root)[0] ?? '')).filter((f) => f.endsWith('.log'))).toEqual(['001-cmd.log'])
  })

  it('ein Lauf ohne vorhandene Sperre hinterlässt keine', () => {
    const root = neuerRoot()
    expect(run(root).status).toBe(3)
    expect(readdirSync(root)).not.toContain('lauf.lock')
  })
})
