Modell: claude-fable-5-2

# Abnahme Schritt st1 (R3): Migration 0065, Pauschale erst ab Termin (Nr. 148), Kontakt und Fotos nach Storno ohne Pauschale gesperrt (Nr. 154), Sätze in geld.md (Nr. 149, 150)

Datum: 2026-11-16
Stand laut Logs: Commit 566cf87 (Branch st1), Arbeitsbaum nicht sauber (Schritt noch nicht committet)
Umfang: Geld, Sicherheit, Schema. Die Optik ist hier nicht geprüft.
Grundlagen: `tmp/proof/st1-plan.md`, `tmp/proof/st1/db-freigabe-1.md` (Urteil frei, N1 und N2 niedrig), `docs/ENTSCHEIDUNGEN.md:154-156, 160, 187` (Nr. 148, 149, 150, 154, 180), `docs/OFFEN.md:39` (st1-1), `.claude/rules/geld.md`, `.claude/rules/daten.md`, `.claude/rules/tests.md`, `tmp/proof/st1/runs.jsonl` und die Logs 001 bis 014.

SHA256: 1b39103d8fbd42eed06f690192dd7b76174e281a09b7f18d4f81e7283fddfa07 supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql
SHA256: d22ba05c2d56a2a067924ccd242876a05983a34c7d6176e0331492514fb55dd4 tests/rls/job-contact-after-cancel.test.ts
SHA256: 93c3f7c4f5b8bd2d5f96c35938cbd76c0f0d1b10daddf31e5bbfbbde4d1cbfb4 tests/rls/cancellation-partner-preview.test.ts
SHA256: 54864c18b2e57d17725d2450efe998c836e1e1aa1e3947e91b52bae686c46df8 tests/rls/cancellation-partner.test.ts
SHA256: 05b49e929e702e65f254f3d099f7504cee48616b6aa11c526d7a50b38bbd9f74 src/lib/partnerJobs.ts
SHA256: f0d9a5583de44300c8086df35450baf5cd9edaccea323d45999518f791779741 .claude/rules/geld.md
SHA256: 28688ef1dacbdf37c10e1f2d5159596052450834db815eb7bfcbb25bddc91e27 tests/unit/partner-cancel.test.ts
SHA256: b7487cc64524242c1daaf789cef0ce469e56af5710cf13ac925073597ab42c06 tests/e2e/partner-absage.spec.ts

Ergebnis: nicht abgenommen. Ein hohes Finding (H1): Zwei Live-Testdateien außerhalb des Auftrags erwarten weiter eine Pauschale vor dem Termin und werden im rls-Volllauf rot; der einzige flow-live-Lauf ist rot, und `tests/rls/flow-live.test.ts` wurde danach geändert, ohne Teil dieses Auftrags zu sein (M2). An den acht geprüften Dateien selbst habe ich für Geld, Sicherheit und Schema nichts Hohes gefunden; die Migration ist die freigegebene.

## Grenzen der Prüfung

- Die Hashes sind aus dem Auftrag abgeschrieben. Ich habe kein Werkzeug, um SHA-256 zu berechnen, und keinen Zugriff auf `git`. Den Abgleich mit dem Endstand macht das Gate. Gestützt ist nur der Hash der Migration: Er steht gleich im Auftrag, in `tmp/proof/st1/db-antrag-1.json:4`, in `db-freigabe-1.md:8` und in beiden Push-Marken (`runs.jsonl:7-8`), und der gelesene Inhalt (98 Zeilen) passt zu den Zeilenangaben der Freigabe (0065:14, 24-28, 31, 46, 81). Für die übrigen sieben Dateien gibt es keinen zweiten Beleg.
- Die Vorfassung von `.claude/rules/geld.md` kenne ich nicht. Ich habe keine Erinnerung an die Planprüfung (sie liegt nur als Zeile Nr. 180 in `docs/ENTSCHEIDUNGEN.md:187` vor), und ein Diff ist mir nicht möglich. „Kein anderer Satz geändert“ kann ich deshalb nicht bestätigen (Prüffrage 2).
- „Keine Datei unter `supabase/functions/` geändert“ stütze ich auf die Statusliste vom Sitzungsbeginn und auf den Inhalt (Prüffrage 4), nicht auf einen eigenen Diff.
- Die roten Läufe 1 bis 6 liefen mit früheren Fassungen der Testdateien. Die Logs tragen keinen Fingerabdruck der Testdatei (`abdruck: null`), alle Läufe liefen mit unsauberem Baum. Welche Fassung in den grünen Läufen 10 bis 13 lief, kann ich nicht belegen; Zeilennummern aus Lauf 7 passen nicht mehr zum Endstand (siehe N2).
- Logs habe ich nach Kopf, Fehlern und Exit-Code durchsucht, nur 014 und die Fehlerstellen von 007 und 008 im Wortlaut gelesen.
- `tests/rls/flow-live.test.ts` habe ich nur im Abschnitt W4 (Zeilen 336-358) gelesen, die beiden anderen Live-Dateien nur an den genannten Stellen.
- Die Volläufe (check, e2e, rls) fehlen noch; sie folgen laut Auftrag nach dem Commit.

