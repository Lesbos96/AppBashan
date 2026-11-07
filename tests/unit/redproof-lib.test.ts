// Unit-Tests der Redproof-Lib ohne Dev (Fake-Datenbank, Fake-Prozess). Jeder Test misst eine Wirkung (Exit-Code, gesendetes SQL, Zustand), nicht nur einen Text.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'node:events'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createRun, diffSoll, EXIT, FatalError, isSelect, judgeVitest, PreError, refuseReasons, RESTORE_CMD, restoreKinds, runMain, SNAPSHOT_SQL, StepError } from '../../scripts/redproof-lib.mjs'

const SOLL = [
  { k: 'function', n: 'public.f()', h: 'h1', e: null },
  { k: 'policy', n: 'public.t.p', h: 'p1', e: null },
  { k: 'trigger', n: 'public.t.trg', h: 't1', e: 'O' },
  { k: 'cron', n: 'photo-cleanup', h: 'c1', e: 'true' },
]
// Wirkung je Textmarke im SQL: Lockerungen und Restores der Fake-Datenbank
const EFFECTS: Record<string, [string, string, Partial<{ h: string; e: string | null }>]> = {
  LOOSEN_F: ['function', 'public.f()', { h: 'X' }],
  RESTORE_F: ['function', 'public.f()', { h: 'h1' }],
  LOOSEN_P: ['policy', 'public.t.p', { h: 'pX' }],
  RESTORE_P: ['policy', 'public.t.p', { h: 'p1' }],
  PAUSE_JOB: ['cron', 'photo-cleanup', { h: 'c2', e: 'false' }],
  RESUME_JOB: ['cron', 'photo-cleanup', { h: 'c1', e: 'true' }],
}

class Db {
  rows: any[] = structuredClone(SOLL)
  calls: string[] = []
  events: string[] = []
  failRestore = false
  deadman = new Set<string>()
  deadmanInactive = false
  cronInfo: any = { tz: 'GMT', bg: 'off', alive: 3 }
  probeJobs: string[] = []
  probeFail = false
  running: number[] = [0]
  queue = 0
  transport: { match: (q: string) => boolean; applied: boolean } | null = null
  private effects(rows: any[], q: string) {
    for (const [tag, [k, n, patch]] of Object.entries(EFFECTS)) {
      if (!q.includes(tag)) continue
      if (this.failRestore && tag.startsWith('RESTORE')) continue
      const r = rows.find((x) => x.k === k && x.n === n)
      if (r) Object.assign(r, patch)
    }
  }
  exec = (q: string): any[] => {
    this.calls.push(q)
    if (this.transport?.match(q)) {
      const t = this.transport
      this.transport = null
      if (t.applied) this.effects(this.rows, q)
      throw Object.assign(new Error('Transport error'), { transport: true })
    }
    if (q === SNAPSHOT_SQL) return structuredClone(this.rows)
    if (q.startsWith('begin;') && q.endsWith('rollback;')) {
      const copy = structuredClone(this.rows)
      this.effects(copy, q)
      return copy
    }
    if (q.startsWith('begin;')) {
      this.events.push(`tx:${Object.keys(EFFECTS).filter((t) => q.includes(t)).join(',')}`)
      this.effects(this.rows, q)
      return [{ x: 1 }]
    }
    if (q.startsWith('select cron.schedule(')) {
      this.deadman.add(/'(redproof-restore-[^']+)'/.exec(q)![1]!)
      return [{ schedule: 1 }]
    }
    if (q.includes('select active from cron.job where jobname = \'redproof-restore-')) return this.deadman.size && !this.deadmanInactive ? [{ active: true }] : []
    if (q.startsWith('select cron.unschedule')) {
      this.deadman.clear()
      return []
    }
    if (q.includes('count(*)::int as n from cron.job where jobname')) {
      const name = /jobname = '([^']+)'/.exec(q)?.[1]
      return [{ n: name ? Number(this.deadman.has(name)) : this.deadman.size }]
    }
    if (q.includes("j.jobname = 'photo-cleanup' and d.status = 'running'")) return [{ n: this.running.length > 1 ? (this.running.shift() as number) : this.running[0] }]
    if (q.includes("current_setting('cron.timezone'")) return [this.cronInfo]
    if (q.startsWith('select now()::text')) return [{ t: '2026-01-01 00:00:00+00' }]
    if (q.startsWith('select status, left(')) {
      const job = /'%(redproof-restore-[^%]+)%'/.exec(q)![1]!
      this.probeJobs.push(job)
      if (this.probeFail) return [{ status: 'failed', msg: 'permission denied' }]
      this.deadman.delete(job) // der Job entfernt sich selbst
      return [{ status: 'succeeded', msg: '' }]
    }
    if (q.includes('d.status = \'running\'')) return [{ n: 0 }]
    if (q.includes('job_run_details')) return [{ n: 0, s: null }]
    if (q.includes('net.http_request_queue')) return [{ n: this.queue }]
    if (q.includes("jobname like 'redproof-restore-%'")) return [...this.deadman].map((jobname) => ({ jobname }))
    if (q.includes('to_char((now()')) return [{ expr: '0 0 1 1 *', ts: '2026-01-01T00:00:00+00' }]
    if (q.includes('from auth.users')) return [{ n: 0, oldest: null }]
    if (q.includes("select active from cron.job where jobname = 'photo-cleanup'")) return [{ active: this.rows.find((r) => r.k === 'cron')?.e === 'true' }]
    throw new Error(`Fake-DB: unbekannte Abfrage ${q.slice(0, 80)}`)
  }
}

