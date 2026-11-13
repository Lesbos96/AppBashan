Modell: claude-fable-5-2

# Abnahme s9i-7c1, Teil D: Journal-CSV der Firma (Geld, Rechte, Personendaten)

- Datum: 2026-11-13
- Branch s9i-7c1, HEAD laut Auftrag 1d8503e. Ich habe kein Shell-Werkzeug: `git diff main..HEAD` konnte ich nicht ausführen, geprüft ist der Dateistand im Arbeitsbaum.
- Gelesen (vollständig): `supabase/functions/_shared/commission/csv.ts`, `src/lib/partnerJournal.ts`, `src/lib/jobs.ts`, `src/screens/partner/Abrechnung.tsx`, `src/screens/Partner.tsx`, `tsconfig.json`, `vite.config.ts`, `tests/unit/journal-csv.test.ts`, `tests/unit/partner-journal.test.ts`, `tests/rls/journal-live.test.ts`, `tests/e2e/partner-journal.spec.ts`, `scripts/export-commissions.mjs`, Ablauf, Fakten, Plan, Planprüfung, `rot-3.log`, `gruen-7.log`, `gruen-8.log`, `bild-d/review-1.md`, `tmp/reports/journal-live-ist.txt`.
- Gelesen (Ausschnitt oder Suche): `tests/e2e/jobs-helpers.ts` (:187-229, :389-393), Migration 0042 (:77-154), 0028 (:1-60), 0023 (:81-105, :248), `tests/unit/jobs-client.test.ts` (:177-183), `tests/shots/partner.spec.ts` (:340-351), `tests/rls/journal.test.ts` (:368-382), `docs/OPEN_ISSUES.md` (Suche), übrige Rot- und Grün-Logs (Ergebniszeilen), `bild-7b2/review-paket-1..6.md` (Findings-Kopf und Zählung).

Ergebnis: Geld- und Sicherheitslogik sind in Ordnung, kein hohes Finding. Vor dem Abschluss-Commit sind M1 bis M4 zu erledigen.

## Findings

### hoch
Keine.

### mittel

**M1. Verweis auf einen OPEN_ISSUES-Eintrag, den es nicht gibt (Auflage A4, Prüffrage 8)**
- `src/screens/Partner.tsx:79` und `tmp/proof/s9i-7c1-ablauf.md:24` verweisen auf „OPEN_ISSUES S9i7c1-3“. Die Suche nach „7c1“ und „S9i7c“ in `docs/OPEN_ISSUES.md`, `docs/PROGRESS.md` und `docs/ROADMAP.md` liefert keinen Treffer.
- Problem: Die Hauptsession hat entschieden, `suspended` nicht aufzunehmen (`Partner.tsx:18`, `:76-82`). Das war laut A4 eine Entscheidung für Beks; ohne Eintrag ist es genau die stille Lücke, die A4 ausschließt. Der Server erlaubt gesperrten Firmen das Lesen ausdrücklich (`tests/rls/journal.test.ts:376-379`: „sonst bliebe ihr die Abrechnung verborgen“), die Oberfläche verbirgt es.
- Ebenfalls ohne Eintrag: Download nur im Web, Capacitor und iOS-Standalone-PWA ungeprüft (Entscheidung 4, A6); keine sichtbare Auftragsnummer, nur UUID (Entscheidung 2); Leistungsart und Nachtrags-ID fehlen in der Datei (`ablauf.md:9` nennt OPEN_ISSUES).
- Fix: Vier Einträge in `docs/OPEN_ISSUES.md` anlegen (S9i7c1-1 bis -4), den zu `suspended` als „Entscheidung Beks offen“ mit beiden Optionen (Karte auch für `suspended` oder Journal auf Anfrage per Admin-Export). Im Abschlussbericht Beks vorlegen. Kein Sicherheitsproblem, deshalb mittel.

