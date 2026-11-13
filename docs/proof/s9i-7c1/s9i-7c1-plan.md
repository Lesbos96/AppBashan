# Plan D: Journal-CSV der Firma (s9i-7c1, Entwurf zur Prüfung durch Fable)

Fakten: `tmp/proof/s9i-7c1-fakten.md` (Abschnitt D; Dateien und Zeilen dort). Lies zusätzlich selbst: `supabase/migrations/20261109140000_0042_completion.sql` (:77-152), `supabase/migrations/20261108110000_0028_commission_journal.sql` (:9-50), `supabase/functions/_shared/commission/csv.ts`, `tests/unit/commission-csv.test.ts`, `tests/rls/completion.test.ts` (:178-230).

## 1. Architektur (Vorschlag: KEINE Migration, KEINE Edge Function)
`public.my_commissions(p_month date)` (0042) liefert heute schon genau die Zeilen der eigenen Firma mit den Regeln des Auftrags (angemeldet, aal2, Mitglied jeder Firmenstatus, nur eigene Firma, keine Kundendaten, alle fünf Arten, Gegenbuchungen mit Vorzeichen, Zeitraum = Abrechnungsmonat Europe/Vienna wie im Admin-Export). Die App ruft die Funktion mit dem Nutzer-JWT, holt seitenweise (`.range`, max_rows 1000, stabile Reihenfolge `created_at, id`), erzeugt die CSV im Browser mit dem vorhandenen Modul `_shared/commission/csv.ts` (neue Funktion `journalCsv`) und bietet sie per Blob-Download an. Begründung: kein neuer Rechtepfad, kein neues SQL, kein Deploy; Rechte und Zeitraum bleiben an einer Stelle (`private.commission_rows`). Gegenvorschlag, falls du Bedenken hast: neue RPC/Edge Function (dann bitte begründen).
Nicht-Ziele: Leistungsart-Spalte (`commission_row` hat keinen Service; bräuchte neues SQL oder Join mit `my_jobs`), Nachtrags-ID (`revision_id` steht nicht im Typ).
Offen für dich: Blob-Download funktioniert im Browser/PWA, in einer Capacitor-WebView (später) nicht ohne Share/Filesystem-Plugin. Vorschlag: jetzt nur Web, GOLIVE-/OPEN_ISSUES-Eintrag für nativ. Einverstanden?

## 2. Spalten der Firmen-CSV (Reihenfolge)
1 Abrechnungsmonat (`billing_month`, JJJJ-MM) · 2 Buchungszeit (`created_at`, Wiener Zeit TT.MM.JJJJ HH:MM) · 3 Auftrag (`request_id`, UUID; das ist die Kennung, die die Firma über `my_jobs()` als `requestId` kennt; die Auftragskarte zeigt keine sichtbare Nummer) · 4 Art (deutsch + technisch, z. B. `Buchung (booking)`) · 5 Bezug (`reverses_entry_id` = Journal-ID der gegengebuchten Zeile, sonst leer) · 6 Betrag Kunde (`total_cents`) · 7 Satz (`fee_rate`, Dezimalkomma) · 8 Provision netto · 9 USt. · 10 Provision brutto (`fee_cents`) · 11 Auszahlung Firma (`payout_cents`) · 12 Journal-ID (`entry_id`).
Weggelassen gegenüber dem Admin-Export: Partner-ID, Partner-Name, USt.-Regel, Auftragsstatus, Endzeitpunkt (der Status ist keine Journalinformation; `ended_at` kann Kundenverhalten andeuten, bitte prüfen).
Art-Bezeichnungen: booking = „Buchung“, change = „Nachtrag“, cancellation = „Storno-Gegenbuchung“, cancellation_fee = „Stornopauschale“, correction = „Korrektur“.

## 3. Zeilenarten (Beispiele in Cent, Satz 15 %, nach Prototyp-Rundung: fee = round(total × 0,15), netto = round(fee / 1,2), USt. = fee − netto, Auszahlung = total − fee)
- Normal: booking, total 6900, fee 1035 (netto 863, USt. 172), payout 5865.
- Nachtrag +2000: change, total 2000, fee 300 (netto 250, USt. 50), payout 1700; Summe je Auftrag 8900 / 1335 / 7565.
- Storno ohne Pauschale: cancellation reverses booking: total −6900, fee −1035, netto −863, USt. −172, payout −5865 (und eine zweite cancellation für den Nachtrag, falls angenommen) → Summe je Auftrag 0.
- Storno mit Pauschale 6900: Gegenbuchung(en) wie oben, dazu cancellation_fee total 6900 / fee 1035 / payout 5865 → Summe = cancellation_fee-Zeile.
- correction: Gegenbuchung mit `reverses_entry_id`, Vorzeichen wie die gegengebuchte Zeile umgekehrt.

## 4. Rechte-Matrix (alles serverseitig durch `my_commissions`, unverändert)
Nicht angemeldet → `not_found` (HTTP 4xx der RPC) · aal1 → `mfa_required` · aal2 Nutzer ohne Firma → `not_found` · aal2 Mitglied Firma A: nur Zeilen von A, jeder Firmenstatus (pending, active, payment_hold, rejected, suspended) · anon → kein Execute-Recht. „Fremde Firma“ ist nicht wählbar (kein Parameter).
UI-Schranke zusätzlich: nur wo `MfaGate` offen ist und Firmenstatus `pending|active|payment_hold` (Partner.tsx:69).