const dirs: string[] = []
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

function setup(opts: { dir?: string; db?: Db; alive?: number[]; dirty?: string; mode?: string } = {}) {
  const dir = opts.dir ?? mkdtempSync(join(tmpdir(), 'rp-'))
  if (!opts.dir) dirs.push(dir)
  const db = opts.db ?? new Db()
  const proc: any = new EventEmitter()
  proc.exitCode = undefined
  proc.exits = [] as number[]
  proc.exit = (c: number) => { proc.exits.push(c) }
  const logs: string[] = []
  const killed: number[] = []
  const spawned: string[][] = []
  const state: any = { timerFn: null, onSpawn: null as null | ((c: any, args: string[]) => void) }
  const deps: any = {
    dir, reportsDir: dir, nodeBin: 'node', vitestEntry: 'vitest.mjs', proc, pid: 4242, now: () => 1_000_000, log: (m: string) => logs.push(m),
    sleep: () => { state.sleeps = (state.sleeps ?? 0) + 1 }, randomTag: () => 'abcd1234',
    timers: { set: (f: () => void) => { state.timerFn = f; return 1 }, clear: () => {} },
    isAlive: (pid: number) => (opts.alive ?? []).includes(pid),
    exec: db.exec,
    spawn: (_c: string, args: string[]) => {
      const child: any = new EventEmitter()
      child.pid = 777
      spawned.push(args)
      setImmediate(() => state.onSpawn?.(child, args))
      return child
    },
    killTree: (pid: number) => { killed.push(pid); db.events.push('kill') },
    git: { functionsStatus: () => opts.dirty ?? '', sollClean: () => true },
  }
  const run = createRun(deps, { name: 'test', mode: opts.mode ?? 'write', soll: SOLL })
  return { dir, db, proc, logs, killed, spawned, deps, run, state }
}
const F = { label: 'f gelockert', loosen: 'select 1 /* LOOSEN_F */', restore: 'select 1 /* RESTORE_F */' }
const P = { label: 'p gelockert', loosen: 'select 1 /* LOOSEN_P */', restore: 'select 1 /* RESTORE_P */' }
const markersIn = (dir: string) => readdirSync(dir).filter((f) => f.startsWith('redproof-offen-'))
const commits = (db: Db, tag: string) => db.calls.filter((c) => c.startsWith('begin;') && c.includes(tag) && c.includes('commit;'))
const tick = () => new Promise((r) => setImmediate(r))
const never = () => new Promise<void>(() => {})

describe('Startprüfung', () => {
  const cases: [string, (rows: any[]) => void, string][] = [
    ['Funktionsdefinition (md5)', (r) => { r[0].h = 'zzz' }, 'function public.f(): abweicht'],
    ['Policy geändert', (r) => { r[1].h = 'zzz' }, 'policy public.t.p: abweicht'],
    ['fremde Policy redproof_update', (r) => { r.push({ k: 'policy', n: 'storage.objects.redproof_update', h: 'x', e: null }) }, 'policy storage.objects.redproof_update: zusätzlich'],
    ['zusätzliche Funktion become_rental_provider', (r) => { r.push({ k: 'function', n: 'public.become_rental_provider()', h: 'x', e: null }) }, 'function public.become_rental_provider(): zusätzlich'],
    ['Recht (ACL) geändert', (r) => { r.push({ k: 'table', n: 'public.x', h: 'acl2', e: null }) }, 'table public.x: zusätzlich'],
    ['Trigger fehlt', (r) => { r.splice(2, 1) }, 'trigger public.t.trg: fehlt'],
    ...['D', 'R', 'A'].map((e): [string, (rows: any[]) => void, string] => [`Trigger tgenabled ${e}`, (r) => { r[2].e = e }, 'trigger public.t.trg: abweicht']),
  ]
  for (const [name, mutate, expected] of cases) {
    it(`bricht ab bei: ${name} (Exit 2, nichts gelockert, nur Schlüssel in der Meldung)`, async () => {
      const t = setup()
      mutate(t.db.rows)
      const code = await runMain(t.run, async () => { throw new Error('darf nicht laufen') }, t.deps)
      expect(code).toBe(EXIT.PRE)
      expect(t.proc.exitCode).toBe(2)
      expect(t.logs.join('\n')).toContain(expected)
      expect(t.logs.join('\n')).not.toMatch(/\bzzz\b|\bacl2\b/)
      expect(t.db.calls.some((c) => c.startsWith('begin;'))).toBe(false)
      expect(existsSync(join(t.dir, 'redproof.lock'))).toBe(false)
    })
  }
  it('bricht ab bei dreckigem supabase/functions (ohne Angebot zum Committen), 0 SQL-Aufrufe', async () => {
    const t = setup({ dirty: ' M supabase/functions/_shared/quote/handler.ts' })
    await expect(t.run.start()).rejects.toBeInstanceOf(PreError)
    expect(t.db.calls).toHaveLength(0)
    await t.run.start().catch((e: Error) => expect(e.message).not.toMatch(/committen/i))
  })
  it('Totmann-Job vorhanden → Exit 2 mit Verweis auf das Restore-Skript', async () => {
    const t = setup()
    t.db.deadman.add('redproof-restore-1-xyz')
    await expect(t.run.start()).rejects.toThrow(RESTORE_CMD)
  })
})