## Findings

### hoch

- H1 `tests/rls/partner-functions-live.test.ts:75, 141, 144` und `tests/rls/journal-live.test.ts:81, 103, 195` – Beide Dateien legen den Auftrag J4 mit Termin in 14 Tagen an und erwarten danach eine Pauschale von 6.900 ct (Vorschau und echte Absage über die Edge Function `cancel-partner`). Seit 0065 gibt die Grundlage vor dem Termin 0 (0065:14, 0062:766): Die Vorschau liefert 0 statt 6.900, der echte Aufruf mit Belegen und gezeigten 6.900 endet in 409 `amount_changed` (`supabase/functions/_shared/cancel/partner.ts:69-70`). In `journal-live` steht der Aufruf in der Vorbereitung, dort fällt die ganze Datei. Beide Dateien sind im Schritt nicht angepasst und nicht gelaufen; der rls-Volllauf wird rot. Der Plan (Schritt 3) nennt nur drei Testdateien und hat diese zwei übersehen. Das ist kein Fehler der Migration, aber der eingereichte Stand ist nicht der Endstand: Es müssen weitere Dateien unter `tests/rls/` geändert werden, die diese Abnahme nicht deckt. – Fix: J4 in beiden Dateien mit begonnenem Termin anlegen (wie W3 in `flow-live.test.ts:129`), die übrigen Erwartungen zu J4 gegenlesen (keine Folgeanfrage, Mail `partner_cancelled_fee`, Summen). Dazu eine Live-Probe für Nr. 148 über die Function: Auftrag mit Termin in der Zukunft und abgelehntem Nachtrag, Vorschau 0, Aufruf mit Belegen und 6.900 ergibt 409, Zustand unverändert (bisher ist dieser Weg nur gelesen, nicht gemessen). Beide Dateien gezielt grün laufen lassen, dann neue Abnahme mit Hash für alle geänderten Testdateien.

### mittel

