// Gemeinsame Mechanik der Redproof-Skripte (R1, Plan tmp/proof/r1-plan.md mit Nachträgen 1 und 2).
// Ein Ablauf: Git-Sauberkeit → Offen-Markierungen (ohne DB) → Sperre → Soll-Prüfung → Fenster (LIFO) → Endprüfung.
// Alle Seiteneffekte kommen über `deps` (Tests ohne Dev). Laufzeitausgaben nennen nur Art und Name, nie Funktions- oder Policy-Text.
// Exit-Codes: 0 bestanden, 1 Redproof fehlgeschlagen, 2 Vorprüfung (nichts gelockert), 3 Fatal (Restore offen), 130 Signal.
import { createHash, randomBytes } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync, writeSync } from 'node:fs'
import { execFileSync, spawn as nodeSpawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

export const EXIT = { OK: 0, FAIL: 1, PRE: 2, FATAL: 3, SIGNAL: 130 }
export const DEADMAN_MIN = 30 // Frist des Totmannschalters: größte Fensterdauer (Probe, Commit, vitest bis Timeout, 3 Restores, Soll-Prüfung) plus Puffer
export const VITEST_TIMEOUT_MS = 10 * 60_000
export const CLEANUP_JOB = 'photo-cleanup'
export const CLEANUP_WAIT_S = 360 // seit dem letzten Lauf des Jobs: Function-Timeout (Edge Function photo-cleanup) plus Puffer
export const DEADMAN_PREFIX = 'redproof-restore-'
export const RESTORE_CMD = 'node scripts/redproof-restore.mjs'
export class PreError extends Error {}
export class FatalError extends Error {}
export class StepError extends Error {}

// --- Snapshot: eine Quelle für Soll-Erzeugung, Start-, Schritt- und Endprüfung -------------------------------------------------------
// Ausgabe je Zeile: k (Art), n (Name), h (md5 des Inhalts), e (Flag: Trigger tgenabled, cron active).
export const SNAPSHOT_SQL = `select k, n, md5(v) as h, e from (
  select 'table' as k, ns.nspname || '.' || c.relname as n, concat_ws(' ', c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relowner::regrole::text, c.relacl::text, c.reloptions::text) as v, null::text as e
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')
  union all
  select 'viewdef', ns.nspname || '.' || c.relname, pg_get_viewdef(c.oid), null
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relkind in ('v', 'm')
  union all
  select 'column', ns.nspname || '.' || c.relname || '.' || a.attname, concat_ws(' ', format_type(a.atttypid, a.atttypmod), a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '<kein Default>'), a.attacl::text), null
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace ns on ns.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where ns.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
  union all
  select 'policy', p.schemaname || '.' || p.tablename || '.' || p.policyname, concat_ws(' ', p.permissive, p.cmd, p.roles::text, p.qual, p.with_check), null
    from pg_policies p where p.schemaname = 'public' or (p.schemaname = 'storage' and p.tablename = 'objects')
  union all
  select 'constraint', ns.nspname || '.' || c.relname || '.' || k.conname, concat_ws(' ', pg_get_constraintdef(k.oid), k.convalidated), null
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public'
  union all
  select 'trigger', ns.nspname || '.' || c.relname || '.' || t.tgname, concat_ws(' ', t.tgenabled, pg_get_triggerdef(t.oid)), t.tgenabled::text
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace ns on ns.oid = c.relnamespace
    where not t.tgisinternal and (ns.nspname = 'public' or (ns.nspname = 'auth' and c.relname = 'users') or (ns.nspname = 'storage' and c.relname = 'objects'))
  union all
  select 'function', p.pronamespace::regnamespace::text || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    concat_ws(' ', md5(pg_get_functiondef(p.oid)), md5(p.prosrc), p.proacl::text, p.proowner::regrole::text, p.prosecdef, p.proconfig::text), null
    from pg_proc p where p.pronamespace::regnamespace::text in ('public', 'private') and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  union all
  select 'schema', nspname, concat_ws(' ', nspowner::regrole::text, nspacl::text), null from pg_namespace where nspname in ('public', 'private', 'storage')
  union all
  select 'defacl', defaclrole::regrole::text || '.' || coalesce(defaclnamespace::regnamespace::text, '') || '.' || defaclobjtype::text, defaclacl::text, null from pg_default_acl
  union all
  select 'bucket', id, concat_ws(' ', public, file_size_limit, allowed_mime_types::text), null from storage.buckets
  union all
  select 'role', rolname, concat_ws(' ', rolsuper, rolbypassrls, rolcanlogin, rolinherit, rolcreaterole, rolcreatedb), null from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
  union all
  select 'member', r.rolname || '>' || m.rolname, am.admin_option::text, null from pg_auth_members am join pg_roles r on r.oid = am.roleid join pg_roles m on m.oid = am.member
    where r.rolname in ('anon', 'authenticated', 'service_role') or m.rolname in ('anon', 'authenticated', 'service_role', 'authenticator')
  union all
  select 'evtrigger', evtname, concat_ws(' ', evtevent, evtenabled, evtfoid::regproc::text), null from pg_event_trigger
  union all
  select 'extension', e.extname, concat_ws(' ', e.extversion, e.extnamespace::regnamespace::text), null from pg_extension e
  union all
  select 'setting', key, count(*)::text, null from public.platform_settings group by key
  union all
  select 'cron', jobname, concat_ws(' ', schedule, active, command), active::text from cron.job where jobname is not null
) s order by 1, 2`

const sha = (s) => createHash('sha256').update(s).digest('hex')
const DEADMAN_PROBE_MIN = 2
/** Arten von SQL-Anweisungen in einem Restore (für den Totmann-Probelauf: jede Art mindestens einmal). */
export function restoreKinds(sql) {
  const s = sql.replace(/\s+/g, ' ').toLowerCase()
  const kinds = []
  if (/cron\.alter_job/.test(s)) kinds.push('cron')
  if (/create or replace function/.test(s)) kinds.push('funktion')
  if (/alter policy [^;]* on storage\./.test(s)) kinds.push('policy-storage')
  if (/alter policy [^;]* on public\./.test(s)) kinds.push('policy')
  if (/add constraint/.test(s)) kinds.push('constraint')
  if (/(enable|disable) trigger/.test(s)) kinds.push('trigger')
  if (/\b(grant|revoke)\b/.test(s)) kinds.push('recht')
  if (/set default|drop default/.test(s)) kinds.push('default')
  if (/drop (policy|function|trigger|table|view) if exists/.test(s)) kinds.push('drop-if-exists')
  return kinds.length ? kinds : ['sonstige']
}
const keyOf = (r) => `${r.k}|${r.n}`
/** Text ohne Zeichenketten ('…' mit '' als Escape, $tag$…$tag$) und Kommentare: erst Zeichenketten, dann Kommentare (ein „--“ in einer Zeichenkette ist kein Kommentar). */
const stripSql = (q) => q.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "''").replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*(\n|$)/g, '\n').replace(/\/\*[\s\S]*?\*\//g, ' ').trim()
const WRITES = /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|copy|call|do|execute|vacuum|set_config|nextval|pg_terminate_backend|pg_cancel_backend)\b|\bcron\s*\.\s*(schedule|unschedule|alter_job|schedule_in_database)\b/i
/** Reiner Lese-Select: beginnt mit select/with, genau eine Anweisung, kein schreibendes Schlüsselwort und keine Cron-Schreibfunktion (auch nicht in einem CTE). */
export const isSelect = (q) => {
  const s = stripSql(q)
  return /^(select|with)\b/i.test(s) && !s.replace(/;\s*$/, '').includes(';') && !WRITES.test(s)
}
export const isProbeSql = (q) => /^begin\s*;/i.test(stripSql(q)) && /\brollback\s*;?\s*$/i.test(stripSql(q)) && !/\bcommit\b/i.test(q)
const wrapTx = (q) => (/^\s*begin\s*;/i.test(q) ? q : `begin; ${q.replace(/;\s*$/, '')}; commit; select 1 as x`)