describe('Markierung und Sperre', () => {
  it('offene Markierung → Start bricht ab, exec 0-mal, Meldung nennt das Restore-Skript', async () => {
    const t = setup()
    writeFileSync(join(t.dir, 'redproof-offen-001-x.json'), '{}')
    const err = await t.run.start().catch((e: Error) => e)
    expect(err).toBeInstanceOf(PreError)
    expect(err.message).toContain(RESTORE_CMD)
    expect(t.db.calls).toHaveLength(0)
  })
  it('Sperre mit lebender PID → Abbruch ohne SQL; tote PID → Abbruch mit Restore-Hinweis', async () => {
    const live = setup({ alive: [999] })
    writeFileSync(join(live.dir, 'redproof.lock'), JSON.stringify({ pid: 999 }))
    await expect(live.run.start()).rejects.toThrow(/aktiv/)
    expect(live.db.calls).toHaveLength(0)
    const dead = setup()
    writeFileSync(join(dead.dir, 'redproof.lock'), JSON.stringify({ pid: 998 }))
    await expect(dead.run.start()).rejects.toThrow(RESTORE_CMD)
    expect(dead.db.calls).toHaveLength(0)
  })
  it('Sperre wird beim Ende entfernt', async () => {
    const t = setup()
    await runMain(t.run, async () => EXIT.OK, t.deps)
    expect(existsSync(join(t.dir, 'redproof.lock'))).toBe(false)
  })
})

describe('Fenster, Signal und Restore', () => {
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    it(`${sig} im offenen Fenster → exit(130); der exit-Handler stellt genau einmal wieder her, prüft das Soll und löscht Markierung und Sperre`, async () => {
      const t = setup()
      await t.run.start()
      void t.run.withWindow(F, never)
      await tick()
      expect(markersIn(t.dir)).toHaveLength(1)
      expect(t.db.rows[0].h).toBe('X')
      t.proc.emit(sig)
      expect(t.proc.exits).toEqual([130])
      t.proc.emit('exit')
      expect(commits(t.db, 'RESTORE_F')).toHaveLength(1)
      expect(diffSoll(SOLL, t.db.rows)).toEqual([])
      expect(markersIn(t.dir)).toHaveLength(0)
      expect(existsSync(join(t.dir, 'redproof.lock'))).toBe(false)
      expect(t.db.deadman.size).toBe(0)
    })
  }
  it('Beenden des vitest-Baums geschieht vor dem Restore (Exit-Handler)', async () => {
    const t = setup()
    await t.run.start()
    void t.run.withWindow(F, async () => { await t.run.vitest({ file: 'f.test.ts', pattern: 'x' }) })
    await tick(); await tick()
    t.proc.emit('SIGINT'); t.proc.emit('exit')
    const events = t.db.events
    expect(events.indexOf('kill')).toBeGreaterThan(-1)
    expect(events.indexOf('kill')).toBeLessThan(events.indexOf('tx:RESTORE_F'))
    expect(t.killed).toEqual([777])
  })
  it('gescheiterter Restore → Fatal (Exit 3), Label und Markierungspfad in der Meldung, 3 Versuche, zweites Fenster startet nicht, Markierung bleibt', async () => {
    const t = setup()
    await t.run.start()
    let second = false
    const err = await (async () => {
      await t.run.withWindow(F, async () => { t.db.failRestore = true })
      second = true
      await t.run.withWindow(P, async () => {})
    })().catch((e: Error) => e) as Error
    expect(err).toBeInstanceOf(FatalError)
    expect(err.message).toContain('f gelockert')
    expect(err.message).toMatch(/redproof-offen-001/)
    expect(second).toBe(false)
    expect(commits(t.db, 'RESTORE_F')).toHaveLength(3)
    expect(commits(t.db, 'LOOSEN_P')).toHaveLength(0)
    expect(markersIn(t.dir)).toHaveLength(1)
  })
  it('Endprüfung findet eine verbliebene Lockerung, auch wenn „vorher“ gleich „nachher“ wäre', async () => {
    const t = setup()
    const code = await runMain(t.run, async () => { t.db.rows[1].h = 'pX'; return EXIT.OK }, t.deps)
    expect(code).toBe(EXIT.FAIL)
    expect(t.logs.join('\n')).toContain('policy public.t.p: abweicht')
  })
  it('Transportfehler auf der Lockerung: genau ein Commit-Aufruf, danach Restore', async () => {
    const t = setup()
    await t.run.start()
    t.db.transport = { match: (q) => q.startsWith('begin;') && q.includes('LOOSEN_F') && q.includes('commit;'), applied: true }
    await expect(t.run.withWindow(F, async () => {})).rejects.toBeInstanceOf(StepError)
    expect(commits(t.db, 'LOOSEN_F')).toHaveLength(1)
    expect(diffSoll(SOLL, t.db.rows)).toEqual([])
  })
  it('Transportfehler im Restore: Zustand wird gelesen; Soll-gleich → kein zweites Senden, sonst erneuter Versuch', async () => {
    const arrived = setup()
    await arrived.run.start()
    await arrived.run.withWindow(F, async () => { arrived.db.transport = { match: (q) => q.includes('RESTORE_F') && q.includes('commit;'), applied: true } })
    expect(commits(arrived.db, 'RESTORE_F')).toHaveLength(1)
    const lost = setup()
    await lost.run.start()
    await lost.run.withWindow(F, async () => { lost.db.transport = { match: (q) => q.includes('RESTORE_F') && q.includes('commit;'), applied: false } })
    expect(commits(lost.db, 'RESTORE_F')).toHaveLength(2)
    expect(diffSoll(SOLL, lost.db.rows)).toEqual([])
  })
  it('Lockerung ohne Wirkung auf den Snapshot → StepError, nichts committet, keine Markierung', async () => {
    const t = setup()
    await t.run.start()
    await expect(t.run.withWindow({ label: 'nix', loosen: 'select 1', restore: 'select 1' }, async () => {})).rejects.toBeInstanceOf(StepError)
    expect(t.db.calls.some((c) => c.startsWith('begin;') && c.includes('commit;'))).toBe(false)
    expect(markersIn(t.dir)).toHaveLength(0)
  })
  it('Probe und Commit tragen denselben Lockerungstext (sha256) und die abgeleiteten Schlüssel stehen im Fensterprotokoll', async () => {
    const t = setup()
    await t.run.start()
    await t.run.withWindow(F, async () => {})
    expect(t.run.windowLog).toHaveLength(1)
    expect(t.run.windowLog[0].hashProbe).toBe(t.run.windowLog[0].hashCommit)
    expect(t.run.windowLog[0].keys).toEqual(['function public.f() (abweicht)'])
  })
})

