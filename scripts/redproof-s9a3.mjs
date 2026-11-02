// Rot-Beweis S9a-3 (nur Dev-Projekt). Drei Teile, jede Prüfung misst den Ist-Wert:
//  1. SQL-Sperren aus 0019: lockern (committet, Eigentümer-SQL), Probe „Ergebnis | Wert“ (Rollback), wiederherstellen, Probe erneut, zuständiger Test muss gelockert rot werden.
//  2. Function-Sperren in quote (Redeploy-Beweis R2-N13): Quelltext lockern, deployen, Test muss rot werden (Ist-Wert = Fehlermeldung des Tests),
//     aus dem Git-Stand zurücksetzen, neu deployen, Test muss grün sein.
//  3. Werkzeuge: Negativbeweis N-15 (falsche Ref in SUPABASE_PROJECT_ID erreicht Dev nicht), N-16 (scan-proof findet Token, URL, fehlendes Verzeichnis).
// „Schicht“: eine zweite Sperre dahinter hält; der erwartete Wert ist der Fehler der zweiten Schicht, kein Beweis der ersten.
// Vorher/Nachher: Definitionen (md5), Policies, Trigger (inkl. tgenabled) und Rechte werden verglichen. Bericht: tmp/proof/s9a3-rotbeweis.md
// Start: npx dotenv -e .env.local -- node scripts/redproof-s9a3.mjs [--only <Namensteil>[,…]] [--no-tests] [--no-code]
import './dev-guard.mjs'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SB = 'node_modules/supabase/dist/supabase.js'
const cli = (...args) => execFileSync(process.execPath, [SB, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 })
const sql = (q) => {
  const json = JSON.parse(cli('db', 'query', '--linked', q))
  if (json._tag === 'Error') throw new Error(json.error?.message)
  return json.rows
}
const q1 = (s) => `'${s.replaceAll("'", "''")}'`

const OBJECTS = `('public.service_requests'::regclass, 'public.price_revisions'::regclass, 'public.status_events'::regclass, 'public.rental_bookings'::regclass, 'public.request_contacts'::regclass, 'public.geocode_cache'::regclass, 'public.geo_districts'::regclass, 'public.profiles'::regclass)`
const SNAPSHOT = `
  select 'policy' k, schemaname || '.' || tablename || '.' || policyname || ' ' || cmd || ' ' || roles::text || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') v
    from pg_policies where (schemaname = 'public' and tablename in ('service_requests', 'price_revisions', 'status_events', 'rental_bookings', 'request_contacts', 'geocode_cache', 'geo_districts')) or (schemaname = 'storage' and tablename = 'objects')
  union all
  select 'trigger', tgrelid::regclass || ' ' || tgenabled::text || ' ' || pg_get_triggerdef(oid) from pg_trigger where not tgisinternal and tgrelid in ${OBJECTS}
  union all
  select 'constraint', conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid) from pg_constraint where conrelid in ${OBJECTS}
  union all
  select 'function', p.oid::regprocedure || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'private' and p.proname in ('guard_request_insert', 'guard_request_status', 'guard_request_pointer', 'guard_request_fields', 'guard_revision_insert', 'guard_rental_status', 'immutable_row', 'log_request_status', 'require_revision'))
       or (n.nspname = 'public' and p.proname in ('withdraw', 'quote_save_request', 'quote_save_booking', 'quote_district', 'price_version_hold'))
  union all
  select 'acl', c.oid::regclass || ' ' || coalesce(c.relacl::text, '') from pg_class c where c.oid in ${OBJECTS}
  union all
  select 'colacl', attrelid::regclass || '.' || attname || ' ' || attacl::text from pg_attribute where attrelid in ${OBJECTS} and attacl is not null
  order by 1, 2`
const snapshot = () => JSON.stringify(sql(SNAPSHOT))

const def = (name) => sql(`select pg_get_functiondef('${name}'::regprocedure) as d`)[0].d
const conDef = (name, table) => sql(`select pg_get_constraintdef(oid) as d from pg_constraint where conname = ${q1(name)} and conrelid = '${table}'::regclass`)[0].d

const SAVE = 'public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb)'
const TERMS = { cancel_free_hours: 48, cancel_late_percent: 50, cancel_full_percent: 100, cancel_full_days_before: 1, call_out_fee_cents: 0, termsHash: 'a'.repeat(64) }
const CONTACT = { name: 'Test Kunde', phone: '+43 660 1234567', email: 'kunde@movenow.test', stairsDoor: null }

