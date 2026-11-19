// Rot-Beweis S9a-4 (nur Dev-Projekt), seit R1 über redproof-lib.mjs: Sperren aus Migration 0020 bis 0022 (Fotos vor dem Absenden, Selbst-Upgrade). Jede Prüfung misst den Ist-Wert:
//  1. SQL-Sperren: Probe „Ergebnis | Wert“ mit der Lockerung in einer Rollback-Transaktion; Schritte mit vitest-Test oder Storage-/PostgREST-Probe lockern
//     zusätzlich committet (Fenster: Markierung, Totmann, Soll-Diff). Der Test muss gelockert rot werden; danach Restore bis Soll-Gleichheit.
//     Schritte mit photo_orphans laufen nur unter Cron-Pause (Job photo-cleanup für die ganze Dauer inaktiv, Fenster mit Markierung).
//  2. Live-Probe der deployten Function `quote` (R2-N13): keine Quelltext-Mutation, nur Aufrufe gegen ${URL}/functions/v1/quote mit Testnutzer-JWT.
//  3. Werkzeuge: Wirkung des dev-guard (Kontrolle Exit 0, fiktive Ref Exit 2) und der Git-Prüfung (A-N4), je im lesenden Modus gemessen, ohne Meldungstext.
// „Schicht“: eine zweite Sperre dahinter hält; der erwartete Wert ist der Fehler der zweiten Schicht, kein Beweis der ersten.
// Soll: scripts/redproof-soll.json (kanonisch, gleich HEAD) für Läufe mit Schreibzugriff; --soll <pfad> nur lesend (Startprüfung, Exit vor dem Lockern);
// --print-sql schreibt tmp/proof/r1-dev-sql-s9a4.sql und sendet nur Selects. Exit: 0 bestanden, 1 fehlgeschlagen, 2 Vorprüfung, 3 Fatal, 130 Signal.
// Nie parallel zu test:rls, test:e2e oder Shots; nur im Hintergrund mit Log oder im Terminal, nie im Vordergrund des Tool-Aufrufs.
// Start: npx dotenv -e .env.local -- node scripts/redproof-s9a4.mjs [--only <Namensteil>[,…]] [--no-tests] [--no-live] [--print-sql] [--soll <pfad>] [--deadman-probe (nur Totmann-Probelauf je Restore-Art, nichts gelockert)]
import './dev-guard.mjs'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createRun, EXIT, realDeps, runMain } from './redproof-lib.mjs'
import * as SQL from './redproof-sql.mjs'

const SB = 'node_modules/supabase/dist/supabase.js'
const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1] }
const mode = process.argv.includes('--print-sql') ? 'print' : arg('--soll') ? 'readonly' : 'write'
const soll = JSON.parse(readFileSync(mode === 'readonly' ? arg('--soll') : 'scripts/redproof-soll.json', 'utf8')).rows
const deps = realDeps()
const rp = createRun(deps, { name: 's9a4', mode, soll })
const select = (q) => rp.select(q)
const q1 = (s) => `'${s.replaceAll("'", "''")}'`

const BUCKET = 'request-photos'
// Dummy-Token von Cloudflare: Mit dem Turnstile-Testsecret (Dev) gilt jedes Token als gültig.
const CAPTCHA = 'XXXX.DUMMY.TOKEN.XXXX'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const mkClient = (key) => createClient(URL_, key, { auth: { persistSession: false, autoRefreshToken: false } })
const service = mkClient(process.env.SUPABASE_SECRET_KEY)

const SAVE = 'public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[])'
const GUARD = 'private.guard_photo_insert()'
const INTERVAL = 'public.photo_staging_interval()'
const TERMS = { cancel_free_hours: 48, cancel_late_percent: 50, cancel_full_percent: 100, cancel_full_days_before: 1, call_out_fee_cents: 0, termsHash: 'a'.repeat(64) }
const CONTACT = { name: 'Test Kunde', phone: '+43 660 1234567', email: 'kunde@movenow.test', stairsDoor: null }
const JPEG = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='), (c) => c.charCodeAt(0))
const JPEG2 = new Uint8Array([...JPEG, 0, 0, 0, 0])
const UUIDX = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const RX = `'^${UUIDX}/${UUIDX}/${UUIDX}\\.jpg$'`

const dayIn = (n) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
const lit = (v) => (v === null ? 'null' : Array.isArray(v) ? q1(`{${v.join(',')}}`) : q1(typeof v === 'object' ? JSON.stringify(v) : String(v)))

// --- Fixtures (im finally gelöscht) ----------------------------------------------------------------------------------------------------
let A, B, C, E // { id, db (JWT-Client) }; C und E haben je 40 Dateien (Kontingent, 0021)
let priceVersion
const made = [] // Storage-Pfade zum Aufräumen
const put = async (path, body = JPEG) => {
  if (mode === 'print') return path
  const r = await service.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false })
  if (r.error) throw r.error
  made.push(path)
  return path
}
const exists = async (path) => (await service.storage.from(BUCKET).download(path)).error === null
const newUser = async (tag) => {
  if (mode === 'print') return { id: `00000000-0000-0000-0000-00000000000${++fakeN}`, db: null, jwt: '' }
  const email = `redproof-s9a4-${tag}-${Date.now().toString(36)}@movenow.test`
  const password = `${randomUUID()}Aa1!`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  const db = mkClient(PUB)
  const s = await db.auth.signInWithPassword({ email, password, options: { captchaToken: CAPTCHA } })
  if (s.error) throw s.error
  return { id: data.user.id, db, jwt: s.data.session.access_token }
}
const baseArgs = (over = {}) => ({
  p_customer: A.id, p_client_ref: randomUUID(), p_service: 'move', p_inputs: {},
  p_snapshot: { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961, lines: [{ key: 'a', cents: 68961 }], terms: TERMS },
  p_price_version: priceVersion, p_total: 68961, p_low: 68961, p_high: 68961,
  p_from_address: null, p_from_lon: null, p_from_lat: null, p_to_address: null, p_to_lon: null, p_to_lat: null,
  p_route: null, p_region: null, p_district: 1, p_preferred_date: dayIn(14), p_time_window: null, p_description: null, p_volume: null,
  p_contact: CONTACT, p_confirmed: { shown: { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 }, termsHash: TERMS.termsHash },
  ...over,
})
const callSql = (over = {}) => `public.quote_save_request(${Object.entries(baseArgs(over)).map(([k, v]) => `${k} => ${lit(v)}`).join(', ')})`
const claims = (u, aal = 'aal1') => JSON.stringify({ sub: u.id, role: 'authenticated', aal })

// Probe: Rollback-Transaktion. `preLoosen` (die Lockerung des Schritts, nur für SQL-Proben) steht vor dem Setup in derselben Transaktion;
// es wird nichts committet. Meldet „ok“ oder „SQLSTATE: Meldung“, dann den Ist-Wert `value`.
let preLoosen = ''
const probe = ({ setup = '', stmt, value, role = 'owner', claims: cl = '' }) => {
  const prefix = [role === 'owner' ? '' : `set local role ${role};`, cl ? `perform set_config('request.jwt.claims', ${q1(cl)}, true);` : ''].join(' ')
  const body = `begin ${prefix} ${stmt}; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce((${value})::text, '<null>');`
  return rp.probe(`begin; ${preLoosen ? `${preLoosen};` : ''} ${setup}; create temp table res (v text); do $p$ begin ${body} end $p$; select string_agg(v, ' | ') as v from res; rollback;`)[0]?.v
}