describe('Fensterstapel LIFO und Cron-Pause', () => {
  const pause = { label: 'cron pausiert', loosen: 'select 1 /* PAUSE_JOB */', restore: 'select 1 /* RESUME_JOB */', deadman: false }
  it('Signal bei zwei Fenstern → innen, dann außen', async () => {
    const t = setup()
    await t.run.start()
    void t.run.withWindow(pause, async () => { await t.run.withWindow(F, never) })
    await tick(); await tick()
    t.proc.emit('SIGINT'); t.proc.emit('exit')
    const tx = t.db.events.filter((e) => e.startsWith('tx:'))
    expect(tx).toEqual(['tx:PAUSE_JOB', 'tx:LOOSEN_F', 'tx:RESTORE_F', 'tx:RESUME_JOB'])
    expect(diffSoll(SOLL, t.db.rows)).toEqual([])
  })
  it('scheitert der innere Restore, läuft der äußere nicht: Job bleibt pausiert, Exit-Code 3', async () => {
    const t = setup()
    await t.run.start()
    void t.run.withWindow(pause, async () => { await t.run.withWindow(F, never) })
    await tick(); await tick()
    t.db.failRestore = true
    t.proc.emit('SIGINT'); t.proc.emit('exit')
    expect(commits(t.db, 'RESUME_JOB')).toHaveLength(0)
    expect(t.proc.exitCode).toBe(EXIT.FATAL)
    expect(t.db.rows[3].e).toBe('false')
  })
  it('das innere Fenster ignoriert die Cron-Zeile des äußeren, die Startprüfung nicht', async () => {
    const t = setup()
    await t.run.start()
    await t.run.withWindow(pause, async () => { await t.run.withWindow(F, async () => {}) })
    expect(diffSoll(SOLL, t.db.rows)).toEqual([])
    const again = setup()
    again.db.rows[3].e = 'false'
    await expect(again.run.start()).rejects.toThrow('cron photo-cleanup: abweicht')
  })
  it('cronPause wartet, solange ein Lauf des Jobs läuft', async () => {
    const t = setup()
    await t.run.start()
    t.db.running = [1, 1, 0]
    // Die Pause-SQL kommt aus der Lib (alter_job): die Fake-DB kennt die Textmarken nicht, darum nur die Wartebedingung prüfen
    t.run.waitCleanupIdle()
    expect(t.state.sleeps).toBe(2)
  })
  it('Warteschlange net.http_request_queue nicht leer → wird gewartet, danach StepError', async () => {
    const t = setup()
    await t.run.start()
    t.db.queue = 3
    expect(() => t.run.waitCleanupIdle()).toThrow(StepError)
    expect(t.state.sleeps).toBe(400)
  })
  it('assertCleanupPaused: aktiver Job → StepError; pausiert → ok', async () => {
    const t = setup()
    await t.run.start()
    expect(() => t.run.assertCleanupPaused()).toThrow(StepError)
    t.db.rows[3].e = 'false'
    expect(() => t.run.assertCleanupPaused()).not.toThrow()
  })
  it('Endprüfung findet einen inaktiv gebliebenen Job', async () => {
    const t = setup()
    const code = await runMain(t.run, async () => { t.db.rows[3].e = 'false'; return EXIT.OK }, t.deps)
    expect(code).toBe(EXIT.FAIL)
    expect(t.logs.join('\n')).toContain('cron photo-cleanup: abweicht')
  })
})

