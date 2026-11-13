// Journal-CSV der Firma (s9i-7c1): Spalten, Quoting, Beträge aus Integer-Cent, Wiener Zeit über beide Zeitumstellungen, Formelschutz.
import { describe, expect, it } from 'vitest'
import { commissionsCsv, journalCsv, type CommissionRow, type JournalRow } from '../../supabase/functions/_shared/commission/csv.ts'

const REQ = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const E1 = '11111111-1111-4111-8111-111111111111'
const E2 = '22222222-2222-4222-8222-222222222222'

// 6.900 ct, Satz 15 %: Gebühr 1.035 (netto 863, USt. 172), Auszahlung 5.865
const row = (over: Partial<JournalRow> = {}): JournalRow => ({
  entry_id: E1,
  request_id: REQ,
  kind: 'booking',
  reverses_entry_id: null,
  created_at: '2026-10-05T08:30:00+00:00',
  total_cents: 6900,
  fee_rate: 0.15,
  fee_net_cents: 863,
  fee_vat_cents: 172,
  fee_cents: 1035,
  payout_cents: 5865,
  billing_month: '2026-10-01',
  ...over,
})

const HEADER = 'Abrechnungsmonat;Buchungszeit;Auftrag;Art;Bezug;Betrag Kunde;Satz;Provision netto;USt.;Provision brutto;Auszahlung Firma;Journal-ID'
const lines = (rows: JournalRow[]) => journalCsv(rows).split('\r\n')
const cells = (r: JournalRow) => lines([r])[1]!.split(';')

describe('journalCsv: Format', () => {
  it('ohne Zeilen nur BOM und Kopfzeile, CRLF', () => {
    expect(journalCsv([])).toBe('\u{FEFF}' + HEADER + '\r\n')
  })

  it('Buchung: Monat, Wiener Zeit, Auftrag, Art deutsch und technisch, Beträge mit Komma, Satz mit Komma', () => {
    expect(lines([row()])[1]).toBe(`2026-10;05.10.2026 10:30;${REQ};Buchung (booking);;69,00;0,15;8,63;1,72;10,35;58,65;${E1}`)
  })

  it('jede Zeile endet mit CRLF, jede Journalzeile ergibt genau eine CSV-Zeile (nichts zusammengefasst)', () => {
    const csv = journalCsv([row(), row({ entry_id: E2 }), row({ entry_id: E1 })])
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(5) // Kopf + 3 + leerer Rest nach dem letzten CRLF
  })

  it('Gegenbuchung mit Vorzeichen und Bezug auf die gegengebuchte Zeile; Storno ohne Pauschale ergibt Summe 0', () => {
    const rows = [
      row(),
      row({ entry_id: E2, kind: 'cancellation', reverses_entry_id: E1, total_cents: -6900, fee_cents: -1035, fee_net_cents: -863, fee_vat_cents: -172, payout_cents: -5865 }),
    ]
    const l = lines(rows)
    expect(l[2]).toBe(`2026-10;05.10.2026 10:30;${REQ};Storno-Gegenbuchung (cancellation);${E1};-69,00;0,15;-8,63;-1,72;-10,35;-58,65;${E2}`)
    const sum = (i: number) => rows.reduce((a, r) => a + [r.total_cents, r.fee_rate, r.fee_net_cents, r.fee_vat_cents, r.fee_cents, r.payout_cents][i]!, 0)
    expect([0, 2, 3, 4, 5].map(sum)).toEqual([0, 0, 0, 0, 0])
  })

  it('Stornopauschale und Nachtrag und Korrektur haben ihre Bezeichnung', () => {
    const art = (kind: string) => cells(row({ kind: kind as JournalRow['kind'], reverses_entry_id: kind === 'correction' ? E2 : null }))[3]
    expect(art('change')).toBe('Nachtrag (change)')
    expect(art('cancellation_fee')).toBe('Stornopauschale (cancellation_fee)')
    expect(art('correction')).toBe('Korrektur (correction)')
  })

  it('keine Spalte mit Kundendaten, Firmenname, Partner-ID oder Status', () => {
    expect(journalCsv([]).split('\r\n')[0]).not.toMatch(/Partner|Status|Name|Adresse|Telefon|Mail|Endzeit/)
  })
})