const results = []
const loosen = []
const add = (s) => loosen.push(s.label.startsWith('photo_orphans:') ? { ...s, cron: true } : s)
// Bausteine liefern { loosen, restore } als SQL-Text (lazy: Originale werden erst beim Schritt gelesen, im Soll-geprüften Zustand).
const patchFns = (label, edits) => ({ label, kind: 'Sperre', text: () => SQL.patchFns(select, edits) })
const patchFn = (label, fn, from, to) => patchFns(label, [[fn, from, to]])
const triggerOff = (label, name, table) => ({ label, kind: 'Sperre', text: () => SQL.triggerOff(table, name) })
const toggle = (label, loosenSql, restoreSql, kind = 'Sperre') => ({ label, kind, text: () => SQL.toggle(loosenSql, restoreSql) })
/** Policy lockern: `looseExpr` ersetzt Bedingung (using/with check), Wiederherstellung aus der gelesenen Definition. */
const policyLoosen = (label, name, table, clause, looseExpr, kind = 'Sperre') => ({ label, kind, text: () => SQL.policyLoosen(select, name, table, clause, looseExpr) })
/** Zwei Policy-Lockerungen zugleich (z. B. DELETE und die SELECT-Sicht, die die Storage-API vorher prüft). */
const combine = (a, b) => ({ label: a.label, kind: a.kind, text: () => SQL.combine(a.text(), b.text()) })
// Proben, die async sind, laufen über Storage-/PostgREST-API und brauchen das committete Fenster; SQL-Proben messen in der Rollback-Transaktion.
const isAsync = (f) => f.constructor.name === 'AsyncFunction'

const runSql = async (selected, withTests) => {
  for (const s of selected) {
    const text = s.text()
    const sqlProbe = !isAsync(s.probe)
    let looseValue, redTests
    if (sqlProbe) {
      preLoosen = text.loosen
      try { looseValue = s.probe() } finally { preLoosen = '' }
    }
    // Committet wird nur, was eine andere Verbindung sehen muss: der vitest-Lauf oder eine Storage-/PostgREST-Probe.
    if (!sqlProbe || (withTests && s.tests)) {
      if (s.cron && mode === 'write') rp.assertCleanupPaused()
      await rp.withWindow({ label: s.label, ...text }, async () => {
        s.onLoose?.()
        if (!sqlProbe) looseValue = await s.probe()
        if (withTests && s.tests) redTests = await rp.vitest({ file: s.testFile ?? 'tests/rls/uploads.test.ts', pattern: s.tests, forbid: s.cron ? /Aufräumen/ : undefined })
      })
      s.onRestored?.()
    }
    if (mode === 'print') continue
    const lockedValue = await s.probe()
    const effect = looseValue === s.loose
    const blocked = lockedValue === s.locked
    const testsRed = !withTests || !s.tests || redTests?.status === 'rot'
    const good = effect && blocked && testsRed
    results.push({ ...s, part: 'SQL', looseValue, lockedValue, redTests, good, effect, blocked, testsRed })
    console.log(`${good ? 'OK    ' : 'FEHLER'} [${s.kind}] ${s.label}\n         gelockert: ${looseValue} (erwartet ${s.loose})\n         gesperrt:  ${lockedValue} (erwartet ${s.locked})${redTests ? `\n         Test ${redTests.status}: ${redTests.failed.length} rot${redTests.message ? ` (${redTests.message})` : ''}${redTests.status === 'fehler' ? ` [${redTests.reason}]` : ''}` : ''}`)
  }
}

