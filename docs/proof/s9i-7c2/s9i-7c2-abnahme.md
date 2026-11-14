Modell: claude-fable-5-2

# Abnahme s9i-7c2 (Rest), Kennung 7c2-1311-c

Datum: 2026-11-13
Branch: `s9i-7c2`, Stand HEAD 012c802 (Diff `main..HEAD`, Dateien selbst gelesen)

Geprüfter Umfang (alles ganz gelesen, soweit nicht anders vermerkt):
- `supabase/migrations/20261113110000_0061_accept_basis_cast.sql`, Nachtragsprüfung `tmp/proof/s9i-7c2-fable-fix-nachtrag.md`
- `tests/rls/flow-live.test.ts`, `tests/rls/listings.test.ts:1-240`, `tests/support/sweep.ts`, `tests/unit/journal-csv.test.ts`
- Hilfen: `tests/support/partner.ts`, `db.ts`, `owner.ts`, `totp.ts`, `scripts/dev-guard.mjs`
- Server, soweit für die Erwartungsanpassungen nötig: `supabase/functions/_shared/cancel/handlers.ts`, `cancel/db.ts`, `jobs/handlers.ts`, `pricing/fee.ts:17-25`, `pricing/change.ts:29-43`, Migrationen 0030:87-98, 0038:624-639, 0042:99-152, 0046:293-335, 0060 (ganz), 0028:192-196
- Nachweise: `tmp/proof/s9i-7c2-flow-ist-4.txt`, `-flow-live-4.csv`, `-flow-run-5.log` bis `-9.log`, `-0061-rot.log`, `-0061-gruen.log`, `-gegenprobe-1.log`, `-gegenprobe-1-diff.log`, `-suche.md`, `-pruefung-rest.md`, `-ausgangslage-3.log`, dazu `tmp/reports/flow-live-ist.txt` (Ist-Datei der Gegenprobe)
- Doku: `docs/AUTOPILOT.md:211` (Entscheidung 104), `docs/OPEN_ISSUES.md:574-603`

**Ergebnis: Geld und Sicherheit sind abgenommen, kein Fund der Schwere hoch.** Summen und Aufteilung stimmen, die Erwartungsanpassungen der Läufe 5 bis 8 verdecken keinen Fehler. Vor dem Merge sind fünf mittlere Punkte zu schließen (M1 bis M3 und M5 im Branch, M4 ist eine Entscheidung für Beks).

Grenzen der Prüfung: nur Lese- und Suchwerkzeuge, keine Shell, kein `git`, kein Zugriff auf Dev. Ich habe keinen Lauf wiederholt, keine Dateizeiten und keine Byte-Gleichheit der Kopien geprüft und den Endzustand auf Dev nicht abgefragt. Die Aussage zu `check` (M2) folgt aus dem gelesenen Code und ist nicht gemessen. Das eingebaute Berater-Tool habe ich nicht aufgerufen.

## Findings

### hoch

Keine.

### mittel

**M1 – Kein Grünlauf auf dem committeten Stand, Ist-Kopf nennt einen Commit ohne den getesteten Code**
- `tmp/proof/s9i-7c2-flow-run-9.log:1` – Hash 3b864cf, Arbeitsbaum nicht sauber (ehrlich vermerkt). `tmp/proof/s9i-7c2-flow-ist-4.txt:1` – nennt nur „commit 3b864cf“, enthält aber W4 und W5, die erst in 012c802 stehen. `tests/rls/flow-live.test.ts:80` – schreibt nur den Kurz-Hash, kein Kennzeichen für ungespeicherte Änderungen.
- Mildernd: Die Gegenprobe lief auf 012c802 plus Proben (`tmp/proof/s9i-7c2-gegenprobe-1.log:1`). Dort sind die 11 unveränderten Tests grün (auch W4, W5 und die Summen), die 5 anderen fallen genau an der Probenzeile, und die Zeilennummern (235, 266, 313, 422, 450) passen zum HEAD-Stand. Auf HEAD nie ausgeführt sind nur die Zeilen hinter den Probenstellen: `flow-live.test.ts:267-268` (Folgeanfrage W2A), `314-322` (W3: Summe, Outbox, `my_cancel_info`, `job_contact`), `451`.
- Fix: ein Abschlusslauf von `flow-live` auf sauberem HEAD in neue Dateien (Lauf-Log mit `EXIT=`, Ist, CSV). Ist-Kopf um ein Kennzeichen ergänzen, wenn der Arbeitsbaum Änderungen hat. Danach erst die Kopie nach `docs/proof/s9i-7c2/`.