/** Vergleich Soll gegen Ist nach (Art, Name): fehlt / zusätzlich / abweicht. `ignore`: 'k|n' oder Präfix mit '*'. */
export function diffSoll(soll, ist, ignore = []) {
  const skip = (r) => ignore.some((i) => (i.endsWith('*') ? keyOf(r).startsWith(i.slice(0, -1)) : keyOf(r) === i))
  const a = new Map(soll.filter((r) => !skip(r)).map((r) => [keyOf(r), r]))
  const b = new Map(ist.filter((r) => !skip(r)).map((r) => [keyOf(r), r]))
  const out = []
  for (const [key, r] of a) {
    const x = b.get(key)
    if (!x) out.push({ k: r.k, n: r.n, state: 'fehlt' })
    else if (x.h !== r.h || (x.e ?? null) !== (r.e ?? null)) out.push({ k: r.k, n: r.n, state: 'abweicht' })
  }
  for (const [key, r] of b) if (!a.has(key)) out.push({ k: r.k, n: r.n, state: 'zusätzlich' })
  return out.sort((x, y) => (keyOf(x) + x.state).localeCompare(keyOf(y) + y.state))
}
export const fmtDiff = (d) => d.map((x) => `${x.k} ${x.n}: ${x.state}`).join('; ')
const sameDiff = (a, b) => fmtDiff(a) === fmtDiff(b)

const FAILURE_BAD = /timeout|timed out|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|rate limit|over_request_rate_limit|429|before(All|Each)|hook/i
const FAILURE_ASSERT = /AssertionError|expected/i
const patternMatches = (pattern, name) => {
  if (name.includes(pattern)) return true
  try { return new RegExp(pattern).test(name) } catch { return false }
}

/** Auswertung eines frischen vitest-JSON (M-6). `exit`: Exit-Code des Kindes oder 'timeout'. */
export function judgeVitest({ exit, report, startedAt, pattern, forbid }) {
  if (exit === 'timeout') return { status: 'fehler', reason: 'Zeitlimit des vitest-Laufs', failed: [], ran: 0, passed: 0 }
  if (!report) return { status: 'fehler', reason: 'keine Report-Datei vom Lauf dieses Aufrufs', failed: [], ran: 0, passed: 0 }
  if (!(report.startTime >= startedAt)) return { status: 'fehler', reason: 'Report ist älter als der Aufruf', failed: [], ran: 0, passed: 0 }
  const tests = (report.testResults ?? []).flatMap((f) => f.assertionResults ?? [])
  const ran = tests.filter((t) => t.status === 'failed' || t.status === 'passed')
  const failed = ran.filter((t) => t.status === 'failed')
  const out = { failed: failed.map((t) => t.fullName), ran: ran.length, passed: ran.length - failed.length, message: failed[0]?.failureMessages?.[0]?.split('\n')[0]?.slice(0, 200) }
  if (exit !== 0 && exit !== 1) return { ...out, status: 'fehler', reason: `vitest abgestürzt (Exit ${exit})` }
  if (ran.length === 0) return { ...out, status: 'fehler', reason: 'kein Test gelaufen' }
  const stray = ran.filter((t) => !patternMatches(pattern, t.fullName))
  if (stray.length) return { ...out, status: 'fehler', reason: `gelaufener Test passt nicht auf das Muster: ${stray[0].fullName}` }
  if (forbid && ran.some((t) => forbid.test(t.fullName))) return { ...out, status: 'fehler', reason: 'verbotener Test gelaufen' }
  if (exit === 0) return { ...out, status: 'nicht-rot', reason: 'Exit 0, alle Tests grün' }
  if (failed.length === 0) return { ...out, status: 'fehler', reason: 'Exit 1 ohne fehlgeschlagenen Test' }
  const bad = failed.find((t) => { const l = t.failureMessages?.[0]?.split('\n')[0] ?? ''; return FAILURE_BAD.test(l) || !FAILURE_ASSERT.test(l) })
  if (bad) return { ...out, status: 'fehler', reason: `Fehler ist kein Assertion-Fehler: ${bad.fullName}` }
  return { ...out, status: 'rot', reason: '' }
}

