import { type JournalRow, journalCsv } from '@commission'
import { JobError, type JobErrorKind } from './jobs'
import { supabase } from './supabase'

/*
 * Journal der Firma als CSV (s9i-7c1). Die Zeilen liefert `my_commissions(p_month)` (Server: angemeldet, aal2, Mitglied, nur die eigene Firma, keine Kundendaten);
 * die Datei entsteht hier aus genau den gespeicherten Werten (`@commission`, dasselbe Modul wie der Admin-Export). Der Monat ist der Abrechnungsmonat des Servers.
 */

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
export const journalName = (month: string) => `movenow-journal-${month}.csv`

// Nur diese Spalten werden gelesen (Datensparsamkeit: kein Status, kein Firmenname, keine Firmen-ID)
const COLUMNS = 'entry_id, request_id, kind, reverses_entry_id, created_at, total_cents, fee_rate, fee_net_cents, fee_vat_cents, fee_cents, payout_cents, billing_month'
const PAGE = 1000 // max_rows von PostgREST

// Datenbankmeldungen von `my_commissions` und PostgREST-Codes → Fehlerart. Leerer Code = die Anfrage kam nie an (Netz).
const MESSAGES: Record<string, JobErrorKind> = { mfa_required: 'unauthorized', not_found: 'gone' }
const CODES: Record<string, JobErrorKind> = { PGRST301: 'unauthorized', PGRST303: 'unauthorized', '42501': 'unauthorized' }
const kindOf = (e: { code?: string; message?: string }): JobErrorKind =>
  (e.message && Object.hasOwn(MESSAGES, e.message) ? MESSAGES[e.message] : undefined) ?? (e.code && Object.hasOwn(CODES, e.code) ? CODES[e.code] : undefined) ?? (!e.code ? 'offline' : 'unavailable')

async function fetchRows(month: string): Promise<JournalRow[]> {
  const rows: JournalRow[] = []
  let total: number | null = null
  for (let from = 0; total === null || rows.length < total; from += PAGE) {
    // feste Sortierung am Aufruf: `.range` braucht sie, die Reihenfolge der Funktion ist nicht zugesichert
    const { data, error, count } = await supabase
      .rpc('my_commissions', { p_month: `${month}-01` }, { count: 'exact' })
      .select(COLUMNS)
      .order('created_at')
      .order('entry_id')
      .range(from, from + PAGE - 1)
    if (error) throw new JobError(kindOf(error))
    if (!Array.isArray(data) || !Number.isSafeInteger(count)) throw new JobError('unavailable')
    total = count
    rows.push(...(data as unknown as JournalRow[]))
    if (data.length < PAGE) break
  }
  // Vollständigkeit: genau so viele Zeilen wie der Server zählt
  if (rows.length !== total) throw new JobError('unavailable')
  return rows
}

/** Lädt das Journal des Monats (`JJJJ-MM`) und erzeugt Dateiname und Inhalt; nie eine halbe Datei. */
export async function loadJournalCsv(month: string): Promise<{ name: string; csv: string }> {
  if (!MONTH.test(month)) throw new JobError('period')
  try {
    const rows = await fetchRows(month)
    // Vollständigkeit: Zeilenzahl = Gesamtzahl, jede Journal-ID einmal, jede Zeile im gewählten Monat
    const ids = new Set(rows.map((r) => r.entry_id))
    if (ids.size !== rows.length || rows.some((r) => r.billing_month !== `${month}-01`)) throw new JobError('unavailable')
    return { name: journalName(month), csv: journalCsv(rows) }
  } catch (e) {
    if (e instanceof JobError) throw e
    // `bad_row` aus dem Modul (unlesbare Zeile) ist ein Serverproblem, alles andere geworfene ein Netzfehler
    throw new JobError(e instanceof Error && e.message === 'bad_row' ? 'unavailable' : 'offline')
  }
}

/** Übergabe an den Browser (Blob und Anker mit `download`). Nativ (Capacitor) wird nur diese Funktion getauscht. */
export function saveCsv(name: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