**M2 – Volläufe nach 0061 fehlen weiter; `check` ist nach dem Code voraussichtlich rot**
- `tests/rls/flow-live.test.ts:12` – importiert `service`, die Datei nutzt die Kennung sonst nirgends (Suche: einzige Fundstelle als Bezeichner ist der Import; `:106`, `:107`, `:115` sind Objektschlüssel und SQL-Text). `tsconfig.json:12` setzt `noUnusedLocals`, `tsconfig.node.json:2` erbt das und `:7` schließt `tests` ein. Erwartete Folge: Typecheck-Fehler für eine ungenutzte Deklaration. Nicht gemessen.
- `tmp/proof/s9i-7c2-pruefung-rest.md:7` – verweist für Auflage M2 des Nachtrags auf „Volläufe“. In `tmp/proof/` liegt davon nur `s9i-7c2-ausgangslage-3.log:4-6` (Migrationsliste 61 Einträge, 0 abweichend, Exit 0). Es fehlen: `check`, `db:types` ohne Diff, `test:rls` komplett (darin der Rechte-Test `tests/rls/rls.test.ts:494-498` nach 0061).
- Fix: Import entfernen. Dann `check`, `db:types`, `test:rls` komplett, je in eine neue Datei mit `EXIT=`. Vorher kein Merge.

**M3 – Testname und Lauf-Log behaupten das Gegenteil der Messung (W4, `job_contact`)**
- `tests/rls/flow-live.test.ts:327` – Titel endet auf „job_contact gesperrt“. `:343-346` erwarten das Gegenteil: kein Fehler, eine Zeile. `tmp/proof/s9i-7c2-flow-run-9.log:21` trägt den falschen Titel in die Beweiskette; wer nur das Log liest, hält die Sperre für belegt.
- Fix: Titel auf „job_contact bleibt im Zugriffsfenster (Entscheidung 104, S9i7-10 c)“ ändern. Der Abschlusslauf aus M1 schreibt dann den richtigen Namen.

**M4 – Datenminimierung: Kontaktdaten nach kostenlosem Kundenstorno weiter lesbar (Bestand, jetzt als Soll im Test)**
- `supabase/migrations/20261113100000_0060_job_contact_after_cancel.sql:4` und `:34-38` – die Sperre greift nur bei Ende durch die Firma. `supabase/migrations/20261108130000_0030_job_listings.sql:87-95` – sonst gilt das Fenster aus `partner_access_days`. Ist in W4 (`flow-live.test.ts:344-346`): Die Firma liest nach einem Storno ohne Gebühr weiter Name, Telefon, Mail und Adresse.
- Einordnung: kein Fehler dieses Branches. Es entspricht der Entscheidung Beks vom 01.11.2026 und Entscheidung 104 (`docs/AUTOPILOT.md:211`) und ist als offen geführt (`docs/OPEN_ISSUES.md:577` S9i7-10 c, `:589` S9i7b2-3). Die Anpassung des Tests an den Ist-Wert ist vertretbar.
- Entscheidung des Beraters, zur Vorlage an Beks: Nach Kundenstorno ohne Stornogebühr `job_contact` sofort sperren, sinngemäß wie 0060 (offen nur, solange die Firma eine Forderung hat). Eigene Migration mit Plan-Freigabe, nicht in diesem Branch, vor dem Öffnen der Buchung. S9i7-10 (c) um den Ist-Beleg aus W4 ergänzen. Kippt die Entscheidung, dreht sich die Erwartung in `flow-live.test.ts:344-346`.

