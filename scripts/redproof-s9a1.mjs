// Rot-Beweis S9a-1 (nur Dev-Projekt): lockert jede Sperre einzeln (committet, über Eigentümer-SQL), lässt den zuständigen Test laufen
// (muss rot werden, mit der erwarteten Meldung), stellt das Original wieder her, lässt den Test grün laufen und vergleicht am Ende
// Policies, Trigger, Funktionen und Rechte mit dem Stand davor. Bericht: tmp/proof/s9a1-rotbeweis.md
// Fee-Proben laufen nur in probes(…) (Rollback) oder mit künftigem Datum: nie committete Fee-Zeilen mit effective_from ≤ heute, solange ein Fee-Trigger gelockert ist.
// Start: npx dotenv -e .env.local -- node scripts/redproof-s9a1.mjs [--only <Namensteil>[,<Namensteil>…]]  (--only schreibt tmp/proof/s9a1-rotbeweis-nachpruefung.md)
import './dev-guard.mjs'
console.error('Gesperrt bis R1 Redproof-Härtung (Abnahme nachtabnahme-vorher-redproof-r2.md: M-5)')
process.exit(2)
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const cli = (...args) => execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 26 })
const sql = (q) => {
  const json = JSON.parse(cli('db', 'query', '--linked', q))
  if (json._tag === 'Error') throw new Error(json.error?.message)
  return json.rows
}
const q1 = (s) => `'${s.replaceAll("'", "''")}'`

const SNAPSHOT = `
  select 'policy' k, schemaname || '.' || tablename || '.' || policyname || ' ' || cmd || ' ' || roles::text || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') v
    from pg_policies where (schemaname = 'public' and tablename in ('price_versions', 'price_config', 'platform_settings', 'audit_log', 'profiles', 'fee_splits')) or (schemaname = 'storage' and tablename = 'objects')
  union all
  select 'trigger', tgrelid::regclass || ' ' || pg_get_triggerdef(oid) from pg_trigger where not tgisinternal and tgrelid in ('public.price_versions'::regclass, 'public.price_config'::regclass, 'public.platform_settings'::regclass, 'public.audit_log'::regclass, 'public.profiles'::regclass)
  union all
  select 'function', p.oid::regprocedure || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'private' and p.proname in ('is_admin', 'assert_admin', 'price_version_hash', 'guard_price_version', 'guard_price_config', 'guard_platform_setting', 'guard_profile_role', 'do_publish', 'publish_seed_version', 'append_only'))
       or (n.nspname = 'public' and p.proname in ('publish_version', 'admin_create_price_version', 'admin_set_price_config', 'admin_set_setting', 'admin_grant_role', 'verify_price_version', 'booking_terms', 'become_rental_provider'))
  union all
  select 'acl', c.oid::regclass || ' ' || coalesce(c.relacl::text, '') from pg_class c where c.oid in ('public.price_versions'::regclass, 'public.price_config'::regclass, 'public.platform_settings'::regclass, 'public.audit_log'::regclass, 'public.profiles'::regclass)
  order by 1, 2`
const snapshot = () => JSON.stringify(sql(SNAPSHOT))

const def = (kind, name) => sql(kind === 'function' ? `select pg_get_functiondef('${name}'::regprocedure) as d` : `select pg_get_triggerdef(oid) as d from pg_trigger where tgname = ${q1(name.split(' on ')[0])} and tgrelid = '${name.split(' on ')[1]}'::regclass`)[0].d
const policyQual = (table, policy) => sql(`select qual, with_check from pg_policies where tablename = ${q1(table.split('.')[1])} and policyname = ${q1(policy)}`)[0]

