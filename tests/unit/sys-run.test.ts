import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
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
