// SQL-Texte der Lockerungen und ihrer Wiederherstellungen für redproof-s9a3/-s9a4 (R1). Reine Textbausteine, keine Nebenwirkung:
// dieselbe Zeichenkette geht in die Probe-Transaktion, den Commit und den Restore. Jeder Restore ist idempotent (create or replace,
// alter policy, grant/revoke, enable trigger, drop … if exists vor add). Originale liest `select` (nur Selects) im Soll-geprüften Zustand.
const q1 = (s) => `'${String(s).replaceAll("'", "''")}'`
const fnDef = (select, fn) => select(`select pg_get_functiondef(${q1(fn)}::regprocedure) as d`)[0].d

/** Funktionen ändern: edits = [[Funktion, von, nach], …]; Muster muss vorkommen. */
export const patchFns = (select, edits) => {
  const fns = [...new Set(edits.map(([fn]) => fn))]
  const orig = Object.fromEntries(fns.map((fn) => [fn, fnDef(select, fn)]))
  const cur = { ...orig }
  for (const [fn, from, to] of edits) {
    if (!cur[fn].includes(from)) throw new Error(`Muster nicht gefunden: ${from}`)
    cur[fn] = cur[fn].replace(from, to)
  }
  return { loosen: fns.map((fn) => cur[fn]).join(';\n'), restore: fns.map((fn) => orig[fn]).join(';\n') }
}
export const patchFn = (select, fn, from, to) => patchFns(select, [[fn, from, to]])
export const triggerOff = (table, name) => ({ loosen: `alter table ${table} disable trigger ${name}`, restore: `alter table ${table} enable trigger ${name}` })
export const toggle = (loosen, restore) => ({ loosen, restore })
/** Policy lockern: `looseExpr` ersetzt using bzw. with check; Wiederherstellung aus der gelesenen Definition. */
export const policyLoosen = (select, name, table, clause, looseExpr) => {
  const [schema, rel] = table.split('.')
  const row = select(`select qual, with_check from pg_policies where schemaname = ${q1(schema)} and tablename = ${q1(rel)} and policyname = ${q1(name)}`)[0]
  const orig = clause === 'using' ? row?.qual : row?.with_check
  if (!orig) throw new Error(`Policy nicht gefunden: ${table}.${name}`)
  return { loosen: `alter policy ${name} on ${table} ${clause} (${looseExpr})`, restore: `alter policy ${name} on ${table} ${clause} (${orig})` }
}
/** Mehrere Lockerungen in einem Fenster (z. B. DELETE-Policy und die SELECT-Sicht, die die Storage-API vorher prüft). */
export const combine = (...parts) => ({ loosen: parts.map((p) => p.loosen).join(';\n'), restore: parts.map((p) => p.restore).join(';\n') })
/** Constraint entfernen. Restore: drop if exists, dann add (idempotent); `purge` löscht vorher verletzende Zeilen der Wegwerf-Konten (N-1 Runde 2). */
export const constraintDrop = (select, table, name, purge = '') => {
  const [schema, rel] = table.split('.')
  const d = select(`select pg_get_constraintdef(k.oid) as d from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = ${q1(schema)} and c.relname = ${q1(rel)} and k.conname = ${q1(name)}`)[0]?.d
  if (!d) throw new Error(`Constraint nicht gefunden: ${table}.${name}`)
  const purgeSql = typeof purge === 'function' ? purge(d.replace(/^CHECK\s*/i, '')) : purge
  return { loosen: `alter table ${table} drop constraint ${name}`, restore: `${purgeSql ? `${purgeSql};\n` : ''}alter table ${table} drop constraint if exists ${name};\nalter table ${table} add constraint ${name} ${d}` }
}
/** Objekt anlegen (Policy, Funktion): Restore = drop … if exists. */
export const createObject = (loosen, restore) => ({ loosen, restore })