describe('Totmannschalter', () => {
  it('Job wird vor dem Commit angelegt (Zeitsperre, Restore in Transaktion, Selbst-Entfernung nach Name) und danach entfernt', async () => {
    const t = setup()
    await t.run.start()
    await t.run.withWindow(F, async () => { expect(t.db.deadman.size).toBe(1) })
    const sched = t.db.calls.findIndex((c) => c.startsWith('select cron.schedule('))
    const commit = t.db.calls.findIndex((c) => c.startsWith('begin;') && c.includes('LOOSEN_F') && c.includes('commit;'))
    expect(sched).toBeGreaterThan(-1)
    expect(sched).toBeLessThan(commit)
    const cmd = t.db.calls[sched]
    expect(cmd).toContain("raise exception 'veraltet'")
    expect(cmd).not.toContain('begin;') // pg_cron: kein explizites begin/commit (beide Ausführungsarten)
    expect(cmd).toContain('set local search_path = "$user", public, extensions;')
    expect(cmd).toContain('select 1 /* RESTORE_F */; select cron.unschedule')
    expect(cmd).toMatch(/cron\.unschedule\(jobid\) from cron\.job where jobname = 'redproof-restore-1-dmabcd1234'/)
    expect(cmd).toContain('$dmabcd1234$')
    expect(t.db.deadman.size).toBe(0)
  })
  it('Job nicht aktiv gelesen → StepError, kein Commit der Lockerung', async () => {
    const t = setup()
    await t.run.start()
    t.db.deadmanInactive = true
    await expect(t.run.withWindow(F, async () => {})).rejects.toBeInstanceOf(StepError)
    expect(commits(t.db, 'LOOSEN_F')).toHaveLength(0)
    expect(diffSoll(SOLL, t.db.rows)).toEqual([])
  })
})