- M1 `tests/rls/cancellation-partner-preview.test.ts:91, 97, 124, 133, 134, 136, 148, 149` und `tests/rls/cancellation-partner.test.ts:237` – Die Gegenproben zur Nachtragsregel aus 0059 (kein Nachtrag, angenommen, abgelehnt dann angenommen, abgelehnt dann offen, Grund NULL) liegen weiter auf Aufträgen mit Termin in 5 Tagen (E0, E3, E4, E6, E1, S2). Seit 0065 sperrt dort schon die Zeit. Diese Prüfungen blieben grün, wenn jemand später die Nachtragsbedingung (0065:15-17) bräche, zum Beispiel „irgendein abgelehnter Nachtrag genügt“. Bei begonnenem Termin ist als Gegenprobe nur noch V4 übrig (ein offener Nachtrag, `:190, 206`); die Reihenfolge nach `n` hat keine Gegenprobe mehr. Die Regel entscheidet, ob der Kunde 69,00 € schuldet. Die Zeilen 15-17 der Migration sind unverändert gegenüber 0059:11-13, heute ist also nichts falsch; es fehlt der Schutz gegen spätere Änderungen. Das ist das Spiegelbild der Kontrolle bei E1 in `job-contact-after-cancel` (dort sperrt nur die Zeit). – Fix: E0, E3, E4, E6 und S2 mit begonnenem Termin anlegen (`PAST`), die NULL-Proben auf E2 legen; dann sperrt jeweils nur die Nachtragsbedingung. Entweder mit H1 in diesem Schritt oder als Zeile st1-2 in `docs/OFFEN.md`.
- M2 `tests/rls/flow-live.test.ts:337, 353-356` mit `tmp/proof/st1/014-tests_rls_flow-live.test.ts.log:30, 45-62, 81` – Lauf 14 ist rot (Exit 1, 18 von 19). Gescheitert ist W4 mit der alten Erwartung „`job_contact` bleibt im Zugriffsfenster“; Ist-Wert `not_assigned`. Das ist die gewollte Wirkung von Nr. 154, gemessen über die echte Function `cancel-customer`. Die Datei auf der Platte erwartet inzwischen `not_assigned` (Titel und Zeilen 353-356 geändert); sie stand nicht im Auftrag, hat keinen Hash und keinen grünen Lauf. Den Abschnitt W4 habe ich gelesen, er entspricht Nr. 154; ob sonst etwas geändert wurde, weiß ich nicht. – Fix: flow-live gezielt grün laufen lassen und die Datei mit Hash in die neue Abnahme aufnehmen.

### niedrig

- N1 `tests/rls/cancellation-partner.test.ts:231, 233` mit `runs.jsonl:4` – Die Datei war vor dem Push grün (Lauf 4, Exit 0). Sie misst 0065 nicht; die Änderung (S1, S5 mit begonnenem Termin) hält sie nur nach dem Push grün. Die Angabe im Auftrag „001 bis 006 rot“ stimmt für 004 nicht, und der Plan (Schritt 3, „zuerst rot“) war für diese Datei nicht erfüllbar. Das Gate verlangt den roten Lauf nur für neue Dateien; Nr. 148 belegen die zwei anderen Dateien. – Fix: im Bericht richtig benennen (Anpassung, kein Beleg).
- N2 `tmp/proof/st1/007-…log:21, 26-29`, `008-…log:22, 29`, `runs.jsonl:9-13` – Nach dem Push waren 007 und 008 rot (Auftrag: „007 bis 009 grün“). Ursache waren die Tests, nicht die Migration: in 007 scheiterte der nachgestellte Kundenstorno mit Pauschale am Journal-Trigger (`amount_mismatch`), in 008 fehlte die erwartete Folgeanfrage bei V5 (Ursache aus dem Log nicht erkennbar). Beide Dateien wurden danach geändert (007 nennt Zeile 189 für eine Prüfung, die im Endstand in Zeile 191 steht) und liefen dann je einmal grün (010, 011). Die Endfassungen haben also keinen eigenen roten Lauf; einzeln rot gemessen sind nur die jeweils ersten scheiternden Prüfungen (Prüffrage 1). Für `contactLocked` (Unit) und den neuen E2E-Fall gibt es keinen roten Lauf; verlangt ist er dort nicht. – Fix: keiner am Code; die Volläufe auf dem committeten Endstand sind der Nachweis.
- N3 `tests/e2e/jobs-helpers.ts:77, 324-330` mit `tests/e2e/partner-absage.spec.ts:62-91` – Der Mock gibt die Pauschale bei `scope_impossible` auch vor dem Termin (`can_start: false` ist der Standard), der Kommentar sagt „verhält sich wie der Server“. Seit Nr. 148 stimmt das nicht mehr; die Pauschalen-Fälle der Spec zeigen einen Zustand, den der Server nicht mehr liefert. Geld ist nicht berührt (die Oberfläche zeigt nur Serverwerte). – Fix: Mock gibt die Pauschale nur bei begonnenem Termin, die Fälle mit Pauschale nutzen `job({ can_start: true })`.
- N4 `.claude/rules/geld.md:15, 16` – Der Auftrag spricht von zwei neuen Aufzählungspunkten nur mit dem Inhalt von Nr. 149 und 150. Ich lese einen geänderten Punkt (Zeile 15, Anzeigeorte, Nr. 149) und einen neuen (Zeile 16) mit zwei Sätzen: Kundensicht der Pauschale (Nr. 150) und „Pauschale erst ab Beginn des Termins“ (Nr. 148, nicht 149 oder 150). Der dritte Satz ist inhaltlich richtig und vom Planauftrag gedeckt. Die Datei gehört zu den Gates; den Rest kann ich nicht gegen die Vorfassung prüfen. – Fix: Die Hauptsession zeigt den Diff der Datei im Bericht und nennt Nr. 148 als Quelle des dritten Satzes.

