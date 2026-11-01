// Rot-Beweis S9a-2 (nur Dev-Projekt): lockert jede neue Sperre einzeln (committet, über Eigentümer-SQL) und misst die WIRKUNG:
// Eine Ist-Wert-Probe (Rollback) liefert „Ergebnis | Wert“ (z. B. „ok | accepted“: der Status wurde wirklich gesetzt). Gelockert muss der
// erwartete Wirkungswert erscheinen, wiederhergestellt der gesperrte Wert (genauer Fehler, Wert unverändert). Zusätzlich muss der zuständige
// Test aus tests/rls/status.test.ts im gelockerten Zustand rot werden. „Schicht“-Einträge haben eine zweite Sperre dahinter: dort ist der
// erwartete Wert der Fehler der zweiten Schicht, ausgewiesen als Schicht, nicht als Beweis der ersten.
// Vorher/Nachher: Definitionen (md5), Policies, Trigger und Rechte werden verglichen. Bericht: tmp/proof/s9a2-rotbeweis.md
// Start: npx dotenv -e .env.local -- node scripts/redproof-s9a2.mjs [--only <Namensteil>[,…]] [--no-tests]
import './dev-guard.mjs'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const cli = (...args) => execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 26 })
const sql = (q) => {
  const json = JSON.parse(cli('db', 'query', '--linked', q))
  if (json._tag === 'Error') throw new Error(json.error?.message)
  return json.rows
}
const q1 = (s) => `'${s.replaceAll("'", "''")}'`

const OBJECTS = `('public.service_requests'::regclass, 'public.price_revisions'::regclass, 'public.status_events'::regclass, 'public.rental_bookings'::regclass, 'public.request_contacts'::regclass, 'public.fee_splits'::regclass, 'public.profiles'::regclass)`
const SNAPSHOT = `
  select 'policy' k, schemaname || '.' || tablename || '.' || policyname || ' ' || cmd || ' ' || roles::text || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') v
    from pg_policies where (schemaname = 'public' and tablename in ('service_requests', 'price_revisions', 'status_events', 'rental_bookings', 'request_contacts', 'request_photos', 'fee_splits')) or (schemaname = 'storage' and tablename = 'objects')
  union all
  select 'trigger', tgrelid::regclass || ' ' || pg_get_triggerdef(oid) from pg_trigger where not tgisinternal and tgrelid in ${OBJECTS}
  union all
  select 'function', p.oid::regprocedure || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'private' and p.proname in ('guard_request_insert', 'guard_request_status', 'guard_request_pointer', 'guard_request_fields', 'guard_revision_insert', 'guard_rental_status', 'immutable_row', 'log_request_status', 'require_revision'))
       or (n.nspname = 'public' and p.proname in ('withdraw', 'quote_save_request', 'quote_save_booking'))
  union all
  select 'acl', c.oid::regclass || ' ' || coalesce(c.relacl::text, '') from pg_class c where c.oid in ${OBJECTS}
  union all
  select 'colacl', attrelid::regclass || '.' || attname || ' ' || attacl::text from pg_attribute where attrelid in ${OBJECTS} and attacl is not null
  order by 1, 2`
const snapshot = () => JSON.stringify(sql(SNAPSHOT))

const def = (name) => sql(`select pg_get_functiondef('${name}'::regprocedure) as d`)[0].d
const trigDef = (name, table) => sql(`select pg_get_triggerdef(oid) as d from pg_trigger where tgname = ${q1(name)} and tgrelid = '${table}'::regclass`)[0].d