**M5 – Aufräumen ist nur zu einem Drittel belegt**
- `tmp/proof/s9i-7c2-flow-ist-4.txt:29` – einzige Zeile `AUFRÄUMEN`: 2 Belegobjekte gelöscht. Das passt zu genau zwei Uploads im Lauf (`flow-live.test.ts:194`, `:296`).
- `tests/rls/flow-live.test.ts:130` – die Schritte „Firmen und Nutzer“ und „Konten“ schreiben bei Erfolg nichts. `tests/support/sweep.ts:81-88` – im Modus `final` werden Fehler und Reste nur auf der Konsole gewarnt, nichts geht in die Ist-Datei. `tests/support/db.ts:44-46` – Fehler von `deleteUser` werden nicht ausgewertet. `flow-live.test.ts:83` – die Zahl des Vorab-Löschens wird verworfen.
- Die Suche nach „Aufräumen“, „warn“ und „stderr“ in `-flow-run-9.log` und `-gegenprobe-1.log` hat keinen Treffer. Das ist das Fehlen einer Meldung, kein Ist-Wert. Der Endzustand auf Dev nach dem letzten Lauf (Gegenprobe, 23:26) ist nicht gemessen; Firma a stand dort zuletzt auf `payment_hold` (`gegenprobe-1.log:115-139`).
- Fix: `afterAll` schreibt nach dem Sweep eine Zählzeile in die Ist-Datei: Testfirmen mit Status `active` oder `payment_hold` = 0, ungebundene = 0, Belegobjekte von Testfirmen = 0, Status der Firma a = `suspended`. Die Vorab-Zahl ebenfalls. Beleg im Abschlusslauf aus M1.

### niedrig

**N1 – Nachtragssumme T wird aus der Vorschau gelesen**
- `tests/rls/flow-live.test.ts:206-208` – `ctx.t1` kommt aus der Antwort von `change-propose`; geprüft ist nur „größer als die Buchung“ und `baseCents`. Die Aufteilung dahinter ist unabhängig (siehe Prüffrage 1), der Betrag selbst nicht.
- Fix: T als Literal 76041 erwarten. Herleitung: Stundensatz 7080 bei 5 Stunden (`tests/unit/pricing.test.ts:31`), 6 Stunden ergeben 68961 + 7080.

**N2 – Nullsummen ohne Zeilenzahl**
- `tests/rls/flow-live.test.ts:387-403` – `ZERO` gilt auch, wenn gar keine Zeile kommt. W5 (keine Zeile) und W2A, W2B, W4 (je zwei Zeilen, Summe 0) sind nicht unterscheidbar. `:443` verlangt nur mindestens 8 Zeilen, Ist sind 11.
- Fix: Zeilenzahl je Auftrag prüfen (2, 2, 2, 3, 2, 0) und 11 gesamt.

**N3 – „Gebühr unsichtbar“ ohne Positivkontrolle**
- `tests/rls/flow-live.test.ts:426` – `empty()` wertet jeden Fehler als „leer“. Ein Tippfehler in Spalte oder Tabelle bestünde den Test, ohne RLS zu messen. Heute sind die Spalten gültig (`0042:103`, `0028:195-196`).
- Fix: dieselbe Abfrage als Firma a mit aal2 muss mehr als 0 Zeilen liefern; als Fehler nur 42501 zulassen.

**N4 – Titel passen nicht zum Rumpf**
- `tests/rls/flow-live.test.ts:143` – nennt Nachtragszeile und `splitChange`, der Rumpf prüft Buchung, Pauschale und Angebot. `:381` – „80000-Summe“ ist ein Rest.
- Fix: Titel anpassen.

**N5 – `offer-confirm`: Antwort und Snapshot nicht auf Gebührenfelder geprüft**
- `tests/rls/flow-live.test.ts:365-366` – nur Status 200. Bei `cancel-customer` (`:338`) und `change-decide` (`:228`) ist der Körper exakt geprüft. `:431-433` prüft nur den Snapshot des Nachtrags von W1.
- Fix: Körper exakt erwarten (`jobs/handlers.ts:157` liefert nur den Status) und die Angebots-Revision von W5 in die Feldprüfung aufnehmen.

