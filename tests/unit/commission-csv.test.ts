// CSV-Export der Provisionszeilen (S9g, Konzept 5.8): Semikolon, Dezimalkomma, BOM, Formelschutz für Text.
import { describe, expect, it } from 'vitest'
import { commissionsCsv, type CommissionRow } from '../../supabase/functions/_shared/commission/csv.ts'

const row = (over: Partial<CommissionRow> = {}): CommissionRow => ({
  entry_id: 'e1',
  request_id: 'r1',
  partner_id: 'p1',
  partner_name: 'Testfirma GmbH',
  kind: 'booking',
  reverses_entry_id: null,
  created_at: '2026-09-30T22:00:00+00:00',
  total_cents: 68961,
  fee_rate: 0.15,
  fee_net_cents: 8620,
  fee_vat_cents: 1724,
  fee_cents: 10344,
  payout_cents: 58617,
  vat_rule: 'standard_20',
  request_status: 'completed',
  ended_at: '2026-09-30T23:30:00+00:00',
  billing_month: '2026-10-01',
  ...over,
})

const HEADER =
  'Abrechnungsmonat;Auftrag;Partner-ID;Partner;Art;Buchung;Gegenbuchung zu;Gebucht am;Gesamtpreis;Satz;Provision netto;USt.;Provision brutto;Auszahlung;USt.-Regel;Auftragsstatus;Endzeitpunkt'

describe('commissionsCsv', () => {
  it('BOM, Kopfzeile, CRLF; ohne Zeilen nur die Kopfzeile', () => {
    expect(commissionsCsv([])).toBe('\u{FEFF}' + HEADER + '\r\n')
  })

  it('Zeile: Monat als JJJJ-MM, Beträge in Euro mit Komma, Satz als Dezimalzahl, leere Felder bleiben leer', () => {
    const lines = commissionsCsv([row()]).split('\r\n')
    expect(lines[1]).toBe(
      '2026-10;r1;p1;Testfirma GmbH;booking;e1;;01.10.2026 00:00;689,61;0,15;86,20;17,24;103,44;586,17;standard_20;completed;01.10.2026 01:30',
    )
  })

  it('negative Beträge und Cent unter einem Euro', () => {
    const l = commissionsCsv([row({ kind: 'correction', reverses_entry_id: 'e0', total_cents: -68961, fee_cents: -5, fee_net_cents: -4, fee_vat_cents: -1, payout_cents: 7 })]).split('\r\n')[1]!
    expect(l).toContain(';-689,61;')
    expect(l).toContain(';-0,05;')
    expect(l).toContain(';0,07;')
    expect(l).toContain(';e0;')
  })

  it('Text mit Semikolon, Anführungszeichen oder Zeilenumbruch wird gequotet; Formelanfänge werden entschärft', () => {
    const csv = commissionsCsv([
      row({ partner_name: 'A;B' }),
      row({ partner_name: 'Say "hi"' }),
      row({ partner_name: '=HYPERLINK("x")' }),
      row({ partner_name: '+1' }),
      row({ partner_name: '@sum' }),
      row({ partner_name: '-2' }),
      row({ partner_name: 'a\nb' }),
    ])
    expect(csv).toContain(';"A;B";')
    expect(csv).toContain(';"Say ""hi""";')
    expect(csv).toContain(`;"'=HYPERLINK(""x"")";`)
    expect(csv).toContain(";'+1;")
    expect(csv).toContain(";'@sum;")
    expect(csv).toContain(";'-2;")
    expect(csv).toContain(';"a\nb";')
  })

  it('Beträge, die als Zeichenkette ankommen (bigint), werden wie Zahlen formatiert', () => {
    const l = commissionsCsv([row({ total_cents: '68961' as unknown as number, fee_rate: '0.15' as unknown as number })]).split('\r\n')[1]!
    expect(l).toContain(';689,61;0,15;')
  })
})
