Modell: claude-fable-5-2

# s9p-1 Abnahme Provisionsstaffel (Kennung p1-1411-b)

- Datum: 2026-11-14, Branch `s9p-1`, HEAD laut Auftrag 7f541ac (nicht selbst geprüft, kein Shell-Werkzeug; `git diff --stat` daher nicht ausgeführt, geprüft sind die genannten Dateien im Arbeitsbaum).
- Vollständig gelesen: `supabase/migrations/20261114100000_0062_fee_schedule.sql` (1056 Zeilen), `supabase/functions/_shared/pricing/fee.ts`, `change.ts`, `_shared/jobs/db.ts`, `jobs/handlers.ts`, `cancel/db.ts`, `cancel/handlers.ts`, `cancel/partner.ts`, `change/db.ts`, `change/handlers.ts`, `admin/db.ts`, `admin/correct.ts`, `commission/csv.ts`, `src/lib/partnerJobs.ts`, `src/lib/partnerJournal.ts`, `tests/rls/fee-schedule.test.ts`, `tests/support/fee.ts`, `tests/rls/journal.test.ts`, `tests/unit/fee-staffel.test.ts`, `tests/rls/partner-fee-read.test.ts`.
- In Ausschnitten: `src/screens/partner/Anfragen.tsx:85-259`, `tests/rls/change-orders.test.ts:1-80, 200-421`, `tests/rls/offers.test.ts` (Suche), `tests/rls/partner-mfa.test.ts:38-63`, `tests/rls/journal-live.test.ts` (Suche), `tests/e2e/backend.ts:88-99`, `tests/e2e/jobs-helpers.ts` (Suche), `scripts/scan-dist.mjs` (Suche), Migrationen 0015, 0023, 0027, 0028, 0038, 0039, 0040, 0047, `docs/PROGRESS.md:6-10`.
- Belege gelesen: `s9p-1-ursache-journal.md`, `-ursache-change.md`, `-deploy-2.log`, `-flow-ist-1.txt`, `-flow-ist-2.txt`, `-bild-1.md`, `-bild-2.md`, `-bild-3.md`, `-journal-zaehlung-1.log`, `-fable-plan.md`, `-fable-plan-2.md`, `-rot-1.log`, `-rot-2.log`; nach Fehlern durchsucht: `-rls-1.log`, `-check-1.log`, `-gezielt-3/4/5.log`, `-gruen-1.log`, `-unit-ziel-1.log`, `-push-1.log`, `-push-vorher-1.log`.
- Nicht geprüft: e2e-Specs, UI außerhalb der Geldzeilen, Doku. Den SHA-256 der Migration habe ich nicht nachgerechnet.
- In meiner Tool-Liste steht ein eingebautes advisor-Tool ohne Parameter. Ich habe es nicht aufgerufen.

Ergebnis in einem Satz: Migration, Edge und Client rechnen und buchen nach der Vorgabe, die Gebühr verlässt keinen Kundenpfad, ich habe keinen Fehler in der Geld- oder Sicherheitslogik gefunden; offen sind fünf mittlere Punkte, alle bei Tests und Nachweisen, die vor dem Merge geschlossen werden müssen.

## Findings

### Hoch

Keine.

### Mittel

**M1** `tests/unit/fee-staffel.test.ts:14-38`, `tests/rls/fee-schedule.test.ts:51-60` – Die Rundungsregel ist nicht getestet. Jeder Erwartungswert der Vorgabe hat einen Bruchteil von 0, 0,07, 0,1 oder 0,15 Cent; alle Tests blieben grün, wenn eine der beiden Schichten abschneiden statt kaufmännisch runden würde. Der Code rundet richtig (`0062:76`, `fee.ts:38`, von Hand geprüft), der Beweis fehlt. – Fix: in beiden Dateien dieselben Vektoren ergänzen: v2 50004→6000, 50005→6001 (genau ein halber Cent), 50009→6001, 100050→11004 (halber Cent in Stufe 3); v1 10→2, 68970→10346. Dazu ein Netto-Fall in der Unit-Datei: `splitFee(25, v2)` ergibt Provision 3, netto 3, USt. 0.