**N6 – Kunde an `accept` und `photo-receipt`: gemessen wird die aal2-Prüfung**
- `tests/rls/flow-live.test.ts:164`, `:189` – das 403 kommt aus `jobs/handlers.ts:57`, derselbe Zweig wie beim aal1-Token der Firma. Kein Fehler; die Rollenprüfung dahinter ist hier nicht berührt. Kommentar genügt.

**N7 – `dev-guard` nur mittelbar**
- `tests/rls/flow-live.test.ts:15` – der Wächter kommt über `tests/support/sweep.ts:7`. Wirksam, weil alle Importe vor dem ersten DB-Zugriff laufen, aber er fällt weg, sobald der Import von `sweep.ts` entfällt. Die Datei committet Fixtures, setzt einen Firmenstatus und löscht Objekte.
- Fix: den Wächter als ersten Import der Testdatei.

**N8 – Offen aus dem Nachtrag**
- `tests/rls/listings.test.ts:187` – weiter ohne `as: 'service_role'` und mit Sammel-Boolean (dort N1, N2).

**N9 – Doku**
- `docs/OPEN_ISSUES.md:601` – S9i7c2-2 führt `offer-confirm` und `cancel-customer` noch als ohne Live-Aufruf; nach W4 und W5 bleibt nur `admin-correct`.
- `docs/PROGRESS.md` – der Verfahrensverstoß M1 des Nachtrags steht dort noch nicht (Suche ohne Treffer). Fix: vor dem Abschluss-Commit nachtragen, auch im Bericht an Beks.

**N10 – Beweiskette, Kleinigkeiten**
- `tmp/proof/s9i-7c2-flow-run-9.log:36` – Meldung, dass der Worker nicht rechtzeitig endete (offener Handle); Exit 0 bleibt.
- `tmp/proof/s9i-7c2-flow-run-9.log:7-28` – 15 von 16 Testnamen; der schnelle Konstanten-Test fehlt in der Liste grüner Läufe (in den roten steht er, z. B. `-flow-run-8.log:7-8`).
- `tmp/proof/s9i-7c2-gegenprobe-1-diff.log:2-3` – „sauber: ja“ stützt sich auf `git diff`, das unversionierte Dateien nicht sieht.
- Die Endnachweise (Lauf 9, Ist 4, CSV 4, Gegenprobe, Suchtabelle) liegen noch nicht unter `docs/proof/s9i-7c2/`; dort liegt weiter `s9i-7c2-flow-run-4.log` ohne `EXIT=`.
- `tmp/proof/s9i-7c2-ausgangslage-3.log:7` – Projekt-Ref in der Befehlszeile. Kein Geheimnis, aber der Scanner läuft vor der Kopie.

**N11 – `sweepReceiptObjects`**
- `tests/support/sweep.ts:32` – mehr als 50 Treffer brechen den ganzen Test ab; sammeln sich Reste anderer Testdateien, bleibt `flow-live` rot bis zum Aufräumen von Hand. Ein Negativtest (Beleg einer Firma ohne Marker bleibt liegen) fehlt. Restrisiken des Markers wie `docs/OPEN_ISSUES.md:584` (S9t-2 b, c, e).

## Prüffragen

### 1. Geld

Die Werte stimmen. Nachgerechnet mit der Regel aus CLAUDE.md (Gebühr = round(Gesamt × Satz), netto = round(Gebühr / 1,2), USt. = Gebühr − netto, Partner = Gesamt − Gebühr), von Hand und gegen die Ganzzahl-Formel in `pricing/fee.ts:22-23`:

| Fall | Gesamt | Gebühr | netto | USt. | Auszahlung | Rechnung |
|---|---|---|---|---|---|---|
| BOOKED | 68961 | 10344 | 8620 | 1724 | 58617 | 10344,15 → 10344; 8620,0 |
| CALL_OUT | 6900 | 1035 | 863 | 172 | 5865 | 1035,0; 862,5 → 863 (halb aufrunden) |
| OFFER | 150000 | 22500 | 18750 | 3750 | 127500 | glatt |
| T (W1 gesamt) | 76041 | 11406 | 9505 | 1901 | 64635 | 11406,15 → 11406; 9505,0 |
| Nachtragszeile | 7080 | 1062 | 885 | 177 | 6018 | T minus BOOKED je Spalte |

