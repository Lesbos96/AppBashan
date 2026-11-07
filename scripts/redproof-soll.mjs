// Soll-Datei der Redproof-Läufe (scripts/redproof-soll.json): Snapshot von Dev, Gegenprüfung gegen die Migrationen, Festschreiben.
//   node scripts/redproof-soll.mjs --check [--soll <pfad>]       nur lesen: Ist gegen vorhandene Soll-Datei (Exit 0 / 2)
//   node scripts/redproof-soll.mjs --verify-migrations           nur lesen: schreibt tmp/proof/r1-soll-objekte.md und r1-soll-matrix.md (Exit 2 bei „fehlt auf Dev“)
//   node scripts/redproof-soll.mjs --write [--out <pfad>]        Soll erzeugen (verweigert gelockerten Zustand, zeigt den Diff zur eingecheckten Datei)
// Quelle: --source dev (Standard, Dev-Guard) | local (supabase db query --local, ungetestet: Docker fehlt). Laufzeitausgabe nennt nur Art und Name.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { diffSoll, fmtDiff, isSelect, refuseReasons, SNAPSHOT_SQL } from './redproof-lib.mjs'
import { compareObjects, netInventory, norm, OBJECTS_SQL, PLATTFORMOBJEKTE } from './redproof-migrations.mjs'

const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1] ?? true }
const has = (n) => process.argv.includes(n)
const fail = (m, code = 2) => { console.error(m); process.exit(code) }
const source = has('--source') ? arg('--source') : 'dev'
if (source !== 'dev' && source !== 'local') fail(`--source verlangt dev oder local (gegeben: ${source}). Keine DB-Aktion.`)
if (source === 'dev') await import('./dev-guard.mjs')
const SOLL_PATH = 'scripts/redproof-soll.json'
const SB = 'node_modules/supabase/dist/supabase.js'
const target = source === 'local' ? '--local' : '--linked'
const sql = (q) => {
  if (!isSelect(q)) fail('Nur Selects erlaubt. Keine DB-Aktion.', 3)
  let out
  try {
    out = execFileSync(process.execPath, [SB, 'db', 'query', target, q], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 })
  } catch (e) {
    let api = ''
    try { api = JSON.parse(e?.stdout ?? '')?.error?.message ?? '' } catch { /* keine JSON-Ausgabe */ }
    fail(`Abfrage fehlgeschlagen: ${(api || `Exit ${e?.status ?? '?'}: ${String(e?.stderr ?? '').split('\n')[0]}`).slice(0, 300)}`, 3)
  }
  const json = JSON.parse(out)
  if (json._tag === 'Error') fail(`Abfrage fehlgeschlagen: ${String(json.error?.message).slice(0, 300)}`, 3)
  return json.rows
}
mkdirSync('tmp/proof', { recursive: true })

// --- Migrationen: Netto-Bestand und Vergleich ---------------------------------------------------------------------------------------
const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
const inventory = netInventory(files.map((name) => ({ name, sql: readFileSync(`supabase/migrations/${name}`, 'utf8') })))

