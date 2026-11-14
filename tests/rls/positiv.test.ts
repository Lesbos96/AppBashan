// Positivzeilen-Register (u3): jede öffentliche SQL-Funktion wird mit einem erlaubten Akteur in einem gültigen Zustand aufgerufen.
// Tabellenfunktionen müssen mindestens eine Zeile mit den registrierten Spaltentypen liefern, Wertfunktionen den registrierten Typ, void-Funktionen laufen ohne Fehler.
// Das Register steht in tests/support/positiv.ts (Daten, vom Unit-Test gegen die Typdatei abgeglichen). Alles läuft in Rollback-Proben (`probes`), es bleibt nichts zurück.
// Mocks und Datenbank stimmen so nur überein, wenn die Funktion wirklich eine Zeile liefert: der Fehler 0061 (`partner_accept_basis`) wäre hier rot gewesen.
import { describe, expect, it } from 'vitest'
import { splitChange, splitFee } from '@pricing'
import { currentFee } from '../support/fee.ts'
import { ownerSql, probes, type Step } from '../support/owner.ts'
import { AUSNAHMEN, REGISTER, SETUP, type Ctx, type Welt } from '../support/positiv.ts'

const fee = currentFee()
const rates = { tiers: fee.tiers, vatRate: fee.vr }
const s = splitFee(68961, rates)
const C: Ctx = {
  vr: fee.vr, fsv: fee.fsv, vrv: fee.vrv, s,
  offer: splitFee(150000, rates), change: splitChange(80000, rates, s),
  zero: { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 },
}

type Flach = {
  als: 'authenticated' | 'anon' | 'service_role' | 'owner'; user?: string; aal?: 'aal1' | 'aal2'
  welt: Welt; ausfuehren: string
  aufruf: (c: Ctx) => string; vorher?: (c: Ctx) => string; davor?: (c: Ctx) => string; gegen?: { user: string; aal: 'aal1' | 'aal2' }
  ergebnis: 'void' | 'zeilen' | 'wert'; spalten?: Record<string, string>; typ?: string
}
const EINTRAEGE = Object.entries(REGISTER) as unknown as [string, Flach][]

const TYPNAME = `case when t.typtype = 'e' then 'enum' else t.typname end`

/** Schritte eines Eintrags und die Prüfung seiner Ergebnisse; `i` macht Temp-Tabelle und Einstellung eindeutig. */
function schritte(fn: string, e: Flach, i: number): { steps: Step[]; fehler: (r: Record<string, string>) => string[] } {
  const call = e.aufruf(C)
  const davor = e.davor ? `${e.davor(C)};` : ''
  const claims = e.als === 'authenticated' ? { sub: e.user!, aal: e.aal! } : undefined
  const steps: Step[] = []
  if (e.vorher) steps.push({ name: `${fn}|vorher`, sql: e.vorher(C).replace(/;?\s*$/, '') })
  if (e.ergebnis === 'void') steps.push({ name: `${fn}|1`, as: e.als, claims, sql: `${davor} perform ${call}` })
  if (e.ergebnis === 'wert') {
    steps.push({ name: `${fn}|1`, as: e.als, claims, sql: `${davor} perform set_config('app.pos_${i}', (select ${TYPNAME} from pg_type t where t.oid = (select pg_typeof(s.v)::oid from (select ${call} as v offset 0) s)), true)` })
    steps.push({ name: `${fn}|2`, sql: `=current_setting('app.pos_${i}')` })
  }
  if (e.ergebnis === 'zeilen') {
    steps.push({ name: `${fn}|1`, as: e.als, claims, sql: `${davor} create temp table pos_${i} as select * from ${call}` })
    steps.push({
      name: `${fn}|2`,
      sql: `=(select (select count(*) from pg_temp.pos_${i})::text || '|' || string_agg(a.attname || ':' || ${TYPNAME}, ',' order by a.attnum) from pg_attribute a join pg_type t on t.oid = a.atttypid where a.attrelid = 'pg_temp.pos_${i}'::regclass and a.attnum > 0 and not a.attisdropped)`,
    })
  }
  if (e.gegen) steps.push({ name: `${fn}|gegen`, as: 'authenticated', claims: { sub: e.gegen.user, aal: e.gegen.aal }, sql: `=(select count(*) from ${call})` })

  const fehler = (r: Record<string, string>): string[] => {
    const out: string[] = []
    if (e.vorher && r[`${fn}|vorher`] !== 'ok') out.push(`${fn}: Vorbereitung ${r[`${fn}|vorher`]}`)
    const main = r[`${fn}|1`]
    if (main !== 'ok') out.push(`${fn}: Aufruf als ${e.als}${claims ? ` (${claims.aal})` : ''} ${main}`)
    else if (e.ergebnis === 'wert') {
      if (r[`${fn}|2`] !== `= ${e.typ}`) out.push(`${fn}: Typ ist ${r[`${fn}|2`]}, soll = ${e.typ}`)
    } else if (e.ergebnis === 'zeilen') {
      const m = /^= (\d+)\|(.*)$/.exec(r[`${fn}|2`] ?? '')
      if (!m) out.push(`${fn}: Ergebnis nicht lesbar: ${r[`${fn}|2`]}`)
      else {
        if (Number(m[1]) < 1) out.push(`${fn}: keine Zeile (Akteur ${e.als}, gültiger Zustand)`)
        const ist = Object.fromEntries(m[2]!.split(',').map((p) => p.split(':') as [string, string]))
        const einzeln = Object.keys(ist).length === 1 && Object.keys(ist)[0] === fn // `setof text`: Spaltenname ist der Funktionsname
        const soll = e.spalten!
        const gleich = einzeln ? Object.values(ist)[0] === Object.values(soll)[0] && Object.keys(soll).length === 1 : JSON.stringify(Object.entries(ist).sort()) === JSON.stringify(Object.entries(soll).sort())
        if (!gleich) out.push(`${fn}: Spalten ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`)
      }
    }
    if (e.gegen) {
      const g = r[`${fn}|gegen`] ?? ''
      if (/^= [1-9]/.test(g)) out.push(`${fn}: Konto ohne Firma und Auftrag bekommt Zeilen (${g})`)
    }
    return out
  }
  return { steps, fehler }
}