- Ist-Werte: `tmp/proof/s9i-7c2-flow-ist-4.txt:3`, `:8`, `:15`, `:20`, `:21-26`. Jede Zeile erfüllt netto + USt. = Gebühr und Gesamt − Gebühr = Auszahlung.
- CSV (`tmp/proof/s9i-7c2-flow-live-4.csv:2-12`): 11 Zeilen, je Auftrag dieselben Summen; jede Gegenbuchung verweist auf die Journal-ID ihrer Buchung (`:5`, `:7`, `:10`, `:12`); Satz 0,15; Monat 2026-11; keine Kundendaten.
- Die Nachtragszeile ist die Differenz der Komponenten, nicht die Aufteilung der Differenz (`pricing/change.ts:29-40`); der Test rechnet genauso (`flow-live.test.ts:224`).
- Kaution und Kraftstoff kommen in diesen Wegen nicht vor.

Unabhängigkeit der Erwartungswerte:
- BOOKED, CALL_OUT, OFFER sind Literale (`flow-live.test.ts:21-23`). `beforeAll` (`:90-94`) und der Konstanten-Test (`:143-151`) prüfen den Code gegen die Literale, nicht umgekehrt. Der Satz ist auf 0,15 festgenagelt (`:150`).
- Die Nachtragszeile rechnet Postgres mit `numeric` (`:221-224`), unabhängig vom JavaScript-Modul; `splitChange` wird danach nur dagegen verglichen (`:232-233`).
- 6900 kommt aus den Bedingungen der Fixture (`:105`), die 0 in W4 aus 48 Stunden Freifrist bei Termin in 14 Tagen.
- Zurückgelesen wird nur T (N1). Mit dem Stundensatz aus `tests/unit/pricing.test.ts:31` ist 76041 unabhängig bestätigt.
- Summen aus `my_commissions` und aus der Datei werden getrennt gebildet (`:393`, `:394-403`); die Datei wird aus ihrem Text zurückgelesen, nicht aus den Zeilenobjekten.

### 2. Sicherheit der Fixtures

Ja, die Daten sind auf die Testmarkierung begrenzt.
- Testfirma heißt: Kontaktadresse im Markermuster, nicht die Abdeckungsfirma, kein Mitglied außerhalb der Testkonten (`tests/support/sweep.ts:13-14`). Gebundene Firmen werden gesperrt, nicht gelöscht (`:55-65`).
- `sweepReceiptObjects` (`sweep.ts:27-39`): nur Belege von Testfirmen mit vorhandenem Objekt, nur über die Storage-API, Abbruch ohne Löschen bei mehr als 50 Treffern oder einem Pfad außerhalb des UUID-Musters, Nachzählung muss 0 sein. Ist: 2 gelöscht, 2 hochgeladen.
- `payment_hold` trifft nur die Firma dieses Laufs: ID, Kontaktadresse des Laufs, keine fremden Journalzeilen, genau eine Audit-Zeile (`flow-live.test.ts:437-446`). Der Akteur ist der Test-Admin aus dem Skript, nicht aus Anfragedaten.
- `dev-guard` prüft drei Refs und beendet den Prozess (`scripts/dev-guard.mjs:7-16`); siehe N7.
- Kontaktdaten der Fixture sind erfunden und nutzen die reservierte Test-Domain (`flow-live.test.ts:109`, `:117`).
- Geheimnisse: Die Suche in allen `tmp/proof/s9i-7c2-*` nach Token-Anfängen, Schlüssel-Präfixen, Verbindungszeichenketten, Passwort-Zuweisungen und Autorisierungs-Kopfzeilen hat 0 Treffer. Die Logs nennen nur den Dateinamen der Umgebungsdatei. Fehlertexte der Tests geben nur Status und Antwortkörper aus, keine Tokens.
- Rest auf Dev je Lauf (bekannt, `flow-live.test.ts:4`): Kunde, 6 Aufträge, Folgeanfrage, Journal, eine gesperrte Firma, Belegzeilen ohne Objekt. Die Gegenprobe hat einen zweiten Satz hinterlassen.