// --- Fixtures: ein Wegwerf-Kunde mit Anfragen (über dieselbe SQL-Funktion wie quote), im finally gelöscht ---------------------------
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const day = new Date(Date.now() + 14 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
let userId
const make = async (over = {}) => {
  const { data: pv } = await service.from('current_price_version').select('version').single()
  const args = {
    p_customer: userId, p_client_ref: randomUUID(), p_service: 'move', p_inputs: {},
    p_snapshot: { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961, lines: [{ key: 'a', cents: 68961 }] },
    p_price_version: pv.version, p_total: 68961, p_low: 68961, p_high: 68961,
    p_from_address: null, p_from_postcode: null, p_from_lon: null, p_from_lat: null, p_to_address: null, p_to_postcode: null, p_to_lon: null, p_to_lat: null,
    p_route: null, p_region: null, p_preferred_date: day, p_time_window: null, p_description: null, p_volume: null, ...over,
  }
  const { data, error } = await service.rpc('quote_save_request', args)
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
const dropTrigger = (name, table, label = `Trigger ${name} entfernt`) => ({
  label, kind: 'Sperre', save: () => trigDef(name, table), apply: () => sql(`drop trigger ${name} on ${table}`), restore: (d) => sql(d),
})
const grantToggle = (label, loosenSql, restoreSql, kind = 'Sperre') => ({ label, kind, save: () => null, apply: () => sql(loosenSql), restore: () => sql(restoreSql) })

const run = async () => {
  userId = (await service.auth.admin.createUser({ email: `redproof-s9a2-${Date.now().toString(36)}@movenow.test`, password: `${randomUUID()}Aa1!`, email_confirm: true })).data.user.id
  const A = await make()
  const B = await make({ p_total: null, p_low: null, p_high: null, p_snapshot: { kind: 'offer', reasons: ['special_case'] } }) // awaiting_offer
  const revA = sql(`select id from public.price_revisions where request_id = '${A}'`)[0].id
  const ghostArgs = `p_customer => '${userId}', p_client_ref => gen_random_uuid(), p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":100,"lowCents":100,"highCents":100,"lines":[]}', p_price_version => 1, p_total => 100, p_low => 100, p_high => 100, p_from_address => null, p_from_postcode => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_postcode => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_preferred_date => current_date + 14, p_time_window => null, p_description => null, p_volume => null`
  const custClaims = JSON.stringify({ sub: userId, role: 'authenticated', aal: 'aal1' })
  const orig = `create temp table orig as select termin_at, accept_deadline from public.service_requests where id = '${A}';`
  const status = `(select status from public.service_requests where id = '${A}')`
  const mark = (to) => `perform set_config('app.mv_transition', '${A}:${to}', true);`

  // 1. Statusmaschine: Paar und Marker einzeln, INSERT-Trigger, UPDATE-Revoke -------------------------------------------------------
  add({
    ...patchFn('Paar-Prüfung von guard_request_status ausgeschaltet', 'private.guard_request_status()', "if not (old.status in ('requested', 'awaiting_offer', 'offered') and new.status = 'withdrawn') then", "if false and not (old.status in ('requested', 'awaiting_offer', 'offered') and new.status = 'withdrawn') then"),
    tests: 'Trigger gilt auch für den Eigentümer',
    probe: () => probe({ stmt: `${mark('accepted')} update public.service_requests set status = 'accepted' where id = '${A}'`, value: status }),
    loose: 'ok | accepted', locked: 'P0001: invalid_transition | requested',
  })
  add({
    ...patchFn('Marker-Prüfung von guard_request_status ausgeschaltet', 'private.guard_request_status()', "if current_setting('app.mv_transition', true) is distinct from new.id::text || ':' || new.status::text then", "if false and current_setting('app.mv_transition', true) is distinct from new.id::text || ':' || new.status::text then"),
    tests: 'Trigger gilt auch für den Eigentümer',
    probe: () => probe({ stmt: `update public.service_requests set status = 'withdrawn' where id = '${A}'`, value: status }),
    loose: 'ok | withdrawn', locked: 'P0001: invalid_transition | requested',
  })
  add({
    ...dropTrigger('guard_request_insert', 'public.service_requests'),
    tests: 'INSERT: nur requested',
    probe: () => probe({ stmt: `insert into public.service_requests (customer_id, client_ref, service, status, termin_at, accept_deadline) values ('${userId}', gen_random_uuid(), 'move', 'accepted', now() + interval '14 days', now() + interval '1 day')`, value: `(select count(*) from public.service_requests where customer_id = '${userId}' and status = 'accepted')` }),
    loose: 'ok | 1', locked: 'P0001: invalid_transition | 0',
  })
  add({
    ...grantToggle('UPDATE-Recht auf status für authenticated (mit durchlässiger Policy und Marker, damit die Wirkung sichtbar wird)', `grant update (status) on public.service_requests to authenticated; create policy rp_update on public.service_requests for update to authenticated using (true) with check (true)`, `drop policy rp_update on public.service_requests; revoke update on public.service_requests from authenticated`),
    tests: 'direktes Status-UPDATE',
    probe: () => probe({ stmt: `${mark('withdrawn')} update public.service_requests set status = 'withdrawn' where id = '${A}'`, value: status, role: 'authenticated', claims: custClaims }),
    loose: 'ok | withdrawn', locked: '42501: permission denied for table service_requests | requested',
  })
  // 2. Revisionen ---------------------------------------------------------------------------------------------------------------------
  add({
    ...dropTrigger('revision_immutable', 'public.price_revisions'),
    tests: 'UPDATE, DELETE, TRUNCATE: auch der Eigentümer',
    probe: () => probe({ stmt: `update public.price_revisions set inputs = '{"x":1}' where id = '${revA}'`, value: `(select inputs ->> 'x' from public.price_revisions where id = '${revA}')` }),
    loose: 'ok | 1', locked: 'P0001: revision_immutable | <null>',
  })
  add({
    // Ganz entfernen ginge nicht: der Trigger setzt auch content_hash, die Fixtures des Tests brächen vorher ab. Gelockert werden nur n/Quelle/Zeiger.
    label: 'n/Quelle/Zeiger-Prüfung von guard_revision_insert ausgeschaltet', kind: 'Sperre', save: () => def('private.guard_revision_insert()'),
    apply: (d) => {
      const a = "if new.n <> 1 or new.source <> 'submit' then"
      const b = 'if not found or rq.current_revision is not null then'
      if (!d.includes(a) || !d.includes(b)) throw new Error('Muster nicht gefunden')
      sql(d.replace(a, 'if false then').replace(b, 'if not found then'))
    },
    restore: (d) => sql(d),
    tests: 'INSERT: nur Revision 1',
    probe: () => probe({ stmt: `insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, content_hash, total_cents, low_cents, high_cents) select request_id, 2, source, inputs, snapshot, price_version, content_hash, total_cents, low_cents, high_cents from public.price_revisions where id = '${revA}'`, value: `(select count(*) from public.price_revisions where request_id = '${A}')` }),
    loose: 'ok | 2', locked: 'P0001: invalid_revision | 1',
  })
  add({
    ...patchFn('status_mismatch-Prüfung von guard_revision_insert ausgeschaltet', 'private.guard_revision_insert()', 'if rq.status is distinct from', 'if false and rq.status is distinct from'),
    tests: 'INSERT: nur Revision 1',
    probe: () => probe({
      setup: `insert into public.service_requests (id, customer_id, client_ref, service, status, termin_at, accept_deadline) values ('33333333-3333-4333-8333-333333333333', '${userId}', gen_random_uuid(), 'move', 'awaiting_offer', now() + interval '14 days', now() + interval '1 day')`,
      stmt: `insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents) select '33333333-3333-4333-8333-333333333333', 1, 'submit', inputs, snapshot, price_version, total_cents, low_cents, high_cents from public.price_revisions where id = '${revA}'`,
      value: `(select count(*) from public.price_revisions where request_id = '33333333-3333-4333-8333-333333333333')`,
    }),
    loose: 'ok | 1', locked: 'P0001: status_mismatch | 0',
  })
  add({
    ...dropTrigger('guard_request_pointer', 'public.service_requests'),
    tests: 'Zeiger: einmalig',
    probe: () => probe({ stmt: `update public.service_requests set current_revision = null where id = '${A}'`, value: `(select current_revision from public.service_requests where id = '${A}')` }),
    loose: 'ok | <null>', locked: `P0001: invalid_revision_pointer | ${revA}`,
  })
  add({
    ...dropTrigger('guard_request_fields', 'public.service_requests'),
    tests: 'Zeiger: einmalig',
    probe: () => probe({ setup: orig, stmt: `update public.service_requests set termin_at = termin_at + interval '1 day', accept_deadline = accept_deadline + interval '1 day' where id = '${A}'`, value: `(select (r.termin_at <> o.termin_at)::text from public.service_requests r, orig o where r.id = '${A}')` }),
    loose: 'ok | true', locked: 'P0001: field_immutable | false',
  })
  add({
    ...dropTrigger('require_revision', 'public.service_requests'),
    tests: 'INSERT: nur requested',
    probe: () => probe({ stmt: `set constraints all immediate; insert into public.service_requests (customer_id, client_ref, service, status, termin_at, accept_deadline) values ('${userId}', gen_random_uuid(), 'move', 'requested', now() + interval '14 days', now() + interval '1 day')`, value: `(select count(*) from public.service_requests where customer_id = '${userId}' and current_revision is null)` }),
    loose: 'ok | 1', locked: 'P0001: revision_missing | 0',
  })
  add({
    ...dropTrigger('request_delete_guard', 'public.service_requests'),
    tests: 'service_role ändert nur den Zeiger',
    probe: () => probe({ stmt: `delete from public.service_requests where id = '${A}'`, value: `(select count(*) from public.service_requests where id = '${A}')` }),
    loose: 'ok | 0', locked: 'P0001: request_immutable | 1',
  })
  add({
    ...dropTrigger('append_only', 'public.status_events', 'Trigger append_only auf status_events entfernt'),
    tests: 'UPDATE, DELETE, TRUNCATE: append_only',
    probe: () => probe({ setup: `perform set_config('app.mv_transition', '${B}:withdrawn', true); update public.service_requests set status = 'withdrawn' where id = '${B}'`.replace(/^/, 'do $s$ begin ').concat('; end $s$'), stmt: `delete from public.status_events where request_id = '${B}'`, value: `(select count(*) from public.status_events where request_id = '${B}')` }),
    loose: 'ok | 0', locked: 'P0001: append_only | 1',
  })
  // 3. Rechte (Wirkung messen; Schicht ausweisen) --------------------------------------------------------------------------------------
  add({
    ...grantToggle('service_role: UPDATE auf alle Spalten von service_requests', 'grant update on public.service_requests to service_role', 'revoke update on public.service_requests from service_role; grant update (current_revision) on public.service_requests to service_role'),
    tests: 'service_role ändert nur den Zeiger',
    probe: () => probe({ stmt: `update public.service_requests set from_address = 'x' where id = '${A}'`, value: `(select from_address from public.service_requests where id = '${A}')`, role: 'service_role' }),
    loose: 'ok | x', locked: '42501: permission denied for table service_requests | <null>',
  })
  add({
    ...grantToggle('service_role: INSERT auf status_events', 'grant insert on public.status_events to service_role', 'revoke insert on public.status_events from service_role'),
    tests: 'UPDATE, DELETE, TRUNCATE: append_only',
    probe: () => probe({ stmt: `insert into public.status_events (request_id, from_status, to_status, actor_role) values ('${A}', 'requested', 'expired', 'system')`, value: `(select count(*) from public.status_events where request_id = '${A}')`, role: 'service_role' }),
    loose: 'ok | 1', locked: '42501: permission denied for table status_events | 0',
  })
  add({
    ...grantToggle('service_role: INSERT auf fee_splits', 'grant insert on public.fee_splits to service_role', 'revoke insert on public.fee_splits from service_role'),
    tests: 'service_role schreibt keine Gebührenzeile mehr',
    probe: () => probe({ stmt: `insert into public.fee_splits (service_request_id, total_cents, fee_rate, fee_vat_rate, fee_cents, fee_net_cents, fee_vat_cents, payout_cents, price_version) values ('${A}', 1, 0, 0, 0, 0, 0, 1, 1)`, value: `(select count(*) from public.fee_splits where service_request_id = '${A}')`, role: 'service_role' }),
    loose: 'ok | 1', locked: '42501: permission denied for table fee_splits | 0',
  })
  add({
    ...grantToggle('service_role: DELETE auf profiles (Kaskade löscht die Anfragen)', 'grant delete on public.profiles to service_role', 'revoke delete on public.profiles from service_role'),
    tests: 'service_role ändert nur den Zeiger',
    probe: () => probe({ stmt: `delete from public.profiles where id = '${userId}'`, value: `(select count(*) from public.service_requests where id = '${A}')`, role: 'service_role' }),
    loose: 'ok | 0', locked: '42501: permission denied for table profiles | 1',
  })
  add({
    ...grantToggle('service_role: DELETE auf service_requests (Schicht: request_delete_guard)', 'grant delete on public.service_requests to service_role', 'revoke delete on public.service_requests from service_role'),
    kind: 'Schicht', tests: 'service_role ändert nur den Zeiger',
    probe: () => probe({ stmt: `delete from public.service_requests where id = '${A}'`, value: `(select count(*) from public.service_requests where id = '${A}')`, role: 'service_role' }),
    loose: 'P0001: request_immutable | 1', locked: '42501: permission denied for table service_requests | 1',
  })
  add({
    ...grantToggle('service_role: UPDATE auf price_revisions (Schicht: revision_immutable)', 'grant update on public.price_revisions to service_role', 'revoke update on public.price_revisions from service_role'),
    kind: 'Schicht', tests: 'UPDATE, DELETE, TRUNCATE: auch der Eigentümer',
    probe: () => probe({ stmt: `update public.price_revisions set inputs = '{"x":1}' where id = '${revA}'`, value: `(select inputs ->> 'x' from public.price_revisions where id = '${revA}')`, role: 'service_role' }),
    loose: 'P0001: revision_immutable | <null>', locked: '42501: permission denied for table price_revisions | <null>',
  })
  add({
    ...grantToggle('withdraw für anon ausführbar', 'grant execute on function public.withdraw(uuid) to anon', 'revoke execute on function public.withdraw(uuid) from anon'),
    tests: 'withdraw: Kunde ok',
    probe: () => probe({ stmt: `perform public.withdraw('${A}')`, value: status, role: 'anon' }),
    loose: 'P0001: not_found | requested', locked: '42501: permission denied for function withdraw | requested',
  })
  add({
    ...grantToggle('quote_save_request für authenticated ausführbar (Schicht: RLS auf platform_settings, kein INSERT-Recht)', 'grant execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, text, double precision, double precision, text, text, double precision, double precision, jsonb, public.region, date, text, text, numeric) to authenticated', 'revoke execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, text, double precision, double precision, text, text, double precision, double precision, jsonb, public.region, date, text, text, numeric) from authenticated'),
    kind: 'Schicht', tests: 'Schreib-Funktionen: anon und authenticated erhalten 42501', testFile: 'tests/rls/quote.test.ts',
    probe: () => probe({ stmt: `perform public.quote_save_request(${ghostArgs})`, value: `(select count(*) from public.service_requests where customer_id = '${userId}')`, role: 'authenticated', claims: custClaims }),
    loose: 'P0001: setting_missing | 2', locked: '42501: permission denied for function quote_save_request | 2', // authenticated liest platform_settings nicht (RLS): zweite Schicht
  })
  // 4. quote_save_request: Terminprüfung ----------------------------------------------------------------------------------------------
  add({
    ...patchFn('too_late-Prüfung von quote_save_request ausgeschaltet', 'public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, text, double precision, double precision, text, text, double precision, double precision, jsonb, public.region, date, text, text, numeric)', "if hours < (s ->> 'accept_min_hours')::numeric then", "if false and hours < (s ->> 'accept_min_hours')::numeric then"),
    tests: null,
    probe: () => probe({ stmt: `perform public.quote_save_request(${ghostArgs.replace('current_date + 14', 'current_date')})`, value: `(select count(*) from public.service_requests where customer_id = '${userId}')`, role: 'service_role' }),
    loose: 'ok | 3', locked: 'P0001: too_late | 2',
  })

  const onlyAt = process.argv.indexOf('--only')
  const only = onlyAt < 0 ? null : process.argv.slice(onlyAt + 1).flatMap((a) => a.split(',')).filter((a) => a && !a.startsWith('--')).map((a) => a.toLowerCase())
  const withTests = !process.argv.includes('--no-tests')
  const selected = only ? loosen.filter((s) => only.some((o) => s.label.toLowerCase().includes(o))) : loosen
  if (only && selected.length === 0) throw new Error('--only: keine Sperre gefunden')

  const testRun = (pattern, file = 'tests/rls/status.test.ts') => {
    const out = 'tmp/reports/redproof-s9a2.json'
    const r = spawnSync('npx', ['dotenv', '-e', '.env.local', '--', 'vitest', 'run', '--project', 'rls', file, '-t', JSON.stringify(pattern), '--reporter=json', `--outputFile=${out}`], { encoding: 'utf8', shell: true, maxBuffer: 1 << 26 })
    const tests = JSON.parse(readFileSync(out, 'utf8')).testResults.flatMap((f) => f.assertionResults)
    return { exit: r.status, failed: tests.filter((t) => t.status === 'failed'), passed: tests.filter((t) => t.status === 'passed').length }
  }

  const before = snapshot()
  // Vorab: gesperrter Ausgangswert gemessen
  for (const s of selected) {
    const saved = s.save()
    let looseValue, redTests
    sql(`select 1`) // Verbindung prüfen
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
    results.push({ ...s, looseValue, lockedValue, redTests, good, effect, blocked, testsRed })
    console.log(`${good ? 'OK    ' : 'FEHLER'} [${s.kind}] ${s.label}\n         gelockert: ${looseValue} (erwartet ${s.loose})\n         gesperrt:  ${lockedValue} (erwartet ${s.locked})${redTests ? `\n         Test rot: ${redTests.failed.length}` : ''}`)
  }
  const after = snapshot()
  return { before, after, selected }
}

mkdirSync('tmp/proof', { recursive: true })
let outcome
try {
  outcome = await run()
} finally {
  if (userId) await service.auth.admin.deleteUser(userId)
}
const same = outcome.before === outcome.after
const proven = results.filter((r) => r.good && r.kind === 'Sperre').length
const layers = results.filter((r) => r.good && r.kind === 'Schicht').length
const report = [
  '# S9a-2 Rot-Beweis',
  '',
  `Stand ${new Date().toISOString()} (Dev-Projekt). Je Sperre: lockern (committet), Ist-Wert-Probe (Rollback) und zuständigen Test laufen lassen, Original wiederherstellen, Probe erneut. Gelockert muss die WIRKUNG eintreten (Statuswert, Zeilenzahl, geänderter Wert), wiederhergestellt der genaue Fehler bei unverändertem Wert.`,
  '',
  'Format der Probe: „Ergebnis | Wert“. Ergebnis ist „ok“ oder „SQLSTATE: Meldung“; Wert ist der Zustand danach (z. B. Status, Zeilenzahl).',
  '',
]
for (const r of results) {
  report.push(`## ${r.label}`, '', `- Art: ${r.kind === 'Schicht' ? 'Schicht (zweite Sperre dahinter, kein Beweis der ersten)' : 'Sperre'}`, `- Gelockert: \`${r.looseValue}\` (erwartet \`${r.loose}\`) ${r.effect ? '✓ Wirkung eingetreten' : '✗ ABWEICHUNG'}`, `- Gesperrt: \`${r.lockedValue}\` (erwartet \`${r.locked}\`) ${r.blocked ? '✓' : '✗ ABWEICHUNG'}`)
  if (r.tests) report.push(`- Test \`tests/rls/status.test.ts\` -t "${r.tests}" im gelockerten Zustand: ${r.redTests ? `${r.redTests.failed.length} rot` : 'nicht ausgeführt'} ${r.testsRed ? '✓' : '✗ (Lücke im Test!)'}`)
  else report.push('- Test: kein eigener Vitest-Test (Wirkung durch die Probe und tests/rls/quote.test.ts „too_late“ belegt)')
  report.push(`- Bewertung: ${r.good ? 'bestanden' : 'FEHLGESCHLAGEN'}`, '')
}
report.push('## Definitionen vorher/nachher', '', same ? 'Policies, Trigger, Funktionen (md5) und Rechte sind identisch.' : 'ACHTUNG: Definitionen weichen ab!', '', `Ergebnis: ${proven} Sperren und ${layers} Schichten bewiesen von ${results.length}.`)
writeFileSync('tmp/proof/s9a2-rotbeweis.md', report.join('\n') + '\n')
const allGood = results.every((r) => r.good) && same
console.log(same ? 'Definitionen vorher und nachher identisch.' : 'ACHTUNG: Definitionen weichen ab!')
console.log(allGood ? 'REDPROOF BESTANDEN' : 'REDPROOF FEHLGESCHLAGEN')
process.exitCode = allGood ? 0 : 1
