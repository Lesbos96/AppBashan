# s9i-7c1 Teil D: Ablauftabelle (Endstand b8d05ef + Textänderung Abrechnung.tsx)

## Architektur
Keine Migration, keine Edge Function, kein Deploy. App ruft `public.my_commissions(p_month)` (0042, unverändert) mit Nutzer-JWT: `src/lib/partnerJournal.ts` (`loadJournalCsv`, `saveCsv`, `MONTH`), Seiten à 1000 mit `count: 'exact'`, `.order('created_at').order('entry_id')`, `.range`, 12 Spalten. Datei aus `supabase/functions/_shared/commission/csv.ts` (`journalCsv`, Alias `@commission`). UI: `src/screens/partner/Abrechnung.tsx` (Karte „Abrechnung“ in `src/screens/Partner.tsx`, hinter `MfaGate`, Firma `active` oder `payment_hold`).
Begründung: Rechte, Zeitraum und Spalten ohne Kundendaten liegen schon serverseitig an einer Stelle; ein zweiter Rechtepfad (Function/RPC) wäre mehr Angriffsfläche und kein Vorteil. Fable (tmp/proof/s9i-7c1-fable-plan.md, Entscheidung 1): ja.

## Spalten (Firmen-CSV)
Abrechnungsmonat · Buchungszeit (Wien) · Auftrag (`request_id`) · Art (deutsch + technisch) · Bezug (`reverses_entry_id`) · Betrag Kunde · Satz · Provision netto · USt. · Provision brutto · Auszahlung Firma · Journal-ID.
Weggelassen gegenüber Admin-Export: Partner-ID, Partner-Name, USt.-Regel, Auftragsstatus, Endzeitpunkt, und nicht einmal abgerufen (`select` nennt nur die 12 Spalten). Leistungsart und Nachtrags-ID fehlen (nicht im Typ `commission_row`, bräuchte SQL; OPEN_ISSUES).

## Zeilenarten
booking = Buchung · change = Nachtrag · cancellation = Storno-Gegenbuchung (Bezug = gegengebuchte Zeile, Vorzeichen negativ) · cancellation_fee = Stornopauschale · correction = Korrektur (Gegenbuchung). Eine Journalzeile = eine CSV-Zeile.

## Rechte-Matrix (serverseitig, `my_commissions`, unverändert; getestet in tests/rls/journal-live.test.ts)
| Aufrufer | Ergebnis |
|---|---|
| anon | 42501 (kein Execute) |
| Kunde (aal1) | `mfa_required` |
| Firma a, aal1 | `mfa_required` |
| Firma a, aal2 (active) | nur eigene Zeilen (partner_id = a, getestet) |
| Firma b, aal2 | 0 Zeilen von a |
| Firma pending / rejected / suspended, aal2 | kein Fehler, leer (keine Zeilen vorhanden) |
| fremde Firma wählen | nicht möglich, kein Parameter |
UI-Schranke zusätzlich: Karte nur bei Firmenstatus active/payment_hold (ACCESS bleibt unverändert; suspended sieht nichts im Portal, OPEN_ISSUES S9i7c1-3).

## Fehlerfälle (Client)
mfa_required, PGRST301/303, 42501 → `unauthorized` · not_found → `gone` · Code leer (Netz) bzw. geworfen → `offline` · Monat ungültig → `period` (neu) · unlesbare Zeile, count ≠ Zeilen, doppelte ID, fremder Monat → `unavailable`, keine Datei · leerer Zeitraum → Datei nur mit Kopfzeile.

## CSV-Regeln
UTF-8 BOM, `;`, CRLF, Kopfzeile immer; Quoting bei `; " CR LF`. Beträge nur aus sicheren Ganzzahlen/Ziffernketten über BigInt (`euro`), sonst `bad_row`; Satz nur `^(0(\.\d{1,5})?|1(\.0{1,5})?)$`; Art nur aus fester Tabelle; Zeit Europe/Vienna, ungültig → `bad_row`. Formelschutz `text()` mit `^\s*[=+\-@\t\r]` (Admin-Export erbt ihn). Betragsausnahme Variante A (Fable Entscheidung 3): Betragsspalten laufen nie durch `text()`.