### 3. Gegenprobe

Alle fünf Proben zeigen einen Ist-Wert, keine scheitert nur an einem Schritt.

| Probe | Stelle | Ist-Wert im Log |
|---|---|---|
| W1-Summe +1 ct | `gegenprobe-1.log:36-47` | 76041 statt 76042 |
| `job_contact` nach W2A erlaubt | `:56-69` | Fehler P0001 `not_assigned` |
| W3 Gebühr +1 ct | `:76-89` | 1035 statt 1036 |
| fremde Firma sieht Zeilen | `:103-107` | 0 Zeilen |
| `payment_hold` liefert 0 Zeilen | `:116-134` | 11 Zeilen mit ID, Art, Beträgen |

- Rücknahme belegt: `gegenprobe-1-diff.log:1-4`, Exit 0. Dass der Wrapper rote Läufe als `EXIT=1` schreibt, zeigen `gegenprobe-1.log:154` und die Läufe 5, 6, 8.
- Einordnung: Es sind verdrehte Erwartungen, keine gelockerten Sperren. Sie belegen, dass die Prüfungen echte Werte vergleichen. Dass die Messung Zeilen sehen kann, zeigen die Positivfälle im selben Test: Firma a liest 11 Zeilen über dieselbe Funktion und denselben Filter, `job_contact` liefert vor dem Storno eine Zeile (`flow-live.test.ts:255-258`) und mit Pauschale ebenfalls (`:318-321`). Eine echte Lockerungsprobe bräuchte eine gelockerte, deployte Function (wie `docs/OPEN_ISSUES.md:580`). Für 0061 gibt es den Rot-Grün-Beleg auf Systemseite (`-0061-rot.log:4-10`, `-0061-gruen.log:2-4`).
- Ohne Probe: W4, W5, „Gebühr unsichtbar“ (dort auch ohne Positivkontrolle, N3), die Rechtefälle 401/403/404 an `accept`.

### 4. Lücken

- `admin-correct` live (bewusst offen, S9i7c2-2).
- Kundenstorno mit Gebühr größer 0 (späte Stufe, Halbcent-Rundung bei 50 % von 68961) und nach dem Start: live nicht geprüft, nur auf SQL-Ebene (laut Suchtabelle `cancellation.test.ts:91`, von mir nicht gelesen).
- W5: Buchung 150000 ist nur per Eigentümer-SQL geprüft (`flow-live.test.ts:369`), nicht über `my_commissions` und die Datei, weil der Auftrag nicht endet. Kein zweites Angebot, kein zurückgezogenes oder abgelaufenes Angebot, kein `partner_not_active`.
- Edge `quote` und damit die Kette Preisberechnung → Speichern → Verteilen ist nicht Teil des Durchgangs (Fixture per SQL, `flow-live.test.ts:3`).
- `accept` unter `payment_hold` über die Edge Function; nur auf SQL-Ebene (`listings.test.ts:145-146`).
- Wettlauf zweier Zuschläge über die Edge Function (hier nur nacheinander, `flow-live.test.ts:174`).
- Mails: nur Outbox-Zeilen gezählt, kein Versand.
- Monatsgrenze des Abrechnungsmonats.
- Volläufe auf HEAD (M2), Grünlauf auf sauberem Stand (M1), Endzustand des Aufräumens (M5).

### 5. Wrapper und Beweiskette