**M2** `tests/rls/offers.test.ts:62`, `:186-188`, `:203` – Die Vererbung Angebot → Auftrag ist nur für den Fall getestet, dass die Version des Angebots auch die geltende ist. Es fehlt jeder Test mit abweichender geltender Version, und damit genau der Fall, der beim Einspielen auf Produktion eintritt (offene Angebote mit Version 1, geltend Version 2). Es fehlen auch die zwei Tests, die ich in `s9p-1-fable-plan-2.md:94-95` verlangt habe: Guard-Zweig „Festangebot“ (`0062:270-276`) und `offer_immutable` bei geänderter `fee_schedule_version` (`0062:152-153`). Nach Lesen des Codes ist der Pfad richtig (`0062:446`, `:487-490`, `:505` vor `:510`, `:271-272`); im Fehlerfall scheitert die Bestätigung (fail closed), eine falsche Buchung entsteht nicht. – Fix: Rollback-Probe in `offers.test.ts`: Angebot senden, als Eigentümer Version 99 mit heutigem Datum einfügen (Muster `change-orders.test.ts:388-390`), dann prüfen: `confirm_offer_basis` liefert Stufen und Version des Angebots; `confirm_offer` mit Version 99 → `rate_mismatch`; mit der Angebotsversion → `confirmed`; die `booking`-Zeile trägt die Angebotsversion und die Gebühr dieser Version. Zusätzlich: Statuswechsel aus `sent` mit geänderter Version → `offer_immutable`.

**M3** `tests/rls/fee-schedule.test.ts:51-60` – `private.fee_cents` ist die bindende Rechnung (Guard), wird aber nur mit 0, 50000, 100000, 150000, 68961 (v2) und 68961 (v1) geprüft. Es fehlen 50001 und 100001 (erster Cent der nächsten Stufe), 6900, 76041, 300000 und für v1 76041→11406 und 6900→1035. Der Kreuztest TS gegen `payout_preview` aus `s9p-1-fable-plan.md:83` fehlt ganz; `partner-mfa.test.ts:50-53` prüft nur „größer 0, höchstens Gesamtpreis“. Weichen TS und SQL ab, endet jede Annahme in `payout_changed` (Ausfall, keine Fehlbuchung). – Fix: die Vektoren ergänzen; ein Test, der für beide Grenzen ±1 und etwa 20 Zufallsbeträge `total − tierFee(total, Stufen aus currentFee())` gegen `payout_preview(total)` vergleicht.

**M4** `tmp/proof/s9p-1-rls-1.log:614-620`, `tmp/proof/s9p-1-check-1.log:146-152` – Der letzte vollständige rls-Lauf endet mit EXIT=1 (6 rot), der letzte vollständige `check` mit EXIT=1 (2 rot). Grün belegt sind danach nur `change-orders.test.ts` (`gezielt-4`), `journal.test.ts` (`gezielt-5`), `flow-live.test.ts` (`flow-ist-1.txt`), `admin-correct-db.test.ts` (`unit-ziel-1`) und `fee-schedule.test.ts` (`gruen-1`). Für `rls.test.ts` (Liste der SECURITY-DEFINER-Rechte), `journal-live.test.ts` und `listings.test.ts` gibt es nach den Korrekturen keinen grünen Lauf; e2e ist laut `docs/PROGRESS.md:9` nicht gelaufen. – Fix: `check`, rls voll und e2e voll auf einem Hash mit Exit-Code im Log (in `PROGRESS.md:9` schon vorgesehen). Kein Merge und kein Push von `main` davor. Diese Abnahme deckt die drei Dateien ohne grünen Lauf nicht ab.