Hinweis für den reviewer (kein Finding dieser Abnahme): `src/screens/partner/Auftraege.tsx:263` begründet die Sperre mit „weil keine Pauschale anfällt“. Nach einem kostenlosen Kundenstorno heißt der Betrag in derselben Karte „Betrag nach Storno“ (`:214`), nicht Pauschale.

## Prüffragen

### 1. Beweisen die Tests die Wirkung, und waren sie vor dem Push rot?

Reihenfolge laut `runs.jsonl`: Läufe 1 bis 6 vor dem Push (23:38 bis 23:41 UTC), Push 23:51:36 UTC (`:7-8`), Läufe 7 bis 14 danach. Anders als im Auftrag: 004 grün (N1), 007 und 008 rot (N2), 014 rot (M2). Grün sind 009 bis 013.

Rote Läufe vor dem Push mit Ist-Wert (Rot-Beweis im Sinn von `tests.md`, Aufruf erfolgreich bzw. Betrag geliefert):
- Nr. 148, echter Aufruf: `002-…log:21` und `006-…log:21`, die Absage mit Pauschale vor dem Termin ergab `ok` statt `call_out_not_allowed`.
- Nr. 148, Vorschau: `003-…log:22`, `005-…log:22, 34`, Ist 6.900 statt 0 (E1 in 5 Tagen, V2 eine Minute vor dem Termin).
- Nr. 154, Kontakt nach Kundenstorno: `001-…log:41`, `002-…log:41`, `006-…log:41`, `job_contact` ergab `ok` statt `not_assigned`.
- Nr. 154, Fotos nach Firmenstorno ohne Pauschale: `001-…log:21`, `job_photo_list` ergab `ok` statt `not_found`.
- Live, nach dem Push: `014-…log:46-57`, alte Erwartung, Ist `not_assigned` nach echtem `cancel-customer`.

Nicht einzeln rot gemessen (jeweils von einer früheren Prüfung desselben Tests verdeckt): Fotos nach Kundenstorno (K1), Fotos nach Gegenbuchung (E4), `call_out_eligible` direkt, die Grenze knapp nach dem Termin. Dass sie ohne die Migration scheitern würden, folgt aus dem Lesen: `job_photo_list` nutzte vorher `assignment_access` (0037:97), das im Fenster wahr ist.

Kontrolle E1 (`job-contact-after-cancel.test.ts:89`): bestätigt. E1 hat einen Beleg und einen vom Kunden abgelehnten Nachtrag (`declineChange`, `:53-56`), Grund `scope_impossible`, Betrag und Belege stimmen (`:95`). `partner_cancel_fee` prüft die Berechtigung vor den Belegen (0059:40 vor 41-46); vor dem Termin bleibt `scope_impossible` als Grund erlaubt (0059:28). Es sperrt also nur die Zeit. E2, E4, E5 mit begonnenem Termin sind die Gegenprobe (`:99, 109, 115`, Storno mit Pauschale `ok`).

Tests, die ohne die Migration grün wären:
- `cancellation-partner.test.ts` ganz (Lauf 4). Sie soll 0065 nicht belegen (N1).
- In den zwei anderen Dateien die Positiv- und Fensterkontrollen (E2, E3, E5, K2, K3, die Rechteproben). Das ist gewollt.
- Keine der Prüfungen, die Nr. 148 oder Nr. 154 tragen: `job-contact-after-cancel.test.ts:134, 137, 151, 188, 189`; `cancellation-partner-preview.test.ts:157-161, 204-205`.
- Umgekehrter Fall, Gegenproben einer älteren Regel, die jetzt aus dem falschen Grund grün sind: M1.

