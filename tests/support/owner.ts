// Eigentümer-SQL gegen das verlinkte Dev-Projekt (supabase db query --linked, Werte per dotenv-cli aus npm run test:rls).
// Nur für Tests, die als Datenbank-Eigentümer laufen müssen: Rollen vergeben, Claims (aal) setzen, Rolle wechseln, TRUNCATE.
// Verändernde Prüfungen laufen in begin … rollback. Die CLI liefert nur das Ergebnis des letzten Statements mit Zeilen.
import { execFileSync } from 'node:child_process'

type Row = Record<string, unknown>

export function ownerSql(query: string): Row[] {
  let out: string
  try {
    out = execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'db', 'query', '--linked', query], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    out = (e as { stdout?: string }).stdout ?? ''
    if (!out) throw e
  }
  const json = JSON.parse(out) as { _tag?: string; error?: { message: string }; rows?: Row[] }
  if (json._tag === 'Error') throw new Error(json.error?.message ?? 'Eigentümer-SQL fehlgeschlagen')
  return json.rows ?? []
}

/** Meldung des Fehlers (Format „ERROR:  SQLSTATE: Meldung“) oder null, wenn die Abfrage gelang. */
export function ownerError(query: string): string | null {
  try {
    ownerSql(query)
    return null
  } catch (e) {
    return (e as Error).message
  }
}

/** Vergibt die Rolle über die einzige Funktion dafür (nur Eigentümer). */
export const ownerGrantRole = (userId: string, role: 'admin' | 'customer' | 'rental_provider' | 'partner') =>
  ownerSql(`select public.admin_grant_role('${userId}', '${role}')`)

/** Führt Abfragen als `authenticated` mit gesetzten JWT-Claims aus (aal1/aal2) und rollt danach zurück. */
export const asUser = (userId: string, aal: 'aal1' | 'aal2', query: string) =>
  ownerSql(
    `begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated","aal":"${aal}"}', true); ${query}; rollback;`,
  )

/** Führt Abfragen mit der Datenbankrolle `role` aus (z. B. service_role) und rollt danach zurück. */
export const asRole = (role: 'service_role' | 'authenticated' | 'anon', query: string) =>
  ownerSql(`begin; set local role ${role}; ${query}; rollback;`)

export type Step = {
  name: string
  /** SQL (plpgsql-Anweisungen); mit `?` am Anfang: boolescher Ausdruck, muss wahr sein („P0001: false“ bei falsch); mit `=`: Wert des Ausdrucks als Ergebnis („= 3“). */
  sql: string
  as?: 'owner' | 'service_role' | 'authenticated' | 'anon'
  /** Claims für `authenticated` (z. B. admin mit aal2). */
  claims?: { sub: string; aal: 'aal1' | 'aal2' }
}

const lit = (s: string) => `'${s.replaceAll("'", "''")}'`

/**
 * Führt `setup` als Eigentümer aus, danach jeden Schritt in eigenem Savepoint mit der gewünschten Rolle, und rollt alles zurück.
 * Ergebnis je Schritt: 'ok' oder 'SQLSTATE: Meldung'. Eine CLI-Abfrage statt einer je Prüfung.
 */
export function probes(setup: string, steps: Step[]): Record<string, string> {
  const body = steps
    .map((s) => {
      const role = s.as ?? 'owner'
      const prefix = [
        'reset role;',
        // Claims eines vorigen Schritts gelten sonst bis zum Ende der Transaktion weiter (auth.uid() des vorigen Kunden)
        "perform set_config('request.jwt.claims', '', true);",
        role === 'owner' ? '' : `set local role ${role};`,
        s.claims ? `perform set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: s.claims.sub, role: 'authenticated', aal: s.claims.aal }))}, true);` : '',
      ].join(' ')
      const isValue = s.sql.startsWith('=')
      const stmt = s.sql.startsWith('?')
        ? `if not coalesce((${s.sql.slice(1)}), false) then raise exception 'false'; end if;`
        : isValue
          ? `perform set_config('app.probe_val', coalesce((${s.sql.slice(1)})::text, '<null>'), true);`
          : `${s.sql};`
      const okValue = isValue ? `'= ' || current_setting('app.probe_val')` : `'ok'`
      return `begin ${prefix} ${stmt} reset role; insert into res values (${lit(s.name)}, ${okValue}); exception when others then reset role; insert into res values (${lit(s.name)}, sqlstate || ': ' || sqlerrm); end;`
    })
    .join('\n')
  const rows = ownerSql(`begin; ${setup}; create temp table res (k text, v text); do $p$ begin ${body} end $p$; select k, v from res; rollback;`)
  return Object.fromEntries(rows.map((r) => [String(r.k), String(r.v)]))
}