// --- Fixtures: ein Wegwerf-Kunde, im finally gelöscht ------------------------------------------------------------------------------
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const dayIn = (n) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
let userId
let priceVersion
const baseArgs = () => ({
  p_customer: userId, p_client_ref: randomUUID(), p_service: 'move', p_inputs: {},
  p_snapshot: { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961, lines: [{ key: 'a', cents: 68961 }], terms: TERMS },
  p_price_version: priceVersion, p_total: 68961, p_low: 68961, p_high: 68961,
  p_from_address: null, p_from_lon: null, p_from_lat: null, p_to_address: null, p_to_lon: null, p_to_lat: null,
  p_route: null, p_region: null, p_district: 1, p_preferred_date: dayIn(14), p_time_window: null, p_description: null, p_volume: null,
  p_contact: CONTACT, p_confirmed: { shown: { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 }, termsHash: TERMS.termsHash },
})
// Alle Werte als unbestimmte Literale: PostgreSQL wählt den Parametertyp (smallint, date, jsonb, enum).
const lit = (v) => (v === null ? 'null' : q1(typeof v === 'object' ? JSON.stringify(v) : String(v)))
const callSql = (over = {}) => `public.quote_save_request(${Object.entries({ ...baseArgs(), ...over }).map(([k, v]) => `${k} => ${lit(v)}`).join(', ')})`
const make = async (over = {}) => {
  const { data, error } = await service.rpc('quote_save_request', { ...baseArgs(), ...over })
  if (error) throw error
  return data[0].id
}

// --- Probe: führt `stmt` aus (Rolle/Claims wie angegeben), meldet „ok“ oder „SQLSTATE: Meldung“, dann den Ist-Wert `value` ---------------
const probe = ({ setup = '', stmt, value, role = 'owner', claims = '' }) => {
  const prefix = [role === 'owner' ? '' : `set local role ${role};`, claims ? `perform set_config('request.jwt.claims', ${q1(claims)}, true);` : ''].join(' ')
  const body = `begin ${prefix} ${stmt}; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce((${value})::text, '<null>');`
  const rows = sql(`begin; ${setup}; create temp table res (v text); do $p$ begin ${body} end $p$; select string_agg(v, ' | ') as v from res; rollback;`)
  return rows[0].v
}

const results = []
const loosen = []
const add = (s) => loosen.push(s)
const patchFn = (label, fn, from, to) => ({
  label, kind: 'Sperre', save: () => def(fn),
  apply: (d) => {
    if (!d.includes(from)) throw new Error(`Muster nicht gefunden: ${from}`)
    sql(d.replace(from, to))
  },
  restore: (d) => sql(d),
})
const disableTrigger = (name, table, label) => ({
  label, kind: 'Sperre', save: () => null, apply: () => sql(`alter table ${table} disable trigger ${name}`), restore: () => sql(`alter table ${table} enable trigger ${name}`),
})
const grantToggle = (label, loosenSql, restoreSql, kind = 'Sperre') => ({ label, kind, save: () => null, apply: () => sql(loosenSql), restore: () => sql(restoreSql) })

const runSql = async (selected, withTests, testRun) => {
  for (const s of selected) {
    // Wiederherstellungs-SQL liegt vor dem Lockern in einer Datei (A1-N1): bricht der Lauf ab, steht die Definition dort.
    const saved = s.save()
    if (saved) writeFileSync(`tmp/proof/s9a3-restore-${results.length}.sql`, String(saved))
    let looseValue, redTests
    try {
      s.apply(saved)
      looseValue = s.probe()
      if (withTests && s.tests) redTests = testRun(s.tests, s.testFile)
    } finally {
      s.restore(saved)
    }
    const lockedValue = s.probe()
    const effect = looseValue === s.loose
    const blocked = lockedValue === s.locked
    const testsRed = !withTests || !s.tests || redTests.failed.length > 0
    const good = effect && blocked && testsRed
    results.push({ ...s, part: 'SQL', looseValue, lockedValue, redTests, good, effect, blocked, testsRed })
    console.log(`${good ? 'OK    ' : 'FEHLER'} [${s.kind}] ${s.label}\n         gelockert: ${looseValue} (erwartet ${s.loose})\n         gesperrt:  ${lockedValue} (erwartet ${s.locked})${redTests ? `\n         Test rot: ${redTests.failed.length}` : ''}`)
  }
}