Inhalt der Proben: Sperre vor der Audit-Zeile (`:142`, E1 bleibt bei einer Zeile); `my_jobs` bleibt nach kostenlosem Kundenstorno sichtbar (`:174, 190`, Teilfrage a des Plans); Direktaufruf der privaten Funktionen als authenticated ergibt 42501 (`:128-129, 160-161`); der kostenlose Kundenstorno läuft jetzt über die echte Funktion (`:170`, N2 der DB-Freigabe zum Teil erledigt). Offen bleibt wie in `docs/OFFEN.md:39` vermerkt: `admin_correct` nach Abschluss und Kundenstorno mit Pauschale über den echten Weg (K2 ist nachgestellt, `:74-83, 175`).

### 2. geld.md

- Zeile 15 (geändert): Anzeigeorte der Gebühr für die Firma, neu „in der Absage-Maske (Zeile ‚Gebühr‘ bei der Pauschale)“ und „in der Abrechnungs-Datei (Journal-CSV)“. Das ist Nr. 149 (`docs/ENTSCHEIDUNGEN.md:155`). Dass der Satz vorher nur Vermieter-Abrechnung, Rechnung und Auszahlungsübersicht nannte, belegen `docs/proof/s9i-7c1/s9i-7c1-fakten.md:12` und `docs/proof/s9i-7b2/s9i-7b2-abnahme.md:41`.
- Zeile 16 (neu): „Einzige Journalzahl für Kunden: der Betrag der Anfahrtspauschale nach einer Absage der Firma (`my_cancel_info` …), nie die Gebühr oder Journalzeilen.“ Das ist Nr. 150 (`:156`) und passt zum Test (`cancellation-partner-preview.test.ts:233-236, 249-252`: Ergebnistyp eine Zahl, Journal für den Kunden leer, nach Gegenbuchung 0). Der zweite Satz („erst ab Beginn des Termins“, Migration 0065) ist Nr. 148.
- Kein Widerspruch zu den übrigen Punkten: Zeile 13 (Journal lesen nur Firma und admin) bleibt, Zeile 16 ist als einzige Ausnahme formuliert; Zeile 19 und CLAUDE.md (Kunden sehen die Gebühr nirgends) sind nicht berührt, die Pauschale ist nicht die Gebühr.
- „Kein anderer Satz geändert“: nicht bestätigt (Grenzen, N4).

### 3. `contactLocked` gegen `my_jobs`

Passt. `my_jobs` liefert als `total_cents` die Summe aller Journalzeilen der eigenen Firma zum Auftrag (0064:161-165) und als `status` den Status des Auftrags (0064:153). Die Sperre der Datenbank hängt an `ended_reason` der Zuordnung und an der Summe der Zeile `cancellation_fee` samt Gegenbuchungen (0065:24-28, 0060:10-15). Beides fällt nach jedem Storno zusammen:
- Jeder Stornoweg setzt Status und `ended_reason` gemeinsam (0062:735-736, 801-802, 927-932) und bucht alle Zeilen `booking` und `change` zurück (0062:737, 803, 936 mit 335-343). Übrig bleibt nur die Pauschale bzw. Stornogebühr, falls gebucht (0062:738-741, 804-807, 937-940).
- `negate_fee` bucht die Gebührenzeile mit Verweis zurück (0062:895-901): Summe 0 in beiden Rechnungen.
- Also Summe 0 genau dann, wenn keine Pauschale fällig ist, für beide Storno-Status. Abgeschlossene und laufende Aufträge sperrt die Funktion nicht (`src/lib/partnerJobs.ts:305-306`), wie die Datenbank.
- Nicht lesbarer Betrag (`null`, auch bei negativer Summe, `:247`) zeigt den Knopf; dann antwortet der Server mit `not_assigned`. Die Anzeige entscheidet nichts, sie kann nur zu wenig sperren, nie Daten freigeben.
- Unit-Test: `tests/unit/partner-cancel.test.ts:86-92` deckt beide Status, Betrag 0, Betrag über 0, `null`, abgeschlossen und angenommen. E2E: `partner-absage.spec.ts:54-60`.