let fakeN = 0
const FAKE_REQ = '00000000-0000-0000-0000-0000000000ff' // --print-sql: keine Fixtures, Platzhalter-IDs in den SQL-Texten
const rpc = (name, args) => (mode === 'print' ? Promise.resolve({ data: [{ id: FAKE_REQ }] }) : service.rpc(name, args))
const run = async () => {
  priceVersion = select(`select version from public.current_price_version`)[0].version
  A = await newUser('a')
  B = await newUser('b')
  C = await newUser('c')
  E = await newUser('e')
  const RLS_DENIED = '42501: new row violates row-level security policy for table "objects"'
  // Staging-Ordner: S (frisch, nicht übernommen), X (für Ablauf), N (neun Dateien), BF (Ordner von B), R1 (mit Anfrage und übernommenem Foto), R2 (Anfrage ohne Foto)
  const refS = randomUUID(), refX = randomUUID(), refN = randomUUID(), refB = randomUUID(), ref1 = randomUUID(), ref2 = randomUUID(), refPl = randomUUID()
  const id = () => randomUUID()
  const S1 = id(), S2 = id(), X1 = id(), BO = id(), P1 = id()
  const N = Array.from({ length: 9 }, id)
  const path = (u, ref, i) => `${u.id}/${ref}/${i}.jpg`
  await put(path(A, refS, S1)); await put(path(A, refS, S2)); await put(path(A, refX, X1)); await put(path(B, refB, BO)); await put(path(A, ref1, P1))
  for (const n of N) await put(path(A, refN, n))
  const R1 = (await rpc('quote_save_request', baseArgs({ p_client_ref: ref1, p_photo_ids: [P1] }))).data?.[0]?.id
  const R2 = (await rpc('quote_save_request', baseArgs({ p_client_ref: ref2 }))).data?.[0]?.id
  if (!R1 || !R2) throw new Error('Fixtures: Anfragen nicht angelegt')
  const photosOf = (ref) => `(select count(*) from public.request_photos p join public.service_requests r on r.id = p.request_id where r.client_ref = '${ref}')`
  const reqsOf = (ref) => `(select count(*) from public.service_requests where client_ref = '${ref}')`
  const both = (ref) => `${reqsOf(ref)} || '/' || ${photosOf(ref)}`
  const rowsOf = (req) => `(select count(*) from public.request_photos where request_id = '${req}')`
  const pRow = `(select request_id from public.request_photos where storage_path = '${path(A, ref1, P1)}')`
  const objCount = (name) => `(select count(*) from storage.objects where bucket_id = '${BUCKET}' and name = '${name}')`
  const adoptedPath = path(A, ref1, P1)
  const settingGone = `alter table public.platform_settings disable trigger user; delete from public.platform_settings where key = 'photo_staging_hours'`
  const settingCount = `(select count(*) from public.platform_settings where key = 'photo_staging_hours')`

  // 1. Übernahme in quote_save_request ---------------------------------------------------------------------------------------------------
  const missProbe = () => probe({ stmt: `perform ${callSql({ p_client_ref: refB, p_photo_ids: [BO] })}`, value: both(refB), role: 'service_role' })
  add({
    ...patchFn('photo_missing: Existenz der Datei nicht mehr verlangt (Schicht: fehlende Datei gilt als abgelaufen, N-3)', SAVE, "raise exception 'photo_missing';", 'null;'),
    kind: 'Schicht', tests: null,
    probe: missProbe,
    loose: 'P0001: photo_expired | 0/0', locked: 'P0001: photo_missing | 0/0',
  })
  add({
    ...patchFns('photo_missing und NULL-Zeitstempel nicht mehr geprüft: Foto-ID aus fremdem Ordner wird übernommen', [[SAVE, "raise exception 'photo_missing';", 'null;'], [SAVE, 'if pcreated is null or pcreated < now() - staging then', 'if false then']]),
    tests: 'fremde Foto-ID', // ohne Umlaut: cmd.exe reicht „ü“ nicht an vitest -t durch
    probe: missProbe,
    loose: 'ok | 1/1', locked: 'P0001: photo_missing | 0/0',
  })
  add({
    ...patchFn('photo_expired: Ablaufprüfung entfernt (abgelaufenes Foto wird übernommen)', SAVE, 'if pcreated is null or pcreated < now() - staging then', 'if pcreated is null then'),
    tests: 'abgelaufenes Staging',
    probe: () => probe({ setup: `update storage.objects set created_at = now() - interval '25 hours' where bucket_id = '${BUCKET}' and name = '${path(A, refX, X1)}'`, stmt: `perform ${callSql({ p_client_ref: refX, p_photo_ids: [X1] })}`, value: both(refX), role: 'service_role' }),
    loose: 'ok | 1/1', locked: 'P0001: photo_expired | 0/0',
  })
  const nine = { p_client_ref: refN, p_photo_ids: N }
  add({
    ...patchFn('too_many_photos: Zählung in der Funktion (Schicht: Trigger guard_photo_insert)', SAVE, "unnest(coalesce(p_photo_ids, '{}')) x) > 8 then", "unnest(coalesce(p_photo_ids, '{}')) x) > 80 then"),
    kind: 'Schicht', tests: null,
    probe: () => probe({ stmt: `perform ${callSql(nine)}`, value: both(refN), role: 'service_role' }),
    loose: 'P0001: too_many_photos | 0/0', locked: 'P0001: too_many_photos | 0/0',
  })
  add({
    ...patchFn('too_many_photos: Zählung im Trigger (Schicht: Funktion)', GUARD, ') >= 8 then', ') >= 80 then'),
    kind: 'Schicht', tests: null,
    probe: () => probe({ stmt: `perform ${callSql(nine)}`, value: both(refN), role: 'service_role' }),
    loose: 'P0001: too_many_photos | 0/0', locked: 'P0001: too_many_photos | 0/0',
  })
  add({
    ...patchFns('too_many_photos: Funktion und Trigger gelockert → 9 Fotos', [[SAVE, "unnest(coalesce(p_photo_ids, '{}')) x) > 8 then", "unnest(coalesce(p_photo_ids, '{}')) x) > 80 then"], [GUARD, ') >= 8 then', ') >= 80 then']]),
    tests: 'Grenze: 8 Fotos',
    probe: () => probe({ stmt: `perform ${callSql(nine)}`, value: both(refN), role: 'service_role' }),
    loose: 'ok | 1/9', locked: 'P0001: too_many_photos | 0/0',
  })
  // 2. Einstellung photo_staging_hours: fail closed ---------------------------------------------------------------------------------------
  const noSetting = (label, stmt, value, loose, locked, kind = 'Sperre', tests = null) => ({
    ...patchFn(label, INTERVAL, "raise exception 'setting_missing';", "return interval '24 hours';"),
    kind, tests,
    probe: () => probe({ setup: settingGone, stmt, value, role: 'service_role' }),
    loose, locked,
  })
  add(noSetting('photo_staging_hours fehlt: photo_staging_interval liefert Ersatzwert statt Fehler', 'perform public.photo_staging_interval()', settingCount, 'ok | 0', 'P0001: setting_missing | 0'))
  add(noSetting('photo_staging_hours fehlt: Absenden speichert trotzdem', `perform ${callSql({ p_client_ref: randomUUID() })}`, `(select count(*) from public.service_requests where customer_id = '${A.id}')`, 'ok | 4', 'P0001: setting_missing | 3', 'Sperre', 'photo_staging_hours fehlt'))
  add(noSetting('photo_staging_hours fehlt: Waisenliste läuft weiter', 'perform * from public.photo_orphans()', settingCount, 'ok | 0', 'P0001: setting_missing | 0'))
  // 3. request_photos: Einfügen nur am Funktionspfad -----------------------------------------------------------------------------------------
  const ins = (req, name) => `insert into public.request_photos (request_id, storage_path) values ('${req}', '${name}')`
  const fresh = (u, ref) => path(u, ref, id())
  add({
    ...triggerOff('guard_photo_insert ausgeschaltet (Einfügen am Funktionspfad vorbei)', 'guard_photo_insert', 'public.request_photos'),
    tests: 'Trigger auch',
    probe: () => probe({ stmt: ins(R2, fresh(A, ref2)), value: rowsOf(R2), role: 'service_role' }),
    loose: 'ok | 1', locked: 'P0001: photo_insert_forbidden | 0',
  })
  add({
    ...patchFn('guard_photo_insert: Marker nicht mehr verlangt', GUARD, "if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then", 'if false then'),
    tests: null,
    probe: () => probe({ stmt: ins(R2, fresh(A, ref2)), value: rowsOf(R2), role: 'service_role' }),
    loose: 'ok | 1', locked: 'P0001: photo_insert_forbidden | 0',
  })
  add({
    ...patchFn('guard_photo_insert: Pfadpräfix der Anfrage nicht mehr verlangt (fremder Ordner mit Marker)', GUARD, 'new.storage_path is null or not starts_with(', 'new.storage_path is null or false and not starts_with('),
    tests: null,
    probe: () => probe({ stmt: `perform set_config('app.mv_photo_request', '${R2}', true); ${ins(R2, fresh(B, refB))}`, value: rowsOf(R2), role: 'owner' }),
    loose: 'ok | 1', locked: 'P0001: photo_insert_forbidden | 0',
  })
  add({
    ...toggle('request_photos: INSERT für authenticated (Schicht: keine Insert-Policy)', 'grant insert on public.request_photos to authenticated', 'revoke insert on public.request_photos from authenticated', 'Schicht'),
    tests: null,
    probe: () => probe({ stmt: ins(R2, fresh(A, ref2)), value: rowsOf(R2), role: 'authenticated', claims: claims(A) }),
    loose: 'P0001: photo_insert_forbidden | 0', locked: '42501: permission denied for table request_photos | 0',
  })
  // 4. request_photos: unveränderlich -------------------------------------------------------------------------------------------------------
  add({
    ...triggerOff('photo_immutable ausgeschaltet: UPDATE (Umhängen auf andere Anfrage)', 'photo_immutable', 'public.request_photos'),
    tests: 'photo_immutable',
    probe: () => probe({ stmt: `update public.request_photos set request_id = '${R2}' where storage_path = '${adoptedPath}'`, value: `${pRow} = '${R2}'` }),
    loose: 'ok | true', locked: 'P0001: photo_immutable | false',
  })
  add({
    ...triggerOff('photo_immutable ausgeschaltet: DELETE (Foto der Anfrage löschen)', 'photo_immutable', 'public.request_photos'),
    tests: null,
    probe: () => probe({ stmt: `delete from public.request_photos where storage_path = '${adoptedPath}'`, value: rowsOf(R1) }),
    loose: 'ok | 0', locked: 'P0001: photo_immutable | 1',
  })
  add({
    ...triggerOff('photo_immutable_truncate ausgeschaltet: TRUNCATE', 'photo_immutable_truncate', 'public.request_photos'),
    tests: null,
    probe: () => probe({ stmt: 'truncate public.request_photos', value: '(select count(*) > 0 from public.request_photos)' }),
    loose: 'ok | false', locked: 'P0001: photo_immutable | true',
  })
  for (const [verb, stmt, loose, locked] of [
    ['UPDATE', `update public.request_photos set request_id = '${R2}' where storage_path = '${adoptedPath}'`, `P0001: photo_immutable | ${R1}`, `42501: permission denied for table request_photos | ${R1}`],
    ['DELETE', `delete from public.request_photos where storage_path = '${adoptedPath}'`, 'P0001: photo_immutable | 1', '42501: permission denied for table request_photos | 1'],
    ['TRUNCATE', 'truncate public.request_photos', 'P0001: photo_immutable | true', '42501: permission denied for table request_photos | true'],
  ]) {
    add({
      ...toggle(`request_photos: ${verb} für service_role (Schicht: Trigger photo_immutable)`, `grant ${verb.toLowerCase()} on public.request_photos to service_role`, `revoke ${verb.toLowerCase()} on public.request_photos from service_role`, 'Schicht'),
      tests: null,
      probe: () => probe({ stmt, value: verb === 'UPDATE' ? pRow : verb === 'DELETE' ? rowsOf(R1) : '(select count(*) > 0 from public.request_photos)', role: 'service_role' }),
      loose, locked,
    })
  }
  for (const [verb, stmt, value, loose, locked] of [
    ['UPDATE', `update public.request_photos set request_id = '${R2}' where storage_path = '${adoptedPath}'`, pRow, `ok | ${R1}`, `42501: permission denied for table request_photos | ${R1}`],
    ['DELETE', `delete from public.request_photos where storage_path = '${adoptedPath}'`, rowsOf(R1), 'ok | 1', '42501: permission denied for table request_photos | 1'],
  ]) {
    add({
      ...toggle(`request_photos: ${verb} für authenticated (Schicht: keine Policy, 0 Zeilen betroffen)`, `grant ${verb.toLowerCase()} on public.request_photos to authenticated`, `revoke ${verb.toLowerCase()} on public.request_photos from authenticated`, 'Schicht'),
      tests: null,
      probe: () => probe({ stmt, value, role: 'authenticated', claims: claims(A) }),
      loose, locked,
    })
  }
  // 5. Lesen ----------------------------------------------------------------------------------------------------------------------------------
  const seen = (req) => `perform set_config('app.probe_val', (select count(*) from public.request_photos where request_id = '${req}')::text, true)`
  const seenObj = (name) => `perform set_config('app.probe_val', (select count(*) from storage.objects where bucket_id = '${BUCKET}' and name = '${name}')::text, true)`
  const val = "current_setting('app.probe_val')"
  const makeAdmin = `select public.admin_grant_role('${B.id}', 'admin')`
  add({
    ...policyLoosen('request_photos_select: jeder liest (fremde Fotos)', 'request_photos_select', 'public.request_photos', 'using', 'true'),
    tests: 'frische Fotos werden atomar',
    probe: () => probe({ stmt: seen(R1), value: val, role: 'authenticated', claims: claims(B) }),
    loose: 'ok | 1', locked: 'ok | 0',
  })
  add({
    ...policyLoosen('request_photos_select: admin-Klausel wieder da (admin aal2 liest fremde Fotos)', 'request_photos_select', 'public.request_photos', 'using', `exists (select 1 from public.service_requests r where r.id = request_photos.request_id and r.customer_id = (select auth.uid())) or (select private.is_admin())`),
    tests: null,
    probe: () => probe({ setup: makeAdmin, stmt: seen(R1), value: val, role: 'authenticated', claims: claims(B, 'aal2') }),
    loose: 'ok | 1', locked: 'ok | 0',
  })
  add({
    ...policyLoosen('request_photos_objects_select: admin-Klausel wieder da (admin aal2 liest fremde Datei)', 'request_photos_objects_select', 'storage.objects', 'using', `bucket_id = 'request-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))`),
    tests: null,
    probe: () => probe({ setup: makeAdmin, stmt: seenObj(adoptedPath), value: val, role: 'authenticated', claims: claims(B, 'aal2') }),
    loose: 'ok | 1', locked: 'ok | 0',
  })
  add({
    ...policyLoosen('request_photos_objects_select: Ordner-Bedingung entfernt (fremde Datei lesen)', 'request_photos_objects_select', 'storage.objects', 'using', `bucket_id = 'request-photos'`),
    tests: 'fremder Nutzer liest',
    probe: () => probe({ stmt: seenObj(adoptedPath), value: val, role: 'authenticated', claims: claims(B) }),
    loose: 'ok | 1', locked: 'ok | 0',
  })
  // 6. Storage-Policies: Einfügen im Staging-Pfad ----------------------------------------------------------------------------------------------
  const putAs = (name) => `insert into storage.objects (bucket_id, name) values ('${BUCKET}', '${name}')`
  const base = `bucket_id = 'request-photos'`
  const own = `(storage.foldername(name))[1] = (select auth.uid())::text`
  const noReq = `not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2])`
  const form = `name ~ ${RX}`
  const noRow = `not exists (select 1 from public.request_photos p where p.storage_path = objects.name)`
  const cnt = `(select private.staging_photo_count()) < 40` // Mengengrenze (0021): bleibt bei allen Lockerungen außer der eigenen erhalten, damit sie allein die Zielbedingung messen (N-2)
  const insProbe = (name) => () => probe({ stmt: putAs(name), value: objCount(name), role: 'authenticated', claims: claims(A) })
  const foreignName = `${B.id}/${refPl}/${id()}.jpg`
  const lateName = `${A.id}/${ref1}/${id()}.jpg`
  const oddName = `${A.id}/${refPl}/foto.jpg`
  add({ ...policyLoosen('Storage-INSERT: Fremdordner-Bedingung entfernt (Datei in Ordner eines anderen)', 'request_photos_objects_insert', 'storage.objects', 'with check', `${base} and ${form} and ${noReq} and ${noRow} and ${cnt}`), tests: 'fremder Ordner', probe: insProbe(foreignName), loose: 'ok | 1', locked: `${RLS_DENIED} | 0` })
  add({ ...policyLoosen('Storage-INSERT: Bedingung „keine Anfrage zu client_ref“ entfernt (Hinzufügen nach dem Absenden)', 'request_photos_objects_insert', 'storage.objects', 'with check', `${base} and ${form} and ${own} and ${noRow} and ${cnt}`), tests: 'in den Ordner', probe: insProbe(lateName), loose: 'ok | 1', locked: `${RLS_DENIED} | 0` })
  add({ ...policyLoosen('Storage-INSERT: Pfadform nicht mehr geprüft', 'request_photos_objects_insert', 'storage.objects', 'with check', `${base} and ${own} and ${noReq} and ${noRow} and ${cnt}`), tests: 'falsche Pfadform', probe: insProbe(oddName), loose: 'ok | 1', locked: `${RLS_DENIED} | 0` })
  // 7. Storage-Policies: Löschen und Ersetzen über die Storage-API (Direkt-DELETE auf storage.objects sperrt Supabase selbst) -------------------
  const removeProbe = (owner, victim) => async () => {
    const name = victim()
    await put(name)
    const r = await owner.db.storage.from(BUCKET).remove([name])
    const gone = !(await exists(name))
    return `entfernt ${r.data?.length ?? 0} | Datei ${gone ? 'weg' : 'da'}`
  }
  add({ ...combine(policyLoosen('Storage-DELETE: Fremdordner-Bedingung entfernt, dazu SELECT-Sicht geöffnet (fremdes Staging-Foto löschen)', 'request_photos_objects_delete', 'storage.objects', 'using', `${base} and ${form} and ${noReq} and ${noRow}`), policyLoosen('x', 'request_photos_objects_select', 'storage.objects', 'using', `bucket_id = 'request-photos'`)), tests: 'fremder Nutzer liest', probe: removeProbe(A, () => `${B.id}/${refPl}/${id()}.jpg`), loose: 'entfernt 1 | Datei weg', locked: 'entfernt 0 | Datei da' })
  add({ ...policyLoosen('Storage-DELETE: Bedingung „keine Anfrage zu client_ref“ entfernt (Löschen nach dem Absenden)', 'request_photos_objects_delete', 'storage.objects', 'using', `${base} and ${form} and ${own} and ${noRow}`), tests: 'nicht genannten Datei', testFile: 'tests/rls/uploads.test.ts', probe: removeProbe(A, () => `${A.id}/${ref1}/${id()}.jpg`), loose: 'entfernt 1 | Datei weg', locked: 'entfernt 0 | Datei da' })
  const keepAdopted = async () => {
    const r = await A.db.storage.from(BUCKET).remove([adoptedPath])
    return `entfernt ${r.data?.length ?? 0} | Datei ${(await exists(adoptedPath)) ? 'da' : 'weg'}`
  }
  add({ ...policyLoosen('Storage-DELETE: Zeilen-Bedingung entfernt (Schicht: client_ref-Bedingung; schützt Alt-Objekte nur über die Zeile)', 'request_photos_objects_delete', 'storage.objects', 'using', `${base} and ${form} and ${own} and ${noReq}`, 'Schicht'), tests: null, probe: keepAdopted, loose: 'entfernt 0 | Datei da', locked: 'entfernt 0 | Datei da' })
  add({ ...policyLoosen('Storage-DELETE: client_ref-Bedingung entfernt (Schicht: Zeilen-Bedingung)', 'request_photos_objects_delete', 'storage.objects', 'using', `${base} and ${form} and ${own} and ${noRow}`, 'Schicht'), tests: null, probe: keepAdopted, loose: 'entfernt 0 | Datei da', locked: 'entfernt 0 | Datei da' })
  add({
    label: 'Storage: UPDATE-Policy für Eigentümer vorhanden (Ersetzen/Verschieben nach dem Absenden)', kind: 'Sperre',
    text: () => SQL.createObject(`create policy redproof_update on storage.objects for update to authenticated using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)`, 'drop policy if exists redproof_update on storage.objects'),
    tests: 'Ersetzen und Verschieben',
    probe: async () => {
      const name = `${A.id}/${ref1}/${id()}.jpg`
      const moved = `${A.id}/${ref1}/${id()}.jpg`
      await put(name)
      made.push(moved)
      const r = await A.db.storage.from(BUCKET).move(name, moved)
      return `${r.error ? 'Fehler' : 'ok'} | ${(await exists(name)) ? 'unverändert' : 'verschoben'}`
    },
    loose: 'ok | verschoben', locked: 'Fehler | unverändert',
  })
  // 7b. Zeilen-Bedingung „keine Zeile in request_photos“ (A-M2): Alt-Pfad {uid}/{request_id}/{id}.jpg, hier hält nur die Zeile (die client_ref-Bedingung greift nicht)
  const R3 = (await rpc('quote_save_request', baseArgs({ p_client_ref: randomUUID() }))).data?.[0]?.id
  if (!R3) throw new Error('Fixtures: Anfrage R3 nicht angelegt')
  const legacyKept = `${A.id}/${R3}/${id()}.jpg`
  const legacyFree = `${A.id}/${R3}/${id()}.jpg`
  const legacyRows = (req, ...names) => rp.fixture(`begin; alter table public.request_photos disable trigger guard_photo_insert; insert into public.request_photos (request_id, storage_path) values ${names.map((n) => `('${req}', '${n}')`).join(', ')}; alter table public.request_photos enable trigger guard_photo_insert; commit; select 1 as x`)
  legacyRows(R3, legacyKept, legacyFree)
  await put(legacyKept)
  const legacyDelete = async () => {
    if (!(await exists(legacyKept))) await service.storage.from(BUCKET).upload(legacyKept, JPEG, { contentType: 'image/jpeg' })
    const r = await A.db.storage.from(BUCKET).remove([legacyKept])
    return `entfernt ${r.data?.length ?? 0} | Datei ${(await exists(legacyKept)) ? 'da' : 'weg'}`
  }
  const legacyInsert = async () => {
    await service.storage.from(BUCKET).remove([legacyFree])
    const r = await A.db.storage.from(BUCKET).upload(legacyFree, JPEG, { contentType: 'image/jpeg' })
    const there = await exists(legacyFree)
    if (there) made.push(legacyFree)
    return `${r.error ? r.error.statusCode : 'ok'} | ${there ? 1 : 0}`
  }
  add({ ...policyLoosen('Storage-DELETE: Zeilen-Bedingung entfernt (Alt-Pfad, A-M2: hier hält allein die Zeile)', 'request_photos_objects_delete', 'storage.objects', 'using', `${base} and ${form} and ${own} and ${noReq}`), tests: 'Zeilen-Bedingung (Alt-Pfad', probe: legacyDelete, loose: 'entfernt 1 | Datei weg', locked: 'entfernt 0 | Datei da' })
  add({ ...policyLoosen('Storage-INSERT: Zeilen-Bedingung entfernt (Alt-Pfad, A-M2: Name einer übernommenen Datei)', 'request_photos_objects_insert', 'storage.objects', 'with check', `${base} and ${form} and ${own} and ${noReq} and ${cnt}`), tests: 'Zeilen-Bedingung (Alt-Pfad', probe: legacyInsert, loose: 'ok | 1', locked: '403 | 0' })

  // 7c. Migration 0021: Kontingent (40 eigene, nicht übernommene Dateien), kein Default, NULL-Pfad. C hat 40 Dateien, E 39 plus eine übernommene (Alt-Zeile).
  const forty = async (u, n) => {
    for (let i = 0; i < n; i += 10) await Promise.all(Array.from({ length: Math.min(10, n - i) }, () => put(`${u.id}/${randomUUID()}/${id()}.jpg`)))
  }
  await forty(C, 40)
  await forty(E, 39)
  const RE = (await rpc('quote_save_request', baseArgs({ p_customer: E.id, p_client_ref: randomUUID() }))).data?.[0]?.id
  if (!RE) throw new Error('Fixtures: Anfrage RE nicht angelegt')
  const adoptedE = `${E.id}/${RE}/${id()}.jpg`
  legacyRows(RE, adoptedE)
  await put(adoptedE)
  // Nach dem Versuch: Anzahl der Objekte des Nutzers (mit dem neuen, falls angenommen), dann das neue wieder entfernen
  const overLimit = (u) => async () => {
    const name = `${u.id}/${randomUUID()}/${id()}.jpg`
    const r = await u.db.storage.from(BUCKET).upload(name, JPEG, { contentType: 'image/jpeg' })
    const n = Number(select(`select count(*)::int as n from storage.objects where bucket_id = '${BUCKET}' and name like '${u.id}/%'`)[0].n)
    if (!r.error) await service.storage.from(BUCKET).remove([name])
    return `${r.error ? r.error.statusCode : 'ok'} | ${n}`
  }
  add({ ...policyLoosen('Storage-INSERT: Mengengrenze (40) entfernt (41. Datei eines Kontos)', 'request_photos_objects_insert', 'storage.objects', 'with check', `${base} and ${form} and ${own} and ${noReq} and ${noRow}`), tests: 'bis zur Grenze erlaubt', probe: overLimit(C), loose: 'ok | 41', locked: '403 | 40' })
  add({ ...patchFn('staging_photo_count: übernommene Dateien zählen mit (Aussperr-Schutz: 40 Dateien, davon eine übernommen)', 'private.staging_photo_count()', 'and not exists (select 1 from public.request_photos p where p.storage_path = o.name)', ''), kind: 'Verfügbarkeit', tests: 'bis zur Grenze erlaubt', probe: overLimit(E), loose: '403 | 40', locked: 'ok | 41' })
  const notNull = 'null value in column "storage_path" of relation "request_photos" violates not-null constraint'
  const noPath = `insert into public.request_photos (request_id) values ('${R2}')`
  add({
    ...patchFn('guard_photo_insert: NULL-Pfad nicht mehr abgefangen (Schicht: NOT NULL der Spalte, Marker gesetzt)', GUARD, 'new.storage_path is null or ', ''),
    kind: 'Schicht', tests: 'ohne storage_path',
    probe: () => probe({ stmt: `perform set_config('app.mv_photo_request', '${R2}', true); ${noPath}`, value: rowsOf(R2) }),
    loose: `23502: ${notNull} | 0`, locked: 'P0001: photo_insert_forbidden | 0',
  })
  add({
    ...toggle("storage_path: Default '' wiederhergestellt (Schicht: NOT NULL; der Trigger ist im Probe-Ablauf aus, Rollback)", "alter table public.request_photos alter column storage_path set default ''", 'alter table public.request_photos alter column storage_path drop default', 'Schicht'),
    tests: 'kein Default mehr',
    probe: () => probe({ setup: 'alter table public.request_photos disable trigger guard_photo_insert', stmt: noPath, value: rowsOf(R2) }),
    loose: 'ok | 1', locked: `23502: ${notNull} | 0`,
  })
  // 8. Aufräumen: Waisenliste---------------------------------------------------------------------------------------------------------------------
  const orphanSetup = `update storage.objects set created_at = now() - interval '30 hours' where bucket_id = '${BUCKET}' and name in ('${adoptedPath}', '${path(A, refX, X1)}')`
  const orphans = (names) => names.map((n) => `(select count(*) from public.photo_orphans() where name = '${n}')`).join(` || '/' || `)
  add({
    ...patchFn('photo_orphans: übernommene Dateien nicht mehr ausgenommen', 'public.photo_orphans()', 'and not exists (select 1 from public.request_photos p where p.storage_path = o.name)', ''),
    tests: 'Waisen-Liste: nur',
    probe: () => probe({ setup: orphanSetup, stmt: 'perform 1', value: orphans([adoptedPath, path(A, refX, X1)]), role: 'service_role' }),
    loose: 'ok | 1/1', locked: 'ok | 0/1',
  })
  add({
    ...patchFn('photo_orphans: Ablauf nicht mehr beachtet (frisches Staging-Foto wird gelistet)', 'public.photo_orphans()', "now() - public.photo_staging_interval() - interval '1 hour'", "now() + interval '1 day' + public.photo_staging_interval()"),
    tests: 'Waisen-Liste: nur',
    probe: () => probe({ setup: orphanSetup, stmt: 'perform 1', value: orphans([path(A, refS, S1), path(A, refX, X1)]), role: 'service_role' }),
    loose: 'ok | 1/1', locked: 'ok | 0/1',
  })
  add({
    ...patchFn('photo_orphans: Karenz von einer Stunde entfernt (Datei knapp über der Übernahmegrenze wird gelistet)', 'public.photo_orphans()', " - interval '1 hour'", ''),
    tests: null,
    probe: () => probe({ setup: `update storage.objects set created_at = now() - interval '24 hours 30 minutes' where bucket_id = '${BUCKET}' and name = '${path(A, refS, S1)}'`, stmt: 'perform 1', value: orphans([path(A, refS, S1)]), role: 'service_role' }),
    loose: 'ok | 1', locked: 'ok | 0',
  })
  add({
    ...toggle('photo_orphans: EXECUTE für authenticated (Schicht: kein Recht auf photo_staging_interval)', `grant execute on function public.photo_orphans() to authenticated`, `revoke execute on function public.photo_orphans() from authenticated`, 'Schicht'),
    tests: null,
    probe: () => probe({ stmt: 'perform * from public.photo_orphans()', value: '1', role: 'authenticated', claims: claims(A) }),
    loose: '42501: permission denied for function photo_staging_interval | 1', locked: '42501: permission denied for function photo_orphans | 1',
  })
  // Isoliert (M-3, Berater S9a-4c): quote_save_request ist SECURITY INVOKER (0020); die inneren Schichten (RLS auf platform_settings, fehlende
  // Schreibrechte auf vier Tabellen) sind nur in der Probe-Transaktion offen (Rollback), umgeschaltet wird allein die Zielsperre.
  // Wert = Anfragen des Kunden A: gelockert legt die Funktion eine Anfrage an (n+1), gesperrt bleibt es bei n mit dem 42501 der Zielsperre.
  const reqCount = `(select count(*) from public.service_requests where customer_id = '${A.id}')`
  const INNER = [
    'create policy redproof_ps on public.platform_settings for select to authenticated using (true)',
    'grant insert on public.service_requests, public.price_revisions, public.request_contacts, public.audit_log to authenticated',
    'grant update (current_revision) on public.service_requests to authenticated',
    'create policy redproof_sr_i on public.service_requests for insert to authenticated with check (true)',
    'create policy redproof_sr_u on public.service_requests for update to authenticated using (true) with check (true)',
    'create policy redproof_pr_i on public.price_revisions for insert to authenticated with check (true)',
    'create policy redproof_rc_i on public.request_contacts for insert to authenticated with check (true)',
    'create policy redproof_al_i on public.audit_log for insert to authenticated with check (true)',
  ].join('; ')
  const saveProbe = (open) => () => probe({ setup: `${INNER}; grant execute on function ${open} to authenticated`, stmt: `perform ${callSql({ p_client_ref: randomUUID() })}`, value: reqCount, role: 'authenticated', claims: claims(A) })
  add({
    ...toggle('quote_save_request: EXECUTE für authenticated (isoliert: innere Schichten und photo_staging_interval nur in der Probe offen)', `grant execute on function ${SAVE} to authenticated`, `revoke execute on function ${SAVE} from authenticated`),
    tests: null,
    probe: saveProbe(INTERVAL),
    loose: 'ok | 4', locked: '42501: permission denied for function quote_save_request | 3',
  })
  add({
    ...toggle('photo_staging_interval: EXECUTE für authenticated (isoliert: innere Schichten und quote_save_request nur in der Probe offen)', `grant execute on function ${INTERVAL} to authenticated`, `revoke execute on function ${INTERVAL} from authenticated`),
    tests: null,
    probe: saveProbe(SAVE),
    loose: 'ok | 4', locked: '42501: permission denied for function photo_staging_interval | 3',
  })
  // 0022: Selbst-Upgrade. Gelockert = Funktion und Recht aus 0001/0016 wieder da; Wert = Gebührenschlüssel aus Kundensicht (Startwert 0).
  const anonDb = mkClient(PUB)
  let brpOn = false
  const rpcReady = async () => {
    // PostgREST lädt das Schema nach DDL neu; erst dann sieht der zuständige Test den Zustand
    for (let i = 0; i < 20; i++) {
      const missing = (await anonDb.rpc('become_rental_provider')).error?.code === 'PGRST202'
      if (missing !== brpOn) return
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error('PostgREST-Schema nicht nachgeladen')
  }
  const BRP = `create function public.become_rental_provider() returns public.user_role
language plpgsql security definer set search_path = ''
as $f$
declare
  uid uuid := (select auth.uid());
  r public.user_role;
begin
  perform set_config('app.mv_role_grant', uid::text || ':rental_provider', true);
  update public.profiles set role = 'rental_provider' where id = uid and role = 'customer';
  perform set_config('app.mv_role_grant', '', true);
  select role into r from public.profiles where id = uid;
  return r;
end
$f$;
revoke all on function public.become_rental_provider() from public, anon;
grant execute on function public.become_rental_provider() to authenticated;
notify pgrst, 'reload schema'`
  add({
    label: 'become_rental_provider entfernt (0022): Kunde stuft sich selbst hoch und liest den Gebührensatz', kind: 'Sperre',
    text: () => SQL.createObject(BRP, `drop function if exists public.become_rental_provider(); notify pgrst, 'reload schema'`),
    onLoose: () => { brpOn = true }, onRestored: () => { brpOn = false },
    tests: 'kein Selbst-Upgrade', testFile: 'tests/rls/rls.test.ts',
    probe: async () => {
      await rpcReady()
      return probe({
        setup: `select set_config('app.probe_val', '0', true)`,
        stmt: `perform public.become_rental_provider(); perform set_config('app.probe_val', (select count(distinct key) from public.platform_settings where key in ('fee_rate', 'fee_vat_rate'))::text, true)`,
        value: `current_setting('app.probe_val', true)`, role: 'authenticated', claims: claims(A),
      })
    },
    loose: 'ok | 2', locked: '42883: function public.become_rental_provider() does not exist | 0',
  })

  // --- Läufe --------------------------------------------------------------------------------------------------------------------------------
  const onlyAt = process.argv.indexOf('--only')
  const only = onlyAt < 0 ? null : process.argv.slice(onlyAt + 1).flatMap((a) => a.split(',')).filter((a) => a && !a.startsWith('--')).map((a) => a.toLowerCase())
  const withTests = !process.argv.includes('--no-tests')
  const withLive = !process.argv.includes('--no-live')
  const matches = (s) => !only || only.some((o) => s.label.toLowerCase().includes(o))
  const selected = loosen.filter(matches)

  if (process.argv.includes('--deadman-probe')) { // nur der Totmann-Probelauf je Restore-Art (nichts gelockert), dann Ende
    for (const l of rp.deadmanProbe(loosen.map((s) => ({ label: s.label, restore: s.text().restore })))) console.log(`Totmann-Probelauf ${l}`)
    return
  }

  // Schritte mit photo_orphans wirken auf den echten Aufräumjob (stündlich um :23): der Job ist für die ganze Dauer pausiert (Fenster mit Markierung).
  const steps = () => runSql(selected, withTests)
  if (selected.some((s) => s.cron)) await rp.cronPause(steps)
  else await steps()
  if (mode === 'print') return

  // --- Teil 2: Live-Probe der deployten Function (R2-N13) ---------------------------------------------------------------------------------
  if (withLive && !only) await liveProbe()

  // --- Teil 3: Werkzeuge ------------------------------------------------------------------------------------------------------------------
  if (!only) tools()
}

async function liveProbe() {
  const quote = `${URL_}/functions/v1/quote`
  const post = async (user, body) => {
    const res = await fetch(quote, { method: 'POST', headers: { 'content-type': 'application/json', apikey: PUB, authorization: `Bearer ${user.jwt}` }, body: JSON.stringify(body) })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* keine JSON-Antwort */ }
    return { status: res.status, json }
  }
  const record = (label, got, want, extra = {}) => {
    const good = got === want
    results.push({ label: `Beobachtung quote (deployt): ${label}`, kind: 'Beobachtung', part: 'Live', looseValue: got, lockedValue: got, loose: want, locked: want, good, effect: good, blocked: good, ...extra })
    console.log(`${good ? 'OK    ' : 'FEHLER'} [Live] ${label}: ${got} (erwartet ${want})`)
  }
  // Adresse wie in der App: Kandidat der Function route (die Prüfung in quote verlangt Label und Punkt des Anbieters).
  const geo = await fetch(`${URL_}/functions/v1/route`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: PUB, authorization: `Bearer ${A.jwt}` }, body: JSON.stringify({ mode: 'geocode', q: 'Stephansplatz 1, Wien', captcha: CAPTCHA }) })
  const cand = (await geo.json()).candidates?.[0]
  if (!cand) throw new Error('Live-Probe: route lieferte keinen Kandidaten')
  const move = (ref, photoIds) => ({
    service: 'clearance', clientRef: ref,
    inputs: { object: 'flat', area: 60, fill: 'normal', lift: false, floor: 3, special: false, assembly: null },
    from: { label: cand.label, point: { lat: cand.lat, lon: cand.lon } },
    preferredDate: dayIn(14), timeWindow: 'morning', contact: CONTACT, photoIds,
  })
  // Wie die App: Bedingungen und Preis erst abfragen (409), dann mit den gezeigten Werten senden.
  const settle = async (user, body) => {
    const first = await post(user, { ...body, priceVersion: 1, termsHash: 'f'.repeat(64), shown: { kind: 'price', totalCents: 0, lowCents: 0, highCents: 0 } })
    if (first.status !== 409 || first.json?.error !== 'terms_changed') return first
    const second = await post(user, { ...body, priceVersion: priceVersion, termsHash: first.json.terms.termsHash, shown: { kind: 'price', totalCents: 0, lowCents: 0, highCents: 0 } })
    const snap = second.json?.snapshot
    if (second.status !== 409 || !snap) return second
    return post(user, { ...body, priceVersion: second.json.priceVersion, termsHash: first.json.terms.termsHash, shown: { kind: 'price', totalCents: snap.totalCents ?? null, lowCents: snap.lowCents, highCents: snap.highCents } })
  }
  const state = (r) => `${r.status} ${r.json?.error ?? ''}`.trim()
  // 1. Parser der deployten Version: kein Array → 400 (die alte Version verwirft den Schlüssel und antwortet anders)
  record('photoIds kein Array → 400 invalid_input (neue Version deployt)', state(await post(A, { ...move(randomUUID(), []), photoIds: 'x', priceVersion, termsHash: 'f'.repeat(64), shown: { kind: 'price', totalCents: 0, lowCents: 0, highCents: 0 } })), '400 invalid_input')
  // Das Nutzerlimit von quote zählt in festen Minutenfenstern (6 je Minute): bis kurz nach der nächsten Minutengrenze warten
  const pause = () => new Promise((r) => setTimeout(r, 62_000 - (Date.now() % 60_000)))
  // 2. fremde Foto-ID → 422, nichts gespeichert
  const refF = randomUUID()
  const foreignId = randomUUID()
  await put(`${B.id}/${refF}/${foreignId}.jpg`)
  const f = await settle(A, move(refF, [foreignId]))
  const stored = (await service.from('service_requests').select('id').eq('client_ref', refF)).data?.length
  record('fremde Foto-ID → 422 photo_missing, keine Anfrage gespeichert', `${state(f)} / Anfragen ${stored}`, '422 photo_missing / Anfragen 0')
  await pause()
  // 3. neun Fotos → 422 too_many_photos
  const refM = randomUUID()
  const nineIds = Array.from({ length: 9 }, () => randomUUID())
  for (const n of nineIds) await put(`${A.id}/${refM}/${n}.jpg`)
  const m = await settle(A, move(refM, nineIds))
  record('9 Fotos → 422 too_many_photos', `${state(m)} / Anfragen ${(await service.from('service_requests').select('id').eq('client_ref', refM)).data?.length}`, '422 too_many_photos / Anfragen 0')
  await pause()
  // 4. eigenes Foto, vom Kunden selbst hochgeladen (Storage-Policy live) → 200, Zeile da
  const refO = randomUUID()
  const own = randomUUID()
  const up = await A.db.storage.from(BUCKET).upload(`${A.id}/${refO}/${own}.jpg`, JPEG, { contentType: 'image/jpeg' })
  if (!up.error) made.push(`${A.id}/${refO}/${own}.jpg`)
  const ok = await settle(A, move(refO, [own]))
  const rows = ok.json?.id ? (await service.from('request_photos').select('storage_path').eq('request_id', ok.json.id)).data?.map((r) => r.storage_path) : null
  record('eigenes Staging-Foto (Kunden-Upload) → 200 und Zeile in request_photos', `${state(ok)} / Zeilen ${JSON.stringify(rows)}`, `200 / Zeilen ${JSON.stringify([`${A.id}/${refO}/${own}.jpg`])}`)
  await pause()
  // 5. Wiederholung derselben clientRef: nichts kommt hinzu
  const again = await settle(A, move(refO, [own, randomUUID()]))
  record('Wiederholung derselben clientRef: dieselbe Anfrage, keine weitere Zeile', `${state(again)} / gleich ${again.json?.id === ok.json?.id} / Zeilen ${(await service.from('request_photos').select('id').eq('request_id', ok.json?.id)).data?.length}`, '200 / gleich true / Zeilen 1')
  // 5b. Rohaufrufe mit falschen Bestätigungen (R2-N13, Beobachtung des Deploy-Zustands): 409 und keine Anfrage. Anderer Nutzer: eigenes Rate-Limit.
  const refW = randomUUID()
  const nReq = async (ref) => (await service.from('service_requests').select('id').eq('client_ref', ref)).data?.length
  const wrongTerms = await post(B, { ...move(refW, []), priceVersion, termsHash: 'f'.repeat(64), shown: { kind: 'price', totalCents: 0, lowCents: 0, highCents: 0 } })
  record('falscher termsHash → 409 terms_changed, keine Anfrage', `${state(wrongTerms)} / Anfragen ${await nReq(refW)}`, '409 terms_changed / Anfragen 0')
  const wrongShown = await post(B, { ...move(refW, []), priceVersion, termsHash: wrongTerms.json?.terms?.termsHash ?? 'f'.repeat(64), shown: { kind: 'price', totalCents: 0, lowCents: 0, highCents: 0 } })
  record('falsches shown → 409 price_changed, keine Anfrage', `${state(wrongShown)} / Anfragen ${await nReq(refW)}`, '409 price_changed / Anfragen 0')
  // 6. nach dem Absenden: Hinzufügen/Löschen/Ersetzen über die Storage-API des Kunden
  const addLate = await A.db.storage.from(BUCKET).upload(`${A.id}/${refO}/${randomUUID()}.jpg`, JPEG, { contentType: 'image/jpeg' })
  const delLate = await A.db.storage.from(BUCKET).remove([`${A.id}/${refO}/${own}.jpg`])
  const repLate = await A.db.storage.from(BUCKET).upload(`${A.id}/${refO}/${own}.jpg`, JPEG2, { contentType: 'image/jpeg', upsert: true })
  record('nach dem Absenden: Hinzufügen/Löschen/Ersetzen verweigert, Datei unverändert', `hinzufügen ${addLate.error?.statusCode ?? 'ok'} / löschen ${delLate.data?.length ?? 'Fehler'} / ersetzen ${repLate.error?.statusCode ?? 'ok'} / Datei ${(await exists(`${A.id}/${refO}/${own}.jpg`)) ? 'da' : 'weg'}`, 'hinzufügen 403 / löschen 0 / ersetzen 403 / Datei da')
}

