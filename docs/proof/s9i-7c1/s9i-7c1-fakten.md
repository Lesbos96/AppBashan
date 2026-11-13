# s9i-7c1 Fakten (Kennung 7c1-1311-a), Stand 711ffe6, selbst gelesen

## C. Gebühr/Provision in den Partner-Ansichten
| Ansicht | Datei:Zeile | Text | Wert |
|---|---|---|---|
| Festangebot bestätigen (Anfragen) | src/screens/partner/Anfragen.tsx:232-233 | „Dein Angebot“ / „Du erhältst voraussichtlich“ | Angebot / `payoutCents(cents, rates)` (Satz aus `current_fee_rates`); **keine Gebührenzeile** |
| Offene Anfrage (Liste) | src/screens/partner/Anfragen.tsx:101 | Auszahlung | `payoutCents`; keine Gebührenzeile |
| Angenommen / Aufträge | src/screens/partner/Auftraege.tsx:214-215 | „Preis für den Kunden“ bzw. „Pauschale“ / „Du erhältst“ | `j.totalCents`, `j.payoutCents` aus `my_jobs()` (Journal); **keine Gebührenzeile** |
| Absage-Maske mit Pauschale | src/screens/partner/Absage.tsx:230-233 | „Pauschale inkl. USt.“ / **„Gebühr“** / „Du erhältst“ | `callOutCents` / `callOutCents - payoutCents` / `payoutCents` (nur `cancel-partner`, Zuordnung + aal2) |
| Absage-Karte beim Kunden | src/screens/auftrag/Absage.tsx:27 | Pauschale | nur Pauschale, nie Gebühr |
| Partner-Absage-Karte (Aufträge) | Auftraege.tsx:211-214 | „Pauschale“ / „Du erhältst“ | keine Gebühr |
CLAUDE.md (Geld) nennt als Anzeigeorte: Vermieter-Abrechnung, Rechnung, Auszahlungsübersicht des Partner-Portals (sobald freigegeben). Die Absage-Maske zeigt also als einzige Partner-Ansicht eine „Gebühr“-Zeile. Das Journal-CSV (D) zeigt je Zeile Provision netto/USt./brutto der eigenen Firma und wäre ein weiterer Anzeigeort (Journal = Abrechnungsunterlage der Firma, Konzept 5.8).
Optionen für Beks:
1. Behalten: CLAUDE.md-Liste um „Absage-Maske der Firma“ und „Journal-CSV der Firma“ ergänzen. Folge: Firma sieht beim Absagen sofort, wie die Pauschale verteilt wird (Transparenz, P2B); eine Anzeigestelle mehr, bei Satzänderung geprüft werden muss. Kein Kundenleck (Zahl nur mit Zuordnung + aal2).
2. Entfernen: Zeile „Gebühr“ streichen (Pauschale und „Du erhältst“ genügen); die Liste in CLAUDE.md bleibt. Folge: Firma sieht die Gebühr nur im Journal-CSV bzw. der späteren Auszahlungsübersicht; die Rechnung „Pauschale − Du erhältst“ bleibt ableitbar.
Empfehlung: Option 1 (Differenz ist ohnehin aus den zwei anderen Zeilen ablesbar, Firma sieht Gebühr nach Gebührensatz-Lesen sowieso).

`CLAUDE_ALL`: kommt in keiner Datei (docs, tests, src) vor; `CLAIM_ALL` steht in OPEN_ISSUES (2) und tests/rls/job-photos.test.ts. Nichts zu korrigieren.

## D. Journal und Rechte
- Tabelle `public.commission_entries`: supabase/migrations/20261108110000_0028_commission_journal.sql:11-40. Arten `commission_kind`: `booking, change, cancellation, cancellation_fee, correction` (:9). `cancellation` und `correction` haben `reverses_entry_id` (:34), höchstens eine Gegenbuchung je Zeile (:43), nur anfügen (append_only :47). Spalten: total/fee/fee_net/fee_vat/payout_cents (bigint), fee_rate, vat_rule, created_at. **Keine Kundendaten, keine Freitexte.**
- `private.commission_rows(p_partner, p_month)`: 20261109140000_0042_completion.sql:100-117. Abrechnungsmonat = Monat (Europe/Vienna) von max(erster Endstatus, created_at der Zeile); Aufträge ohne Endstatus erscheinen noch nicht (Join auf `d.ended_at is not null`). Reihenfolge `created_at, id`. Rückgabe-Typ `commission_row` (:79-97): entry_id, request_id, partner_id, partner_name, kind, reverses_entry_id, created_at, total/fee_rate/fee_net/fee_vat/fee/payout, vat_rule, request_status, ended_at, billing_month.
- `public.my_commissions(p_month date default null)`: 0042:133-145. security definer, `search_path=''`, stable. Prüft: angemeldet (sonst `not_found`), JWT-`aal` = `aal2` (sonst `mfa_required`), `private.my_member_partner_id()` (Mitglied **jeder** Firmenstatus, aal2; 0023:81-86; sonst `not_found`). Filtert nach der eigenen Firma. Grants: authenticated (:149-150), nicht anon. Live-/rls-Tests existieren: tests/rls/completion.test.ts:224-228 (Dubletten, aal1, Kunde ohne Firma, anon).
- Funktionsinventur: tests/rls/rls.test.ts:458 `my_commissions(date)`.
- CSV-Modul: supabase/functions/_shared/commission/csv.ts (61 Zeilen): `commissionsCsv(rows)` für das Admin-Skript scripts/export-commissions.mjs (:7, :28); BOM, `;`, CRLF, Beträge `euro()` aus Integer-Cent (:32-36), Zeit `when()` Europe/Vienna „TT.MM.JJJJ HH:MM“ (:39-43), Text-Entschärfung `text()` (:46-50, Regex `^[=+\-@\t\r]`, **keine führenden Leerzeichen**), Unit-Test tests/unit/commission-csv.test.ts. Nicht in `src` benutzt.
- Partner-App: **keine** Provisions-/Journalansicht (src enthält `my_commissions` nirgends). Partner.tsx:69-80 (Karte „Status“, dahinter `MfaGate` → Anfragen, PartnerAuftraege, Dokumente). Aufträge: `my_jobs()` liefert `request_id`; Auftragskarte zeigt keine sichtbare Nummer (Auftraege.tsx), der Auftrag hat nur `requestId` (UUID) als Kennung (partnerJobs.ts:260-285).
- `src/lib/jobs.ts`: `JobErrorKind` (:6), `jobErrorText` (:43), `asKind`, `invoke`. tsconfig `include` nimmt `supabase/functions/_shared/pricing|route|quote|http.ts`, nicht `commission` (tsconfig.json:25); Alias `@pricing` (tsconfig.json:20, vite.config.ts:15).
- PostgREST kürzt auf max_rows 1000 (Skript pagt mit `.range`, export-commissions.mjs:15-26).