**M5** `tmp/proof/s9p-1-rot-1.log:18`, `tmp/proof/s9p-1-rot-2.log:11-17` – Die beiden Rot-Läufe zeigen nur, dass die Tabelle vor dem Einspielen fehlte (Meldung „relation does not exist“). Nach CLAUDE.md zählt ein Rot-Beweis nur, wenn er die Wirkung einer gelockerten Sperre misst. Für die neuen Sperren gibt es damit keinen gültigen Rot-Beweis. – Fix (Skript mit `scripts/dev-guard.mjs`, alles im Rollback): (a) Policy `fee_schedule_tiers_select` auf alle Konten gelockert → Kunde sieht N > 0 Zeilen; (b) Policy `platform_settings_select` auf den Stand von 0027 → Firmenkonto sieht die Zeile `fee_rate`; (c) Versionsprüfung im Guard (`0062:276`) entfernt → `booking` mit nicht zulässiger Version entsteht; (d) `fee_schedule_version` aus `guard_partner_offer` entfernt → Version im Statuswechsel geändert. Jeweils Ist-Wert ins Log.

### Niedrig

**N1** `src/screens/partner/Anfragen.tsx:244` – „Dein Anteil kann sich bis zur Annahme ändern.“ stimmt nicht mehr: die Version wird beim Senden festgeschrieben (`0062:570-571`) und ist danach unveränderlich (`0062:147-158`). Ändern kann sich der Anteil nur zwischen Vorschau und Senden (Tageswechsel mit neuer Staffel). – Fix: Satz streichen oder ersetzen, z. B. „Dein Anteil steht mit dem Senden fest.“; Textentscheidung bei Beks.

**N2** `src/lib/partnerJobs.ts:110-111` – Der Kommentar ist mitten im Wort umgebrochen (Zeile 111 beginnt mit „ull“; vermutlich wurde eine Backtick-n-Folge von PowerShell als Zeilenumbruch geschrieben). Liegt im Blockkommentar, ohne Wirkung auf den Code. – Fix: Kommentar wieder in eine Zeile; die übrigen per Skript geänderten Dateien nach demselben Muster durchsuchen.

**N3** `src/lib/partnerJobs.ts:116-117` – `Number(data)` macht aus `null` oder einer leeren Zeichenkette 0; die App zeigte dann „Du erhältst 0,00 €“. Der Server liefert nie null (`0062:121-122`), und `accept` lehnt 0 ab (`jobs/handlers.ts:94`). – Fix: nur `typeof data === 'number'` (oder Ziffernfolge) annehmen; Fall `data: null` ohne Fehler in `tests/unit/partner-jobs.test.ts:58-66` ergänzen.

**N4** `scripts/scan-dist.mjs:2`, `:8` – Der Kommentar nennt noch die entfallene View als Ausnahme; die beiden neuen Tabellennamen stehen nicht im Muster für Gebührentabellen (Auflage aus `s9p-1-fable-plan-2.md:97`). In `src/` kommt heute keiner der Namen vor (Suche). – Fix: Kommentar anpassen, beide Tabellennamen ins Muster.

**N5** `tests/e2e/backend.ts:91-95`, `tests/e2e/jobs-helpers.ts:338`, `:345` – Die Mocks rechnen flach 15 %; die Bilder zeigen 586,17 € zu 689,61 €, live gilt 610,65 €. Bewusst und nur Testdaten, aber `s9p-1-bild-1.md:23` und `-bild-2.md:20` lesen sich wie eine Bestätigung von 15 %. – Fix: Mock mit den v2-Stufen rechnen lassen (fester Testwert, kein App-Code), dann stimmen Bild und Live überein.

**N6** `supabase/functions/_shared/pricing/fee.ts:1` – Kommentar nennt `platform_settings` als Quelle der Sätze; es ist `fee_schedule_tiers`. – Fix: Kommentar anpassen.

**N7** `tmp/proof/s9p-1-flow-ist-2.txt:1` – Die Datei trägt die Kennung 7c2-1311-c, nicht p1-1411-b. Zuordnung nur über Commit 7f541ac und Zeit (04:16 UTC, nach `s9p-1-deploy-2.log:1`). – Fix: Kennung im Skript als Parameter; Hinweis in `docs/PROGRESS.md`, die Nachweisdatei bleibt unverändert.

**N8** `tests/rls/journal.test.ts:220` – Die festen Zahlen 7896/1104/9935 binden den Test an Version 2 als geltende Version auf Dev. Richtig so (Test und Server sollen nicht dieselbe Funktion benutzen), aber bei Version 3 wird er rot. – Fix: Kommentar an der Zeile; in der Migration einer künftigen Version mit anpassen.