describe('Positivzeilen-Register', () => {
  for (const welt of ['angebot', 'auftrag', 'verwaltung', 'betrieb'] as const) {
    it(`Welt ${welt}: jede Funktion liefert mit erlaubtem Akteur`, () => {
      const lauf = EINTRAEGE.map(([fn, e], i) => ({ fn, e, i })).filter((x) => x.e.welt === welt).map((x) => ({ ...x, ...schritte(x.fn, x.e, x.i) }))
      const r = probes(SETUP[welt](C), lauf.flatMap((x) => x.steps))
      expect(lauf.flatMap((x) => x.fehler(r))).toEqual([])
    }, 600_000)
  }

  // Nur lesend (OFFEN u3-2): die Erweiterung ist auf Dev verfügbar, eingeschaltet wird sie in einer eigenen Migration. Der Lauf belegt die Version.
  it('plpgsql_check: auf Dev verfügbar (nur lesen, nichts eingeschaltet)', () => {
    const rows = ownerSql(`select name::text as name, default_version::text as v from pg_available_extensions where name = 'plpgsql_check'`)
    expect(rows).toEqual([{ name: 'plpgsql_check', v: expect.stringMatching(/^\d+\.\d+/) as string }])
  })

  it('Katalog: genau diese Funktionen und genau diese Rollen mit EXECUTE', () => {
    const rows = ownerSql(`select p.proname::text as n, (case when has_function_privilege('anon', p.oid, 'execute') then 'a' else '' end || case when has_function_privilege('authenticated', p.oid, 'execute') then 'u' else '' end
      || case when has_function_privilege('service_role', p.oid, 'execute') then 's' else '' end) as x
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') order by 1, 2`)
    const ist = new Map<string, string[]>()
    for (const r of rows) ist.set(String(r.n), [...(ist.get(String(r.n)) ?? []), String(r.x)])
    const soll = new Set([...Object.keys(REGISTER), ...Object.keys(AUSNAHMEN)])
    const fehler: string[] = []
    for (const n of ist.keys()) if (!soll.has(n)) fehler.push(`${n}: Funktion in der Datenbank ohne Eintrag`)
    for (const n of soll) if (!ist.has(n)) fehler.push(`${n}: Eintrag ohne Funktion in der Datenbank`)
    for (const [fn, e] of EINTRAEGE) {
      const x = ist.get(fn)
      if (!x) continue
      if (x.length !== 1) fehler.push(`${fn}: ${x.length} Überladungen, Register kennt eine`)
      else if (x[0] !== e.ausfuehren) fehler.push(`${fn}: EXECUTE für „${x[0]}“, Register sagt „${e.ausfuehren}“`)
      const rolle = { authenticated: 'u', anon: 'a', service_role: 's', owner: '' }[e.als]
      if (rolle && !e.ausfuehren.includes(rolle)) fehler.push(`${fn}: Akteur ${e.als} hat kein EXECUTE`)
      if (e.als === 'owner' && e.ausfuehren !== '') fehler.push(`${fn}: owner nur, wenn keine API-Rolle EXECUTE hat`)
    }
    expect(fehler).toEqual([])
  })
})
