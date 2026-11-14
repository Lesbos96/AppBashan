// CSV der Provisionszeilen (Konzept 5.8): Semikolon als Trenner, Dezimalkomma, UTF-8-BOM, CRLF, damit österreichisches Excel sie ohne Import öffnet.
// Gemeinsam für das Export-Skript (admin) und die Liste im Partner-Portal (S9i). Zeilen kommen aus export_commissions bzw. my_commissions.

export type CommissionRow = {
  entry_id: string
  request_id: string
  partner_id: string
  partner_name: string
  kind: string
  reverses_entry_id: string | null
  created_at: string
  total_cents: number
  fee_schedule: string
  fee_net_cents: number
  fee_vat_cents: number
  fee_cents: number
  payout_cents: number
  vat_rule: string
  request_status: string
  ended_at: string
  billing_month: string
}

const HEADER = [
  'Abrechnungsmonat', 'Auftrag', 'Partner-ID', 'Partner', 'Art', 'Buchung', 'Gegenbuchung zu', 'Gebucht am', 'Gesamtpreis', 'Staffel',
  'Provision netto', 'USt.', 'Provision brutto', 'Auszahlung', 'USt.-Regel', 'Auftragsstatus', 'Endzeitpunkt',
]

const BOM = '\u{FEFF}'

// Eine fehlerhafte Zeile ergibt nie eine halbe Datei: der Aufrufer bricht ab (App: Fehlerart `unavailable`)
const bad = (): never => {
  throw new Error('bad_row')
}

// Cent als Euro mit Komma, ohne Tausendertrenner (Excel rechnet damit). Nur sichere Ganzzahlen (Zahl oder bigint als Zeichenkette), sonst bad_row:
// kein Gleitkomma, und kein `Number('')` = 0. Der Wert entsteht ausschließlich hier aus Cent und wird nie als Text entschärft (Minus ASCII 0x2D, danach Ziffern).
const euro = (cents: unknown): string => {
  const ok = typeof cents === 'number' ? Number.isSafeInteger(cents) : typeof cents === 'string' && /^-?\d+$/.test(cents)
  if (!ok) return bad()
  const n = BigInt(cents as number | string)
  const abs = n < 0n ? -n : n
  return `${n < 0n ? '-' : ''}${abs / 100n},${String(abs % 100n).padStart(2, '0')}`
}

// Kennungen im Journal sind UUIDs aus der Datenbank, sonst bad_row
const uuid = (v: unknown): string => (typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : bad())

// Bezeichnung der Staffel-Version (Tabelle fee_schedules, nur per Migration gepflegt): Text, sonst bad_row
const staffel = (v: unknown): string => (typeof v === 'string' ? text(v) : bad())

// Zeitpunkte in Wiener Ortszeit „TT.MM.JJJJ HH:MM“ (wie der Abrechnungsmonat; Excel liest das als Datum)
const VIENNA = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const when = (iso: unknown): string => {
  // nur ISO-Zeitstempel als Zeichenkette (`new Date(null)` wäre 1970)
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(iso) || Number.isNaN(new Date(iso).getTime())) return bad()
  const p = Object.fromEntries(VIENNA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`
}

// Text: Formelanfänge entschärfen (Tabellenkalkulation führt „=…“, „+…“, „-…“, „@…“ aus, auch nach führenden Leerzeichen), dann bei Bedarf quoten
const text = (v: string | null): string => {
  if (v === null) return ''
  const safe = /^\s*[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

// Journal der Firma (s9i-7c1): eine Journalzeile = eine CSV-Zeile, nichts zusammengefasst, Gegenbuchungen mit Vorzeichen. Nur gespeicherte Werte, keine Summen,
// keine Kundendaten, keine Freitexte (Art ist ein fester Text, alles andere Zahl, Zeit oder ID).
export type JournalRow = Pick<
  CommissionRow,
  'entry_id' | 'request_id' | 'kind' | 'reverses_entry_id' | 'created_at' | 'total_cents' | 'fee_schedule' | 'fee_net_cents' | 'fee_vat_cents' | 'fee_cents' | 'payout_cents' | 'billing_month'
>

const JOURNAL_HEADER = [
  'Abrechnungsmonat', 'Buchungszeit', 'Auftrag', 'Art', 'Bezug', 'Betrag Kunde', 'Staffel', 'Provision netto', 'USt.', 'Provision brutto', 'Auszahlung Firma', 'Journal-ID',
]

const KIND: Record<string, string> = {
  booking: 'Buchung (booking)',
  change: 'Nachtrag (change)',
  cancellation: 'Storno-Gegenbuchung (cancellation)',
  cancellation_fee: 'Stornopauschale (cancellation_fee)',
  correction: 'Korrektur (correction)',
}

export function journalCsv(rows: JournalRow[]): string {
  const lines = rows.map((r) => {
    if (!Object.hasOwn(KIND, r.kind) || !/^\d{4}-\d{2}-\d{2}$/.test(r.billing_month)) return bad()
    return [
      r.billing_month.slice(0, 7), when(r.created_at), uuid(r.request_id), KIND[r.kind]!, r.reverses_entry_id === null ? '' : uuid(r.reverses_entry_id), euro(r.total_cents), staffel(r.fee_schedule),
      euro(r.fee_net_cents), euro(r.fee_vat_cents), euro(r.fee_cents), euro(r.payout_cents), uuid(r.entry_id),
    ].join(';')
  })
  return BOM + [JOURNAL_HEADER.join(';'), ...lines].map((l) => `${l}\r\n`).join('')
}

export function commissionsCsv(rows: CommissionRow[]): string {
  const lines = rows.map((r) =>
    [
      r.billing_month.slice(0, 7), r.request_id, r.partner_id, text(r.partner_name), r.kind, r.entry_id, r.reverses_entry_id ?? '', when(r.created_at),
      euro(r.total_cents), staffel(r.fee_schedule), euro(r.fee_net_cents), euro(r.fee_vat_cents), euro(r.fee_cents), euro(r.payout_cents),
      r.vat_rule, r.request_status, when(r.ended_at),
    ].join(';'),
  )
  return BOM + [HEADER.join(';'), ...lines].map((l) => `${l}\r\n`).join('')
}