const run = async () => {
  priceVersion = sql(`select version from public.current_price_version`)[0].version
  userId = (await service.auth.admin.createUser({ email: `redproof-s9a3-${Date.now().toString(36)}@movenow.test`, password: `${randomUUID()}Aa1!`, email_confirm: true })).data.user.id
  const A = await make()
  const custClaims = JSON.stringify({ sub: userId, role: 'authenticated', aal: 'aal1' })
  const reqCount = `(select count(*) from public.service_requests where customer_id = '${userId}')`
  const contactCount = `(select count(*) from public.request_contacts c join public.service_requests r on r.id = c.request_id where r.customer_id = '${userId}')`
  const rentalSetup = (id) => `insert into public.rental_bookings (id, offer_id, customer_id, pickup_at, return_at, km, price_snapshot, price_version, total_cents, deposit_cents)
    select '${id}', (select id from public.rental_offers limit 1), '${userId}', now() + interval '20 days', now() + interval '21 days', 10, '{}', ${priceVersion}, 100, 0`
  const rid = randomUUID()
  const rentalStatus = `(select status from public.rental_bookings where id = '${rid}')`
  const rentalCount = `(select count(*) from public.rental_bookings where id = '${rid}')`

  // 1. N-10: rental_bookings für service_role (Schicht: Statustrigger guard_rental_status bzw. Löschschutz) ---------------------------
  add({
    ...grantToggle('rental_bookings: UPDATE für service_role (Schicht: guard_rental_status)', 'grant update on public.rental_bookings to service_role', 'revoke update on public.rental_bookings from service_role'),
    // requested → withdrawn ist ein gültiges Paar: hier hält allein das Revoke (Trigger lässt es durch).
    tests: 'rental_bookings: service_role darf', testFile: 'tests/rls/quote-hardening.test.ts', // ohne Umlaut: cmd.exe reicht „ü“ nicht an vitest -t durch
    probe: () => probe({ setup: rentalSetup(rid), stmt: `update public.rental_bookings set status = 'withdrawn' where id = '${rid}'`, value: rentalStatus, role: 'service_role' }),
    loose: 'ok | withdrawn', locked: '42501: permission denied for table rental_bookings | requested',
  })
  add({
    ...grantToggle('rental_bookings: UPDATE ungültiges Statuspaar (Schicht: guard_rental_status)', 'grant update on public.rental_bookings to service_role', 'revoke update on public.rental_bookings from service_role'),
    kind: 'Schicht', tests: null,
    probe: () => probe({ setup: rentalSetup(rid), stmt: `update public.rental_bookings set status = 'completed' where id = '${rid}'`, value: rentalStatus, role: 'service_role' }),
    loose: 'P0001: invalid_transition | requested', locked: '42501: permission denied for table rental_bookings | requested',
  })
  add({
    ...grantToggle('rental_bookings: DELETE für service_role (Schicht: Löschschutz)', 'grant delete on public.rental_bookings to service_role', 'revoke delete on public.rental_bookings from service_role'),
    kind: 'Schicht', tests: 'rental_bookings: service_role darf', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ setup: rentalSetup(rid), stmt: `delete from public.rental_bookings where id = '${rid}'`, value: rentalCount, role: 'service_role' }),
    loose: 'ok | 0', locked: '42501: permission denied for table rental_bookings | 1',
  })
  // 2. Pflichtangaben in quote_save_request ------------------------------------------------------------------------------------------
  add({
    ...patchFn('terms_missing: Bedingungen im Snapshot nicht mehr verlangt (Schicht: invalid_revision)', SAVE, "if not coalesce(p_snapshot -> 'terms' ?& array", "if false and not coalesce(p_snapshot -> 'terms' ?& array"),
    kind: 'Schicht', tests: 'terms_missing', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: `perform ${callSql({ p_snapshot: { kind: 'price', totalCents: 1, lowCents: 1, highCents: 1, lines: [] } })}`, value: reqCount, role: 'service_role' }),
    loose: 'P0001: invalid_revision | 1', locked: 'P0001: terms_missing | 1',
  })
  add({
    ...patchFn('district_required: Bezirk nicht mehr verlangt (Schicht: NOT NULL der Spalte)', SAVE, 'if p_district is null then', 'if false and p_district is null then'),
    kind: 'Schicht', tests: 'quote_save_request: eigene Prüfungen', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: `perform ${callSql({ p_district: null })}`, value: reqCount, role: 'service_role' }),
    loose: '23502: null value in column "district" of relation "service_requests" violates not-null constraint | 1', locked: 'P0001: district_required | 1',
  })
  add({
    ...patchFn('contact_required: Kontakt nicht mehr verlangt (Schicht: NOT NULL der Spalten)', SAVE, "raise exception 'contact_required';", 'null;'),
    kind: 'Schicht', tests: 'quote_save_request: eigene Prüfungen', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: `perform ${callSql({ p_contact: null })}`, value: reqCount, role: 'service_role' }),
    loose: '23502: null value in column "name" of relation "request_contacts" violates not-null constraint | 1', locked: 'P0001: contact_required | 1',
  })
  add({
    ...patchFn('confirmed_required: Bestätigung nicht mehr verlangt (Schicht: NOT NULL audit_log.detail)', SAVE, "raise exception 'confirmed_required';", 'null;'),
    kind: 'Schicht', tests: 'quote_save_request: eigene Prüfungen', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: `perform ${callSql({ p_confirmed: null })}`, value: `${reqCount} || '/' || (select count(*) from public.audit_log where entity_id in (select id::text from public.service_requests where customer_id = '${userId}') and action = 'price_confirmed')`, role: 'service_role' }),
    loose: '23502: null value in column "detail" of relation "audit_log" violates not-null constraint | 1/1', locked: 'P0001: confirmed_required | 1/1',
  })
  add({
    ...patchFn('too_late: Mindestvorlauf nicht mehr geprüft (N-6, Test läuft gelockert)', SAVE, "if hours < (s ->> 'accept_min_hours')::numeric then", "if false and hours < (s ->> 'accept_min_hours')::numeric then"),
    tests: 'too_late', testFile: 'tests/rls/quote.test.ts',
    probe: () => probe({ stmt: `perform ${callSql({ p_preferred_date: dayIn(0) })}`, value: reqCount, role: 'service_role' }),
    loose: 'ok | 2', locked: 'P0001: too_late | 1',
  })
  add({
    ...grantToggle('request_contacts_format: Kontaktformat-Constraint entfernt', 'alter table public.request_contacts drop constraint request_contacts_format', '', 'Sperre'),
    save: () => conDef('request_contacts_format', 'public.request_contacts'),
    apply: () => sql('alter table public.request_contacts drop constraint request_contacts_format'),
    restore: (d) => sql(`alter table public.request_contacts add constraint request_contacts_format ${d}`),
    tests: 'Kontaktformat zusätzlich in der Datenbank', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: `perform ${callSql({ p_contact: { ...CONTACT, email: 'kein-mail' } })}`, value: contactCount, role: 'service_role' }),
    loose: 'ok | 2', locked: '23514: new row for relation "request_contacts" violates check constraint "request_contacts_format" | 1',
  })
  // 3. Bezirk und Stadtgrenze ---------------------------------------------------------------------------------------------------------
  add({
    ...patchFn('quote_district: Prüfung „liegt in Wien“ ausgeschaltet (Grazer Punkt)', 'public.quote_district(double precision, double precision)', 'extensions.ST_Covers(vi.geom, pt.p),', 'true,'),
    tests: 'price_version_hold und quote_district', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: 'perform 1', value: `(select in_vienna from public.quote_district(15.4395, 47.0707))`, role: 'service_role' }),
    loose: 'ok | true', locked: 'ok | false',
  })
  add({
    ...patchFn('quote_district: Bezirk aus falschem Polygon (immer 99)', 'public.quote_district(double precision, double precision)', 'select d.district from public.geo_districts d where extensions.ST_Covers(d.geom, pt.p) order by d.district limit 1', 'select 99::smallint'),
    tests: 'price_version_hold und quote_district', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: 'perform 1', value: `(select district from public.quote_district(16.3731, 48.2086))`, role: 'service_role' }),
    loose: 'ok | 99', locked: 'ok | 1',
  })
  // 4. Rechte der neuen Objekte -------------------------------------------------------------------------------------------------------
  add({
    ...grantToggle('geo_districts: SELECT für authenticated (Schicht: RLS ohne Policy)', 'grant select on public.geo_districts to authenticated', 'revoke select on public.geo_districts from authenticated'),
    kind: 'Schicht', tests: 'geocode_cache und geo_districts', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: 'perform 1 from public.geo_districts', value: `(select count(*) from public.geo_districts)`, role: 'authenticated', claims: custClaims }),
    loose: 'ok | 23', locked: '42501: permission denied for table geo_districts | 23',
  })
  add({
    ...grantToggle('geocode_cache: SELECT für authenticated (Schicht: RLS ohne Policy)', 'grant select on public.geocode_cache to authenticated', 'revoke select on public.geocode_cache from authenticated'),
    kind: 'Schicht', tests: 'geocode_cache und geo_districts', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: 'perform 1 from public.geocode_cache', value: `(select count(*) from public.geocode_cache)`, role: 'authenticated', claims: custClaims }),
    loose: 'ok | 0', locked: '42501: permission denied for table geocode_cache | 0',
  })
  add({
    ...grantToggle('quote_district: EXECUTE für authenticated (Schicht: kein Recht auf geo_boundaries)', 'grant execute on function public.quote_district(double precision, double precision) to authenticated', 'revoke execute on function public.quote_district(double precision, double precision) from authenticated'),
    kind: 'Schicht', tests: 'price_version_hold und quote_district', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: 'perform * from public.quote_district(16.3731, 48.2086)', value: `(select district from public.quote_district(16.3731, 48.2086))`, role: 'authenticated', claims: custClaims }),
    loose: '42501: permission denied for table geo_boundaries | 1', locked: '42501: permission denied for function quote_district | 1',
  })
  add({
    ...grantToggle('quote_save_request: EXECUTE für authenticated (Schicht: RLS auf platform_settings)', `grant execute on function ${SAVE} to authenticated`, `revoke execute on function ${SAVE} from authenticated`),
    kind: 'Schicht', tests: 'Schreib-Funktionen: anon und authenticated erhalten 42501', testFile: 'tests/rls/quote.test.ts',
    probe: () => probe({ stmt: `perform ${callSql()}`, value: reqCount, role: 'authenticated', claims: custClaims }),
    loose: 'P0001: setting_missing | 1', locked: '42501: permission denied for function quote_save_request | 1',
  })
  // 4b. Nachzug S9a-1 (A1-N2, A1-N3): Sperren aus 0015/0016 mit Ist-Wert; Version 9990 wird nie angelegt -----------------------------------
  const publishAuthed = 'public.publish_version(uuid, int)'
  add({
    ...grantToggle('S9a-1 N2: publish_version für authenticated mit nie angelegter Version 9990 (Schicht: assert_admin)', `grant execute on function ${publishAuthed} to authenticated`, `revoke execute on function ${publishAuthed} from authenticated`),
    kind: 'Schicht', tests: null,
    probe: () => probe({ stmt: `perform public.publish_version('${userId}', 9990)`, value: `(select count(*) from public.price_versions where version = 9990)`, role: 'authenticated', claims: custClaims }),
    loose: '42501: not_admin | 0', locked: '42501: permission denied for function publish_version | 0',
  })
  add({
    ...patchFn('S9a-1 N3: assert_admin lässt Nicht-Admin durch', 'private.assert_admin(uuid)', "raise exception 'not_admin' using errcode = '42501';", 'null;'),
    tests: null,
    probe: () => probe({ stmt: `perform public.admin_set_setting('${userId}', 'cancel_free_hours', 24, current_date + 60)`, value: `(select count(*) from public.platform_settings where key = 'cancel_free_hours' and effective_from > current_date)`, role: 'service_role' }),
    loose: 'ok | 1', locked: '42501: not_admin | 0',
  })
  add({
    ...patchFn('S9a-1 N3: guard_price_version, INSERT-Zweig (veröffentlicht einfügen)', 'private.guard_price_version()', 'if new.published or new.published_at is not null or new.content_hash is not null then', 'if false then'),
    tests: null,
    probe: () => probe({ stmt: `insert into public.price_versions (version, effective_on, note, published, published_at, content_hash) values (9990, current_date + 400, 'redproof', true, now(), repeat('a', 64))`, value: `(select count(*) from public.price_versions where version = 9990)` }),
    loose: 'ok | 1', locked: 'P0001: field_immutable | 0',
  })
  add({
    ...grantToggle('S9a-1 N3: TRUNCATE auf platform_settings für service_role (Schicht: Trigger)', 'grant truncate on public.platform_settings to service_role', 'revoke truncate on public.platform_settings from service_role'),
    kind: 'Schicht', tests: null,
    probe: () => probe({ stmt: 'truncate public.platform_settings', value: `(select count(*) from public.platform_settings)`, role: 'service_role' }),
    loose: 'P0001: append_only | 27', locked: '42501: permission denied for table platform_settings | 27',
  })
  add({
    ...patchFn('S9a-1 N3: booking_terms liefert fee_rate', 'public.booking_terms()', "array['cancel_free_hours',", "array['fee_rate', 'cancel_free_hours',"),
    tests: null,
    probe: () => probe({ stmt: 'perform 1', value: `(public.booking_terms())::text like '%fee_rate%'`, role: 'service_role' }),
    loose: 'ok | true', locked: 'ok | false',
  })
  // 5. M-5: Löschschutz nach 0019 (Eigentümer, nicht service_role) ---------------------------------------------------------------------
  add({
    ...disableTrigger('request_delete_guard', 'public.service_requests', 'request_delete_guard nach 0019 ausgeschaltet (Eigentümer-DELETE)'),
    tests: null,
    probe: () => probe({ stmt: `delete from public.service_requests where id = '${A}'`, value: `(select count(*) from public.service_requests where id = '${A}')` }),
    loose: 'ok | 0', locked: 'P0001: request_immutable | 1',
  })

  const onlyAt = process.argv.indexOf('--only')
  const only = onlyAt < 0 ? null : process.argv.slice(onlyAt + 1).flatMap((a) => a.split(',')).filter((a) => a && !a.startsWith('--')).map((a) => a.toLowerCase())
  const withTests = !process.argv.includes('--no-tests')
  const withCode = !process.argv.includes('--no-code')
  const matches = (s) => !only || only.some((o) => s.label.toLowerCase().includes(o))
  const selected = loosen.filter(matches)

  const testRun = (pattern, file = 'tests/rls/status.test.ts') => {
    const out = 'tmp/reports/redproof-s9a3.json'
    const r = spawnSync('npx', ['dotenv', '-e', '.env.local', '--', 'vitest', 'run', '--project', 'rls', file, '-t', JSON.stringify(pattern), '--reporter=json', `--outputFile=${out}`], { encoding: 'utf8', shell: true, maxBuffer: 1 << 26 })
    const tests = JSON.parse(readFileSync(out, 'utf8')).testResults.flatMap((f) => f.assertionResults)
    return { exit: r.status, ran: tests.filter((t) => t.status === 'failed' || t.status === 'passed').length, failed: tests.filter((t) => t.status === 'failed'), passed: tests.filter((t) => t.status === 'passed').length, message: tests.find((t) => t.status === 'failed')?.failureMessages?.[0]?.split('\n')[0]?.slice(0, 220) }
  }

  const before = snapshot()
  await runSql(selected, withTests, testRun)

  // --- Teil 2: Function quote, Redeploy-Beweis (R2-N13) -------------------------------------------------------------------------------
  const H = 'supabase/functions/_shared/quote/handler.ts'
  const code = [
    { label: 'quote: Abholung außerhalb Wiens nicht mehr geprüft (Schicht: Bezirk aus Polygon)', kind: 'Schicht', file: H, from: "if (!pickup.inVienna) throw new HttpError(422, 'pickup_outside_vienna')", to: "if (false) throw new HttpError(422, 'pickup_outside_vienna')", test: 'Abholung außerhalb Wiens', note: 'zweite Schicht: district null → district_required' },
    { label: 'quote: gezeigter Betrag nicht mehr abgeglichen (Kundenpreis ohne Zustimmung)', kind: 'Sperre', file: H, from: '|| !matchesShown(snapshot, call.shown)) throw new Conflict', to: ') throw new Conflict', test: 'gleiche Version, anderer Betrag' },
    { label: 'quote: Haltefenster nicht mehr geprüft (abgelaufene Version zählt)', kind: 'Sperre', file: H, from: 'return holdAllows(await deps.loadHold(shown), deps.now()) ? shown : await deps.currentVersion()', to: 'return shown', test: 'abgelaufenes Haltefenster' },
    { label: 'quote: Bedingungen-Hash nicht mehr abgeglichen', kind: 'Sperre', file: H, from: "if (terms['termsHash'] !== call.termsHash) throw", to: 'if (false) throw', test: 'falscher termsHash' },
    { label: 'quote: Client-Punkt bindet nicht mehr an den Kandidaten (Schicht: Bezirk/Wien-Prüfung)', kind: 'Schicht', file: H, from: 'return pickCandidate(candidates, place.point)', to: 'return candidates[0]!', test: 'manipulierte Koordinaten', note: 'zweite Schicht: Wien-Prüfung am Kandidaten' },
  ].filter((c) => matches({ label: c.label }))
  const deploy = () => cli('functions', 'deploy', 'quote', '--use-api')
  if (withCode) {
    for (const c of code) {
      const original = readFileSync(c.file, 'utf8')
      if (!original.includes(c.from)) throw new Error(`Muster nicht gefunden: ${c.from}`)
      let loose, restored, diffClean
      try {
        writeFileSync(c.file, original.replace(c.from, c.to))
        deploy()
        loose = testRun(c.test, 'tests/rls/quote-hardening.test.ts')
      } finally {
        execFileSync('git', ['checkout', '--', c.file])
        deploy()
        restored = testRun(c.test, 'tests/rls/quote-hardening.test.ts')
        diffClean = spawnSync('git', ['diff', '--quiet', '--', c.file]).status === 0
      }
      const good = loose.failed.length > 0 && restored.failed.length === 0 && restored.passed > 0 && diffClean
      results.push({ ...c, part: 'Redeploy', looseValue: `${loose.failed.length} Test(s) rot: ${loose.message ?? '–'}`, lockedValue: `${restored.passed} grün, ${restored.failed.length} rot`, loose: 'Test rot', locked: 'Test grün', good, effect: loose.failed.length > 0, blocked: restored.failed.length === 0, diffClean })
      console.log(`${good ? 'OK    ' : 'FEHLER'} [${c.kind}] ${c.label}\n         gelockert: ${loose.failed.length} rot (${loose.message ?? '–'})\n         neu deployt: ${restored.passed} grün, ${restored.failed.length} rot; Datei gleich Git-Stand: ${diffClean}`)
    }
  }

  // --- Teil 3: Werkzeuge ------------------------------------------------------------------------------------------------------------
  if (!only) {
    // N-15: SUPABASE_PROJECT_ID mit nicht existierender Ref – die CLI darf Dev nicht erreichen (gleiche Abfrage wie sonst).
    const wrong = 'a'.repeat(20)
    const r = spawnSync(process.execPath, [SB, 'db', 'query', '--linked', 'select 1 as x'], { encoding: 'utf8', env: { ...process.env, SUPABASE_PROJECT_ID: wrong } })
    const r2 = spawnSync(process.execPath, [SB, 'db', 'query', '--linked', 'select 1 as x'], { encoding: 'utf8', env: process.env })
    const good = r.status !== 0 && r2.status === 0
    results.push({ label: 'N-15: falsche Ref in SUPABASE_PROJECT_ID erreicht Dev nicht', kind: 'Werkzeug', part: 'Werkzeug', looseValue: `falsche Ref: Exit ${r.status}`, lockedValue: `Dev-Ref: Exit ${r2.status}`, loose: 'Exit ≠ 0', locked: 'Exit 0', good, effect: r.status !== 0, blocked: r2.status === 0 })
    console.log(`${good ? 'OK    ' : 'FEHLER'} N-15 falsche Ref Exit ${r.status}, Dev-Ref Exit ${r2.status}`)

    // N-16: scan-proof auf präparierten Verzeichnissen (Fundtext aus Teilen zusammengesetzt, damit dieser Quelltext selbst nicht trifft).
    const scan = (dir) => spawnSync(process.execPath, ['scripts/scan-proof.mjs', dir], { encoding: 'utf8', env: process.env }).status
    const root = mkdtempSync(join(tmpdir(), 'scan-red-'))
    const mk = (name, text) => {
      const d = join(root, name)
      mkdirSync(d)
      writeFileSync(join(d, 'x.md'), text)
      return d
    }
    const hex = '0123456789abcdef0123456789abcdef01234567'
    const cases = [
      ['sauber', mk('clean', 'nichts zu sehen\n'), 0],
      ['Access Token', mk('token', ['sb', 'p_', hex, '\n'].join('')), 1],
      ['Verbindungs-URL', mk('url', ['post', 'gres://user:geheim', '@host:5432/db\n'].join('')), 1],
      ['Verzeichnis fehlt', join(root, 'gibt-es-nicht'), 2],
    ]
    for (const [name, dir, want] of cases) {
      const got = scan(dir)
      results.push({ label: `N-16: scan-proof, ${name}`, kind: 'Werkzeug', part: 'Werkzeug', looseValue: `Exit ${got}`, lockedValue: `erwartet Exit ${want}`, loose: `Exit ${want}`, locked: `Exit ${want}`, good: got === want, effect: got === want, blocked: got === want })
      console.log(`${got === want ? 'OK    ' : 'FEHLER'} N-16 scan-proof ${name}: Exit ${got} (erwartet ${want})`)
    }
    rmSync(root, { recursive: true, force: true })
  }
  const after = snapshot()
  return { before, after }
}