const SETTINGS = ['tests/rls/settings.test.ts']
const loosen = []
const dropTrigger = (name, table, test, pattern, expect) => ({
  name: `Trigger ${name} entfernt`, files: SETTINGS, pattern, expect,
  apply: () => sql(`drop trigger ${name} on ${table}`),
  restore: (saved) => sql(saved.d),
  save: () => ({ d: def('trigger', `${name} on ${table}`) }),
})
const patchFn = (label, fn, from, to, pattern, expect) => ({
  name: label, files: SETTINGS, pattern, expect,
  save: () => ({ d: def('function', fn) }),
  apply: (saved) => {
    if (!saved.d.includes(from)) throw new Error(`Muster nicht gefunden: ${from}`)
    sql(saved.d.replace(from, to))
  },
  restore: (saved) => sql(saved.d),
})
const grantToggle = (label, loosenSql, restoreSql, pattern, expect, files = SETTINGS) => ({
  name: label, files, pattern, expect, save: () => ({}), apply: () => sql(loosenSql), restore: () => sql(restoreSql),
})
const policyToggle = (label, table, policy, using, pattern, expect, files = SETTINGS) => ({
  name: label, files, pattern, expect,
  save: () => policyQual(table, policy),
  apply: () => sql(`alter policy ${policy} on ${table} using (${using})`),
  restore: (s) => sql(`alter policy ${policy} on ${table} using (${s.qual})${s.with_check ? ` with check (${s.with_check})` : ''}`),
})