export function createRun(deps, { name, mode = 'write', soll }) {
  const dir = deps.dir
  const lockPath = join(dir, 'redproof.lock')
  const stack = []
  const windowLog = []
  const printed = []
  let nr = 0
  let probeNr = 0
  let locked = false
  let handlersOn = false
  let fatal = false
  const log = (m) => deps.log(m)

  // --- SQL: genau ein Versuch; nur Selects und Probe-Transaktionen (enden in rollback) werden bei Transportfehler wiederholt ---------------
  const send = (q) => {
    if (mode !== 'write' && !isSelect(q)) throw new PreError(`Modus ${mode}: nur Selects erlaubt`)
    const retry = isSelect(q) || isProbeSql(q)
    for (let attempt = 1; ; attempt++) {
      try { return deps.exec(q) } catch (e) {
        if (!retry || !e?.transport || attempt >= 3) throw e
        log(`Transportfehler zur Management-API, Versuch ${attempt + 1} von 3`)
        deps.sleep(2000 * attempt)
      }
    }
  }
  const snapshot = () => send(SNAPSHOT_SQL)
  const markers = () => (existsSync(dir) ? readdirSync(dir).filter((f) => /^redproof-offen-\d+-.*\.json$/.test(f)).sort() : [])
  const readMarker = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))
  const ignoreFor = (w) => {
    const i = stack.indexOf(w)
    const below = (i < 0 ? stack : stack.slice(0, i)).flatMap((x) => x.touched)
    return [...below, `cron|${DEADMAN_PREFIX}*`]
  }
  const writeMarker = (w) => {
    mkdirSync(dir, { recursive: true })
    const file = `redproof-offen-${String(w.nr).padStart(3, '0')}-${new Date(deps.now()).toISOString().replace(/[:.]/g, '-')}.json`
    w.marker = join(dir, file)
    const fd = openSync(w.marker, 'wx')
    try {
      writeSync(fd, JSON.stringify({ nr: w.nr, type: w.kind, label: w.label, script: name, time: new Date(deps.now()).toISOString(), restoreSql: w.restore ?? null, commit: w.commit ?? null, deadman: null, touched: w.touched }, null, 1))
      fsyncSync(fd)
    } finally { closeSync(fd) }
  }
  const updateMarker = (w) => {
    const m = JSON.parse(readFileSync(w.marker, 'utf8'))
    writeFileSync(w.marker, JSON.stringify({ ...m, deadman: w.deadman ?? null }, null, 1))
  }
  const releaseLock = () => { if (locked) { rmSync(lockPath, { force: true }); locked = false } }
  const quittPath = join(dir, 'redproof-totmann-quittung.json')
  const quittung = () => { try { return JSON.parse(readFileSync(quittPath, 'utf8')).time } catch { return '-infinity' } }

  // --- Totmannschalter (M-A): einmaliger pg_cron-Job, der den Restore nach Frist nachholt --------------------------------------------------
  /**
   * Befehl und Zeitplan des Totmann-Jobs. Kein begin/commit im Befehl: pg_cron führt einen mehrteiligen Befehl in beiden Ausführungsarten
   * (libpq und Background-Worker) als eine Transaktion aus; ein Fehler bricht alles ab, auch das Entfernen. Der search_path der Cron-Sitzung wird gesetzt,
   * weil Restore-Texte aus pg_get_functiondef/pg_policies ohne Schema-Präfix stammen. `restore`: Rohtext ohne begin/commit.
   */
  const deadmanCommand = (jobName, restore, ts) => `set local search_path = "$user", public, extensions; do $g$ begin if now() > '${ts}'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; ${restore.replace(/;\s*$/, '')}; select cron.unschedule(jobid) from cron.job where jobname = '${jobName}'`
  const deadmanTime = (minutes) => send(`select to_char((now() + interval '${minutes} minutes') at time zone 'UTC', 'FMMI FMHH24 FMDD FMMM') || ' *' as expr, to_char(now() + interval '${minutes} minutes', 'YYYY-MM-DD"T"HH24:MI:SSOF') as ts`)[0]
  const freeTag = (text) => {
    let tag = `dm${deps.randomTag()}`
    while (text.includes(`$${tag}$`)) tag = `dm${deps.randomTag()}`
    if (text.includes('$g$')) throw new StepError('Restore-Text enthält $g$')
    return tag
  }
  const planDeadman = (w, restore, minutes = DEADMAN_MIN) => {
    const tag = freeTag(restore)
    const jobName = `${DEADMAN_PREFIX}${w.nr}-${tag}`
    const t = deadmanTime(minutes)
    send(`select cron.schedule('${jobName}', '${t.expr}', $${tag}$${deadmanCommand(jobName, restore, t.ts)}$${tag}$)`)
    w.deadman = jobName // sofort in die Markierung: auch wenn die Aktiv-Abfrage scheitert, kennt das Restore den Job
    updateMarker(w)
    const on = send(`select active from cron.job where jobname = '${jobName}'`)
    if (!on.length || on[0].active !== true) throw new StepError('Totmann-Job nicht angelegt oder nicht aktiv: kein Commit')
    w.deadman = jobName
    updateMarker(w)
  }
  const removeDeadman = (jobName) => {
    for (let i = 0; i < 40; i++) {
      const running = send(`select count(*)::int as n from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname = '${jobName}' and d.status = 'running'`)[0]?.n ?? 0
      if (running === 0) break
      deps.sleep(5000)
    }
    send(`select cron.unschedule(jobid) from cron.job where jobname = '${jobName}'`)
    const left = send(`select count(*)::int as n from cron.job where jobname = '${jobName}'`)[0]?.n ?? 0
    if (left !== 0) throw new FatalError(`Totmann-Job ${jobName} nicht entfernt`)
  }

  // --- Restore: bis zu 3 Versuche, nach jedem Senden wird der Zustand gelesen; Soll-gleich → nichts erneut senden --------------------------
  const restoreVerified = (w, ignore) => {
    const tx = wrapTx(w.restore)
    let last = ''
    for (let i = 1; i <= 3; i++) {
      try { send(tx) } catch (e) { last = String(e?.message ?? e).slice(0, 200) }
      try {
        const d = diffSoll(soll, snapshot(), ignore)
        if (d.length === 0) return
        last = last || fmtDiff(d)
      } catch (e) { last = String(e?.message ?? e).slice(0, 200) }
    }
    throw new FatalError(`Restore fehlgeschlagen: ${w.label}. Markierung ${w.marker}. Letzter Fehler: ${last}. Wiederherstellen: ${RESTORE_CMD}`)
  }
  const killChildren = (w) => { for (const c of w.children) { try { deps.killTree(c.pid) } catch { /* Prozess schon beendet */ } } w.children.clear() }
  const finishWindow = (w) => {
    try {
      if (w.kind === 'deploy') {
        for (let i = 1; i <= 3; i++) {
          try { w.restoreFn(); if (w.verify()) break } catch { /* nächster Versuch */ }
          if (i === 3) throw new FatalError(`Deploy-Restore fehlgeschlagen: ${w.label}. Markierung ${w.marker}. Wiederherstellen: ${RESTORE_CMD}`)
        }
      } else {
        restoreVerified(w, ignoreFor(w))
        if (w.deadman) removeDeadman(w.deadman)
      }
    } catch (e) {
      if (e instanceof FatalError) fatal = true // ab hier stellt kein äußeres Fenster mehr her (LIFO), auch nicht im normalen finally
      throw e
    }
    rmSync(w.marker, { force: true })
    stack.splice(stack.indexOf(w), 1)
  }
  /** finally eines Fensters: nur wiederherstellen, wenn kein Fatal vorliegt und das Fenster das oberste ist; sonst nichts senden, der ursprüngliche Fehler bleibt (H-1). */
  const closeWindow = (w) => {
    killChildren(w)
    if (!fatal && stack[stack.length - 1] === w) finishWindow(w)
  }
  const onExit = () => {
    const before = fatal
    try {
      for (const w of [...stack].reverse()) {
        killChildren(w)
        try { finishWindow(w) } catch (e) { log(String(e?.message ?? e)); fatal = true; break }
      }
    } catch (e) { log(`Exit-Handler: ${e?.message ?? e}`); fatal = true }
    if (before && stack.length === 0) log('Exit-Handler: nach dem Fatal wurde jetzt wiederhergestellt (Markierungen entfernt); der Exit-Code 3 bleibt, die Sperre auch bis zur Prüfung mit dem Restore-Skript.')
    if (fatal) deps.proc.exitCode = EXIT.FATAL
    else releaseLock()
  }
  const onSignal = () => deps.proc.exit(EXIT.SIGNAL)
  const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']
  const register = () => {
    if (handlersOn) return
    handlersOn = true
    for (const s of SIGNALS) deps.proc.on(s, onSignal)
    deps.proc.on('exit', onExit)
  }

  const run = {
    soll, windowLog, printed,
    get stack() { return stack },
    select: (q) => { if (!isSelect(q)) throw new PreError('select() verlangt einen reinen Select'); return send(q) },
    /** Fixture-SQL: genau ein Versuch; Texte mit Trigger-Abschaltung müssen begin … commit enthalten. */
    fixture(q) {
      if (/disable\s+trigger/i.test(q) && !/^\s*begin\s*;[\s\S]*\bcommit\s*;/i.test(q)) throw new PreError('Fixture mit Trigger-Abschaltung ohne begin … commit')
      if (mode === 'print') { printed.push({ label: 'Fixture', sql: q }); return [] }
      return send(q)
    },
    /** Probe-Transaktion (begin … rollback): nichts wird committet. */
    probe(q) {
      if (!isProbeSql(q)) throw new PreError('probe() verlangt begin … rollback')
      if (mode === 'print') { printed.push({ label: 'Probe', sql: q }); return [] }
      probeNr++
      return send(q)
    },

    async start() {
      try {
        const dirty = deps.git.functionsStatus()
        if (dirty) throw new PreError(`supabase/functions hat Änderungen gegenüber HEAD (git status --porcelain nicht leer): ${dirty.split('\n').length} Eintrag/Einträge. Nichts gelockert.`)
        if (mode === 'write' && !deps.git.sollClean()) throw new PreError('scripts/redproof-soll.json weicht von HEAD ab (oder ist nicht eingecheckt). Nichts gelockert.')
        if (mode === 'write') {
          const open = markers()
          if (open.length) throw new PreError(`Offene Markierung(en): ${open.join(', ')}. Wiederherstellen: ${RESTORE_CMD}`)
          if (existsSync(lockPath)) {
            const l = JSON.parse(readFileSync(lockPath, 'utf8'))
            throw new PreError(deps.isAlive(l.pid) ? `Ein Redproof-Lauf ist aktiv (PID ${l.pid}).` : `Sperre eines beendeten Laufs (PID ${l.pid}). Wiederherstellen: ${RESTORE_CMD}`)
          }
          mkdirSync(dir, { recursive: true })
          const fd = openSync(lockPath, 'wx')
          try { writeSync(fd, JSON.stringify({ pid: deps.pid, script: name, time: new Date(deps.now()).toISOString() })); fsyncSync(fd) } finally { closeSync(fd) }
          locked = true
          register()
        }
        const dm = send(`select jobname from cron.job where jobname like '${DEADMAN_PREFIX}%'`)
        if (dm.length) throw new PreError(`Totmann-Job(s) vorhanden: ${dm.map((r) => r.jobname).join(', ')}. Wiederherstellen: ${RESTORE_CMD}`)
        // Fehlläufe zählen erst nach dem späteren von: letzter erfolgreicher Totmann-Lauf, Quittung des Restore-Skripts (M-3)
        const bad = send(`select count(*)::int as n from cron.job_run_details where command like '%${DEADMAN_PREFIX}%' and status = 'failed' and start_time > greatest(coalesce((select max(start_time) from cron.job_run_details where command like '%${DEADMAN_PREFIX}%' and status = 'succeeded'), '-infinity'::timestamptz), '${quittung()}'::timestamptz)`)[0]?.n ?? 0
        if (bad > 0) throw new PreError(`${bad} fehlgeschlagene(r) Totmann-Lauf/Läufe seit dem letzten sauberen. Wiederherstellen und quittieren: ${RESTORE_CMD}`)
        if (mode === 'write') {
          // Vorbedingungen des Totmanns (M-1): Zeitzone, Lebendigkeit von pg_cron; Ausführungsart nur zur Kenntnis
          const cr = send(`select current_setting('cron.timezone', true) as tz, current_setting('cron.use_background_workers', true) as bg, (select count(*)::int from cron.job_run_details where status = 'succeeded' and end_time > now() - interval '65 minutes') as alive`)[0]
          if (cr?.tz && !/^(GMT|UTC)$/i.test(cr.tz)) throw new PreError(`pg_cron läuft nicht in GMT/UTC (cron.timezone = ${cr.tz}): der Totmann-Zeitplan wäre falsch. Nichts gelockert.`)
          if (!cr?.alive) throw new PreError('pg_cron: kein erfolgreicher Lauf in den letzten 65 Minuten, der Totmann wäre unwirksam. Nichts gelockert.')
          log(`pg_cron: Zeitzone ${cr.tz ?? 'Standard'}, Background-Worker ${cr.bg ?? 'unbekannt'}, ${cr.alive} erfolgreiche Läufe in 65 min`)
        }
        if (mode === 'print') printed.push({ label: 'Snapshot (SNAPSHOT_SQL): nur ein Select, nach jeder Lockerung und jedem Restore', sql: SNAPSHOT_SQL })
        const d = diffSoll(soll, snapshot())
        if (d.length) throw new PreError(`Dev weicht vom Soll ab (nichts gelockert): ${fmtDiff(d)}`)
        const acc = send(`select count(*)::int as n, min(created_at)::text as oldest from auth.users where email like 'redproof-%@movenow.test'`)[0]
        if (acc?.n > 0) log(`Warnung: ${acc.n} Konto/Konten redproof-%@movenow.test, ältestes ${acc.oldest} (Aufräumen: node scripts/redproof-cleanup.mjs)`)
      } catch (e) {
        releaseLock()
        throw e
      }
    },

    /** Gelockertes SQL-Fenster: Probe-Transaktion (Schlüssel ableiten) → Markierung → Totmann → Commit → Diff → fn → Restore. */
    async withWindow({ label, loosen, restore, deadman = true }, fn) {
      if (mode === 'print') {
        const job = `${DEADMAN_PREFIX}<nr>-<tag>`
        printed.push({
          label,
          sql: [
            `-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:\nbegin; ${loosen}; <SNAPSHOT_SQL>; rollback;`,
            deadman
              ? `-- 2. Totmann (+${DEADMAN_MIN} min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):\nselect cron.schedule('${job}', '<MI HH DD MM *>', $<tag>$${deadmanCommand(job, restore, '<Zeitstempel>')}$<tag>$)`
              : '-- 2. kein Totmann (Cron-Pause)',
            `-- 3. Lockerung (committet):\n${wrapTx(loosen)}`,
            `-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):\n${wrapTx(restore)}`,
            deadman ? `-- 5. Totmann entfernen:\nselect cron.unschedule(jobid) from cron.job where jobname = '${job}'` : '',
          ].filter(Boolean).join('\n'),
        })
        return undefined
      }
      if (mode !== 'write') throw new PreError(`Modus ${mode}: keine Fenster`)
      const outer = stack[stack.length - 1]
      const probeRows = send(`begin; ${loosen}; ${SNAPSHOT_SQL}; rollback;`)
      const w = { kind: 'sql', label, restore, nr: ++nr, children: new Set(), touched: [] }
      const expect = diffSoll(soll, probeRows, ignoreFor(w))
      if (expect.length === 0) throw new StepError(`Lockerung ändert den Snapshot nicht: ${label}`)
      w.touched = expect.map((x) => keyOf(x))
      const hash = sha(loosen)
      writeMarker(w)
      stack.push(w)
      let value
      try {
        if (deadman) planDeadman(w, restore)
        try { send(wrapTx(loosen)) } catch (e) { throw new StepError(`Lockerung nicht bestätigt (${label}): ${String(e?.message ?? e).slice(0, 200)}`) }
        const got = diffSoll(soll, snapshot(), ignoreFor(w))
        if (!sameDiff(got, expect)) throw new StepError(`Commit weicht von der Probe ab (${label}): erwartet ${fmtDiff(expect)}; gefunden ${fmtDiff(got)}`)
        windowLog.push({ label, keys: expect.map((x) => `${x.k} ${x.n} (${x.state})`), hashProbe: hash, hashCommit: sha(loosen), outer: outer?.label ?? null })
        value = await fn({ child: (c) => { w.children.add(c) } })
      } finally {
        closeWindow(w)
      }
      return value
    },

    /** Gelockertes Deploy-Fenster (Function quote): nur Markierung mit Commit-ID, kein Totmann. */
    async withDeployWindow({ label, commit, loosen, restore, verify }, fn) {
      if (mode === 'print') { printed.push({ label, deploy: commit }); return undefined }
      if (mode !== 'write') throw new PreError(`Modus ${mode}: keine Fenster`)
      const w = { kind: 'deploy', label, commit, nr: ++nr, children: new Set(), touched: [], restoreFn: restore, verify }
      writeMarker(w)
      stack.push(w)
      let value
      try {
        loosen()
        value = await fn({ child: (c) => { w.children.add(c) } })
      } finally {
        closeWindow(w)
      }
      return value
    },

    /** vitest direkt starten (kein Wrapper), Prozessbaum bei Zeitlimit beenden, frischen JSON-Report auswerten (M-3, M-6). */
    async vitest({ file, pattern, timeoutMs = VITEST_TIMEOUT_MS, forbid }) {
      const top = stack[stack.length - 1]
      const out = join(deps.reportsDir, `${name}-${++probeNr}.json`)
      rmSync(out, { force: true })
      const startedAt = deps.now()
      // vitest wertet -t als regulären Ausdruck aus; ein Muster mit „(“ (z. B. „Alt-Pfad“-Test) ließ den Lauf früher ohne Report abbrechen: wörtlich übergeben.
      const child = deps.spawn(deps.nodeBin, [deps.vitestEntry, 'run', '--project', 'rls', file, '-t', pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), '--reporter=json', `--outputFile=${out}`])
      top?.children.add(child)
      const exit = await new Promise((resolve) => {
        let done = false
        const timer = deps.timers.set(() => { if (done) return; done = true; deps.killTree(child.pid); resolve('timeout') }, timeoutMs)
        child.on('exit', (code) => { if (done) return; done = true; deps.timers.clear(timer); resolve(code) })
      })
      top?.children.delete(child)
      let report = null
      try { report = JSON.parse(readFileSync(out, 'utf8')) } catch { /* keine Datei: fehler */ }
      return judgeVitest({ exit, report, startedAt, pattern, forbid })
    },

    /** Cron-Pause (M-4) für die ganze Dauer von fn; die Wartebedingungen (M-7) gelten, bevor fn läuft. */
    async cronPause(fn) {
      const job = `(select jobid from cron.job where jobname = '${CLEANUP_JOB}')`
      if (mode === 'print') { // nur auflisten: Pause-Text drucken, die Schritte darunter (die selbst nur drucken) trotzdem durchlaufen
        await run.withWindow({ label: `cron ${CLEANUP_JOB} pausiert`, deadman: false, loosen: `select cron.alter_job(${job}, active := false)`, restore: `select cron.alter_job(${job}, active := true)` }, async () => {})
        return fn()
      }
      return run.withWindow({
        label: `cron ${CLEANUP_JOB} pausiert`, deadman: false,
        loosen: `select cron.alter_job(${job}, active := false)`,
        restore: `select cron.alter_job(${job}, active := true)`,
      }, async (ctx) => { run.waitCleanupIdle(); return fn(ctx) })
    },
    /**
     * Totmann-Probelauf (M-2): je Restore-Art ein Job mit genau dem Aufbau der echten Totmann-Jobs, aber auf +2 min und mit dem Restore im Soll-Zustand
     * (idempotent, ändert nichts). Wartet auf „succeeded“ und prüft, dass sich jeder Job selbst entfernt hat und Dev gleich dem Soll ist.
     * `items`: [{ label, restore }]. Gewählt werden so wenige Einträge, dass jede Art (restoreKinds) mindestens einmal vorkommt.
     */
    deadmanProbe(items) {
      if (mode !== 'write') throw new PreError(`Modus ${mode}: kein Probelauf`)
      const covered = new Set()
      const chosen = []
      for (const it of items) {
        const kinds = restoreKinds(it.restore)
        if (kinds.some((k) => !covered.has(k))) { kinds.forEach((k) => covered.add(k)); chosen.push({ ...it, kinds }) }
      }
      const jobs = []
      try {
        const lines = []
        // nacheinander (kein paralleles DDL, kein Verpassen der Minute beim Anlegen vieler Jobs); jeder Job bekommt seine eigene Zeit
        for (const [i, it] of chosen.entries()) {
          const t = deadmanTime(DEADMAN_PROBE_MIN)
          const tag = freeTag(it.restore)
          const jobName = `${DEADMAN_PREFIX}probe${i + 1}-${tag}`
          const j = { ...it, jobName }
          jobs.push(j)
          send(`select cron.schedule('${jobName}', '${t.expr}', $${tag}$${deadmanCommand(jobName, it.restore, t.ts)}$${tag}$)`)
          let st
          for (let n = 0; n < 60 && st?.status !== 'succeeded' && st?.status !== 'failed'; n++) {
            st = send(`select status, left(coalesce(return_message, ''), 200) as msg from cron.job_run_details where command like '%${j.jobName}%' order by start_time desc limit 1`)[0]
            if (st?.status !== 'succeeded' && st?.status !== 'failed') deps.sleep(10_000) // keine Zeile, starting oder running: weiter warten
          }
          if (st?.status !== 'succeeded') throw new StepError(`Totmann-Probelauf ${j.kinds.join('+')} (${j.label}): ${st ? `${st.status}: ${st.msg}` : 'kein Lauf innerhalb von 10 Minuten'}`)
          const left = send(`select count(*)::int as n from cron.job where jobname = '${j.jobName}'`)[0]?.n ?? 0
          if (left !== 0) throw new StepError(`Totmann-Probelauf ${j.kinds.join('+')}: Job hat sich nicht selbst entfernt`)
          lines.push(`${j.kinds.join('+')}: succeeded, Job entfernt (${j.label})`)
        }
        const d = diffSoll(soll, snapshot(), [`cron|${DEADMAN_PREFIX}*`])
        if (d.length) throw new FatalError(`Nach dem Totmann-Probelauf weicht Dev vom Soll ab: ${fmtDiff(d)}. Wiederherstellen: ${RESTORE_CMD}`)
        return lines
      } finally {
        for (const j of jobs) { try { removeDeadman(j.jobName) } catch { /* Meldung folgt über den Start-Check */ } }
      }
    },
    waitCleanupIdle() {
      for (let i = 0; i < 400; i++) {
        const q = (s) => send(s)[0]
        const running = q(`select count(*)::int as n from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname = '${CLEANUP_JOB}' and d.status = 'running'`)?.n ?? 0
        const queued = q('select count(*)::int as n from net.http_request_queue')?.n ?? 0
        const since = q(`select extract(epoch from now() - max(d.end_time))::int as s from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname = '${CLEANUP_JOB}'`)?.s
        const minute = new Date(deps.now()).getMinutes()
        if (running === 0 && queued === 0 && (since === null || since === undefined || since > CLEANUP_WAIT_S) && !(minute >= 20 && minute <= 35)) return
        deps.sleep(15_000)
      }
      throw new StepError('Aufräum-Job wird nicht ruhig (Lauf, Warteschlange oder Sperrminuten)')
    },
    assertCleanupPaused() {
      const r = send(`select active from cron.job where jobname = '${CLEANUP_JOB}'`)[0]
      if (!r || r.active !== false) throw new StepError(`Job ${CLEANUP_JOB} ist nicht pausiert`)
    },

    /** Endprüfung gegen das Soll; entfernt Sperre und Handler. */
    finish() {
      let end = []
      if (stack.length === 0) {
        try { end = diffSoll(soll, snapshot()) } catch (e) { end = [{ k: 'snapshot', n: String(e?.message ?? e).slice(0, 80), state: 'fehlt' }] }
      }
      if (mode === 'write' && stack.length === 0) releaseLock()
      return { end }
    },

    /** Wiederherstellung von Hand (redproof-restore.mjs): alle Markierungen LIFO, danach Totmann-Reste, Soll, Sperre. */
    async recover() {
      const dirty = deps.git.functionsStatus()
      if (dirty) throw new PreError('supabase/functions hat Änderungen gegenüber HEAD. Nichts wiederhergestellt.')
      if (!deps.git.sollClean()) throw new PreError('scripts/redproof-soll.json weicht von HEAD ab. Nichts wiederhergestellt.')
      mkdirSync(dir, { recursive: true })
      if (existsSync(lockPath)) {
        const l = JSON.parse(readFileSync(lockPath, 'utf8'))
        if (deps.isAlive(l.pid)) throw new PreError(`Ein Redproof-Lauf ist aktiv (PID ${l.pid}). Nichts wiederhergestellt.`)
        rmSync(lockPath, { force: true })
      }
      const fd = openSync(lockPath, 'wx')
      try { writeSync(fd, JSON.stringify({ pid: deps.pid, script: 'restore', time: new Date(deps.now()).toISOString() })); fsyncSync(fd) } finally { closeSync(fd) }
      locked = true
      const files = markers().map((f) => ({ f, m: readMarker(f) })).sort((x, y) => y.m.nr - x.m.nr)
      const done = []
      for (const { f, m } of files) {
        const rest = files.filter((x) => x.m.nr < m.nr).flatMap((x) => x.m.touched ?? [])
        const w = { kind: m.type, label: m.label, nr: m.nr, restore: m.restoreSql, marker: join(dir, f), touched: m.touched ?? [], deadman: m.deadman, children: new Set() }
        if (m.type === 'deploy') {
          if (!deps.deployCommit) throw new FatalError('Kein Deploy-Restore verfügbar')
          // erst lesend prüfen: Download = Commit der Markierung und Einstellungen gleich → quittieren, sonst deployen (Etappe 3: Deploy war nie gelaufen)
          let passt = false
          try { passt = deps.deployMatches(m.commit) } catch { /* Vorprüfung gescheitert (Download, Function fehlt, Netz) → deployen; die Nachprüfung bleibt streng */ }
          if (!passt) deps.deployCommit(m.commit)
          if (!deps.deployMatches(m.commit)) throw new FatalError(`Deploy-Stand entspricht nicht Commit ${m.commit}. Markierung ${w.marker}`)
        } else {
          restoreVerified(w, [...rest, `cron|${DEADMAN_PREFIX}*`])
        }
        done.push(w)
        rmSync(w.marker, { force: true })
      }
      for (const j of send(`select jobname from cron.job where jobname like '${DEADMAN_PREFIX}%'`)) removeDeadman(j.jobname)
      const d = diffSoll(soll, snapshot())
      if (d.length) throw new FatalError(`Nach der Wiederherstellung weicht Dev vom Soll ab: ${fmtDiff(d)}`)
      // Quittung (M-3): Soll gleich bestätigt, frühere Totmann-Fehlläufe sperren den Start nicht mehr
      writeFileSync(quittPath, JSON.stringify({ time: send('select now()::text as t')[0]?.t, by: 'restore' }))
      releaseLock()
      return { restored: done.map((w) => w.label) }
    },
  }
  return run
}