**N9** Doku – CLAUDE.md „Geld“ und Kopf nennen 15 % und `round(total × 0,15)`; `docs/S9_KONZEPT.md` 9.1–9.3 den flachen Satz; `docs/OPEN_ISSUES.md` enthält den in `0062:6` angekündigten Eintrag zu `fee_rate` noch nicht (Suche). – Fix: Doku-Schritt; CLAUDE.md ändert nur Beks.

**N10** `docs/PROGRESS.md:9` – Der lokale `main` zeigt auf den WIP-Commit f38fb4a. CLAUDE.md: Zwischenstände nicht auf `main`. Nicht gepusht. – Fix: `main` erst nach M4 per ff auf den geprüften Stand; vorher kein Push von `main`.

**N11 (aus der Planprüfung, unverändert akzeptiert)** `0062:571` NOT-NULL statt `setting_missing`, wenn keine Version gilt; `0062:43` Version 2 ohne Ankündigungsfrist (Beks' Vorgabe, reine Senkung); kein Einfüge-Trigger auf `partner_offers` für die Version (kein DML-Grant, `0038:60-61`).

## Prüffragen

### (1) Übereinstimmung mit Vorgabe und Erwartungswerten

Ja.

- Staffel und Rundung: `0062:44-48` (1500 offen; 50000/1200, 100000/1000, offen/700), `0062:63-76` und `fee.ts:19-39` sind dieselbe Rechnung: Anteil je Stufe × Basispunkte, eine Summe, einmal half-up. Die Grenzen 50000 und 100000 liegen in der unteren Stufe. Alle 14 Erwartungswerte von Hand bestätigt: 30000→3600, 50000→6000, 50001→6000, 68961→7896, 76041→8604, 80000→9000, 100000→11000, 100001→11000, 150000→14500, 300000→25000, 6900→828; v1 68961→10344, 76041→11406 (Nachtrag 1062), 6900→1035.
- Nachtrag: `change.ts:32-43` bucht Provision(Gesamt nach) − Summe bisher; der Guard verlangt dasselbe exakt (`0062:300`). 8604 − 7896 = 708, Auszahlung 6372.
- Pauschale: Staffel auf die Basis allein mit der Version des Auftrags (`0062:316`, `cancel/partner.ts:31`, `cancel/handlers.ts:56`, `admin/correct.ts:75`). 6900→828, Auszahlung 6072.
- Version-Vererbung: `send_offer` speichert die geltende Version (`0062:570-571`), unveränderlich (`0062:147-158`); `confirm_offer_basis` liefert Stufen und Version des Angebots (`0062:446`), `confirm_offer` prüft sie (`0062:487-490`), der Guard prüft unabhängig gegen das bestätigte Angebot (`0062:270-276`). Festpreis-Annahme: geltende Version (`0062:416-420`, `:274`). Nachtrag, Stornogebühr, Pauschale: Version der `booking`-Zeile, in Funktion (`0062:657-660`, `:730-733`, `:796-799`, `:920-923`) und Guard (`0062:288`). Gegenbuchungen übernehmen die Version der Ursprungszeile (`0062:199-203`, `:247`).
- Bestand: Spaltenvorgabe 1 ohne Zeilen-UPDATE (`0062:132-135`), Abbruchprüfung vor dem Löschen der Satzspalten (`0062:137-143`), Zählung 554 Zeilen, alle 0,15 (`s9p-1-journal-zaehlung-1.log:14-17`). Beträge alter Zeilen bleiben unverändert.
- Live: `s9p-1-flow-ist-2.txt:3-20` zeigt booking 68961/7896/6580/1316/61065, change 7080/708/590/118/6372, Pauschale 6900/828/690/138/6072, Angebot 150000/14500/12083/2417/135500; Netto und USt. nachgerechnet, stimmen. Summen `my_commissions` = CSV = Vorgabe (`:21-26`); W5 ergibt 0, weil der Auftrag nicht beendet ist (`0062:986-989`), richtig.
- Client: rechnet nichts; „Du erhältst“ kommt aus `payout_preview` (`partnerJobs.ts:112-121`, `Anfragen.tsx:92-103`), Annahme nur mit geladenem Wert (`Anfragen.tsx:147`, `:162-163`). Kein fester Satz in `src/` (Suche nach 0,15 und 1500: nur ein Timeout in `router.tsx:95`).
- Abweichung vom freigegebenen Plan: keine im SQL (Hash vor dem Push gleich Freigabe, `s9p-1-push-vorher-1.log:2`; Zeilenstellen wie in meinem Bericht 2). Von den Auflagen offen: Halbcent-Vektoren (M1), Tests zu M2/M3 der Planprüfung (hier M2), Kreuztest (M3), gültiger Rot-Beweis (M5), `scan-dist` (N4). Erfüllt: Stufen in TS mit Fail-closed-Regel, `fee_tiers` nie in Kundenantworten, RLS-Tests für beide Tabellen und die Vorschau, Test zu `fee_rate` unsichtbar (`partner-fee-read.test.ts:58-61`, `partner-mfa.test.ts:42-45`), Guard-Zweig „geltende Version“ (`journal.test.ts:319-331`).

Zu den beiden Ursachenberichten:
- `s9p-1-ursache-journal.md`: Schlussfolgerung stimmt. Die alte Erwartung war die Staffel auf die Differenz (12 % von 11039 = 1325); die Vorgabe verlangt 9000 − 7896 = 1104. Beim flachen Satz fiel das nicht auf, weil beide Rechnungen dort fast gleich sind. Guard (`0062:298-304`) und Edge (`change.ts:32-43`) folgen der Vorgabe. Die Korrektur prüft gegen feste Zahlen aus der Vorgabe (`journal.test.ts:220`), nicht gegen den Ist-Wert. Kein Server-Fehler.
- `s9p-1-ursache-change.md`: stimmt. Doppeltes Semikolon und falscher Schlüssel sind reine Testfehler (`change-orders.test.ts:389`, `:393`, `:415`). Der Test prüft danach das Richtige: neue geltende Version 99, Entscheidung mit 99 → `fee_basis_changed`, mit der Version des Auftrags → `accepted`, Zeile trägt die Version des Auftrags.

### (2) Lecks, RLS, p_actor, Wettläufe, Überlauf

Kein Fund.

- Kunden und anon: beide Tabellen ohne Grant für anon, Lesen nur Firmenmitglied oder admin, beide mit aal2 über die Helfer (`0062:31-39`, `0023:81-86`, `0015:10-12`). `payout_preview` nur authenticated, aal2, Mitglied (`0062:118-126`). `partner_offers.fee_schedule_version` ist für Konten nicht lesbar (Spalten-Grant `0039:9-10` ohne die Spalte). Journal unverändert: eigene Firma mit aal2 und admin (`0028:193-196`). Mit echten Tokens belegt: Kunde liest 0 Zeilen (`quote.test.ts:293-295`, `partner-mfa.test.ts:58-60`).
- Kundenpfade der Edge Functions: `offer-confirm`, `change-decide`, `cancel-customer` geben nur Status bzw. die Stornogebühr des Kunden zurück (`jobs/handlers.ts:156-157`, `change/handlers.ts:193-194`, `cancel/handlers.ts:52-59`); Fehlercodes mit Bezug zur Gebühr werden zu `retry` (`jobs/handlers.ts:136`, `change/handlers.ts:162`, `cancel/handlers.ts:28`). Stufen stehen nur in den Grundlagen-Funktionen, die allein service_role ausführen darf (`0062:1030-1055`).
- Firmenpfade: `partner_accept_basis` und `cancel_by_partner_basis` prüfen Mitgliedschaft bzw. das Tor mit aal2 (`0062:360`, `:761`).
- p_actor: jede Funktion mit `p_actor` nur für service_role (`0062:1025-1026`, `:1030-1055`); die Functions nehmen Akteur und aal aus dem geprüften Token (`jobs/db.ts:16-25`, `jobs/handlers.ts:53-59`). `admin_correct` prüft Rolle und aal2 (`0062:868-869`).
- SECURITY DEFINER: alle neu definierten Funktionen mit `set search_path = ''`; private Helfer ohne Grant (`0062:111`, `:216-217`, `:1022`, `:1029`). Kein direktes Status-UPDATE auf Aufträgen; Übergänge über `private.set_request_status`.
- Schreibschutz der Staffel: kein DML-Grant für irgendeine API-Rolle, append-only-Trigger (`0062:24-33`), getestet (`fee-schedule.test.ts:86-95`).
- Versionswechsel: geltende Version hängt nur am Wiener Datum der Transaktion (`0062:93`); Funktion und Guard rechnen in derselben Transaktion. Wechselt die Version zwischen Grundlage und Buchung: `rate_mismatch`, ein neuer Versuch mit frischer Grundlage, dann `payout_changed` bzw. `retry` (`jobs/handlers.ts:97-115`, `:150-167`). Angebote und laufende Aufträge sind vom Wechsel nicht betroffen (Version eingefroren). Sperrreihenfolge unverändert.
- Überlauf und negative Basis: `fee_cents` lehnt null und negativ ab (`0062:61`), bigint-Überlauf bricht ab; `tierFee` verlangt ganze Cent ≥ 0 im sicheren Bereich (`fee.ts:20`); `payout_preview` lehnt null und negativ ab (`0062:121`); Angebotsbetrag ist int mit Obergrenze (`0062:540`, `:553-557`). Kaputte Stufenmenge: fail closed in beiden Schichten (`0062:64`, `:69`, `:75`; `fee.ts:25`, `:31`, `:37`). Fehlende Version: `fee_tiers` null → Function bricht mit 500 ab, nichts wird gebucht.
- Missbrauch: Eine Firma kann ein altes Angebot zurückziehen und neu senden, um die geltende Version zu bekommen; das ist zulässig und nur innerhalb der Angebotsfrist möglich.

### (3) Fehlende Tests

- Randwerte 50000/50001/100000/100001: in Unit vorhanden (`fee-staffel.test.ts:16-22`); in SQL nur 50000 und 100000 (M3).
- Version-2-Staffel in Unit: vorhanden (`fee-staffel.test.ts:13-29`), auch v1, Nachtrag, Pauschale, kaputte Stufenmengen.
- Es fehlen: Rundung mit halbem Cent in beiden Schichten (M1); Vererbung Angebot → Auftrag bei abweichender geltender Version und `offer_immutable` für die Version (M2); SQL-Vektoren und Kreuztest TS gegen `payout_preview` (M3); gültiger Rot-Beweis (M5); volle Läufe nach den Korrekturen (M4).

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `0062:63-76` mit 14 Beträgen und 50005, 100050 | Erwartungswerte bestätigt; halber Cent rundet auf (6001, 11004) |
| `fee.ts:19-39` gegen `0062:51-78` | gleiche Rechnung, gleiche Abbruchregeln |
| `fee.ts:45-51` | netto half-up in Ganzzahlen; USt. = Gebühr − netto; Auszahlung = Gesamt − Gebühr |
| `change.ts:32-43` | Differenz der Komponenten; Staffel monoton, keine Komponente wird negativ |
| `0062:31-39`, `0023:81-86`, `0015:10-12` | Lesen nur Firmenmitglied oder admin, beide mit aal2 |
| `0039:9-10` | neue Spalte der Angebote nicht im Spalten-Grant |
| `0062:161-165` gegen `0027:8-12` | Firmen lesen nur noch `fee_vat_rate` |
| `0062:118-126` | Vorschau: Konto, aal2, Mitglied, Eingabe; nur authenticated |
| `0062:270-276`, `:496-510` | Guard findet das bestätigte Angebot; Status `confirmed` vor der Buchung |
| `0047:26`, `:41-42` | Folgeanfrage nie aus Festangebot, Herkunft `submit`; kein Konflikt mit dem Guard |
| `0062:1029-1055` | Grants passen zu den neuen Parameterlisten; Ausführung nur service_role, `send_offer` authenticated |
| `jobs/db.ts:27-58`, `:60-89` | Version und Stufen aus der Grundlage, unverändert an die Buchung |
| `jobs/handlers.ts:97-115` | ein neuer Versuch bei `rate_mismatch`/`amount_mismatch`, dann 409 |
| `jobs/handlers.ts:136`, `:171-173` | Kunde erhält nur `retry` bzw. `offer_unavailable` |
| `change/handlers.ts:110` | kein Nachtrag auf Aufträge aus Festangebot |
| `change/handlers.ts:189-194` | Vorwerte aus dem Journal, Antwort nur Status |
| `cancel/handlers.ts:52-59` | Antwort enthält nur die Stornogebühr des Kunden |
| `cancel/partner.ts:62-65` | Vorschau für die Firma (aal2): Pauschale und Auszahlung mit der Version des Auftrags |
| `admin/db.ts:36-42`, `0062:915-924` | ohne Gebühr werden Satz und Version nicht ausgewertet |
| `commission/csv.ts:49-50`, `:91`, `:102` | Spalte „Staffel“ als entschärfter Text; Beträge nur aus Cent |
| `partnerJournal.ts:14`, `0062:956-974` | Spaltenliste passt zum neuen Typ |
| `partnerJobs.ts:112-121` | Fehler → keine Zahl; Wert muss zwischen 0 und Gesamtpreis liegen (N3) |
| `Anfragen.tsx:128-132`, `:147`, `:162-167`, `:243-244` | Betrag nur vom Server; Annahme gesperrt ohne Wert; Text N1 |
| Suche `src/` nach Satz, Staffel, Gebührentabellen | nur `payout_preview` und die Journalspalte; kein fester Satz |
| `src/screens/Auftrag.tsx:21`, `:114`, `:169`; `src/screens/auftrag/Absage.tsx:10` | Kundenscreens: nur Stornogebühr bzw. Pauschale, keine Plattformgebühr |
| `fee-schedule.test.ts:76-108` | Matrix Status × aal, Kunde, anon, service_role ohne Schreibrecht, Vorschau 150000 → 135500 |
| `journal.test.ts:112-114`, `:145`, `:319-331` | falsche, leere, ältere, niedrigere, künftige Version → `rate_mismatch` |
| `journal.test.ts:218-220`, `:281` | Nachtrag über `splitChange`, feste Zahlen der Vorgabe |
| `change-orders.test.ts:388-393`, `:412-415` | eingefrorene Version nach Wechsel der geltenden Version |
| `offers.test.ts:62`, `:203` | Bestätigung nur mit geltender = Angebotsversion (M2) |
| `journal-live.test.ts:169-173` | Pauschale 6900/828/690/138/6072 mit festen Zahlen |
| `s9p-1-flow-ist-2.txt:3-26` | Live-Werte W1–W5 und Summen wie Vorgabe |
| `s9p-1-deploy-2.log:1-31` | sieben Functions, je EXIT 0, Smoke 401; vor dem Flow-Lauf |
| `s9p-1-journal-zaehlung-1.log:14-17` | 554 Zeilen, 0 abweichend |
| `s9p-1-push-vorher-1.log:2`, `s9p-1-fable-plan-2.md:126` | Hash vor dem Push gleich Freigabe (nicht nachgerechnet) |
| `s9p-1-rls-1.log:614-620`, `s9p-1-check-1.log:146-152` | letzte Volläufe rot (M4) |
| `s9p-1-rot-2.log:11-17` | Rot wegen fehlender Tabelle, kein Rot-Beweis einer Sperre (M5) |
| `s9p-1-bild-1.md:43`, `-bild-2.md:35`, `-bild-3.md:29` | hoch 0; ein mittlerer Fund in Bild 1 betrifft die Trefferfläche des Schließen-Knopfs, keinen Betrag; Beträge aus dem 15-%-Mock (N5) |

## Auflagen vor dem Merge

M1, M2, M3 (Tests ergänzen, je gezielter Lauf mit Exit-Code), M5 (Rot-Beweis mit Ist-Wert), danach M4 (Volläufe auf einem Hash). N1 bis N4 in derselben Runde mitnehmen. Ändert sich dabei SQL, Edge-Code oder `partnerJobs.ts` über N2/N3 hinaus, prüfe ich die geänderten Stellen erneut.

Offene Findings hoch: 0