loosen.push(
  dropTrigger('guard_price_version', 'public.price_versions', null, 'veröffentlichte Preisversion ist unveränderlich', 'price_versions_published_complete'),
  patchFn('Marker-Prüfung von guard_price_version ausgeschaltet', 'private.guard_price_version()', "if current_setting('app.mv_publish', true) is distinct from old.version::text", "if false and current_setting('app.mv_publish', true) is distinct from old.version::text", 'veröffentlichte Preisversion ist unveränderlich', "flag_without_marker_owner: expected 'ok' to be 'P0001: field_immutable'"),
  dropTrigger('guard_price_config', 'public.price_config', null, 'veröffentlichte Preisversion ist unveränderlich', 'version_published'),
  dropTrigger('guard_platform_setting', 'public.platform_settings', null, 'Gebührensätze und Einstellungen', 'fee_rate_notice'),
  patchFn('Vorlauf-Prüfung von guard_platform_setting ausgeschaltet', 'private.guard_platform_setting()', 'if new.effective_from < today + notice::int', 'if false and new.effective_from < today + notice::int', 'Gebührensätze und Einstellungen', 'fee_rate_notice'),
  dropTrigger('append_only', 'public.audit_log', null, 'audit_log nur anfügen', 'append_only'),
  patchFn('guard_platform_setting: OLD-Schlüssel nicht geprüft (Umbenennen)', 'private.guard_platform_setting()', "(tg_op <> 'INSERT' and old.key in ('fee_rate', 'fee_vat_rate', 'fee_notice_days'))", 'false', 'Gebührensätze und Einstellungen', 'fee_rename'),
  patchFn('guard_profile_role: Tausch von profiles.id erlaubt', 'private.guard_profile_role()', "if tg_op = 'UPDATE' and new.id is distinct from old.id", "if false and tg_op = 'UPDATE' and new.id is distinct from old.id", 'audit_log nur anfügen', "profile_id_swap: expected 'ok' to be 'P0001: field_immutable'"),
  dropTrigger('append_only_truncate', 'public.audit_log', null, 'audit_log nur anfügen', 'audit_truncate_owner'),
  dropTrigger('guard_platform_setting_truncate', 'public.platform_settings', null, 'audit_log nur anfügen', 'settings_truncate_owner'),
  dropTrigger('guard_price_config_truncate', 'public.price_config', null, 'audit_log nur anfügen', 'config_truncate_owner'),
  dropTrigger('guard_role', 'public.profiles', null, 'audit_log nur anfügen', ["profile_id_swap: expected 'ok' to be 'P0001: field_immutable'", "role_after_update: expected '= admin' to be '= customer'", "role_insert: expected 'ok' to be 'P0001: field_immutable'"]),
  grantToggle('audit_log: UPDATE/DELETE/TRUNCATE für service_role erlaubt', 'grant update, delete, truncate on public.audit_log to service_role', 'revoke update, delete, truncate on public.audit_log from service_role', 'audit_log nur anfügen', 'audit_update_service'),
  grantToggle('TRUNCATE price_config für service_role erlaubt', 'grant truncate on public.price_config to service_role', 'revoke truncate on public.price_config from service_role', 'veröffentlichte Preisversion ist unveränderlich', 'truncate_config'),
  patchFn('is_admin() ohne aal2', 'private.is_admin()', "and (select auth.jwt() ->> 'aal') = 'aal2'", '', 'audit_log nur anfügen', [/audit_read_aal1: expected '= [1-9]\d*' to be '= 0'/, "is_admin_aal1: expected '= true' to be '= false'"]),
  patchFn('verify_price_version ohne Hash-Vergleich', 'public.verify_price_version(int)', 'if pv.content_hash is distinct from private.price_version_hash(p_version)', 'if false and pv.content_hash is distinct from private.price_version_hash(p_version)', 'veröffentlichte Preisversion ist unveränderlich', 'version_hash_mismatch'),
  grantToggle('admin_grant_role für service_role ausführbar', 'grant execute on function public.admin_grant_role(uuid, public.user_role) to service_role', 'revoke execute on function public.admin_grant_role(uuid, public.user_role) from service_role', 'admin_grant_role ist auch für service_role gesperrt', "to be '42501'"),
  grantToggle('publish_version für authenticated ausführbar', 'grant execute on function public.publish_version(uuid, int), public.admin_create_price_version(uuid, int, date, text), public.admin_set_setting(uuid, text, numeric, date, text) to authenticated', 'revoke execute on function public.publish_version(uuid, int), public.admin_create_price_version(uuid, int, date, text), public.admin_set_setting(uuid, text, numeric, date, text) from authenticated', 'ruft keine Admin-Funktion auf', "to be '42501'"),
  grantToggle('platform_settings: Schreib-Grants für authenticated', 'grant insert, update, delete on public.platform_settings to authenticated', 'revoke insert, update, delete on public.platform_settings from authenticated', 'Schreiben über die API', '42501'),
  grantToggle('price_config: Schreib-Grants für authenticated', 'grant insert, update, delete on public.price_versions, public.price_config to authenticated', 'revoke insert, update, delete on public.price_versions, public.price_config from authenticated', 'über die API: authenticated und admin', '42501'),
  policyToggle('price_versions_select für alle (auch unveröffentlicht)', 'public.price_versions', 'price_versions_select', 'true', 'audit_log nur anfügen', ["unpublished_admin_aal1: expected '= 1' to be '= 0'", "unpublished_anon: expected '= 1' to be '= 0'"]),
  policyToggle('profiles_select: admin ohne aal2', 'public.profiles', 'profiles_select', "id = (select auth.uid()) or (select private.my_role()) = 'admin'", 'audit_log nur anfügen', /profiles_admin_aal1: expected '= (?:[2-9]|[1-9]\d+)' to be '= 1'/),
  policyToggle('fee_splits_select: admin ohne aal2', 'public.fee_splits', 'fee_splits_select', "payee_id = (select auth.uid()) or (select private.my_role()) = 'admin'", 'admin liest Aufteilungen nur mit aal2', 'to deeply equal', ['tests/rls/rls.test.ts']),
)

const testRun = (files, pattern) => {
  const out = 'tmp/reports/redproof-s9a1.json'
  const r = spawnSync('npx', ['dotenv', '-e', '.env.local', '--', 'vitest', 'run', '--project', 'rls', ...files, '-t', pattern, '--reporter=json', `--outputFile=${out}`], { encoding: 'utf8', shell: true, maxBuffer: 1 << 26 })
  const json = JSON.parse(readFileSync(out, 'utf8'))
  const tests = json.testResults.flatMap((f) => f.assertionResults)
  const failed = tests.filter((t) => t.status === 'failed')
  return { exit: r.status, passed: tests.filter((t) => t.status === 'passed').length, failed, line: (t) => (t.failureMessages?.[0] ?? '').split('\n').find((l) => l.trim()) ?? '' }
}