/** Hauptablauf eines Redproof-Skripts: start → main → finish; setzt den Exit-Code. */
export async function runMain(run, main, deps) {
  let code
  try {
    await run.start()
    code = (await main(run)) ?? EXIT.OK
    const { end } = run.finish()
    if (end.length) { deps.log(`Endprüfung: Dev weicht vom Soll ab: ${fmtDiff(end)}`); code = EXIT.FAIL }
  } catch (e) {
    deps.log(String(e?.message ?? e))
    code = e instanceof PreError ? EXIT.PRE : e instanceof FatalError ? EXIT.FATAL : EXIT.FAIL
    if (!(e instanceof PreError)) { try { run.finish() } catch { /* Fehler schon gemeldet */ } }
  }
  if (deps.proc.exitCode !== EXIT.FATAL) deps.proc.exitCode = code
  return code
}

// --- Echte Abhängigkeiten --------------------------------------------------------------------------------------------------------------
const SB = 'node_modules/supabase/dist/supabase.js'
const TRANSPORT = /Transport error|HttpClientError|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed/i
const win = process.platform === 'win32'
export function realDeps({ dir = 'tmp/proof' } = {}) {
  return {
    dir, reportsDir: 'tmp/reports/r1', nodeBin: process.execPath, vitestEntry: 'node_modules/vitest/vitest.mjs',
    proc: process, pid: process.pid, now: () => Date.now(), log: (m) => console.error(m),
    sleep: (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
    randomTag: () => randomBytes(4).toString('hex'),
    timers: { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t) },
    isAlive: (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } },
    exec: (q) => {
      let out
      try {
        out = execFileSync(process.execPath, [SB, 'db', 'query', '--linked', q], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 })
      } catch (e) {
        const full = `${e?.message ?? e}\n${e?.stdout ?? ''}`
        // Meldung ohne den SQL-Text der Kommandozeile (N-4): Fehlertext der API, sonst nur die erste Zeile
        let api = ''
        try { api = JSON.parse(e?.stdout ?? '')?.error?.message ?? '' } catch { /* keine JSON-Ausgabe */ }
        const err = new Error((api || `Aufruf fehlgeschlagen (Exit ${e?.status ?? '?'}: ${String(e?.stderr ?? '').split('\n')[0]})`).slice(0, 300))
        err.transport = TRANSPORT.test(full)
        throw err
      }
      const json = JSON.parse(out)
      if (json._tag === 'Error') throw new Error(json.error?.message)
      return json.rows
    },
    spawn: (cmd, args) => {
      const c = nodeSpawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, shell: false, detached: !win })
      c.stdout.resume(); c.stderr.resume()
      return c
    },
    killTree: (pid) => {
      if (win) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'])
      else process.kill(-pid, 'SIGKILL')
    },
    git: {
      functionsStatus: () => execFileSync('git', ['status', '--porcelain', '--', 'supabase/functions'], { encoding: 'utf8' }).trim(),
      sollClean: () => spawnSync('git', ['ls-files', '--error-unmatch', 'scripts/redproof-soll.json']).status === 0
        && execFileSync('git', ['status', '--porcelain', '--', 'scripts/redproof-soll.json'], { encoding: 'utf8' }).trim() === '',
    },
  }
}

/** Gründe, aus denen ein Snapshot nicht als Soll festgeschrieben werden darf (Q1c, N-3 aus Runde 1). */
export function refuseReasons(rows) {
  const out = []
  for (const r of rows) {
    if (r.k === 'trigger' && r.e !== 'O') out.push(`Trigger ${r.n} ist nicht aktiv (tgenabled ${r.e})`)
    if (r.k === 'cron' && r.e !== 'true' && !String(r.n).startsWith(DEADMAN_PREFIX)) out.push(`Cron-Job ${r.n} ist inaktiv`)
    if (String(r.n).toLowerCase().includes('redproof')) out.push(`Objekt mit Präfix redproof: ${r.k} ${r.n}`)
  }
  return out
}
