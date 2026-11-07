// Gegenprüfung Migration ↔ Dev für das Soll (H-A, H-A-Rest): Netto-Bestand aus supabase/migrations (Policies, Trigger, Constraints,
// Spalten-Defaults, RLS-Flags, Funktionskörper) und Vergleich in beide Richtungen mit dem Ist-Zustand von Dev (Ausdruckstexte).
// Grenze: Postgres schreibt Ausdrücke um; verglichen wird normalisiert (Kleinschreibung, Casts, Schemapräfixe, Klammern, Leerraum).
// Unbenannte Inline-Constraints, deren Postgres-Name sich nicht ableiten lässt (z. B. unbenannte Tabellen-Checks), stehen unter `unresolved`.
import { createHash } from 'node:crypto'

/** Zerlegt SQL in Anweisungen (Kommentare, Strings, Bezeichner in Anführungszeichen und Dollar-Quotes bleiben heil). */
export function splitStatements(sql) {
  const out = []
  let cur = ''
  for (let i = 0; i < sql.length;) {
    const c = sql[i]
    const two = sql.slice(i, i + 2)
    if (two === '--') { const j = sql.indexOf('\n', i); i = j < 0 ? sql.length : j; continue }
    if (two === '/*') { const j = sql.indexOf('*/', i + 2); i = j < 0 ? sql.length : j + 2; continue }
    if (c === "'" || c === '"') {
      let j = i + 1
      while (j < sql.length) { if (sql[j] === c) { if (sql[j + 1] === c) j += 2; else break } else j++ }
      cur += sql.slice(i, j + 1); i = j + 1; continue
    }
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))
      if (m) {
        const end = sql.indexOf(m[0], i + m[0].length)
        const j = end < 0 ? sql.length : end + m[0].length
        cur += sql.slice(i, j); i = j; continue
      }
    }
    if (c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue }
    cur += c; i++
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const stripQ = (s) => s.replaceAll('"', '').trim()
/** Tabellenname → 'schema.name' (ohne Schema: public). */
export const tableKey = (t) => { const s = stripQ(t).toLowerCase(); return s.includes('.') ? s : `public.${s}` }
const space = (s) => s.replace(/\s+/g, ' ').trim()
/** Kommaliste auf oberster Ebene (Klammern, Strings, Dollar-Quotes beachtet). */
export function splitTop(s, sep = ',') {
  const out = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === "'") { let j = i + 1; while (j < s.length && !(s[j] === "'" && s[j + 1] !== "'")) j += s[j] === "'" ? 2 : 1; cur += s.slice(i, j + 1); i = j; continue }
    if (c === '(' || c === '[') depth++
    if (c === ')' || c === ']') depth--
    if (c === sep && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
/** Inhalt der ersten Klammer ab `from` (balanciert). */
const paren = (s, from = 0) => {
  const a = s.indexOf('(', from)
  if (a < 0) return null
  let depth = 0
  for (let i = a; i < s.length; i++) {
    if (s[i] === "'") { i = s.indexOf("'", i + 1); if (i < 0) break; continue }
    if (s[i] === '(') depth++
    if (s[i] === ')' && --depth === 0) return { inner: s.slice(a + 1, i), end: i + 1 }
  }
  return null
}

/** Vergleichsform eines Ausdrucks: ohne Casts, Schemapräfixe, Anführungszeichen, Klammern, Aliasse, Leerraum. */
export function norm(text) {
  let t = String(text ?? '').toLowerCase().replace(/--[^\n]*/g, ' ').replaceAll('"', '')
  t = t.replace(/::\s*[a-z_][a-z0-9_.]*(?:\s+(?:varying|precision|without time zone|with time zone))?(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?(?:\s*\[\s*\])*/g, '')
  t = t.replace(/\b(public|extensions|private|auth|storage)\./g, (m, s) => (s === 'private' || s === 'auth' || s === 'storage' ? m : ''))
  t = t.replace(/=\s*any\s*\(\s*array\s*\[/g, ' in (').replace(/\barray\s*\[/g, '(').replace(/\bas\s+[a-z_][a-z0-9_]*\b/g, '')
  // x between a and b ↔ x >= a and x <= b; not in ↔ <> all; not like ↔ !~~; on delete set null (Wortende)
  t = t.replace(/([a-z_][a-z0-9_.]*(?:\([^()]*\))?)\s+between\s+([^\s)]+)\s+and\s+([^\s)]+)/g, '$1 >= $2 and $1 <= $3')
  t = t.replace(/([a-z_][a-z0-9_.]*)\s+not\s+in\s*\(/g, '$1 <> all (').replace(/\bnot\s+like\b/g, '!~~')
  t = t.replace(/\(\s*(-?\d+(?:\.\d+)?)\s*\)/g, '$1')
  t = t.replace(/\b(security_definer|security_invoker)\b/g, '$1')
  // Klammern und Leerraum fallen weg (Grenze: Vorrang von and/or ohne Klammern bleibt gleich); Operatorzeichen (~ | & ? @ # ^ ,) bleiben erhalten
  return t.replace(/[^a-z0-9_.<>=!+\-*/'%~|&?@#^,]/g, '')
}

const AUTONAME = (table, cols, kind) => `${table.split('.')[1]}_${cols.join('_')}_${kind}`
/** Inline- und Tabellen-Constraints sowie Defaults einer create-table-Definition. */
function parseCreateTable(inv, table, body, unresolved, file) {
  inv.rls.set(table, inv.rls.get(table) ?? { enabled: false, force: false })
  for (const item of splitTop(body)) {
    const it = space(item)
    const low = it.toLowerCase()
    const named = /^constraint\s+("?[\w]+"?)\s+(.*)$/i.exec(it)
    if (named) { inv.constraints.set(`${table}.${stripQ(named[1]).toLowerCase()}`, { text: named[2], file }); continue }
    if (/^(primary key|unique|foreign key|check|exclude)\b/i.test(low)) {
      const cols = (paren(it)?.inner ?? '').split(',').map((c) => stripQ(c).toLowerCase()).filter(Boolean)
      if (low.startsWith('primary key')) inv.constraints.set(`${table}.${table.split('.')[1]}_pkey`, { text: it, file })
      else if (low.startsWith('unique')) inv.constraints.set(`${table}.${AUTONAME(table, cols, 'key')}`, { text: it, file })
      else if (low.startsWith('foreign key')) inv.constraints.set(`${table}.${AUTONAME(table, cols, 'fkey')}`, { text: it, file })
      else unresolved.push({ table, text: it.slice(0, 80), file })
      continue
    }
    const col = /^("?[\w]+"?)\s+(.*)$/.exec(it)
    if (!col) continue
    const name = stripQ(col[1]).toLowerCase()
    const rest = col[2]
    const def = /\bdefault\s+(.+?)(?=(?<!\bset)\s+(?:not null|null|constraint|primary key|references|check|unique|generated)\b|$)/i.exec(rest)
    if (def) inv.defaults.set(`${table}.${name}`, { text: def[1].trim(), file })
    const cn = /\bconstraint\s+("?[\w]+"?)\s+(primary key|references|check|unique)/i.exec(rest)
    if (/\bprimary key\b/i.test(rest)) inv.constraints.set(`${table}.${cn && /primary key/i.test(cn[2]) ? stripQ(cn[1]).toLowerCase() : `${table.split('.')[1]}_pkey`}`, { text: `primary key (${name})`, file })
    const ref = /\breferences\s+(.+?)(?=(?<!\bset)\s+(?:not null|null|constraint|primary key|check|unique|default)\b|$)/i.exec(rest)
    if (ref) inv.constraints.set(`${table}.${cn && /references/i.test(cn[2]) ? stripQ(cn[1]).toLowerCase() : AUTONAME(table, [name], 'fkey')}`, { text: `foreign key (${name}) references ${ref[1]}`, file })
    if (/\bunique\b/i.test(rest)) inv.constraints.set(`${table}.${AUTONAME(table, [name], 'key')}`, { text: `unique (${name})`, file })
    const chk = /\bcheck\s*\(/i.exec(rest)
    if (chk) { const p = paren(rest, chk.index); inv.constraints.set(`${table}.${cn && /check/i.test(cn[2]) ? stripQ(cn[1]).toLowerCase() : AUTONAME(table, [name], 'check')}`, { text: `check (${p?.inner ?? ''})`, file }) }
  }
}

const dropTable = (inv, table) => {
  for (const m of [inv.policies, inv.triggers, inv.constraints, inv.defaults]) for (const k of [...m.keys()]) if (k.startsWith(`${table}.`)) m.delete(k)
  inv.rls.delete(table)
}

function applyStatement(inv, stmt, file, unresolved, warnings, inDo = false) {
  const s = space(stmt)
  const low = s.toLowerCase()
  let m
  if ((m = /^create table (?:if not exists )?([\w."]+)\s*\(/i.exec(s))) {
    const table = tableKey(m[1])
    const p = paren(stmt, stmt.toLowerCase().indexOf(m[1].toLowerCase()))
    if (p) parseCreateTable(inv, table, p.inner, unresolved, file)
    return
  }
  if ((m = /^drop table (?:if exists )?(.+?)(?: cascade| restrict)?$/i.exec(s))) { for (const t of m[1].split(',')) dropTable(inv, tableKey(t)); return }
  if ((m = /^alter table (?:only )?(?:if exists )?([\w."]+)\s+(.*)$/is.exec(stmt))) {
    const table = tableKey(m[1])
    if (/^rename\b/i.test(m[2])) { warnings.push(`${file}: ${space(stmt).slice(0, 100)}`); return }
    for (const act of splitTop(m[2])) {
      const a = space(act)
      let x
      if ((x = /^add constraint ("?[\w]+"?)\s+(.*)$/i.exec(a))) inv.constraints.set(`${table}.${stripQ(x[1]).toLowerCase()}`, { text: x[2], file })
      else if ((x = /^drop constraint (?:if exists )?("?[\w]+"?)/i.exec(a))) inv.constraints.delete(`${table}.${stripQ(x[1]).toLowerCase()}`)
      else if ((x = /^alter column ("?[\w]+"?) set default (.+)$/i.exec(a))) inv.defaults.set(`${table}.${stripQ(x[1]).toLowerCase()}`, { text: x[2], file })
      else if ((x = /^alter column ("?[\w]+"?) drop default/i.exec(a))) inv.defaults.delete(`${table}.${stripQ(x[1]).toLowerCase()}`)
      else if ((x = /^add column (?:if not exists )?("?[\w]+"?)\s+(.*)$/i.exec(a))) parseCreateTable(inv, table, `${x[1]} ${x[2]}`, unresolved, file)
      else if ((x = /^drop column (?:if exists )?("?[\w]+"?)/i.exec(a))) {
        // Postgres entfernt mit der Spalte jede Constraint, die sie betrifft (auch mehrspaltige Checks)
        const col = stripQ(x[1]).toLowerCase()
        inv.defaults.delete(`${table}.${col}`)
        for (const [k, c] of [...inv.constraints]) if (k.startsWith(`${table}.`) && new RegExp(`\\b${col}\\b`, 'i').test(c.text)) inv.constraints.delete(k)
      }
      else if (/^enable row level security/i.test(a)) inv.rls.set(table, { ...(inv.rls.get(table) ?? { force: false }), enabled: true })
      else if (/^disable row level security/i.test(a)) inv.rls.set(table, { ...(inv.rls.get(table) ?? { force: false }), enabled: false })
      else if (/^force row level security/i.test(a)) inv.rls.set(table, { ...(inv.rls.get(table) ?? { enabled: false }), force: true })
      else if (/^no force row level security/i.test(a)) inv.rls.set(table, { ...(inv.rls.get(table) ?? { enabled: false }), force: false })
    }
    return
  }
  if ((m = /^create policy ("?[\w]+"?) on ([\w."]+)\s*(.*)$/is.exec(stmt))) { inv.policies.set(`${tableKey(m[2])}.${stripQ(m[1]).toLowerCase()}`, { ...parsePolicy(m[3]), file }); return }
  if ((m = /^alter policy ("?[\w]+"?) on ([\w."]+)\s+(.*)$/is.exec(stmt))) {
    const key = `${tableKey(m[2])}.${stripQ(m[1]).toLowerCase()}`
    if (/^rename\b/i.test(m[3])) { warnings.push(`${file}: ${space(stmt).slice(0, 100)}`); return }
    const old = inv.policies.get(key)
    const patch = parsePolicy(m[3])
    if (old) inv.policies.set(key, { cmd: old.cmd, permissive: old.permissive, roles: patch.roles ?? old.roles, qual: patch.qual ?? old.qual, check: patch.check ?? old.check, file })
    else warnings.push(`${file}: alter policy ohne vorheriges create (${key})`)
    return
  }
  if ((m = /^drop policy (?:if exists )?("?[\w]+"?) on ([\w."]+)/i.exec(s))) { inv.policies.delete(`${tableKey(m[2])}.${stripQ(m[1]).toLowerCase()}`); return }
  if ((m = /^create (?:or replace )?(?:constraint )?trigger ("?[\w]+"?)\s+(.*?)\bon ([\w."]+)\s*(.*)$/is.exec(stmt))) { inv.triggers.set(`${tableKey(m[3])}.${stripQ(m[1]).toLowerCase()}`, { text: space(stmt), file }); return }
  if ((m = /^drop trigger (?:if exists )?("?[\w]+"?) on ([\w."]+)/i.exec(s))) { inv.triggers.delete(`${tableKey(m[2])}.${stripQ(m[1]).toLowerCase()}`); return }
  if ((m = /^create (?:or replace )?function ([\w."]+)\s*\(/i.exec(stmt))) {
    const name = stripQ(m[1]).toLowerCase()
    const p = paren(stmt, stmt.indexOf('('))
    const args = p ? splitTop(p.inner).filter(Boolean).length : 0
    const body = /\$([A-Za-z_][A-Za-z0-9_]*)?\$([\s\S]*)\$\1\$/.exec(stmt)
    inv.functions.set(`${name.includes('.') ? name : `public.${name}`}/${args}`, { body: body?.[2] ?? '', file })
    return
  }
  if ((m = /^drop function (?:if exists )?([\w."]+)\s*\(([^)]*)\)/i.exec(s))) {
    const name = stripQ(m[1]).toLowerCase()
    inv.functions.delete(`${name.includes('.') ? name : `public.${name}`}/${m[2].trim() ? splitTop(m[2]).length : 0}`)
    return
  }
  if (/^do\b/i.test(low) && !inDo) {
    const body = /\$([A-Za-z_][A-Za-z0-9_]*)?\$([\s\S]*)\$\1\$/.exec(stmt)
    if (body) for (const inner of splitStatements(body[2])) applyStatement(inv, inner.replace(/^(begin|declare)\b/i, '').trim(), file, unresolved, warnings, true)
  }
}

function parsePolicy(rest) {
  const r = space(rest)
  const cmd = /\bfor (all|select|insert|update|delete)\b/i.exec(r)?.[1]?.toLowerCase()
  const roles = /\bto ([^()]+?)(?=\s+(?:using|with check)\b|$)/i.exec(r)?.[1]
  const u = /\busing\s*\(/i.exec(r)
  const c = /\bwith check\s*\(/i.exec(r)
  const permissive = /\bas restrictive\b/i.test(r) ? 'RESTRICTIVE' : 'PERMISSIVE'
  return { cmd, roles, permissive, qual: u ? paren(r, u.index)?.inner : undefined, check: c ? paren(r, c.index)?.inner : undefined }
}

/** Netto-Bestand aus Migrationsdateien [{ name, sql }] in Reihenfolge der Namen. */
export function netInventory(files) {
  const inv = { policies: new Map(), triggers: new Map(), constraints: new Map(), defaults: new Map(), rls: new Map(), functions: new Map() }
  const unresolved = []
  const warnings = []
  for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) for (const st of splitStatements(f.sql)) applyStatement(inv, st, f.name, unresolved, warnings)
  return { ...inv, unresolved, warnings }
}

/** Ausdruckstexte von Dev (nur Selects): n wie im Snapshot, v = Text. */
export const OBJECTS_SQL = `select k, n, v from (
  select 'policy' as k, p.schemaname || '.' || p.tablename || '.' || p.policyname as n, concat_ws('¦', p.cmd, p.roles::text, coalesce(p.qual, ''), coalesce(p.with_check, ''), p.permissive) as v
    from pg_policies p where p.schemaname = 'public' or (p.schemaname = 'storage' and p.tablename = 'objects')
  union all
  select 'trigger', ns.nspname || '.' || c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace ns on ns.oid = c.relnamespace
    where not t.tgisinternal and (ns.nspname = 'public' or (ns.nspname = 'auth' and c.relname = 'users') or (ns.nspname = 'storage' and c.relname = 'objects'))
  union all
  select 'constraint', ns.nspname || '.' || c.relname || '.' || k.conname, pg_get_constraintdef(k.oid)
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and k.contype <> 't'
  union all
  select 'default', ns.nspname || '.' || c.relname || '.' || a.attname, pg_get_expr(d.adbin, d.adrelid)
    from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum join pg_class c on c.oid = d.adrelid join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public'
  union all
  select 'rls', ns.nspname || '.' || c.relname, c.relrowsecurity::text || ' ' || c.relforcerowsecurity::text
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relkind in ('r', 'p')
  union all
  select 'function', p.pronamespace::regnamespace::text || '.' || p.proname || '/' || p.pronargs, p.prosrc
    from pg_proc p where p.pronamespace::regnamespace::text in ('public', 'private') and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
) s order by 1, 2`

const normBody = (b) => norm(String(b).replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' '))
const md5 = (s) => createHash('md5').update(s).digest('hex')

/** Soll-Text einer Migration in der Form des Dev-Textes (zum Vergleichen). */
function migText(kind, o) {
  if (kind === 'policy') return [o.cmd ?? 'all', o.roles ?? 'public', o.qual ?? '', o.check ?? '', o.permissive ?? 'PERMISSIVE'].join('¦')
  if (kind === 'rls') return `${o.enabled} ${o.force}`
  return o.text ?? o.body ?? ''
}
const sortEvents = (t) => t.replace(/\b(before|after|instead of)\s+((?:insert|update|delete|truncate)(?:\s+or\s+(?:insert|update|delete|truncate))*)/i, (_m, when, ev) => `${when} ${ev.toLowerCase().split(/\s+or\s+/).sort().join(' or ')}`)
const trigText = (t) => norm(sortEvents(t.replace(/^create (?:or replace )?(?:constraint )?trigger\s+\S+\s+/i, ''))).replaceAll("'", '')
const unqual = (text, tbl) => String(text ?? '').replace(new RegExp(`\\b${tbl}\\.`, 'gi'), '')
const rolesNorm = (r) => String(r ?? 'public').replace(/[^a-z_,]/gi, '').replaceAll(',', '').toLowerCase()
const devNorm = (kind, v, tbl) => {
  if (kind === 'policy') return v.split('¦').map((x, i) => (i === 0 ? x.toLowerCase() : i === 1 ? rolesNorm(x) : norm(unqual(x, tbl)))).join('¦')
  if (kind === 'rls') return v
  if (kind === 'function') return normBody(v)
  if (kind === 'trigger') return trigText(v)
  return norm(v)
}
const migNorm = (kind, o, tbl) => {
  if (kind === 'policy') return [o.cmd ?? 'all', rolesNorm(o.roles), norm(unqual(o.qual, tbl)), norm(unqual(o.check, tbl)), norm(o.permissive ?? 'PERMISSIVE')].join('¦')
  if (kind === 'rls') return `${o.enabled} ${o.force}`
  if (kind === 'function') return normBody(o.body)
  if (kind === 'trigger') return trigText(o.text)
  return norm(o.text)
}

/**
 * Plattformobjekte: von Supabase selbst auf storage.objects angelegt, stehen in keiner Migration von uns. Ausdrückliche Einzelfälle
 * (keine Schema-Ausnahme): Name, vollständige Definition (pg_get_triggerdef) und Begründung. Weicht Dev ab, ist es ein Fund („abweichend“).
 */
export const PLATTFORMOBJEKTE = [
  {
    k: 'trigger', n: 'storage.objects.protect_objects_delete',
    def: 'CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete()',
    grund: 'Supabase Storage sperrt direktes DELETE auf storage.objects (Dateien nur über die Storage-API löschen); gehört zum Storage-Schema, nicht zu unseren Migrationen.',
  },
  {
    k: 'trigger', n: 'storage.objects.update_objects_updated_at',
    def: 'CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column()',
    grund: 'Supabase Storage pflegt updated_at bei jedem UPDATE auf storage.objects; gehört zum Storage-Schema, nicht zu unseren Migrationen.',
  },
]
const flat = (s) => String(s).replace(/\s+/g, ' ').trim()

/** Vergleich in beide Richtungen. `dev`: Zeilen aus OBJECTS_SQL. Ergebniszeilen: { k, n, state, dev, mig, file }. */
export function compareObjects(inv, dev) {
  const maps = { policy: inv.policies, trigger: inv.triggers, constraint: inv.constraints, default: inv.defaults, rls: inv.rls, function: inv.functions }
  const lines = []
  const seen = new Set()
  for (const r of dev) {
    const o = maps[r.k]?.get(r.n)
    seen.add(`${r.k}|${r.n}`)
    if (!o) {
      const p = PLATTFORMOBJEKTE.find((x) => x.k === r.k && x.n === r.n)
      if (p) lines.push({ k: r.k, n: r.n, state: flat(p.def) === flat(r.v) ? 'gleich (Plattformobjekt)' : 'abweichend', dev: r.v, mig: p.def, file: 'Plattformobjekt' })
      else lines.push({ k: r.k, n: r.n, state: 'nicht gefunden', dev: r.v, mig: '', file: '' })
      continue
    }
    const tbl = r.n.split('.')[1]
    const same = devNorm(r.k, r.v, tbl) === migNorm(r.k, o, tbl)
    const raw = r.k === 'function' && same ? (md5(r.v) === md5(o.body) ? ' (roh gleich)' : ' (normalisiert gleich)') : ''
    lines.push({ k: r.k, n: r.n, state: same ? `gleich${raw}` : 'abweichend', dev: r.v, mig: migText(r.k, o), file: o.file ?? '' })
  }
  for (const [kind, map] of Object.entries(maps)) {
    for (const [n, o] of map) {
      if (seen.has(`${kind}|${n}`)) continue
      if (kind === 'rls' && !o.enabled && !o.force) continue
      lines.push({ k: kind, n, state: 'fehlt auf Dev', dev: '', mig: migText(kind, o), file: o.file ?? '' })
    }
  }
  for (const p of PLATTFORMOBJEKTE) if (!seen.has(`${p.k}|${p.n}`)) lines.push({ k: p.k, n: p.n, state: 'fehlt auf Dev', dev: '', mig: p.def, file: 'Plattformobjekt' })
  return lines.sort((a, b) => `${a.k}|${a.n}`.localeCompare(`${b.k}|${b.n}`))
}
