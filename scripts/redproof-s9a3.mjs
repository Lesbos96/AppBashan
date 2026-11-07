// Stand 0019, ab S9a-4b mit der Signatur von 0020 (p_photo_ids); der Nachweis von S9a-3 bleibt docs/proof/s9a3/. Fotos: redproof-s9a4.mjs.
// Rot-Beweis S9a-3 (nur Dev-Projekt), seit R1 über redproof-lib.mjs. Drei Teile, jede Prüfung misst den Ist-Wert:
//  1. SQL-Sperren aus 0019: Probe „Ergebnis | Wert“ mit der Lockerung in einer Rollback-Transaktion; nur Schritte mit vitest-Test lockern zusätzlich
//     committet (Fenster: Markierung, Totmann, Soll-Diff), der zuständige Test muss gelockert rot werden; danach Restore bis Soll-Gleichheit.
//  2. Function-Sperren in quote (Redeploy-Beweis R2-N13): Kopie aus `git show <HEAD>` (nie der Arbeitsbaum), Textänderung, Deploy aus der Kopie,
//     Test muss rot werden, Deploy des sauberen Commits, Stand von Dev = HEAD (Download). Steht Dev vor Teil 2 nicht auf HEAD: STOPP vor Teil 2.
//  3. Werkzeuge: Negativbeweis N-15 (falsche Ref in SUPABASE_PROJECT_ID erreicht Dev nicht), N-16 (scan-proof findet Token, URL, fehlendes Verzeichnis).
// „Schicht“: eine zweite Sperre dahinter hält; der erwartete Wert ist der Fehler der zweiten Schicht, kein Beweis der ersten.
// Soll: scripts/redproof-soll.json (kanonisch, gleich HEAD) für Läufe mit Schreibzugriff; --soll <pfad> nur lesend (Startprüfung, Exit vor dem Lockern);
// --print-sql schreibt tmp/proof/r1-dev-sql-s9a3.sql und sendet nur Selects. Exit: 0 bestanden, 1 fehlgeschlagen, 2 Vorprüfung, 3 Fatal, 130 Signal.
// Start: npx dotenv -e .env.local -- node scripts/redproof-s9a3.mjs [--only <Namensteil>[,…]] [--no-tests] [--no-code] [--print-sql] [--soll <pfad>] [--deadman-probe (nur Totmann-Probelauf je Restore-Art, nichts gelockert)]
import './dev-guard.mjs'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { createRun, EXIT, realDeps, runMain } from './redproof-lib.mjs'
import { createDeployer, realDeployDeps } from './redproof-deploy.mjs'
import * as B from './redproof-sql.mjs'

const SB = 'node_modules/supabase/dist/supabase.js'
const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1] }
const mode = process.argv.includes('--print-sql') ? 'print' : arg('--soll') ? 'readonly' : 'write'
const soll = JSON.parse(readFileSync(mode === 'readonly' ? arg('--soll') : 'scripts/redproof-soll.json', 'utf8')).rows
const deps = realDeps()
const rp = createRun(deps, { name: 's9a3', mode, soll })
const select = (q) => rp.select(q)
const q1 = (s) => `'${s.replaceAll("'", "''")}'`
const H = 'supabase/functions/_shared/quote/handler.ts'

const SAVE = 'public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[])'
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

// --- Probe: Rollback-Transaktion. `preLoosen` (die Lockerung des Schritts, nur für SQL-Proben) steht vor dem Setup in derselben Transaktion;
// es wird nichts committet. Meldet „ok“ oder „SQLSTATE: Meldung“, dann den Ist-Wert `value`. -------------------------------------------------
let preLoosen = ''
const probe = ({ setup = '', stmt, value, role = 'owner', claims = '' }) => {
  const prefix = [role === 'owner' ? '' : `set local role ${role};`, claims ? `perform set_config('request.jwt.claims', ${q1(claims)}, true);` : ''].join(' ')
  const body = `begin ${prefix} ${stmt}; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce((${value})::text, '<null>');`
  return rp.probe(`begin; ${preLoosen ? `${preLoosen};` : ''} ${setup}; create temp table res (v text); do $p$ begin ${body} end $p$; select string_agg(v, ' | ') as v from res; rollback;`)[0]?.v
}

