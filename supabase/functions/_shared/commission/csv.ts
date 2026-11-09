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
  fee_rate: number
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
  'Abrechnungsmonat', 'Auftrag', 'Partner-ID', 'Partner', 'Art', 'Buchung', 'Gegenbuchung zu', 'Gebucht am', 'Gesamtpreis', 'Satz',
  'Provision netto', 'USt.', 'Provision brutto', 'Auszahlung', 'USt.-Regel', 'Auftragsstatus', 'Endzeitpunkt',
]

const BOM = '\u{FEFF}'

// Cent als Euro mit Komma, ohne Tausendertrenner (Excel rechnet damit); bigint kann als Zeichenkette ankommen
const euro = (cents: number | string): string => {
  const n = Number(cents)
  const abs = Math.abs(n)
  return `${n < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

// Zeitpunkte in Wiener Ortszeit „TT.MM.JJJJ HH:MM“ (wie der Abrechnungsmonat; Excel liest das als Datum)
const VIENNA = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const when = (iso: string): string => {
  const p = Object.fromEntries(VIENNA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`
}

// Text: Formelanfänge entschärfen (Tabellenkalkulation führt „=…“, „+…“, „-…“, „@…“ aus), dann bei Bedarf quoten
const text = (v: string | null): string => {
  if (v === null) return ''
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function commissionsCsv(rows: CommissionRow[]): string {
  const lines = rows.map((r) =>
    [
      r.billing_month.slice(0, 7), r.request_id, r.partner_id, text(r.partner_name), r.kind, r.entry_id, r.reverses_entry_id ?? '', when(r.created_at),
      euro(r.total_cents), String(r.fee_rate).replace('.', ','), euro(r.fee_net_cents), euro(r.fee_vat_cents), euro(r.fee_cents), euro(r.payout_cents),
      r.vat_rule, r.request_status, when(r.ended_at),
    ].join(';'),
  )
  return BOM + [HEADER.join(';'), ...lines].map((l) => `${l}\r\n`).join('')
}