describe('vitest-Auswertung (M-6)', () => {
  const T = (over: any = {}) => ({ fullName: 'Suite a Test', status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'], ...over })
  const rep = (tests: any[], startTime = 2000) => ({ startTime, testResults: [{ assertionResults: tests }] })
  const base = { startedAt: 1000, pattern: 'Test' }
  it('rot nur bei frischem Report, Exit 1, Assertion-Fehler und Muster', () => {
    expect(judgeVitest({ ...base, exit: 1, report: rep([T()]) }).status).toBe('rot')
  })
  it('keine Datei / alte startTime → fehler', () => {
    expect(judgeVitest({ ...base, exit: 1, report: null }).status).toBe('fehler')
    expect(judgeVitest({ ...base, exit: 1, report: rep([T()], 500) }).status).toBe('fehler')
  })
  it('Exit 0 mit grünen Tests → nicht-rot; Exit 2 ohne Fehlschläge → Absturz; nichts gelaufen → fehler', () => {
    expect(judgeVitest({ ...base, exit: 0, report: rep([T({ status: 'passed', failureMessages: [] })]) }).status).toBe('nicht-rot')
    expect(judgeVitest({ ...base, exit: 2, report: rep([T({ status: 'passed' })]) }).reason).toMatch(/abgestürzt/)
    expect(judgeVitest({ ...base, exit: 1, report: rep([]) }).status).toBe('fehler')
  })
  it('gelaufener Test außerhalb des Musters → fehler (auch wenn er grün war)', () => {
    expect(judgeVitest({ ...base, exit: 1, report: rep([T(), T({ fullName: 'anderes', status: 'passed' })]) }).status).toBe('fehler')
  })
  it('Fehlschlag durch Zeitlimit, Netz, Rate-Limit oder Hook ist kein Rot-Beweis', () => {
    for (const m of ['Error: Test timed out in 5000ms', 'TypeError: fetch failed', 'Error: over_request_rate_limit', 'Error: beforeAll hook failed', 'Error: etwas anderes']) {
      expect(judgeVitest({ ...base, exit: 1, report: rep([T({ failureMessages: [m] })]) }).status).toBe('fehler')
    }
  })
  it('verbotener Test (Aufräumen) gelaufen → fehler', () => {
    expect(judgeVitest({ ...base, exit: 1, report: rep([T({ fullName: 'Aufräumen Test' })]), forbid: /Aufräumen/ }).status).toBe('fehler')
  })
  it('Aufruf: altes JSON am Pfad bleibt unbeachtet, das Kind schreibt nichts → fehler', async () => {
    const t = setup()
    await t.run.start()
    writeFileSync(join(t.dir, 'test-1.json'), JSON.stringify(rep([T()], 999_999_999)))
    t.state.onSpawn = (c: any) => c.emit('exit', 1)
    const r = await t.run.vitest({ file: 'f.test.ts', pattern: 'Test' })
    expect(r.status).toBe('fehler')
    expect(r.reason).toMatch(/Report/)
  })
  it('Aufruf: Kind schreibt frischen Report → rot; vitest wird direkt gestartet (kein Wrapper)', async () => {
    const t = setup()
    await t.run.start()
    t.state.onSpawn = (c: any, args: string[]) => {
      const out = args.find((a) => a.startsWith('--outputFile='))!.slice('--outputFile='.length)
      writeFileSync(out, JSON.stringify(rep([T()], 1_000_001)))
      c.emit('exit', 1)
    }
    const r = await t.run.vitest({ file: 'f.test.ts', pattern: 'Test' })
    expect(r.status).toBe('rot')
    expect(t.spawned[0]![0]).toBe('vitest.mjs')
    expect(t.spawned[0]).toContain('-t')
  })
  it('Muster mit Regex-Zeichen („Zeilen-Bedingung (Alt-Pfad“) wird wörtlich an vitest übergeben', async () => {
    const t = setup()
    await t.run.start()
    t.state.onSpawn = (c: any) => c.emit('exit', 1)
    await t.run.vitest({ file: 'f.test.ts', pattern: 'Zeilen-Bedingung (Alt-Pfad {uid}' })
    const arg = t.spawned[0]![t.spawned[0]!.indexOf('-t') + 1]!
    expect(() => new RegExp(arg)).not.toThrow()
    expect(new RegExp(arg).test('Zeilen-Bedingung (Alt-Pfad {uid}/x')).toBe(true)
  })
  it('Zeitlimit: Prozessbaum wird beendet, Schritt = fehler, Fenster stellt wieder her', async () => {
    const t = setup()
    await t.run.start()
    let result: any
    await t.run.withWindow(F, async () => {
      const p = t.run.vitest({ file: 'f.test.ts', pattern: 'Test' })
      await tick()
      t.state.timerFn()
      result = await p
    })
    expect(t.killed).toEqual([777])
    expect(result.status).toBe('fehler')
    expect(diffSoll(SOLL, t.db.rows)).toEqual([])
    expect(markersIn(t.dir)).toHaveLength(0)
  })
})

describe('Modi ohne Schreibzugriff', () => {
  it('print: Fenster werden nur aufgezeichnet, alle SQL-Aufrufe sind reine Selects', async () => {
    const t = setup({ mode: 'print' })
    await t.run.start()
    const v = await t.run.withWindow(F, async () => 'darf nicht laufen')
    expect(v).toBeUndefined()
    t.run.fixture('begin; insert into x values (1); commit;')
    const printed = t.run.printed
    expect(printed.map((p: any) => p.label.split(' ')[0])).toEqual(['Snapshot', 'f', 'Fixture'])
    // genau die Texte, die gesendet würden: Probe, Totmann (ohne begin/commit), Lockerung und Restore in Transaktion, Totmann entfernen
    const sql = printed[1].sql as string
    expect(sql).toContain('begin; select 1 /* LOOSEN_F */; <SNAPSHOT_SQL>; rollback;')
    expect(sql).toContain('select cron.schedule(')
    expect(sql).toContain("raise exception 'veraltet'")
    expect(sql).toContain('begin; select 1 /* LOOSEN_F */; commit; select 1 as x')
    expect(sql).toContain('begin; select 1 /* RESTORE_F */; commit; select 1 as x')
    expect(sql).toContain('select cron.unschedule(jobid)')
    expect(t.db.calls.every((c) => /^select/i.test(c))).toBe(true)
  })
  it('print: die Cron-Pause druckt ihren Text und lässt die Schritte darunter laufen (die selbst nur drucken)', async () => {
    const t = setup({ mode: 'print' })
    await t.run.start()
    let ran = false
    await t.run.cronPause(async () => { ran = true; t.run.fixture('begin; insert into x values (1); commit;') })
    expect(ran).toBe(true)
    expect(t.run.printed.map((p: any) => p.label.split(' ')[0])).toEqual(['Snapshot', 'cron', 'Fixture'])
    expect(t.db.calls.every((c) => /^select/i.test(c))).toBe(true)
  })
  it('readonly: jede Nicht-Select-Anweisung wird abgelehnt, bevor sie gesendet wird', async () => {
    const t = setup({ mode: 'readonly' })
    await t.run.start()
    expect(() => t.run.fixture('begin; delete from x; commit;')).toThrow(PreError)
    await expect(t.run.withWindow(F, async () => {})).rejects.toBeInstanceOf(PreError)
    expect(t.db.calls.some((c) => c.startsWith('begin;'))).toBe(false)
  })
  it('probe() verlangt begin … rollback und sendet den Text genau einmal ohne commit', async () => {
    const t = setup()
    await t.run.start()
    expect(() => t.run.probe('select 1')).toThrow(PreError)
    const q = 'begin; select 1 as x; rollback;'
    t.db.exec = (x: string) => { t.db.calls.push(x); return [{ x: 1 }] }
    t.deps.exec = t.db.exec
    expect(t.run.probe(q)).toEqual([{ x: 1 }])
    expect(t.db.calls.filter((c) => c === q)).toHaveLength(1)
  })
  it('fixture() mit Trigger-Abschaltung ohne begin … commit → abgelehnt; Fixture wird nie wiederholt', async () => {
    const t = setup()
    await t.run.start()
    expect(() => t.run.fixture('alter table x disable trigger y; insert into x values (1)')).toThrow(PreError)
    t.db.transport = { match: (q) => q.includes('insert into x'), applied: true }
    expect(() => t.run.fixture('begin; alter table x disable trigger y; insert into x values (1); alter table x enable trigger y; commit;')).toThrow(/Transport/)
    expect(t.db.calls.filter((c) => c.includes('insert into x'))).toHaveLength(1)
  })
  it('Selects werden bei Transportfehler wiederholt (bis zu 3 Versuche)', async () => {
    const t = setup()
    await t.run.start()
    t.db.transport = { match: (q) => q.includes('jobname like'), applied: false }
    expect(t.run.select("select jobname from cron.job where jobname like 'redproof-restore-%'")).toEqual([])
    expect(t.db.calls.filter((c) => c.includes('jobname like')).length).toBeGreaterThanOrEqual(2)
  })
})

describe('Deploy-Fenster', () => {
  it('lockern, Restore nach dem Fenster; Markierung mit Commit-ID; Exit-Handler stellt wieder her', async () => {
    const t = setup()
    await t.run.start()
    const seen: string[] = []
    await t.run.withDeployWindow({ label: 'quote', commit: 'abc123', loosen: () => seen.push('loosen'), restore: () => seen.push('restore'), verify: () => true }, async () => {
      const m = JSON.parse(readFileSync(join(t.dir, markersIn(t.dir)[0]!), 'utf8'))
      expect(m).toMatchObject({ type: 'deploy', commit: 'abc123' })
    })
    expect(seen).toEqual(['loosen', 'restore'])
    expect(markersIn(t.dir)).toHaveLength(0)
    const t2 = setup()
    await t2.run.start()
    const seen2: string[] = []
    void t2.run.withDeployWindow({ label: 'quote', commit: 'abc123', loosen: () => seen2.push('loosen'), restore: () => seen2.push('restore'), verify: () => true }, never)
    await tick()
    t2.proc.emit('SIGINT'); t2.proc.emit('exit')
    expect(seen2).toEqual(['loosen', 'restore'])
    expect(markersIn(t2.dir)).toHaveLength(0)
  })
  it('fehlschlagende Verifikation nach 3 Versuchen → Fatal, Markierung bleibt', async () => {
    const t = setup()
    await t.run.start()
    let n = 0
    const err = await t.run.withDeployWindow({ label: 'quote', commit: 'abc123', loosen: () => {}, restore: () => { n++ }, verify: () => false }, async () => {}).catch((e: Error) => e)
    expect(err).toBeInstanceOf(FatalError)
    expect(n).toBe(3)
    expect(markersIn(t.dir)).toHaveLength(1)
  })
})

describe('Restore von Hand (recover)', () => {
  const pause = { label: 'cron pausiert', loosen: 'select 1 /* PAUSE_JOB */', restore: 'select 1 /* RESUME_JOB */', deadman: false }
  async function crashed() {
    const first = setup()
    await first.run.start()
    void first.run.withWindow(pause, async () => { await first.run.withWindow(F, never) })
    await tick(); await tick()
    return first
  }
  it('zwei Markierungen → innen, dann außen; danach Markierungen, Totmann-Job und Sperre weg, Soll gleich', async () => {
    const first = await crashed()
    expect(markersIn(first.dir)).toHaveLength(2)
    const second = setup({ dir: first.dir, db: first.db })
    first.db.events.length = 0
    const out = await second.run.recover()
    expect(first.db.events.filter((e) => e.startsWith('tx:'))).toEqual(['tx:RESTORE_F', 'tx:RESUME_JOB'])
    expect(out.restored).toEqual(['f gelockert', 'cron pausiert'])
    expect(markersIn(first.dir)).toHaveLength(0)
    expect(first.db.deadman.size).toBe(0)
    expect(existsSync(join(first.dir, 'redproof.lock'))).toBe(false)
    expect(diffSoll(SOLL, first.db.rows)).toEqual([])
  })
  it('lebende PID in der Sperre → Abbruch ohne Executor-Aufruf; tote PID wird übernommen', async () => {
    const first = await crashed()
    first.db.calls.length = 0
    const alive = setup({ dir: first.dir, db: first.db, alive: [4242] })
    await expect(alive.run.recover()).rejects.toThrow(/aktiv/)
    expect(first.db.calls).toHaveLength(0)
    const dead = setup({ dir: first.dir, db: first.db, alive: [] })
    await expect(dead.run.recover()).resolves.toBeTruthy()
  })
  it('verlangt sauberen supabase/functions-Stand', async () => {
    const first = await crashed()
    first.db.calls.length = 0
    const dirty = setup({ dir: first.dir, db: first.db, dirty: ' M x' })
    await expect(dirty.run.recover()).rejects.toBeInstanceOf(PreError)
    expect(first.db.calls).toHaveLength(0)
  })
})

describe('Abnahme R1 Runde 1 (Berater)', () => {
  const pause = { label: 'cron pausiert', loosen: 'select 1 /* PAUSE_JOB */', restore: 'select 1 /* RESUME_JOB */', deadman: false }
  it('H-1: scheitert der innere Restore im normalen Ablauf (kein Signal), läuft der äußere nicht; die Meldung nennt das innere Fenster', async () => {
    const t = setup()
    await t.run.start()
    const err = await t.run.withWindow(pause, async () => {
      await t.run.withWindow(F, async () => { t.db.failRestore = true })
    }).catch((e: Error) => e)
    expect(err).toBeInstanceOf(FatalError)
    expect((err as Error).message).toContain('f gelockert')
    expect(commits(t.db, 'RESUME_JOB')).toHaveLength(0)
    expect(t.db.rows[3].e).toBe('false') // Job bleibt pausiert
    expect(markersIn(t.dir)).toHaveLength(2) // beide Markierungen bleiben
  })
  it('H-1: fehlschlagender Schritt im inneren Fenster (StepError), Restore gelingt → innen, dann außen, Soll gleich', async () => {
    const t = setup()
    await t.run.start()
    const err = await t.run.withWindow(pause, async () => { await t.run.withWindow(F, async () => { throw new StepError('Schritt rot') }) }).catch((e: Error) => e)
    expect(err).toBeInstanceOf(StepError)
    expect(t.db.events.filter((e) => e.startsWith('tx:'))).toEqual(['tx:PAUSE_JOB', 'tx:LOOSEN_F', 'tx:RESTORE_F', 'tx:RESUME_JOB'])
    expect(diffSoll(SOLL, t.db.rows)).toEqual([])
    expect(markersIn(t.dir)).toHaveLength(0)
  })
  it('M-1: pg_cron nicht in GMT/UTC oder ohne erfolgreichen Lauf → Exit 2 vor dem Lockern', async () => {
    const tz = setup()
    tz.db.cronInfo = { tz: 'Europe/Vienna', bg: 'off', alive: 3 }
    await expect(tz.run.start()).rejects.toThrow(/GMT\/UTC/)
    expect(existsSync(join(tz.dir, 'redproof.lock'))).toBe(false)
    const dead = setup()
    dead.db.cronInfo = { tz: 'GMT', bg: 'off', alive: 0 }
    await expect(dead.run.start()).rejects.toBeInstanceOf(PreError)
    expect(dead.db.calls.some((c) => c.startsWith('begin;'))).toBe(false)
  })
  it('M-3: das Restore-Skript quittiert; der Start zählt Fehlläufe nur nach der Quittung', async () => {
    const t = setup()
    await t.run.recover()
    expect(existsSync(join(t.dir, 'redproof-totmann-quittung.json'))).toBe(true)
    const next = setup({ dir: t.dir })
    await next.run.start()
    const q = next.db.calls.find((c) => c.includes("status = 'failed'"))
    expect(q).toContain("greatest(")
    expect(q).toContain("'2026-01-01 00:00:00+00'::timestamptz")
    const fresh = setup()
    await fresh.run.start()
    expect(fresh.db.calls.find((c) => c.includes("status = 'failed'"))).toContain("'-infinity'::timestamptz)")
  })
  it('M-2: Totmann-Probelauf legt je Restore-Art genau einen Job an, wartet auf succeeded, Jobs weg, Soll gleich', async () => {
    const t = setup()
    await t.run.start()
    const lines = t.run.deadmanProbe([
      { label: 'a', restore: 'create or replace function public.f() returns int as $f$ select 1 $f$' },
      { label: 'b', restore: 'create or replace function public.g() returns int as $f$ select 2 $f$' },
      { label: 'c', restore: 'alter policy p on public.t using (true)' },
      { label: 'd', restore: 'alter policy p on storage.objects using (true)' },
    ])
    expect(lines).toHaveLength(3)
    expect(t.db.probeJobs).toHaveLength(3)
    expect(t.db.deadman.size).toBe(0)
    const sched = t.db.calls.filter((c) => c.startsWith('select cron.schedule('))
    expect(sched).toHaveLength(3)
    expect(sched.every((c) => c.includes("raise exception 'veraltet'") && c.includes('set local search_path') && !c.includes('begin;'))).toBe(true)
  })
  it('M-2: scheitert ein Probe-Job → StepError mit der Meldung des Jobs, alle Probe-Jobs werden entfernt', async () => {
    const t = setup()
    await t.run.start()
    t.db.probeFail = true
    expect(() => t.run.deadmanProbe([{ label: 'a', restore: 'alter policy p on public.t using (true)' }])).toThrow(/permission denied/)
    expect(t.db.deadman.size).toBe(0)
  })
  it('restoreKinds: Arten je Restore, kombinierte Restores zählen mehrfach', () => {
    expect(restoreKinds('grant select on public.t to authenticated')).toEqual(['recht'])
    expect(restoreKinds('alter table public.t enable trigger x')).toEqual(['trigger'])
    expect(restoreKinds("alter policy p on storage.objects using (true);\nalter policy q on public.t using (true)")).toEqual(['policy-storage', 'policy'])
    expect(restoreKinds('delete from public.t where x;\nalter table public.t drop constraint if exists c;\nalter table public.t add constraint c check (true)')).toEqual(['constraint'])
    expect(restoreKinds('select 1')).toEqual(['sonstige'])
  })
  it('N-1: Lese-Sperre erkennt schreibende CTEs, Cron-Schreibfunktionen, mehrere Anweisungen und „--“ in Zeichenketten', () => {
    expect(isSelect(SNAPSHOT_SQL)).toBe(true)
    expect(isSelect('select schedule, created_at, updated_at from cron.job')).toBe(true)
    expect(isSelect("select 'a;b; delete' as x -- Kommentar; drop")).toBe(true)
    expect(isSelect("select cron.schedule('x', '* * * * *', 'select 1')")).toBe(false)
    expect(isSelect("select cron.alter_job(1, active := false)")).toBe(false)
    expect(isSelect('with d as (delete from t returning 1) select * from d')).toBe(false)
    expect(isSelect("select '--' ; delete from t")).toBe(false)
    expect(isSelect('select 1; select 2')).toBe(false)
    expect(isSelect("select set_config('a', 'b', false)")).toBe(false)
  })
})

describe('Soll-Erzeugung verweigert gelockerten Zustand', () => {
  it('Trigger nicht O, inaktiver Cron-Job, Objekt mit Präfix redproof', () => {
    expect(refuseReasons(SOLL)).toEqual([])
    expect(refuseReasons([{ k: 'trigger', n: 'public.t.x', h: 'a', e: 'D' }]).join()).toContain('public.t.x')
    expect(refuseReasons([{ k: 'cron', n: 'photo-cleanup', h: 'a', e: 'false' }]).join()).toContain('inaktiv')
    expect(refuseReasons([{ k: 'policy', n: 'storage.objects.redproof_update', h: 'a', e: null }]).join()).toContain('redproof')
  })
})