const onlyAt = process.argv.indexOf('--only')
const only = onlyAt < 0 ? null : process.argv.slice(onlyAt + 1).flatMap((a) => a.split(',')).filter((a) => a && !a.startsWith('--')).map((a) => a.toLowerCase())
const selected = only ? loosen.filter((s) => only.some((o) => s.name.toLowerCase().includes(o))) : loosen
if (only && selected.length === 0) throw new Error('--only: keine Sperre gefunden')
const reportFile = only ? 'tmp/proof/s9a1-rotbeweis-nachpruefung.md' : 'tmp/proof/s9a1-rotbeweis.md'
mkdirSync('tmp/proof', { recursive: true })
const before = snapshot()
const report = ['# S9a-1 Rot-Beweis', '', `Stand ${new Date().toISOString()} (Dev-Projekt). Je Sperre: lockern (committet), Test laufen lassen (muss rot sein), Original wiederherstellen, Test laufen lassen (muss grün sein).`, '']
let ok = 0
const cleanup = () => {
  sql(`delete from public.price_config where version in (9997, 9998); delete from public.price_versions where version in (9997, 9998); delete from public.platform_settings where key = 'offers_open_max' and version > 1`)
}
try {
  for (const s of selected) {
    const saved = s.save()
    let red, green
    try {
      s.apply(saved)
      red = testRun(s.files, s.pattern)
    } finally {
      s.restore(saved)
      cleanup()
    }
    green = testRun(s.files, s.pattern)
    const wants = [].concat(s.expect)
    const msgs = red.failed.flatMap((t) => t.failureMessages ?? []).join('\n')
    const hit = (w) => (w instanceof RegExp ? w.test(msgs) : msgs.includes(w))
    const isRed = red.failed.length > 0 && wants.every(hit)
    const isGreen = green.failed.length === 0 && green.passed > 0
    if (isRed && isGreen) ok++
    console.log(`${isRed && isGreen ? 'OK    ' : 'FEHLER'} ${s.name}: rot ${red.failed.length}, grün-danach ${green.passed} bestanden / ${green.failed.length} rot`)
    report.push(`## ${s.name}`, '', `- Test: \`${s.files.join(', ')}\` -t "${s.pattern}"`)
    for (const w of wants) report.push(`- Erwartete Meldung in der roten Ausgabe: \`${w}\` (${hit(w) ? 'gefunden' : 'NICHT gefunden'})`)
    for (const t of red.failed.slice(0, 3)) {
      report.push(`- ROT: ${t.fullName ?? t.title}`)
      for (const m of (t.failureMessages ?? []).filter((m) => m.startsWith('AssertionError')).slice(0, 6)) report.push(`  - Kernzeile: \`${m.split('\n')[0].slice(0, 220)}\``)
    }
    if (red.failed.length === 0) report.push('- ROT: keine Tests rot (Lücke im Test!)')
    report.push(`- GRÜN nach Zurücknehmen: ${green.passed} Tests bestanden, ${green.failed.length} rot (Exit ${green.exit})`, `- Bewertung: ${isRed && isGreen ? 'bestanden' : 'FEHLGESCHLAGEN'}`, '')
  }
} finally {
  cleanup()
  const after = snapshot()
  const same = before === after
  report.push('## Definitionen vorher/nachher', '', same ? 'Policies, Trigger, Funktionen (md5) und Rechte sind identisch.' : 'ACHTUNG: Definitionen weichen ab!', '', `Ergebnis: ${ok} von ${selected.length} Sperren bewiesen.`)
  writeFileSync(reportFile, report.join('\n') + '\n')
  console.log(same ? 'Definitionen vorher und nachher identisch.' : 'ACHTUNG: Definitionen weichen ab!')
  console.log(ok === selected.length && same ? 'REDPROOF BESTANDEN' : 'REDPROOF FEHLGESCHLAGEN')
  process.exitCode = ok === selected.length && same ? 0 : 1
}