const results = []
const loosen = []
const add = (s) => loosen.push(s)
// Bausteine liefern { loosen, restore } als SQL-Text (lazy: Originale werden erst beim Schritt gelesen, im Soll-geprüften Zustand).
const patchFn = (label, fn, from, to) => ({ label, kind: 'Sperre', text: () => B.patchFn(select, fn, from, to) })
const disableTrigger = (name, table, label) => ({ label, kind: 'Sperre', text: () => B.triggerOff(table, name) })
const grantToggle = (label, loosenSql, restoreSql, kind = 'Sperre') => ({ label, kind, text: () => B.toggle(loosenSql, restoreSql) })
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
    // Committet wird nur, was eine andere Verbindung sehen muss: der vitest-Lauf oder eine API-Probe.
    if (!sqlProbe || (withTests && s.tests)) {
      await rp.withWindow({ label: s.label, ...text }, async () => {
        if (!sqlProbe) looseValue = await s.probe()
        if (withTests && s.tests) redTests = await rp.vitest({ file: s.testFile ?? 'tests/rls/status.test.ts', pattern: s.tests })
      })
    }
    if (mode === 'print') continue
    const lockedValue = await s.probe()
    const effect = looseValue === s.loose
    const blocked = lockedValue === s.locked
    const testsRed = !withTests || !s.tests || redTests?.status === 'rot'
    const good = effect && blocked && testsRed
    results.push({ ...s, part: 'SQL', looseValue, lockedValue, redTests, good, effect, blocked, testsRed })
    console.log(`${good ? 'OK    ' : 'FEHLER'} [${s.kind}] ${s.label}\n         gelockert: ${looseValue} (erwartet ${s.loose})\n         gesperrt:  ${lockedValue} (erwartet ${s.locked})${redTests ? `\n         Test ${redTests.status}: ${redTests.failed.length} rot${redTests.status === 'fehler' ? ` (${redTests.reason})` : ''}` : ''}`)
  }
}