mkdirSync('tmp/proof', { recursive: true })
mkdirSync('tmp/reports', { recursive: true })
let outcome
try {
  outcome = await run()
} finally {
  if (userId) await service.auth.admin.deleteUser(userId)
}
const same = outcome.before === outcome.after
const count = (part, kind) => results.filter((r) => r.good && r.part === part && r.kind === kind).length
const report = [
  '# S9a-3 Rot-Beweis',
  '',
  `Stand ${new Date().toISOString()} (Dev-Projekt). Teil 1 SQL: lockern (committet), Ist-Wert-Probe (Rollback) und zuständigen Test laufen lassen, Original wiederherstellen (Restore-SQL vorher nach tmp/proof/s9a3-restore-*.sql), Probe erneut. Teil 2 Redeploy (R2-N13): Quelltext lockern, quote deployen, Test muss rot werden, per \`git checkout\` zurück, neu deployen, Test grün, Datei gleich Git-Stand. Teil 3 Werkzeuge (N-15, N-16).`,
  '',
  'Format der Probe: „Ergebnis | Wert“. Ergebnis ist „ok“ oder „SQLSTATE: Meldung“; Wert ist der Zustand danach. „Schicht“: eine zweite Sperre dahinter hält, kein Beweis der ersten.',
  '',
]
for (const r of results) {
  report.push(`## ${r.label}`, '', `- Teil: ${r.part}; Art: ${r.kind === 'Schicht' ? `Schicht (zweite Sperre dahinter${r.note ? `: ${r.note}` : ''}, kein Beweis der ersten)` : r.kind}`)
  report.push(`- Gelockert/Beobachtet: \`${r.looseValue}\` (erwartet \`${r.loose}\`) ${r.effect ? '✓' : '✗ ABWEICHUNG'}`, `- Gesperrt/Wiederhergestellt: \`${r.lockedValue}\` (erwartet \`${r.locked}\`) ${r.blocked ? '✓' : '✗ ABWEICHUNG'}`)
  if (r.part === 'SQL') report.push(r.tests ? `- Test \`${r.testFile ?? 'tests/rls/status.test.ts'}\` -t "${r.tests}" gelockert: ${r.redTests ? `${r.redTests.failed.length} rot von ${r.redTests.ran} gelaufen${r.redTests.message ? ` (${r.redTests.message})` : ''}` : 'nicht ausgeführt'} ${r.testsRed ? '✓' : '✗ (Lücke im Test!)'}` : '- Test: keiner (Wirkung durch die Probe belegt)')
  if (r.part === 'Redeploy') report.push(`- Datei nach \`git checkout\` gleich Git-Stand: ${r.diffClean ? 'ja' : 'NEIN'}`)
  report.push(`- Bewertung: ${r.good ? 'bestanden' : 'FEHLGESCHLAGEN'}`, '')
}
report.push('## Definitionen vorher/nachher (SQL-Teil)', '', same ? 'Policies, Trigger (inkl. tgenabled), Constraints, Funktionen (md5) und Rechte sind identisch.' : 'ACHTUNG: Definitionen weichen ab!', '')
report.push(`Ergebnis: SQL ${count('SQL', 'Sperre')} Sperren und ${count('SQL', 'Schicht')} Schichten, Redeploy ${count('Redeploy', 'Sperre')} Sperren und ${count('Redeploy', 'Schicht')} Schichten, Werkzeuge ${count('Werkzeug', 'Werkzeug')} bewiesen von ${results.length}.`)
writeFileSync(process.argv.includes('--only') ? 'tmp/proof/s9a3-rotbeweis-nachzug.md' : 'tmp/proof/s9a3-rotbeweis.md', report.join('\n') + '\n')
const allGood = results.every((r) => r.good) && same
console.log(same ? 'Definitionen vorher und nachher identisch.' : 'ACHTUNG: Definitionen weichen ab!')
console.log(allGood ? 'REDPROOF BESTANDEN' : 'REDPROOF FEHLGESCHLAGEN')
process.exitCode = allGood ? 0 : 1