- Jeder Lauf hat Kopfzeile (Kennung, Hash, Zustand des Arbeitsbaums), Befehl und `EXIT=`. Der Wrapper liefert nachweislich 1 bei Rot (Läufe 5, 6, 8, Gegenprobe) und 0 bei Grün (7, 9).
- Lauf 9 und Ist 4 gehören zusammen: Start 23:20:50 (`-flow-run-9.log:32`), Ist-Kopf 22:21:09 UTC, Buchungszeiten der CSV 23:22 bis 23:24. Die Journal-IDs der Gegenprobe (`gegenprobe-1.log:123-133`) kommen in der CSV 4 nicht vor; die Kopien stammen also nicht aus dem späteren Lauf.
- Rot vor Grün bei 0061: Reihenfolge laut `-pruefung-rest.md:5`, Ist-Wert 42804 im Rot-Log.
- Schwächen: M1 (Stand nicht committet, Ist-Kopf), M3 (falscher Titel im Log), M5 (Aufräumen), N10.
- Verfahrensverstoß M1 des Nachtrags (Push vor Prüfung des SQL) ist in `-pruefung-rest.md:3-8` ausgewiesen; inhaltlich ist 0061 abgenommen. Der Eintrag in `docs/PROGRESS.md` fehlt noch (N9).

### Anpassungen an den Ist-Wert (Läufe 5 bis 8)

| Anpassung | Beleg | Urteil |
|---|---|---|
| Firma an `cancel-customer` und `offer-confirm`: 404 statt 403 | `-flow-run-5.log:33-39`; `cancel/handlers.ts:37` und `jobs/handlers.ts:144` (kein aal2), `0046:302` und `0038:633-635` (`not_found` für Nicht-Eigentümer), `jobs/handlers.ts:19` | Vertretbar, so entworfen. Fremde und nicht vorhandene Anfrage antworten gleich, es gibt kein Orakel. 403 wäre schlechter. |
| `job_contact` nach Kundenstorno bleibt offen | `-flow-run-6.log:33-39`; `0060:4`, `:34-38`; Entscheidung 104; `docs/OPEN_ISSUES.md:577`, `:589` | Vertretbar, kein verdeckter Fehler: dokumentierter Bestand mit offener Entscheidung. Aber Titel falsch (M3) und Empfehlung zur Sperre (M4). |
| W5-Summe in `my_commissions` erst nach Abschluss | `-flow-run-8.log:35-51`; `0042:109-112` (Zeilen nur mit Ende-Ereignis); gleiches Verhalten bei W1 vor dem Abschluss (`flow-live.test.ts:239-240`) | Vertretbar, so entworfen. Die Buchung selbst ist geprüft (`:369`). Rest: N2 und Lücke W5. |

## Stichproben