function tools() {
  const record = (label, got, want) => {
    results.push({ label, kind: 'Werkzeug', part: 'Werkzeug', looseValue: got, lockedValue: want, loose: want, locked: want, good: got === want, effect: got === want, blocked: got === want })
    console.log(`${got === want ? 'OK    ' : 'FEHLER'} [Werkzeug] ${label}: ${got} (erwartet ${want})`)
  }
  // Gemessen wird die Wirkung (Exit-Code, Konten, Baum), nicht ein Meldungstext. Die Kinder laufen lesend (--soll): Kontrolle Exit 0, mit der Störung Exit 2,
  // so trennt der Vergleich die Ursache (die Sperre des laufenden Hauptprozesses spielt im lesenden Modus keine Rolle).
  const accounts = () => Number(select(`select count(*)::int as n from auth.users where email like 'redproof-%@movenow.test'`)[0].n)
  const child = (script, env = process.env) => spawnSync(process.execPath, [script, '--soll', 'scripts/redproof-soll.json', '--only', 'zzz-nichts'], { encoding: 'utf8', env })
  const a0 = accounts()
  const fake = 'a'.repeat(20)
  const control = child('scripts/redproof-s9a4.mjs')
  const g = child('scripts/redproof-s9a4.mjs', { ...process.env, SUPABASE_PROJECT_ID: fake })
  record('M-3: dev-guard mit fiktiver SUPABASE_PROJECT_ID', `Kontrolle Exit ${control.status}, fiktive Ref Exit ${g.status}, Konten ${accounts() === a0 ? 'unverändert' : 'VERÄNDERT'}`, 'Kontrolle Exit 0, fiktive Ref Exit 2, Konten unverändert')
  const cliRun = spawnSync(process.execPath, [SB, 'db', 'query', '--linked', 'select 1 as x'], { encoding: 'utf8', env: { ...process.env, SUPABASE_PROJECT_ID: fake } })
  record('M-3: CLI mit fiktiver Ref scheitert und nennt die fiktive Ref', `Exit ${cliRun.status !== 0 ? '≠0' : '0'}, ${(cliRun.stderr + cliRun.stdout).includes(fake) ? 'Ref genannt' : 'Ref nicht genannt'}`, 'Exit ≠0, Ref genannt')
  // A-N4: uncommittete Datei unter supabase/functions → die Startprüfung bricht ab (Exit 2), ohne die Datei Exit 0; danach ist der Baum wieder wie vorher.
  const helper = 'supabase/functions/zz-redproof-s9a4.tmp'
  const treeBefore = execFileSync('git', ['status', '--porcelain', '--', 'supabase/functions'], { encoding: 'utf8' }).trim()
  const clean = child('scripts/redproof-s9a3.mjs')
  writeFileSync(helper, 'redproof\n')
  let dirty, treeAfter
  try {
    dirty = child('scripts/redproof-s9a3.mjs')
  } finally {
    rmSync(helper, { force: true })
    treeAfter = execFileSync('git', ['status', '--porcelain', '--', 'supabase/functions'], { encoding: 'utf8' }).trim()
  }
  record('A-N4: Start von redproof-s9a3 mit uncommitteter Datei unter supabase/functions', `ohne Datei Exit ${clean.status}, mit Datei Exit ${dirty.status}, Konten ${accounts() === a0 ? 'unverändert' : 'VERÄNDERT'}, Hilfsdatei ${existsSync(helper) ? 'NOCH DA' : 'entfernt'}, Baum ${treeAfter === treeBefore ? 'wie vorher' : 'VERÄNDERT'}`, 'ohne Datei Exit 0, mit Datei Exit 2, Konten unverändert, Hilfsdatei entfernt, Baum wie vorher')
}