**M2. Grün-Nachweise stammen nicht vom Endstand**
- `tmp/proof/s9i-7c1-gruen-4.log:1-2` (check) und `gruen-7.log:1-2` (live): Commit b68e42c, Arbeitsbaum nicht sauber. `gruen-8.log:1-2` (e2e): b8d05ef, nicht sauber. HEAD ist 1d8503e mit Änderungen an `Abrechnung.tsx` (Hinweistext), am Live-Test (Beleg-CSV) und an der e2e-Spec.
- `tests/rls/journal-live.test.ts:189` schreibt `tmp/reports/journal-live.csv`; die Datei existiert nicht (Suche `tmp/reports/*.csv`: kein Treffer). Der Live-Test in der Fassung von HEAD hat also keinen belegten Lauf.
- `gruen-8.log` enthält nur `partner-journal.spec.ts` (20 Tests). `Partner.tsx` und `tests/e2e/jobs-helpers.ts` sind geteilt; die übrigen Partner-Specs sind nach der neuen Karte nicht belegt.
- `bild-d/review-1.md:24` (mittel, Format-Hinweis) ist im Text geändert (`Abrechnung.tsx:54-56`), Runde 2 der Bildsicht fehlt.
- Fix: Auf sauberem HEAD einmal `check`, die ganze e2e-Suite und `journal-live.test.ts` laufen lassen, Logs mit Commit, „Arbeitsbaum sauber: ja“ und Exit-Code; `review-2.md` nachliefern.

**M3. Ist-Werte der Rechte-Matrix sind keinem Lauf zuzuordnen (Bewertung rot-3 siehe Prüffrage 7)**
- `tests/rls/journal-live.test.ts:48`: `appendFileSync` ohne Datum, Commit oder Lauf-Kennung; `tmp/reports/journal-live-ist.txt` hat zwei Zeilen ohne Herkunft und wird bei jedem Lauf länger. Die Ist-Werte für pending, rejected und suspended stehen nur in `expect` (`:134-138`), nicht in der Datei.
- Fix: Je Lauf eine Kopfzeile (ISO-Zeit, Commit) und eine Zeile für die drei Status schreiben; die Datei des Endlaufs byte-genau zu den Nachweisen kopieren. Im Bericht „Ist-Wert-Messung an unveränderter Sperre“ nennen, nicht „Rot-Beweis“.

**M4. Die UI-Schranke nach Firmenstatus ist nicht getestet**
- `ablauf.md:24` behauptet „Karte nur bei active/payment_hold“. Alle e2e-Tests öffnen mit `status: 'active'` (`tests/e2e/jobs-helpers.ts:391`), die Shots ebenso (`tests/shots/partner.spec.ts:341-345`). Kein Test belegt „payment_hold sieht die Karte“ oder „pending, rejected, suspended sehen sie nicht“; auch nicht „aal1 sieht sie nicht“ (MfaGate).
- Fix: Ein e2e-Test mit Schleife über die fünf Status (Region „Abrechnung“ sichtbar bzw. Anzahl 0, bei Anzahl 0 zusätzlich `journalCalls` leer).

### niedrig

**N1. `when()` prüft den Typ nicht** – `csv.ts:54-58`: `new Date(null)` ist gültig und ergäbe „01.01.1970 01:00“ statt `bad_row`; eine Zahl ebenso. Die Spalte ist `not null` (0028:30), praktisch tritt es nicht auf. Fix: `typeof iso === 'string'` und Form `^\d{4}-\d{2}-\d{2}T` verlangen, sonst `bad()`; Testfall `created_at: null`.

**N2. IDs werden nur entschärft, nicht geprüft** – `csv.ts:90-91`: `text(undefined)` liefert eine leere Zelle; eine einzelne Zeile ohne `entry_id` besteht auch die Eindeutigkeitsprüfung (`partnerJournal.ts:51-52`). Fix: in `journalCsv` für `entry_id` und `request_id` ein UUID-Muster verlangen, für `reverses_entry_id` UUID oder `null`, sonst `bad_row`; `text()` bleibt als zweite Schicht. Die Quoting-Tests (`journal-csv.test.ts:149-169`) laufen dann über `partner_name` des Admin-Exports.

**N3. Zwei Tests behaupten im Titel mehr, als sie messen**
- `tests/unit/journal-csv.test.ts:52-53`: „ergibt Summe 0“ summiert die Eingabe-Fixture, nicht die Datei. Fix: aus den Zellen 5, 7 bis 10 der erzeugten Zeilen summieren (Integer aus Ziffern, ohne Gleitkomma). Der Live-Test misst es an der Datei (`journal-live.test.ts:193-195`), dort nur für „Betrag Kunde“.
- `tests/e2e/partner-journal.spec.ts:72-83`: „während des Ladens ist der Knopf gesperrt“ wird nie geprüft (nur `toBeEnabled` am Ende). Fix: Antwort verzögern, `toBeDisabled()` und den Text „Wird erstellt …“ prüfen.

**N4. Fehlende Paging-Fälle** – `tests/unit/partner-journal.test.ts:66-72` deckt 1001 Zeilen. Es fehlen: genau 1000 Zeilen (ein Aufruf, `partnerJournal.ts:26`, `:38`) und ein Zähler, der sich zwischen zwei Seiten ändert (Dublette über die Seitengrenze → `unavailable`). Die Logik ist nach meiner Durchsicht richtig; Fix: zwei Testfälle.