/** Von den alten und neuen Redproof-Skripten gelockerte Objekte (aus den Quelltexten; s9a1/s9a2 aus HEAD). */
function targets() {
  const src = [['scripts/redproof-s9a3.mjs'], ['scripts/redproof-s9a4.mjs'], ['HEAD:scripts/redproof-s9a1.mjs'], ['HEAD:scripts/redproof-s9a2.mjs']].map(([p]) => {
    try { return p.startsWith('HEAD:') ? execFileSync('git', ['show', p], { encoding: 'utf8' }) : readFileSync(p, 'utf8') } catch { return '' }
  }).join('\n')
  const set = { policy: new Set(), trigger: new Set(), function: new Set(), constraint: new Set() }
  for (const m of src.matchAll(/(?:policyToggle|policyLoosen|alter policy)[^'`]*?[('`, ]+(?:'[^']*',\s*)?'?(\w+)'?,?\s*'?(?:on\s+)?((?:public|storage)\.\w+)/g)) set.policy.add(`${m[2]}.${m[1]}`)
  for (const m of src.matchAll(/alter policy (\w+) on ((?:public|storage)\.\w+)/g)) set.policy.add(`${m[2]}.${m[1]}`)
  for (const m of src.matchAll(/(?:triggerOff|disableTrigger)\((?:'[^']*',\s*)?'(\w+)',\s*'((?:public)\.\w+)'/g)) set.trigger.add(`${m[2]}.${m[1]}`)
  for (const m of src.matchAll(/(?:drop|disable) trigger (\w+) on (public\.\w+)/g)) set.trigger.add(`${m[2]}.${m[1]}`)
  for (const m of src.matchAll(/'((?:public|private))\.(\w+)\(/g)) set.function.add(`${m[1]}.${m[2]}`)
  for (const m of src.matchAll(/(?:drop|add) constraint (\w+)/g)) set.constraint.add(m[1])
  return set
}
const isTarget = (t, l) => (l.k === 'policy' && t.policy.has(l.n)) || (l.k === 'trigger' && t.trigger.has(l.n)) || (l.k === 'function' && t.function.has(l.n.split('/')[0])) || (l.k === 'constraint' && t.constraint.has(l.n.split('.').pop()))

function verifyMigrations() {
  const lines = compareObjects(inventory, sql(OBJECTS_SQL))
  const t = targets()
  const counts = {}
  for (const l of lines) { const s = l.state.replace(/ \(.*\)/, ''); counts[s] = (counts[s] ?? 0) + 1 }
  const bad = lines.filter((l) => !l.state.startsWith('gleich'))
  const z = lines.filter((l) => isTarget(t, l))
  const row = (l) => `| ${l.k} | \`${l.n}\` | ${l.state} | ${l.file} |`
  const detail = (l) => `### ${l.k} \`${l.n}\` (${l.state}${l.file ? `, ${l.file}` : ''})\n- Dev (Rohtext): \`${String(l.dev).replace(/\n/g, ' ').slice(0, 600)}\`\n- Migration (Rohtext): \`${String(l.mig).replace(/\n/g, ' ').slice(0, 600)}\`\n- Dev normalisiert: \`${normShow(l.dev)}\`\n- Migration normalisiert: \`${normShow(l.mig)}\``
  const out = [
    '# Soll-Gegenprüfung Migration ↔ Dev', '', `Stand ${new Date().toISOString()} (nur Selects). Migrationen: ${files.length}, letzte ${files.at(-1)}.`, '',
    `Zeilen je Ergebnis: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `Unbenannte Constraints ohne ableitbaren Namen (nicht geprüft): ${inventory.unresolved.length}. Umbenennungen/alter policy ohne create (Warnung): ${inventory.warnings.length}.`, '',
    '## Zielliste: von s9a1 bis s9a4 gelockerte Objekte', '', '| Art | Name | Ergebnis | Migration |', '|---|---|---|---|', ...z.map(row), '',
    '## Plattformobjekte (ausdrückliche Ausnahmeliste, Supabase-eigen)', '', '| Art | Name | Ergebnis | Begründung |', '|---|---|---|---|',
    ...PLATTFORMOBJEKTE.map((p) => `| ${p.k} | \`${p.n}\` | ${lines.find((l) => l.k === p.k && l.n === p.n)?.state ?? 'fehlt auf Dev'} | ${p.grund} |`), '',
    '## Alle Zeilen außer „gleich“ (beide Ausdrücke)', '', ...bad.map(detail), '',
    '## Funktionen (Körper gegen letzte Fundstelle)', '', '| Art | Name | Ergebnis | Migration |', '|---|---|---|---|', ...lines.filter((l) => l.k === 'function').map(row), '',
    '## Nicht ableitbare Constraints', '', ...inventory.unresolved.map((u) => `- ${u.table} (${u.file}): ${u.text}`), '', '## Warnungen', '', ...inventory.warnings.map((w) => `- ${w}`), '',
  ]
  writeFileSync('tmp/proof/r1-soll-objekte.md', out.join('\n'))
  return { lines, bad, counts }
}
const normShow = (text) => String(text).split('¦').map((x) => norm(x)).join(' ¦ ').slice(0, 400)

function matrix() {
  const rows = sql(`select 'tabelle' as art, c.relname as n, concat_ws(' | ', 'RLS ' || c.relrowsecurity, 'force ' || c.relforcerowsecurity, c.relacl::text) as v from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relkind in ('r', 'p', 'v')
    union all select 'policy', p.tablename || '.' || p.policyname, concat_ws(' | ', p.cmd, p.roles::text) from pg_policies p where p.schemaname = 'public'
    union all select 'funktion', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', concat_ws(' | ', 'definer ' || p.prosecdef, p.proacl::text) from pg_proc p where p.pronamespace::regnamespace::text = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    order by 1, 2`)
  writeFileSync('tmp/proof/r1-soll-matrix.md', ['# Soll-Matrix (Kurztabelle aus Dev, nur Selects)', '', '| Art | Name | Rechte / Policy |', '|---|---|---|', ...rows.map((r) => `| ${r.art} | \`${r.n}\` | ${r.v} |`), ''].join('\n'))
}

// --- Modi ------------------------------------------------------------------------------------------------------------------------------
if (has('--verify-migrations')) {
  const { bad, counts } = verifyMigrations()
  matrix()
  console.log(`Gegenprüfung: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}. Berichte: tmp/proof/r1-soll-objekte.md, r1-soll-matrix.md`)
  process.exit(bad.length ? 2 : 0)
}
if (has('--check')) {
  const path = typeof arg('--soll') === 'string' ? arg('--soll') : SOLL_PATH
  if (!existsSync(path)) fail(`Soll-Datei fehlt: ${path}`)
  const soll = JSON.parse(readFileSync(path, 'utf8'))
  const d = diffSoll(soll.rows, sql(SNAPSHOT_SQL))
  if (d.length) fail(`Dev weicht vom Soll ab: ${fmtDiff(d)}`)
  console.log(`Dev gleich Soll (${soll.rows.length} Zeilen, ${path})`)
  process.exit(0)
}
if (has('--write')) {
  const rows = sql(SNAPSHOT_SQL)
  const reasons = refuseReasons(rows)
  if (reasons.length) fail(`Soll wird nicht geschrieben: ${reasons.join('; ')}`)
  const { bad } = verifyMigrations()
  if (bad.length) fail(`Soll wird nicht geschrieben, Dev weicht von den Migrationen ab: ${bad.map((l) => `${l.k} ${l.n} (${l.state})`).join('; ')}`)
  const out = typeof arg('--out') === 'string' ? arg('--out') : SOLL_PATH
  if (existsSync(out)) {
    const old = JSON.parse(readFileSync(out, 'utf8'))
    const d = diffSoll(old.rows, rows)
    console.log(`Diff zur vorhandenen Soll-Datei: ${d.length ? fmtDiff(d) : 'keiner'}`)
    if (d.length) {
      const newer = files.filter((f) => f > (old.migrations?.latest ?? ''))
      if (newer.length === 0) fail('Der Diff ist keiner neuen Migration zugeordnet (keine Migration neuer als der Stand im Kopf der Soll-Datei).')
    }
  }
  const version = sql('select version() as v')[0].v
  writeFileSync(out, `${JSON.stringify({ source, generated: new Date().toISOString(), postgres: version, migrations: { count: files.length, latest: files.at(-1) }, rows }, null, 1)}\n`)
  console.log(`Soll geschrieben: ${out} (${rows.length} Zeilen, ${files.length} Migrationen). Nicht-„gleich“-Zeilen der Gegenprüfung vor dem Einchecken vom Berater lesen lassen.`)
  process.exit(0)
}
fail('Aufruf: --check [--soll <pfad>] | --verify-migrations | --write [--out <pfad>]  (optional --source dev|local)')