describe('journalCsv: Beträge aus Integer-Cent', () => {
  it.each([
    [6900, '69,00'],
    [-1035, '-10,35'],
    [5, '0,05'],
    [0, '0,00'],
    [-5, '-0,05'],
    [123456789, '1234567,89'],
  ])('%i ct → %s', (cents, text) => {
    expect(cells(row({ total_cents: cents }))[5]).toBe(text)
  })

  it('Minus ist ASCII 0x2D, jede Betragsspalte passt auf ^-?\\d+,\\d{2}$', () => {
    const c = cells(row({ total_cents: -6900, fee_net_cents: -863, fee_vat_cents: -172, fee_cents: -1035, payout_cents: -5865 }))
    for (const i of [5, 7, 8, 9, 10]) expect(c[i]).toMatch(/^-?\d+,\d{2}$/)
    expect(c[5]!.charCodeAt(0)).toBe(0x2d)
  })

  it('bigint als Zeichenkette ist erlaubt', () => {
    expect(cells(row({ total_cents: '6900' as unknown as number }))[5]).toBe('69,00')
  })

  it.each([
    ['leere Zeichenkette', ''],
    ['null', null],
    ['undefined', undefined],
    ['Kommazahl', 1.5],
    ['NaN', Number.NaN],
    ['Unendlich', Number.POSITIVE_INFINITY],
    ['zu groß für eine sichere Ganzzahl', 2 ** 60],
    ['Exponent', '1e3'],
    ['Dezimalpunkt', '12.5'],
    ['Text', 'abc'],
    ['Leerzeichen', ' 5'],
    ['Formel', '=1+1'],
  ])('Betrag %s ist bad_row', (_n, v) => {
    for (const col of ['total_cents', 'fee_net_cents', 'fee_vat_cents', 'fee_cents', 'payout_cents'] as const) {
      expect(() => journalCsv([row({ [col]: v as never })])).toThrow('bad_row')
    }
  })

  it.each([
    [0.15, '0,15'],
    [0, '0'],
    [1, '1'],
    ['0.15000', '0,15000'],
    [0.2, '0,2'],
  ])('Satz %s → %s', (rate, text) => {
    expect(cells(row({ fee_rate: rate as number }))[6]).toBe(text)
  })

  it.each([['leer', ''], ['null', null], ['1,5', 1.5], ['negativ', -0.1], ['Exponent', 1e-7], ['NaN', Number.NaN], ['Text', 'x']])('Satz %s ist bad_row', (_n, v) => {
    expect(() => journalCsv([row({ fee_rate: v as never })])).toThrow('bad_row')
  })

  it('unbekannte Art ist bad_row', () => {
    expect(() => journalCsv([row({ kind: 'refund' as never })])).toThrow('bad_row')
  })
})

describe('journalCsv: Wiener Zeit über die Zeitumstellungen', () => {
  const at = (iso: string) => cells(row({ created_at: iso }))[1]
  it('Sommerzeit-Beginn (letzter Sonntag im März, 2026-03-29, 01:00 UTC)', () => {
    expect(at('2026-03-28T23:30:00+00:00')).toBe('29.03.2026 00:30')
    expect(at('2026-03-29T00:59:00+00:00')).toBe('29.03.2026 01:59')
    expect(at('2026-03-29T01:00:00+00:00')).toBe('29.03.2026 03:00')
    expect(at('2026-03-29T22:30:00+00:00')).toBe('30.03.2026 00:30')
  })
  it('Winterzeit-Beginn (letzter Sonntag im Oktober, 2026-10-25, 01:00 UTC)', () => {
    expect(at('2026-10-24T22:30:00+00:00')).toBe('25.10.2026 00:30')
    expect(at('2026-10-25T00:30:00+00:00')).toBe('25.10.2026 02:30')
    expect(at('2026-10-25T01:30:00+00:00')).toBe('25.10.2026 02:30')
    expect(at('2026-10-25T02:30:00+00:00')).toBe('25.10.2026 03:30')
  })
  it('Tageswechsel um Mitternacht Wiener Zeit', () => {
    expect(at('2026-12-31T22:59:00+00:00')).toBe('31.12.2026 23:59')
    expect(at('2026-12-31T23:00:00+00:00')).toBe('01.01.2027 00:00')
  })
})

describe('journalCsv: Quoting und Formelschutz (Textfelder)', () => {
  const id = (v: string) => lines([row({ request_id: v })])[1]!
  it('Semikolon, Anführungszeichen, CR und LF: Anführungszeichen, " verdoppelt', () => {
    expect(id('a;b')).toContain(';"a;b";')
    expect(id('say "hi"')).toContain(';"say ""hi""";')
    expect(id('a\nb')).toContain(';"a\nb";')
    expect(id('a\rb')).toContain(';"a\rb";')
  })
  it.each([
    ['=SUMME(A1)', "'=SUMME(A1)"],
    ['+1', "'+1"],
    ['-1', "'-1"],
    ['@cmd', "'@cmd"],
    ['\tx', "'\tx"],
    ['  =1+1', "'  =1+1"],
    [' -2', "' -2"],
  ])('Textfeld %j wird zu %j entschärft', (input, out) => {
    expect(id(input)).toContain(`;${out};`)
  })
  it('Formel mit Anführungszeichen wird erst entschärft, dann gequotet', () => {
    expect(id('=HYPERLINK("x")')).toContain(`;"'=HYPERLINK(""x"")";`)
  })
  it('Beträge werden nie entschärft: negative Beträge bleiben ohne Apostroph', () => {
    const l = lines([row({ total_cents: -6900, fee_cents: -1035, fee_net_cents: -863, fee_vat_cents: -172, payout_cents: -5865 })])[1]!
    expect(l).not.toContain("'")
    expect(l).toContain(';-69,00;')
  })
})

describe('commissionsCsv (Admin): Formelschutz auch nach führenden Leerzeichen', () => {
  const base: CommissionRow = {
    entry_id: 'e1', request_id: 'r1', partner_id: 'p1', partner_name: 'x', kind: 'booking', reverses_entry_id: null, created_at: '2026-09-30T22:00:00+00:00', total_cents: 100,
    fee_rate: 0.15, fee_net_cents: 12, fee_vat_cents: 3, fee_cents: 15, payout_cents: 85, vat_rule: 'standard_20', request_status: 'completed', ended_at: '2026-09-30T23:30:00+00:00', billing_month: '2026-10-01',
  }
  it('führende Leerzeichen vor = werden entschärft', () => {
    expect(commissionsCsv([{ ...base, partner_name: '  =1+1' }])).toContain(";'  =1+1;")
  })
})