**N5. Fehler ohne Code gelten als Netzfehler** – `partnerJournal.ts:21`: eine Gateway-Antwort ohne JSON (502/503) hat keinen `code` und wird „Keine Verbindung“. Beide Arten sind wiederholbar, keine Datei entsteht. Fix (optional): den HTTP-Status mitnehmen, Status 0 = `offline`, sonst `unavailable`. Ebenso läuft `0000-01` durch `MONTH` (`:10`) und endet erst am Server als `unavailable`.

**N6. Admin-Export bleibt hinter A1 zurück** – `csv.ts:100-101`: `fee_rate` ohne `rate()`, `kind` und `billing_month` ungeprüft, IDs ohne `text()`. Nicht Teil D, `euro()` ist bereits streng. Fix: `rate()` auch dort.

**N7. Wiederholte Stunde der Zeitumstellung ist in der Datei nicht unterscheidbar** – `tests/unit/journal-csv.test.ts:138-139`: 00:30 und 01:30 UTC ergeben beide „25.10.2026 02:30“. Die Zeilenfolge bleibt richtig (Sortierung nach `created_at`). Kein Fix nötig; in der Doku erwähnen.

**N8. Dauerreste in Dev** – `tests/rls/journal-live.test.ts:3`, `:97-104`: jeder Lauf hinterlässt drei Aufträge mit ihren Journalzeilen und fünf Firmen (unlöschbar, wie S9c-7). Fix: im OPEN_ISSUES-Eintrag S9c-7 um diesen Test ergänzen.

## Prüffragen

1. **Kundendaten in Datei, Abfrage, Logs: keine.** Die Abfrage sendet nur `p_month` (`partnerJournal.ts:29`) und liest 12 Spalten (`:14`, `:30`), keine davon personenbezogen. Der Typ `commission_row` hat keine Kundenspalte (0042:79-97), der Live-Test friert die Spaltenliste ein (`journal-live.test.ts:148-155`) und prüft, dass die Kunden-ID nicht in der Datei steht (`:192`). Der Dateiname enthält nur den Monat (`partnerJournal.ts:11`). In `partnerJournal.ts` und `Abrechnung.tsx` gibt es keine Konsolenausgabe und keinen Speicherzugriff (Suche ohne Treffer). `tmp/` ist in `.gitignore:14`.
2. **Beträge: in Ordnung.** `euro()` nimmt nur sichere Ganzzahlen oder Ziffernketten und rechnet mit BigInt (`csv.ts:38-44`); kein Gleitkomma, keine Summen, keine Neuberechnung. Minus ist ASCII 0x2D (`csv.ts:43`, Test `journal-csv.test.ts:80-84`). Betragsspalten laufen nie durch `text()` (`csv.ts:90-91`, Variante A; Test `:170-174`). Der Satz wird nur als Zeichenkette geprüft und umgeschrieben (`csv.ts:47-50`). Im App-Code steht kein fester Satz.
3. **CSV-Injection: geschlossen.** `text()` entschärft auch nach führendem Leerraum (`csv.ts:63`; Tests `journal-csv.test.ts:156-169`, Admin `:177-185`). Die Art kommt aus einer festen Tabelle mit `Object.hasOwn` (`csv.ts:78-88`), Monat, Zeit, Satz und Beträge sind formatgeprüft. Rest: N2.
4. **Paging und Vollständigkeit: in Ordnung.** Sortierung am Aufruf, `count: 'exact'`, Seiten zu 1000 (`partnerJournal.ts:26-39`); danach Zeilenzahl = Zähler (`:41`), IDs eindeutig und jeder `billing_month` = gewählter Monat (`:51-52`). Zeilen können einem Monat nur hinzukommen (Journal nur anfügen, frühester Endstatus); ein Zugang vor der Seitengrenze erzeugt eine Dublette und damit `unavailable`. Der Live-Test bestätigt Zähler = Zeilen gegen Dev (`journal-live.test.ts:125`). Rest: N4.
5. **Rechte: Server unverändert.** Letzte Migration ist 0060, laut `s9i-7c1-ausgangslage.log:54` schon vor der Session auf Dev. `csv.ts` wird von keiner Edge Function importiert (Suche: nur Skript, Tests, `src/lib/partnerJournal.ts`), also kein Deploy. `my_commissions` prüft Anmeldung, aal2 und Mitgliedschaft und hat keinen Firmen-Parameter (0042:133-150). UI-Schranke: MfaGate und `active`/`payment_hold` (`Partner.tsx:70-82`). Einschränkung: Diff nicht ausführbar (siehe Kopf). Rest: M4.
6. **Fehlerpfade: nie eine halbe Datei.** `journalCsv` baut die ganze Zeichenkette, jede schlechte Zeile wirft (`csv.ts:32-34`, `:86-95`); `saveCsv` läuft erst nach erfolgreichem `loadJournalCsv` (`Abrechnung.tsx:26-27`). Zuordnung der Fehlerarten `partnerJournal.ts:18-21`, `:54-58`; Tests `partner-journal.test.ts:74-103`, e2e `:114-136` (keine Datei, zweiter Versuch klappt). Der Text zu `period` (`jobs.ts:72`) besteht den Wortfilter (`jobs-client.test.ts:180-182`). Rest: N5.
7. **Tests und Rot-Belege.**
   - rot-1 (Unit, 54 rot) und rot-2 (e2e, 10 rot) sind gültige Rot-Läufe für neue Funktion.
   - rot-3: 7 von 8 sofort grün ist richtig und zu erwarten, weil in dieser Session keine Sperre entstanden oder geändert wurde. Der eine rote Test misst eine fehlende Funktion, keine Sperre. Ein Rot-Beweis im Sinn der Regel (Wirkung einer gelockerten Sperre) liegt für die Rechte-Matrix in dieser Session nicht vor und ist auch nicht fällig; die Sperre selbst ist in S9g belegt (`tests/rls/completion.test.ts:224-228`).
   - Die Ist-Werte genügen als Messung: anon 42501, Kunde und aal1 `mfa_required`, Firma b 0 Zeilen von a. Die Gegenkontrolle ist vorhanden (Firma a: 9 Zeilen mit demselben Aufruf und Monat; alle Zeilen tragen die Firma a, `journal-live.test.ts:141-146`), die Null von Firma b ist also nicht leer gemessen. Der Aufruf entspricht dem der App (e2e prüft URL, Spalten, Sortierung und Zähler, `partner-journal.spec.ts:61-67`).
   - Nicht genügend ist die Form: M3 (Zuordnung zum Lauf) und M2 (kein Lauf am Endstand). Titel ohne Messung: N3. Ungetestete Behauptung: M4.