const FAKE = '00000000-0000-0000-0000-000000000001' // --print-sql: keine Fixtures, Platzhalter-ID in den SQL-Texten
const run = async () => {
  priceVersion = select(`select version from public.current_price_version`)[0].version
  userId = mode === 'print' ? FAKE : (await service.auth.admin.createUser({ email: `redproof-s9a3-${Date.now().toString(36)}@movenow.test`, password: `${randomUUID()}Aa1!`, email_confirm: true })).data.user.id
  const A = mode === 'print' ? FAKE : await make()
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
    label: 'request_contacts_format: Kontaktformat-Constraint entfernt', kind: 'Sperre',
    // Restore: vorher die verletzenden Zeilen der Wegwerf-Konten löschen (ein gelockerter Test kann sie committet haben; Abbruchweg: Exit-Handler und Totmann).
    text: () => B.constraintDrop(select, 'public.request_contacts', 'request_contacts_format', (expr) => `delete from public.request_contacts where request_id in (select r.id from public.service_requests r join auth.users u on u.id = r.customer_id where u.email like '%@movenow.test') and not ${expr}`), // alle Testkonten (die Testdateien legen <tag>-<run>@movenow.test an); Zeilen anderer Konten bleiben, dann scheitert add constraint sichtbar
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
  // Isoliert (M-3, Berater S9a-4c): innere Schichten nur in der Probe-Transaktion offen (Rollback), umgeschaltet wird allein die Zielsperre.
  // geocode_cache: eigene Testzeile, Lese-Policy nur in der Probe; Wert = Zeilen der Testzeile aus Kundensicht (Startwert 0, bleibt bei Fehler 0).
  const gcKey = `redproof:${randomUUID()}`
  add({
    ...grantToggle('geocode_cache: SELECT für authenticated (isoliert: Lese-Policy nur in der Probe)', 'grant select on public.geocode_cache to authenticated', 'revoke select on public.geocode_cache from authenticated'),
    tests: 'geocode_cache und geo_districts', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({
      setup: `insert into public.geocode_cache (key, value, expires_at) values (${q1(gcKey)}, '[]', now() + interval '1 hour'); create policy redproof_gc on public.geocode_cache for select to authenticated using (true); select set_config('app.probe_val', '0', true)`,
      stmt: `perform set_config('app.probe_val', (select count(*) from public.geocode_cache where key = ${q1(gcKey)})::text, true)`,
      value: `current_setting('app.probe_val', true)`, role: 'authenticated', claims: custClaims,
    }),
    loose: 'ok | 1', locked: '42501: permission denied for table geocode_cache | 0',
  })
  add({
    ...grantToggle('quote_district: EXECUTE für authenticated (Schicht: kein Recht auf geo_boundaries)', 'grant execute on function public.quote_district(double precision, double precision) to authenticated', 'revoke execute on function public.quote_district(double precision, double precision) from authenticated'),
    kind: 'Schicht', tests: 'price_version_hold und quote_district', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({ stmt: 'perform * from public.quote_district(16.3731, 48.2086)', value: `(select district from public.quote_district(16.3731, 48.2086))`, role: 'authenticated', claims: custClaims }),
    loose: '42501: permission denied for table geo_boundaries | 1', locked: '42501: permission denied for function quote_district | 1',
  })
  // quote_save_request ist SECURITY INVOKER (0020): ohne diese Öffnung hielte immer die nächste Schicht.
  const STAGING = 'public.photo_staging_interval()'
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
  // Wert = Anfragen des Kunden: gelockert legt die Funktion eine an (2), gesperrt bleibt es bei 1 mit dem 42501 der Zielsperre.
  const saveProbe = (open) => () => probe({ setup: `${INNER}; grant execute on function ${open} to authenticated`, stmt: `perform ${callSql()}`, value: reqCount, role: 'authenticated', claims: custClaims })
  add({
    ...grantToggle('quote_save_request: EXECUTE für authenticated (isoliert: innere Schichten und photo_staging_interval nur in der Probe offen)', `grant execute on function ${SAVE} to authenticated`, `revoke execute on function ${SAVE} from authenticated`),
    tests: 'Schreib-Funktionen: anon und authenticated erhalten 42501', testFile: 'tests/rls/quote.test.ts',
    probe: saveProbe(STAGING),
    loose: 'ok | 2', locked: '42501: permission denied for function quote_save_request | 1',
  })
  add({
    ...grantToggle('photo_staging_interval: EXECUTE für authenticated (isoliert: innere Schichten und quote_save_request nur in der Probe offen)', `grant execute on function ${STAGING} to authenticated`, `revoke execute on function ${STAGING} from authenticated`),
    tests: null,
    probe: saveProbe(SAVE),
    loose: 'ok | 2', locked: '42501: permission denied for function photo_staging_interval | 1',
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

  if (process.argv.includes('--deadman-probe')) { // nur der Totmann-Probelauf je Restore-Art (nichts gelockert), dann Ende
    for (const l of rp.deadmanProbe(loosen.map((s) => ({ label: s.label, restore: s.text().restore })))) console.log(`Totmann-Probelauf ${l}`)
    return
  }

  await runSql(selected, withTests)

  // --- Teil 2: Function quote, Redeploy-Beweis (R2-N13): Deploy aus Kopie von HEAD, Arbeitsbaum unverändert -----------------------------
  const code = [
    { label: 'quote: Abholung außerhalb Wiens nicht mehr geprüft (Schicht: Bezirk aus Polygon)', kind: 'Schicht', file: H, from: "if (!pickup.inVienna) throw new HttpError(422, 'pickup_outside_vienna')", to: "if (false) throw new HttpError(422, 'pickup_outside_vienna')", test: 'Abholung außerhalb Wiens', note: 'zweite Schicht: district null → district_required' },
    { label: 'quote: gezeigter Betrag nicht mehr abgeglichen (Kundenpreis ohne Zustimmung)', kind: 'Sperre', file: H, from: '|| !matchesShown(snapshot, call.shown)) throw new Conflict', to: ') throw new Conflict', test: 'gleiche Version, anderer Betrag' },
    { label: 'quote: Haltefenster nicht mehr geprüft (abgelaufene Version zählt)', kind: 'Sperre', file: H, from: 'return holdAllows(await deps.loadHold(shown), deps.now()) ? shown : await deps.currentVersion()', to: 'return shown', test: 'abgelaufenes Haltefenster' },
    { label: 'quote: Bedingungen-Hash nicht mehr abgeglichen', kind: 'Sperre', file: H, from: "if (terms['termsHash'] !== call.termsHash) throw", to: 'if (false) throw', test: 'falscher termsHash' },
    { label: 'quote: Client-Punkt bindet nicht mehr an den Kandidaten (Schicht: Bezirk/Wien-Prüfung)', kind: 'Schicht', file: H, from: 'return pickCandidate(candidates, place.point)', to: 'return candidates[0]!', test: 'manipulierte Koordinaten', note: 'zweite Schicht: Wien-Prüfung am Kandidaten' },
  ].filter((c) => matches({ label: c.label }))
  if (withCode && code.length) {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    if (mode === 'print') {
      for (const c of code) await rp.withDeployWindow({ label: c.label, commit })
    } else {
      const dep = createDeployer(realDeployDeps())
      writeFileSync('tmp/proof/r1-quote-info-vorher.txt', dep.info())
      const before = dep.matches(commit)
      if (!before.same) {
        results.push({ label: `quote: Dev-Stand vor Teil 2 ist nicht Commit ${commit.slice(0, 8)}`, kind: 'Werkzeug', part: 'Redeploy', looseValue: before.diff.join('; '), lockedValue: '–', loose: 'gleich HEAD', locked: 'gleich HEAD', good: false, effect: false, blocked: false })
        console.log(`STOPP vor Teil 2: Dev weicht von HEAD ab: ${before.diff.join('; ')}`)
      } else {
        const clean = dep.exportCommit(commit)
        try {
          for (const c of code) {
            const dir = dep.exportCommit(commit, { file: c.file, from: c.from, to: c.to })
            let loose, restoredRun, verified
            try {
              await rp.withDeployWindow({ label: c.label, commit, loosen: () => dep.deploy(dir), restore: () => dep.deploy(clean), verify: () => dep.matches(commit).same }, async () => {
                loose = await rp.vitest({ file: 'tests/rls/quote-hardening.test.ts', pattern: c.test })
              })
              restoredRun = await rp.vitest({ file: 'tests/rls/quote-hardening.test.ts', pattern: c.test })
              verified = dep.matches(commit)
            } finally { dep.remove(dir) }
            const good = loose.status === 'rot' && restoredRun.status === 'nicht-rot' && verified.same
            results.push({ ...c, part: 'Redeploy', looseValue: `${loose.failed.length} Test(s) rot (${loose.status}): ${loose.message ?? loose.reason ?? '–'}`, lockedValue: `${restoredRun.passed} grün, ${restoredRun.failed.length} rot (${restoredRun.status})`, loose: 'Test rot', locked: 'Test grün', good, effect: loose.status === 'rot', blocked: restoredRun.status === 'nicht-rot', diffClean: verified.same, commit })
            console.log(`${good ? 'OK    ' : 'FEHLER'} [${c.kind}] ${c.label}\n         gelockert: ${loose.status}, ${loose.failed.length} rot (${loose.message ?? loose.reason ?? '–'})\n         neu deployt: ${restoredRun.passed} grün, ${restoredRun.failed.length} rot; Dev-Stand gleich Commit ${commit.slice(0, 8)}: ${verified.same ? 'ja' : 'NEIN'}`)
          }
        } finally { dep.remove(clean) }
      }
      writeFileSync('tmp/proof/r1-quote-info-nachher.txt', dep.info())
    }
  }

  // --- Teil 3: Werkzeuge ------------------------------------------------------------------------------------------------------------
  if (!only && mode === 'write') {
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
}

mkdirSync('tmp/proof', { recursive: true })
mkdirSync('tmp/reports/r1', { recursive: true })
const main = async () => {
  if (mode === 'readonly') { console.log('Startprüfung gegen die angegebene Soll-Datei bestanden, nichts gelockert (Modus lesend).'); return EXIT.OK }
  try {
    await run()
  } finally {
    if (userId && mode === 'write') await service.auth.admin.deleteUser(userId)
  }
  if (process.argv.includes('--deadman-probe')) return rp.finish().end.length ? EXIT.FAIL : EXIT.OK // kein Bericht, kein Rot-Beweis
  if (mode === 'print') {
    writeFileSync('tmp/proof/r1-dev-sql-s9a3.sql', rp.printed.map((p) => `-- ${p.label}${p.deploy ? ` (Deploy aus Commit ${p.deploy})` : ''}\n${p.sql ?? [p.loosen && `-- Lockerung\n${p.loosen}`, p.restore && `-- Restore\n${p.restore}`].filter(Boolean).join('\n')}\n`).join('\n'))
    console.log(`SQL-Texte nach tmp/proof/r1-dev-sql-s9a3.sql geschrieben (${rp.printed.length} Einträge), nichts gesendet außer Selects.`)
    return EXIT.OK
  }
  const { end } = rp.finish()
  const same = end.length === 0
  const count = (part, kind) => results.filter((r) => r.good && r.part === part && r.kind === kind).length
  const report = [
    '# S9a-3 Rot-Beweis (R1-Lib)',
    '',
    `Stand ${new Date().toISOString()} (Dev-Projekt). Soll: scripts/redproof-soll.json. Teil 1 SQL: Ist-Wert-Probe mit der Lockerung in einer Rollback-Transaktion, nur Schritte mit vitest-Test zusätzlich committet (Fenster); Restore bis Soll-Gleichheit. Teil 2 Redeploy (R2-N13): Kopie aus HEAD, Deploy aus der Kopie, Test rot, Deploy des sauberen Commits, Dev-Stand gleich Commit. Teil 3 Werkzeuge (N-15, N-16).`,
    '',
    'Format der Probe: „Ergebnis | Wert“. Ergebnis ist „ok“ oder „SQLSTATE: Meldung“; Wert ist der Zustand danach. „Schicht“: eine zweite Sperre dahinter hält, kein Beweis der ersten.',
    '',
  ]
  for (const r of results) {
    report.push(`## ${r.label}`, '', `- Teil: ${r.part}; Art: ${r.kind === 'Schicht' ? `Schicht (zweite Sperre dahinter${r.note ? `: ${r.note}` : ''}, kein Beweis der ersten)` : r.kind}`)
    report.push(`- Gelockert/Beobachtet: \`${r.looseValue}\` (erwartet \`${r.loose}\`) ${r.effect ? '✓' : '✗ ABWEICHUNG'}`, `- Gesperrt/Wiederhergestellt: \`${r.lockedValue}\` (erwartet \`${r.locked}\`) ${r.blocked ? '✓' : '✗ ABWEICHUNG'}`)
    if (r.part === 'SQL') report.push(r.tests ? `- Test \`${r.testFile ?? 'tests/rls/status.test.ts'}\` -t "${r.tests}" gelockert: ${r.redTests ? `${r.redTests.status}: ${r.redTests.failed.length} rot von ${r.redTests.ran} gelaufen${r.redTests.message ? ` (${r.redTests.message})` : ''}${r.redTests.reason ? ` [${r.redTests.reason}]` : ''}` : 'nicht ausgeführt'} ${r.testsRed ? '✓' : '✗ (kein Rot-Beweis!)'}` : '- Test: keiner (Wirkung durch die Probe belegt)')
    if (r.part === 'Redeploy') report.push(`- Dev-Stand nach dem Restore gleich Commit ${r.commit}: ${r.diffClean ? 'ja' : 'NEIN'}`)
    report.push(`- Bewertung: ${r.good ? 'bestanden' : 'FEHLGESCHLAGEN'}`, '')
  }
  report.push('## Fenster (committete Lockerungen)', '', 'Schlüssel = Diff von Dev gegen das Soll nach dem Commit (aus der Probe-Transaktion abgeleitet, der Commit muss gleich sein); Hash = sha256 des Lockerungstexts in Probe und Commit.', '')
  for (const w of rp.windowLog) report.push(`- ${w.label}: ${w.keys.join('; ')}; Hash Probe ${w.hashProbe.slice(0, 12)}, Commit ${w.hashCommit.slice(0, 12)}: ${w.hashProbe === w.hashCommit ? 'gleich' : 'ABWEICHUNG'}`)
  report.push('', '## Endprüfung gegen das Soll', '', same ? 'Dev ist nach dem Lauf gleich dem Soll (alle Objektarten des Snapshots).' : `ACHTUNG: Dev weicht vom Soll ab: ${end.map((x) => `${x.k} ${x.n} ${x.state}`).join('; ')}`, '')
  report.push(`Ergebnis: SQL ${count('SQL', 'Sperre')} Sperren und ${count('SQL', 'Schicht')} Schichten, Redeploy ${count('Redeploy', 'Sperre')} Sperren und ${count('Redeploy', 'Schicht')} Schichten, Werkzeuge ${count('Werkzeug', 'Werkzeug')} bewiesen von ${results.length}.`)
  writeFileSync(process.argv.includes('--only') ? 'tmp/proof/s9a3-rotbeweis-nachzug.md' : 'tmp/proof/s9a3-rotbeweis.md', report.join('\n') + '\n')
  const allGood = results.every((r) => r.good) && same
  console.log(same ? 'Dev nach dem Lauf gleich Soll.' : 'ACHTUNG: Dev weicht vom Soll ab!')
  console.log(allGood ? 'REDPROOF BESTANDEN' : 'REDPROOF FEHLGESCHLAGEN')
  return allGood ? EXIT.OK : EXIT.FAIL
}
await runMain(rp, main, deps)