### 4. Edge Functions, Deploy

Kein Deploy nötig.
- In der Statusliste vom Sitzungsbeginn steht kein Pfad unter `supabase/functions/`; `database.types.ts` ist nach dem Push unverändert geblieben, die Signaturen von `job_contact` und `job_photo_list` dort (`:1768-1793`) entsprechen 0065:34-35, 57-58.
- Keine Function ruft die neuen oder geänderten privaten Funktionen direkt auf (Suche über `supabase/functions`: nur `job_photo_list` in `photo/db.ts:68`, gleiche Argumente).
- Die Migration ändert Rümpfe, keine Signatur und keinen Rückgabetyp; die Regel aus `daten.md` (neu deployen, wenn sich die Basis ändert) greift nicht.
- Gemessen: Lauf 14 gegen die deployten Functions mit angewendeter Migration, 18 von 19 grün, darunter W3 (Pauschale ab Termin, Vorschau 6.900 und 5.865), W2a und W2b (Kontakt gesperrt). Der eine Fehler ist die alte Erwartung im Test (M2).

### Weitere Prüfung

- Geld: Beträge, Rundung und Staffel sind nicht berührt; die Tests rechnen die Pauschale mit `splitFee` (`job-contact-after-cancel.test.ts:59, 80`). Wechselt die Zeit zwischen Vorschau und Buchung über den Terminbeginn, scheitert der Abgleich oder die Firma sagt bewusst ohne Pauschale ab; es wird nie ein anderer als der gezeigte Betrag gebucht (`cancel/partner.ts:52-54, 69-70`, 0062:793). Keine neue Sicht auf die Gebühr für Kunden.
- Sicherheit: `job_contact` prüft Anmeldung, aal2, Firma und Zugriff vor der Audit-Zeile (0065:42-47). `partner_data_access` ist für keine Rolle aufrufbar (0065:31, Probe `:129, 161`). Kein Secret, kein Seed, keine Policy geändert. Missbrauch: Ein kostenloser Kundenstorno nimmt der Firma sofort Kontakt und Fotos (gewollt, Nr. 154); Listing und `my_jobs` enthalten keine Kundendaten (0064:153-155).
- Schema: keine Tabelle, kein Constraint, kein Trigger geändert; `assignment_access` unverändert (0030:87-95).
- N1 und N2 der DB-Freigabe stehen in `docs/OFFEN.md:39` (st1-1), passend zum Endstand der Testdatei.

## Stichproben (selbst nachgeschlagen)