8. **`suspended` nicht in der UI-Schranke.** Sachlich vertretbar: kein Leck, keine Rechte-Ausweitung, `payment_hold` ist enthalten, der Admin-Export bleibt als Ausweg. Es ist aber eine Produktentscheidung, die nur Beks trifft, und sie widerspricht der serverseitigen Absicht (`journal.test.ts:376`). Stand: als Entscheidung der Hauptsession im Code, ohne OPEN_ISSUES-Eintrag. Offen bis M1 erledigt ist.

## Entscheidungen für Beks (in den Abschlussbericht)
1. Gesperrte Firmen: Karte „Abrechnung“ auch für `suspended` (meine Empfehlung aus A4) oder Journal nur auf Anfrage.
2. Anzeigeorte der Gebühr in CLAUDE.md: Journal-CSV der Firma und Zeile „Gebühr“ der Absage-Maske ergänzen oder die Zeile streichen (`fakten.md:13-16`). CLAUDE.md ist unverändert.
3. Download nur im Web; nativ (Capacitor) und iOS-Standalone-PWA offen.
4. Sichtbare Auftragsnummer statt UUID.

## Stichproben

| Fundstelle | Ergebnis |
|---|---|
| `supabase/functions/_shared/commission/csv.ts:38-44` | Beträge nur aus sicherer Ganzzahl oder Ziffernkette, BigInt, ASCII-Minus |
| `csv.ts:47-50` | Satz-Muster wie A1, Punkt wird Komma, sonst `bad_row` |
| `csv.ts:63` | Formelschutz mit führendem Leerraum |
| `csv.ts:88` | unbekannte Art und falscher Monat werfen `bad_row` |
| `csv.ts:54-58` | Typ von `created_at` ungeprüft (N1) |
| `src/lib/partnerJournal.ts:14`, `:28-33` | 12 Spalten, Zähler exakt, zwei Sortierschlüssel, `range` |
| `partnerJournal.ts:41`, `:51-52` | drei Vollständigkeitsprüfungen vor der Datei |
| `partnerJournal.ts:62-71` | Übergabe getrennt, Objekt-URL nach 10 s freigegeben |
| `src/screens/partner/Abrechnung.tsx:18-22`, `:26-27` | Ref-Sperre, Datei erst nach vollständigem Laden |
| `src/screens/Partner.tsx:18`, `:76-82` | ACCESS unverändert, Karte nur `active`/`payment_hold` |
| `src/lib/jobs.ts:37`, `:72` | Fehlerart `period` mit Text ohne Gebührenwort |
| `tsconfig.json:22`, `:26`; `vite.config.ts:16` | Alias und Typprüfung für das Modul |
| Migration 0042:133-150 | Anmeldung, aal2, Mitglied, kein Firmen-Parameter, anon entzogen |
| Migration 0042:113 | Abrechnungsmonat = größerer Wert aus Endzeitpunkt und Buchungszeit |
| Migration 0028:18-30, `:47-50` | Beträge `bigint not null`, `created_at not null`, nur anfügen |
| Migration 0023:81-86 | Mitgliedschaft verlangt aal2, jeder Firmenstatus |
| `tests/unit/journal-csv.test.ts:80-84`, `:90-107` | ASCII-Minus und zwölf abgewiesene Betragsformen je Spalte |
| `tests/unit/partner-journal.test.ts:51-59`, `:66-85` | Aufrufform, 1001 Zeilen, sieben Abbruchfälle |
| `tests/rls/journal-live.test.ts:115-139`, `:148-155` | Rechte-Matrix mit echten Tokens, eingefrorene Spaltenliste |
| `tests/e2e/partner-journal.spec.ts:55-67` | BOM als Bytes, Zeileninhalt, URL des Aufrufs |
| `tests/e2e/jobs-helpers.ts:210-229`, `:391` | Mock mit Zähler im Antwortkopf; nur Status `active` |
| `tmp/reports/journal-live-ist.txt:1-2` | Ist-Werte vorhanden, ohne Lauf-Kennung |
| `tmp/proof/s9i-7c1-rot-3.log:28-32` | 1 rot, 7 grün, EXIT=1 |
| `tmp/proof/s9i-7c1-gruen-4.log:100-106`, `gruen-7.log:7-12`, `gruen-8.log:32-33` | EXIT=0, aber nicht am Endstand (M2) |
| `tmp/proof/s9i-7c1/bild-7b2/review-paket-1..6.md` | je „hoch: Keine“, je 12 von 12 gesichtet |
| `tmp/proof/s9i-7c1/bild-d/review-1.md:24`, `:34` | ein mittleres UI-Finding, 12 von 12 gesichtet, Runde 2 fehlt |
| `docs/OPEN_ISSUES.md` | kein Eintrag zu s9i-7c1 (M1) |