mkdirSync('tmp/proof', { recursive: true })
mkdirSync('tmp/reports/r1', { recursive: true })
const main = async () => {
  if (mode === 'readonly') { console.log('Startprüfung gegen die angegebene Soll-Datei bestanden, nichts gelockert (Modus lesend).'); return EXIT.OK }
  try {
    await run()
  } finally {
    // Aufräumen: jeder Schritt einzeln abgesichert, damit ein Netzfehler die übrigen nicht überspringt.
    const step = async (label, f) => { try { await f() } catch (e) { console.error(`AUFRÄUMEN FEHLGESCHLAGEN: ${label}: ${e?.message ?? e}`) } }
    if (mode === 'write') {
      for (const u of [A, B, C, E]) if (u) await step(`Konto ${u.id}`, () => service.auth.admin.deleteUser(u.id))
      for (let i = 0; i < made.length; i += 100) await step('Dateien löschen', () => service.storage.from(BUCKET).remove(made.slice(i, i + 100)))
    }
  }
  if (process.argv.includes('--deadman-probe')) return rp.finish().end.length ? EXIT.FAIL : EXIT.OK // kein Bericht, kein Rot-Beweis
  if (mode === 'print') {
    writeFileSync('tmp/proof/r1-dev-sql-s9a4.sql', rp.printed.map((p) => `-- ${p.label}\n${p.sql ?? [p.loosen && `-- Lockerung\n${p.loosen}`, p.restore && `-- Restore\n${p.restore}`].filter(Boolean).join('\n')}\n`).join('\n'))
    console.log(`SQL-Texte nach tmp/proof/r1-dev-sql-s9a4.sql geschrieben (${rp.printed.length} Einträge), nichts gesendet außer Selects.`)
    return EXIT.OK
  }
  const { end } = rp.finish()
  const same = end.length === 0
  const count = (part, kind) => results.filter((r) => r.good && r.part === part && r.kind === kind).length
  const report = [
    '# S9a-4 Rot-Beweis (R1-Lib)',
    '',
    `Stand ${new Date().toISOString()} (Dev-Projekt). Soll: scripts/redproof-soll.json. Teil 1 SQL und Storage: Ist-Wert-Probe mit der Lockerung in einer Rollback-Transaktion bzw. Storage-API im committeten Fenster, zuständigen Test laufen lassen, Restore bis Soll-Gleichheit; Schritte mit photo_orphans unter Cron-Pause. Teil 2 Live-Probe (R2-N13): Aufrufe gegen die deployte Function \`quote\` mit Testnutzer-JWT, keine Quelltext-Mutation. Teil 3 Werkzeuge (M-3, A-N4), Wirkung statt Meldungstext.`,
    '',
    'Format der Probe: „Ergebnis | Wert“. Ergebnis ist „ok“ oder „SQLSTATE: Meldung“; Wert ist der Zustand danach. „Schicht“: eine zweite Sperre dahinter hält, kein Beweis der ersten.',
    '',
  ]
  for (const r of results) {
    report.push(`## ${r.label}`, '', `- Teil: ${r.part}; Art: ${r.kind === 'Schicht' ? 'Schicht (zweite Sperre dahinter, kein Beweis der ersten)' : r.kind}`)
    report.push(`- Gelockert/Beobachtet: \`${r.looseValue}\` (erwartet \`${r.loose}\`) ${r.effect ? '✓' : '✗ ABWEICHUNG'}`, `- Gesperrt/Wiederhergestellt: \`${r.lockedValue}\` (erwartet \`${r.locked}\`) ${r.blocked ? '✓' : '✗ ABWEICHUNG'}`)
    if (r.part === 'SQL') report.push(r.tests ? `- Test \`${r.testFile ?? 'tests/rls/uploads.test.ts'}\` -t "${r.tests}" gelockert: ${r.redTests ? `${r.redTests.status}: ${r.redTests.failed.length} rot von ${r.redTests.ran} gelaufen${r.redTests.message ? ` (${r.redTests.message})` : ''}${r.redTests.reason ? ` [${r.redTests.reason}]` : ''}` : 'nicht ausgeführt'} ${r.testsRed ? '✓' : '✗ (kein Rot-Beweis!)'}` : '- Test: keiner (Wirkung durch die Probe belegt)')
    report.push(`- Bewertung: ${r.good ? 'bestanden' : 'FEHLGESCHLAGEN'}`, '')
  }
  report.push('## Fenster (committete Lockerungen)', '', 'Schlüssel = Diff von Dev gegen das Soll nach dem Commit (aus der Probe-Transaktion abgeleitet, der Commit muss gleich sein); Hash = sha256 des Lockerungstexts in Probe und Commit.', '')
  for (const w of rp.windowLog) report.push(`- ${w.label}: ${w.keys.join('; ')}; Hash Probe ${w.hashProbe.slice(0, 12)}, Commit ${w.hashCommit.slice(0, 12)}: ${w.hashProbe === w.hashCommit ? 'gleich' : 'ABWEICHUNG'}`)
  report.push('', '## Endprüfung gegen das Soll', '', same ? 'Dev ist nach dem Lauf gleich dem Soll (alle Objektarten des Snapshots).' : `ACHTUNG: Dev weicht vom Soll ab: ${end.map((x) => `${x.k} ${x.n} ${x.state}`).join('; ')}`, '')
  report.push(`Ergebnis: SQL ${count('SQL', 'Sperre')} Sperren und ${count('SQL', 'Schicht')} Schichten, ${count('SQL', 'Verfügbarkeit')} Verfügbarkeit, Beobachtungen ${count('Live', 'Beobachtung')}, Werkzeuge ${count('Werkzeug', 'Werkzeug')}, bestanden von ${results.length} Prüfungen.`)
  writeFileSync(process.argv.includes('--only') ? 'tmp/proof/s9a4-rotbeweis-teil.md' : 'tmp/proof/s9a4-rotbeweis.md', report.join('\n') + '\n')
  const allGood = results.every((r) => r.good) && same
  console.log(same ? 'Dev nach dem Lauf gleich Soll.' : 'ACHTUNG: Dev weicht vom Soll ab!')
  console.log(allGood ? 'REDPROOF BESTANDEN' : 'REDPROOF FEHLGESCHLAGEN')
  return allGood ? EXIT.OK : EXIT.FAIL
}
await runMain(rp, main, deps)