| Datei:Zeile | Ergebnis |
|---|---|
| `supabase/migrations/20261113110000_0061_accept_basis_cast.sql:27` | Cast auf `bigint`, sonst kein Grant, kein Drop |
| `supabase/functions/_shared/pricing/fee.ts:22-23` | Ganzzahl-Rechnung, halb aufrunden; ergibt die Literale |
| `supabase/functions/_shared/pricing/change.ts:32-40` | Differenz der Komponenten |
| `tests/rls/flow-live.test.ts:21-23` | Literale, von Hand bestätigt |
| `tests/rls/flow-live.test.ts:90-94` | Abbruch vor dem Commit der Fixtures, wenn der Satz nicht passt |
| `tests/rls/flow-live.test.ts:221-224` | unabhängiger Rechner in Postgres |
| `tests/rls/flow-live.test.ts:12` | `service` importiert, nicht genutzt |
| `tests/rls/flow-live.test.ts:327` gegen `:343-346` | Titel widerspricht der Erwartung |
| `tests/rls/flow-live.test.ts:387` | W5 mit Nullsumme, begründet im Kommentar |
| `tests/rls/flow-live.test.ts:426` | jeder Fehler gilt als „leer“ |
| `tests/rls/flow-live.test.ts:437-446` | `payment_hold` nur für die Firma des Laufs |
| `tests/support/sweep.ts:13-14` | Marker plus Mitgliedsprüfung |
| `tests/support/sweep.ts:27-39` | Deckel 50, UUID-Pfad, Nachzählung |
| `tests/support/sweep.ts:81-88` | `final`: nur Warnung |
| `tests/support/db.ts:44-46` | Fehler von `deleteUser` nicht ausgewertet |
| `scripts/dev-guard.mjs:7-16` | drei Refs, Abbruch |
| `tests/rls/listings.test.ts:187` | ohne `as`, Sammel-Boolean |
| `tests/unit/journal-csv.test.ts:36`, `:45-56` | Zeilenformat und Nullsumme aus dem Dateitext |
| `tests/unit/pricing.test.ts:31` | Stundensatz 7080 bei 5 Stunden, bestätigt T |
| `supabase/functions/_shared/cancel/handlers.ts:37`, `:52-59` | ohne aal2, Vorschau und Storno aus derselben Basis, Antwort ohne Gebühr |
| `supabase/functions/_shared/jobs/handlers.ts:19`, `:57`, `:144-157` | `not_found` = 404, aal2-Zweig, Antwort nur Status |
| `supabase/migrations/20261109180000_0046_cancel_by_partner.sql:302` | `not_found` für Nicht-Eigentümer |
| `supabase/migrations/20261109100000_0038_partner_offers.sql:633-635` | `not_found` für Nicht-Eigentümer |
| `supabase/migrations/20261109140000_0042_completion.sql:109-112`, `:139-143` | Zeilen nur mit Ende-Ereignis; aal2 und Mitgliedschaft |
| `supabase/migrations/20261113100000_0060_job_contact_after_cancel.sql:34-38` | Sperre nur nach Ende durch die Firma |
| `supabase/migrations/20261108130000_0030_job_listings.sql:87-95` | Zugriffsfenster |
| `tsconfig.json:12`, `tsconfig.node.json:2`, `:7` | `noUnusedLocals` gilt für `tests` |
| `tmp/proof/s9i-7c2-flow-ist-4.txt:3`, `:8`, `:15`, `:20` | Journalzeilen wie erwartet |
| `tmp/proof/s9i-7c2-flow-ist-4.txt:21-26` | Summen aus Funktion, Datei und Erwartung gleich |
| `tmp/proof/s9i-7c2-flow-ist-4.txt:27-29` | fremde Firma 0 Zeilen; 11 = 11; 2 Objekte gelöscht |
| `tmp/proof/s9i-7c2-flow-live-4.csv:2-12` | 11 Zeilen, Bezüge und Summen stimmen |
| `tmp/proof/s9i-7c2-flow-run-9.log:1`, `:31`, `:36-37` | Stand nicht committet; 16 bestanden; Worker-Meldung; Exit 0 |
| `tmp/proof/s9i-7c2-flow-run-5.log:33`, `-6.log:33`, `-8.log:35` | die drei Erwartungsfehler mit Ist-Wert |
| `tmp/proof/s9i-7c2-gegenprobe-1.log:36`, `:56`, `:76`, `:103`, `:116`, `:154` | fünf Ist-Werte, Exit 1 |
| `tmp/proof/s9i-7c2-gegenprobe-1-diff.log:1-4` | Rücknahme, Exit 0 |
| `tmp/reports/flow-live-ist.txt:1`, `:28` | Ist-Datei der Gegenprobe (012c802), nur eine Aufräum-Zeile |
| `tmp/proof/s9i-7c2-0061-rot.log:4-10`, `-0061-gruen.log:2-4` | 42804 und Exit 1; 14 bestanden und Exit 0 |
| `tmp/proof/s9i-7c2-ausgangslage-3.log:4-6` | 61 Migrationen, 0 abweichend |
| `tmp/proof/s9i-7c2-suche.md:7-9`, `:39` | W4 und W5 als neu geführt, Anpassungen genannt |
| `tmp/proof/s9i-7c2-pruefung-rest.md:3-8` | Verfahrensverstoß ausgewiesen; Volläufe nur behauptet |
| `docs/AUTOPILOT.md:211` | Entscheidung 104, Kundenstorno ausdrücklich unverändert |
| `docs/OPEN_ISSUES.md:577`, `:589`, `:601` | S9i7-10 c und S9i7b2-3 offen; S9i7c2-2 veraltet |
| `tmp/proof/s9i-7c2-*` (Suche nach Geheimnissen) | 0 Treffer |
| `docs/PROGRESS.md` (Suche nach dem Verfahrensverstoß) | 0 Treffer |

Offene Findings hoch: 0