## 5. CSV-Regeln
UTF-8 mit BOM, `;`, CRLF nach jeder Zeile inkl. letzter, Kopfzeile immer (leerer Zeitraum = nur Kopfzeile). Felder mit `;`, `"`, CR, LF in Anführungszeichen, `"` verdoppelt. Beträge aus Integer-Cent ohne Gleitkomma: `euro()` (Dezimalkomma, zwei Stellen, kein Tausendertrenner, Minus vorn; 6900 → 69,00 · −1035 → −10,35 · 5 → 0,05 · 0 → 0,00). Neu: Wert muss eine sichere Ganzzahl sein (bigint kommt als Zahl oder Zeichenkette), sonst Fehler `bad_row` statt „NaN“. Zeit mit `Intl.DateTimeFormat` Europe/Vienna; Tests über beide Zeitumstellungen (2026-03-29 und 2026-10-25).
Injection: `text()` entschärft jetzt `^[=+\-@\t\r]`; neu `^\s*[=+\-@\t\r]` (auch nach führenden Leerzeichen), Präfix `'` vor den Originaltext. Beträge laufen NIE durch `text()`; sie entstehen nur aus Integer-Cent in `euro()` und beginnen höchstens mit „−“ gefolgt von Ziffern. Das ist die Betragsausnahme: Variante A (Vorschlag, strukturell): Betragsspalten gehen nicht durch `text()`, weil der Wert aus einer Ganzzahl formatiert wird; Variante B (Regex-Whitelist `^-?\d+,\d{2}$` nach dem Formatieren). Bitte entscheide A oder B und begründe.
Freitexte kommen in der Firmen-CSV nicht vor (Art-Bezeichnungen sind feste Texte, IDs sind UUIDs aus der DB, Zeit/Beträge werden formatiert); `text()` bleibt für jedes Textfeld im Pfad (Art, Bezug, IDs) als Schutz davor.

## 6. Fehlerfälle (Client)
nicht angemeldet / aal1 (`mfa_required`, `not_found` ohne Sitzung) → `unauthorized`; Nutzer ohne Firma (`not_found`) → `gone`; Zeitraum nicht `JJJJ-MM` mit Monat 01–12 (Client-Prüfung vor dem Aufruf) → neue Art `period`; Netzfehler → `offline`; alles andere → `unavailable`; unlesbare Zeile → `unavailable` (nie eine halbe Datei). Leerer Zeitraum: Datei nur mit Kopfzeile (kein Fehler). Texte in `jobErrorText`, Test `tests/unit/jobs-client.test.ts` pflegen.

## 7. UI
Neue Karte „Abrechnung“ im Partner-Portal (hinter `MfaGate`, unter den Aufträgen, für `active`, `payment_hold`, `pending`; Monatsfeld nativ `<input type="month">` mit Label, Standard = aktueller Monat Wiener Zeit; Knopf „Journal herunterladen“ mit Ladezustand, Doppelklick = genau ein Aufruf (Sperre in der Komponente, bis die Anfrage fertig ist), Fehlertext als `role="alert"`). Dateiname `movenow-journal-<JJJJ-MM>.csv`. Download per `Blob` + `a[download]`, Objekt-URL danach freigeben. Es gibt kein Provisions-/Journalansicht in der App bisher; die Karte ist die Ansicht.

## 8. Tests (zuerst rot)
Unit: `journalCsv` (Spalten, Beispielzeilen aus 3., Quoting, BOM, CRLF, leerer Zeitraum, Beträge 6900/−1035/5/0, Zeitumstellung, Injection =SUMME(A1), +1, −1 als Text, @cmd, Tab, CR, führende Leerzeichen, Betragsausnahme), Monatsprüfung, Fehlerzuordnung. rls/Live (echte aal2-Tokens, Muster `partner-functions-live.test.ts`): Rechte-Matrix, eigene vs. fremde Firma, `commission_row`-Spaltenliste = erwartete Whitelist (keine Kundendatenspalten), nach Storno ohne Pauschale ist die Summe je Auftrag 0. e2e: Download-Ereignis, Dateiinhalt, Doppelklick = ein Aufruf, Fehlerfälle (aal1, Netz, leerer Zeitraum).

## Fragen an Fable
1. Ist „keine Migration, Client-CSV aus `my_commissions`“ sicher und einfach genug, oder verlangst du eine RPC/Edge Function (Gründe)?
2. Spaltenliste (Abschnitt 2): zu viel, zu wenig, personenbezogen (z. B. `ended_at`, `request_id`)? Ist die UUID als Auftragskennung vertretbar?
3. Betragsausnahme A oder B? Whitespace-Erweiterung von `text()` (auch Admin-Export betroffen) ok?
4. Capacitor/Blob: Web-only jetzt vertretbar?
5. Abrechnungsmonat (nicht `created_at`-Kalendermonat) als Zeitraum ok? Gegenbuchungen im Folgemonat erscheinen im Monat der Buchung.
6. Weitere Risiken (Geld, Rechte, Personendaten, Rundung, Satzanzeige) und konkrete Auflagen.