## Auflagen aus der Planprüfung

| Auflage | Stand | Fundstelle |
|---|---|---|
| A1 Eingabeprüfung in `csv.ts` | erfüllt | `csv.ts:38-44` (Beträge), `:47-50` (Satz), `:88` (Art), `:43` (ASCII-Minus), keine Summenzeile; Tests `journal-csv.test.ts:80-84`, `:90-125`. Rest N1, N2, N6 |
| A2 Paging | erfüllt | `partnerJournal.ts:29-33`, `:41`, `:51-52`; Tests `partner-journal.test.ts:66-85`, live `journal-live.test.ts:125`. Rest N4 |
| A3 Datensparsamkeit | erfüllt | `partnerJournal.ts:14`, `:30`; geprüft in `partner-journal.test.ts:55` und `partner-journal.spec.ts:66-67` |
| A4 Gesperrte Firmen | offen | Empfehlung nicht umgesetzt (`Partner.tsx:18`, `:76-82`), Beks nicht vorgelegt, OPEN_ISSUES-Eintrag fehlt (M1) |
| A5 CLAUDE.md nicht anfassen | erfüllt | CLAUDE.md ohne neue Anzeigeorte; `jobs.ts:72` besteht `jobs-client.test.ts:180-182`. Die Vorlage an Beks steht noch aus |
| A6 Kleinteile | teilweise | Hinweis `Abrechnung.tsx:42`; Übergabe `partnerJournal.ts:62-71`; Ref-Sperre `Abrechnung.tsx:18-22`; Format-Hinweis `:54-56` mit Test `partner-journal.spec.ts:42`, `:106-112` (kein Lauf in einem Browser ohne natives Monatsfeld); `tsconfig.json:26`. Offen: iOS-Standalone-PWA weder von Hand geprüft noch in OPEN_ISSUES (M1) |

Offene Findings hoch: 0