- `supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql:13-17` – Zeitbedingung neu in Zeile 14, Rest wie 0059:10-13. In Ordnung.
- `…0065…sql:24-28, 31` – Zugriff nur ohne Storno oder mit fälliger Pauschale; Entzug für alle Rollen. In Ordnung.
- `…0065…sql:46, 81` – die zwei Aufrufstellen. In Ordnung (N1 der Freigabe bleibt in OFFEN).
- `supabase/migrations/20261112120000_0059_partner_cancel_preview.sql:28, 39-47` – Zeitgrenze der Gründe; Berechtigung vor Belegen. In Ordnung.
- `supabase/migrations/20261113100000_0060_job_contact_after_cancel.sql:7-18, 33-38` – Summe der Gebührenzeile samt Gegenbuchung; alte Sperre nur nach Firmenstorno. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:335-343` – Gegenbuchung aller Zeilen `booking` und `change`. In Ordnung.
- `…0062…sql:735-741, 766, 792-793, 801-807` – Kundenstorno und Firmenstorno: Status, Zuordnung, Gegenbuchung, Gebührenzeile, Grundlage. In Ordnung.
- `…0062…sql:893-901, 926-940` – `negate_fee` und Storno durch admin. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:153-166` – `my_jobs`: Status des Auftrags, Summe des Journals, Fenster. In Ordnung.
- `supabase/migrations/20261108130000_0030_job_listings.sql:87-98` – `assignment_access`. In Ordnung.
- `supabase/functions/_shared/cancel/partner.ts:48-55, 62-73` – Belege und Betrag gehören zusammen; Abgleich vor dem Schreiben. In Ordnung.
- `supabase/functions/_shared/database.types.ts:1768-1793` – Signaturen unverändert. In Ordnung.
- `src/lib/partnerJobs.ts:247, 269-270, 305-306` – `cents`, Summen aus `my_jobs`, `contactLocked`. In Ordnung.
- `src/screens/partner/Auftraege.tsx:208-216, 222, 262-263` – einzige Verwendung von `contactLocked`; Anzeige folgt dem Serverbetrag. In Ordnung, Wortlaut siehe Hinweis.
- `tests/rls/job-contact-after-cancel.test.ts:89, 95, 134-137` – Kontrolle E1 und Erwartungen. In Ordnung.
- `tests/rls/job-contact-after-cancel.test.ts:170-174, 188-190` – echter kostenloser Kundenstorno, Kontakt und Fotos gesperrt, `my_jobs` bleibt. In Ordnung.
- `tests/rls/job-contact-after-cancel.test.ts:74-83, 175` – Kundenstorno mit Pauschale nachgestellt. Bekannt (st1-1).
- `tests/rls/cancellation-partner-preview.test.ts:79-85, 124-134, 185-192` – Termine der Fälle. Siehe M1.
- `tests/rls/cancellation-partner-preview.test.ts:157-161, 204-205` – Proben vor und ab dem Termin, Grenze. In Ordnung.
- `tests/rls/cancellation-partner.test.ts:231-233, 237, 244, 282-288` – S1 und S5 ab Termin, S2 in 5 Tagen. Siehe N1, M1.
- `tests/unit/partner-cancel.test.ts:84-94` – sieben Fälle. In Ordnung.
- `tests/e2e/partner-absage.spec.ts:54-60` – Kundenstorno ohne Pauschale, kein Kontaktknopf. In Ordnung.
- `tests/e2e/jobs-helpers.ts:77, 324-339` – Mock ohne Zeitbezug. Siehe N3.
- `tests/rls/partner-functions-live.test.ts:74-75, 83-91, 138-153` – J4 in 14 Tagen, erwartet 6.900. Siehe H1.
- `tests/rls/journal-live.test.ts:80-81, 97-103, 195` – dasselbe. Siehe H1.
- `tests/rls/flow-live.test.ts:336-358` – W4 erwartet jetzt `not_assigned`. Siehe M2.
- `tests/support/positiv.ts:244-247, 293-300, 408-411` – Registerzeilen auf laufenden Aufträgen bzw. ohne Pauschale; von 0065 nicht berührt. In Ordnung.
- `tests/rls/admin-correct.test.ts:162, 244-246` – Pauschale durch admin nutzt `call_out_base` direkt; von 0065 nicht berührt. In Ordnung.
- `tmp/proof/st1/runs.jsonl:1-16` – Reihenfolge, Exit-Codes, Push-Marken. Siehe Prüffrage 1.
- `tmp/proof/st1/001-…log:21, 41`, `002-…log:21, 41`, `003-…log:22`, `005-…log:22, 34`, `006-…log:21, 41` – Ist-Werte vor dem Push. In Ordnung.
- `tmp/proof/st1/004-…log:13-17, 29` – grün vor dem Push. Siehe N1.
- `tmp/proof/st1/007-…log:21-29`, `008-…log:22-29` – rot nach dem Push, Ursache im Test. Siehe N2.
- `tmp/proof/st1/009-…log:28`, `010-…log:28`, `011-…log:28`, `012-…log:22`, `013-…log:54` – Exit 0. In Ordnung.
- `tmp/proof/st1/014-…log:13-41, 45-62, 81` – 18 von 19, W4 rot, Exit 1. Siehe M2.
- `tmp/proof/st1/loesch-lauf.jsonl:1` – Aufräumen nur im Lauf 14 über `sweep.ts`, Endzahlen 0, nicht final. In Ordnung.
- `docs/ENTSCHEIDUNGEN.md:154-156, 160, 187` – Nr. 148, 149, 150, 154, 180 im Wortlaut. In Ordnung.
- `docs/OFFEN.md:39` – st1-1 mit N1 und N2 der DB-Freigabe. In Ordnung.

Offene Findings hoch: 1
