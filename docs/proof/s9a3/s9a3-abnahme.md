# S9a-3 Abnahme, Runde 2 (letzte Runde). Berater: Geld, Sicherheit, Schema

Datum: 2026-11-02. Modell: Opus 5.5.
Hinweis nach CLAUDE.md: In meiner Tool-Liste steht ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es nicht benutzt.

**Umfang:**
- Arbeitsstand gegen `6880eee` (`git diff 6880eee`, Arbeitsverzeichnis) laut `tmp/proof/s9a3-diff.patch`: 52 Dateien, an den `diff --git`-Köpfen nachgezählt.
- Dazu die unversionierte Datei `scripts/redproof-s9a3.mjs`. Stichprobe Z. 1-40: unverändert gegenüber Runde 1, M-2 besteht weiter.
- Schwerpunkt sind die Änderungen seit Runde 1. Vollständig im aktuellen Stand gelesen: `src/lib/quote.ts`, `src/screens/anfrage/Zusammenfassung.tsx`, `src/lib/draft.ts`.
- Aus dem Diff: die Abschnitte zu `Zusammenfassung.tsx`, `tests/e2e/anfrage.spec.ts`, `tests/shots/shots.spec.ts`, `tests/unit/draft.test.ts` und `tests/rls/quote.test.ts`.
- Unterlagen: `tmp/proof/s9a3-abnahme.md` (Runde 1, unverändert gelassen), `s9a3-0d.md`, `s9a3-0d-db.txt`, `s9a3-shots-runde2.md`, Logs (siehe Frage 4), `docs/OPEN_ISSUES.md:74-115`, `docs/S9_KONZEPT.md:291, 352-354, 487`.
- Edge Functions, Migration 0019 und `src/lib/money.ts` sind laut Auftrag unverändert. `money.ts` und `money-cases.ts` kommen im Patch nicht vor, ihr Diff gegen `6880eee` ist also leer.

---

## Findings

### Hoch

Keine.

### Mittel

**R2-M1 · Nach einem angenommenen 409 zeigt die Seite wieder die alten Werte, gesendet werden aber die neuen.**
- Betroffene Stellen in `src/screens/anfrage/Zusammenfassung.tsx`:
  - `:193`, `:275`: Die Preiskarte liest nur `readShownFull(path)`.
  - `:195`, `:295-303`: Der Abschnitt „Stornierung“ zeigt nur das beim Laden geholte `terms`.
  - `:248-249`: `acceptChange` legt den neuen Preis bzw. Hash nur im Ref `override` ab.
  - `:221`: `buildBody` sendet `override.current.shown ?? …` und `override.current.termsHash ?? …`.
- Szenario Preis:
  - 409 `price_changed` mit 800,00 €. Der Kunde tippt „Neuen Preis übernehmen und senden“.
  - Der zweite Aufruf scheitert: offline, 429, 503 oder 500.
  - Danach gilt `confirmChange = null`. Die obere Preiskarte erscheint wieder (`:272`) und zeigt **770,40 €**.
  - „Erneut senden“ (`:400-401`) sendet `shown` = 800,00 €. Der Server speichert 800,00 € und schreibt `price_confirmed` mit 800,00 € ins Journal. Auf dem Bildschirm stand beim letzten Tipp 770,40 €.
- Szenario Bedingungen: Nach angenommenem `terms_changed` und einem Folgefehler zeigt „Stornierung“ wieder die alten Stufen, gesendet wird der neue `termsHash`.
- Warum nicht „hoch“:
  - Der Kunde hat den neuen Wert einen Schritt vorher ausdrücklich bestätigt. Der Knopf trägt den Text „Neuen Preis übernehmen …“, direkt unter „Neuer Preis: 800,00 €“.
  - Der Server speichert nur bei Betragsgleichheit.
  - Die Bestätigungsseite zeigt danach den Serverpreis mit dem Hinweis „Der Preis wurde aktualisiert“. `Gesendet.tsx:20-23` vergleicht dazu mit `readShown` = 770,40 €.
  - Es entsteht also keine Zustimmung ohne Anzeige. Die Anzeige im Moment des Sendens ist aber falsch, und das widerspricht genau der Invariante aus H-1 („angezeigt = gesendet“).
- **Fix (klein, vor dem Commit empfohlen):**
  - In `acceptChange` den angenommenen Preis mit `rememberShown(path, s.totalCents, shownFromSnapshot(s))` speichern. Dann lesen Anzeige, `buildBody` und Bestätigungsseite denselben Speicher, und `override.shown` entfällt.
  - Die angenommenen Bedingungen als State (`useState<Terms>(terms)`) führen. Aus diesem State kommen sowohl die Anzeige als auch `termsHash`.
  - E2E-Test: 409 `price_changed` → übernehmen → `abort` → Karte zeigt 800,00 € → „Erneut senden“ → `body.shown` = 800,00 €. Dasselbe für `terms_changed`.

### Niedrig

- **R2-N1 · `Zusammenfassung.tsx:400-401`: Im 409-Zustand ist „Erneut senden“ in der Aktionsleiste aktiv.** Er sendet die alten Werte, die gerade ausgeblendet sind (Preiskarte `:272` bzw. Stornierung `:291`). Der Server lehnt sie ab (wieder 409, keine Zeile). Das ist also sicher, aber widersprüchlich, und die Reviewer melden es als doppelten Knopf (`OPEN_ISSUES.md:105-106`). Fix: Die Leiste im 409-Zustand sperren oder ausblenden, oder sie mit `acceptChange` belegen.
- **R2-N2 · `Zusammenfassung.tsx:248`, `:249`: Unvollständige 409-Antworten führen in eine Schleife von 409-Antworten.**
  - Fall 1: `price_changed` mit `snapshot`, aber ohne `priceVersion`.
  - Fall 2: `terms_changed` ohne lesbare `terms`. Die Karte zeigt dann nur die Überschrift, `:355`.
  - In beiden Fällen ändert sich `override` nicht, und jeder Tipp ruft wieder auf. Es wird nie etwas gespeichert, das Nutzerlimit begrenzt das. Fix: Solche Antworten wie bei fehlendem Snapshot als `unavailable` behandeln (`:234`).
- **R2-N3 · `quote.ts:191`, `:115-121`: Die Spanne (Entrümpelung) wird in ganzen Euro angezeigt, `shown` trägt Cent.** Der Server vergleicht `low`/`high` centgenau (`hold.ts:23-35`). Bei einer Abweichung um wenige Cent folgt ein 409 mit scheinbar gleichem „neuen Preis“. Die Spanne ist kein verbindlicher Preis, der Endpreis kommt später als Angebot (S9e). `S9_KONZEPT.md:487` verlangt „centgenau“ für den Festpreis. Der Festpreis, auch der Mindestpreis mit `low = high`, wird centgenau angezeigt (`draft.test.ts`, Diff Z. 3571, 3607). Nur vermerken.
- **R2-N4 · `Zusammenfassung.tsx:300-304`: „Anfahrtspauschale: 69,00 €“ steht ohne Bedingung im Abschnitt „Stornierung“.** Laut `S9_KONZEPT.md:354`, `:420` fällt sie nur bei `scope_impossible` mit Fotobeleg an. Ohne diesen Satz liest der Kunde sie als feste Gebühr. Das ist kein Plattformgebühr-Hinweis, aber eine Rechts- und Textfrage. Fix: Den Satz „nur wenn der Auftrag vor Ort nicht durchführbar ist“ ergänzen, spätestens mit der Rechtsprüfung (S9i, Abschnitt 11).
- **R2-N5 · `Zusammenfassung.tsx:222-224`: Fehlt der Preis erst beim Senden (Speicher zwischen Anzeige und Tipp geleert), führt die App zum Termin statt zum Preis-Schritt.** Praktisch nicht erreichbar, weil `:194` vorher greift. Fix optional: dasselbe Ziel `config.back` wie dort.
- **R2-N6 · RLS-Log deckt den geänderten Test nicht ab.**
  - `tmp/proof/s9a3-rls.log:164` „Start at 15:36:03“ ist derselbe Lauf wie in Runde 1.
  - Die Wartelogik im Nutzerlimit-Test kam laut Auftrag erst danach (`tests/rls/quote.test.ts`, Diff Z. 3080-3082).
  - `OPEN_ISSUES.md:114` („danach 168/168“) belegt damit den alten Teststand. Der Typecheck in `s9a3-check.log:11` umfasst die Datei, ausgeführt wurde sie gegen die DB nicht.
  - Fix: `quote.test.ts` (oder `test:rls`) einmal mit `EXIT=` laufen lassen, oder den Satz in OPEN_ISSUES/README genau fassen.
- **R2-N7 · Belege und Doku sind nicht ganz nachgezogen.**
  - `s9a3-0d.md:7` nennt „DELETE“ weiter als „(Schicht)“. Das widerspricht dem eigenen Hinweis `:24` (Sperre).
  - `s9a3-0d.md:9` listet als Shots-Logs nur `run2`/`run3`. Es fehlen `s9a3-shots-run5.log` und `s9a3-shots-runde2.md`, der Ordner `docs/proof/s9a3/` existiert noch nicht (Glob leer).
  - `s9a3-0d.md:12` und `:14` vermerken anders als `:13` die Einschränkung M-2 nicht.
  - `s9a3-0d-db.txt`: Nur der letzte Abschnitt (`:24`) nennt den Abfragetext. Die Abschnitte `:1`, `:8`, `:18` und `:21` haben nur Überschriften. Das entspricht nicht ganz der Ankündigung „mit Abfragetexten“.
  - `OPEN_ISSUES.md:95` (A1-N9) verweist weiter auf `s9a3-grantrole-rechte.txt` ohne Abfrage und Exit, statt auf `s9a3-0d-db.txt:24-30`.
  - `OPEN_ISSUES.md:105` führt „in der Bedingungen-Karte fehlt die Anfahrtspauschale“ als Fund. Im Shot ist `call_out_fee_cents: 0` (`shots.spec.ts`, Diff Z. 3244), das Weglassen ist also gewollt.
  - `OPEN_ISSUES.md:107` „Anfahrtspauschale: 0,00 € bei 0 weglassen“ ist erledigt (`Zusammenfassung.tsx:300`, `:361`).
  - Fix: Die Zeilen mit Edit korrigieren und den Hinweis in `docs/proof/s9a3/README.md` aufnehmen.
- **R2-N8 · Shots vor dem Commit.** `s9a3-shots-run5.log:2` zeigt 66 Tests: 11 Zusammenfassungs-Screens × 390/430/1280 × Light/Dark. 768 px fehlt, und Screens außerhalb des Filters wurden nach der Änderung nicht neu aufgenommen. Nach CLAUDE.md braucht eine UI-Session vor dem Commit einmal `shots:all`. Das liegt außerhalb von Geld und Sicherheit und wird hier nur vermerkt.

Unverändert offen aus Runde 1, mit Teilschritt eingetragen (`OPEN_ISSUES.md:74`, `:112-113`): M-1 bis M-4, N-1 bis N-5 und N-7 bis N-10. N-6 ist durch `s9a3-0d-db.txt` ersetzt, siehe aber R2-N7.

---

## Prüffragen

**1. Sind H-1 und H-2 geschlossen? – Ja. Eine Einschränkung gilt nach einem angenommenen 409 (R2-M1).**
- **Kein erfundenes `shown`:** `quote.ts:27-28` setzt `shown = confirmed.shown ?? readShownFull(path)`, sonst `null`. Der Rückfall auf `shownOf(preview…)` ist an allen Stellen weg (Diff Z. 554 ff., aktueller Stand `:25-48`). `readShownFull` schreibt nur `rememberShown` (`draft.ts:112-120`). Diese Funktion wird nur beim Tipp auf „Weiter“ im Preis-Schritt aufgerufen: `Konfigurator.tsx:221`, `Montage.tsx:58`, `entruempelung/Ergebnis.tsx:154` (Grep).
- **Alle Wege, über die `shown`/`termsHash` entstehen könnten:**
  - Direkter Aufruf der Zusammenfassung oder alter Entwurf nur mit `movenow.shown.*`: `readShownFull` liefert `null` (`draft.ts:122-133`). `Zusammenfassung.tsx:194` leitet dann vor jedem Senden-Knopf zu `config.back` um. Das belegen der E2E-Test „ohne gemerkten Preis …“ (`anfrage.spec.ts`, Diff Z. 2433-2441; Log `s9a3-e2e.log:68`) und der Unit-Test (Diff Z. 3558-3561).
  - `stashDraft`/`restoreDraft`, auch bei „Anderes Konto“: `shownFullKey` steht in `draftKeys` (`draft.ts:106`) und reist mit. `restoreDraft` überschreibt nichts (`:215`). Was ankommt, wird in der Zusammenfassung angezeigt, bevor es gesendet werden kann. Passt ein mitgebrachter Preis nicht zu den Eingaben im neuen Tab, antwortet der Server mit 409.
  - Konto wechseln: Die Einwilligung hängt am Konto (`:167-170`), `send` prüft die Live-Sitzung (`:217`). An `shown` ändert das nichts.
  - Wiederholung: Die Ref wird ohne die bestätigten Angaben gebildet (`:227`). War der erste Aufruf schon gespeichert, liefert der Server die damals bestätigte Revision (Runde 1, Frage 1).
  - `override`: `override.shown` entsteht nur aus dem Snapshot, den die 409-Karte angezeigt hat (`:248`, `:343-345`). `override.termsHash` entsteht nur aus den `terms`, deren Sätze die Karte zeigt (`:249`, `:355-365`).
  - Ergebnis: Ohne vorherige Anzeige entsteht kein Wert.
- **Byte-genau gleich?**
  - Normalfall: ja. Die Anzeige kommt aus `readShownFull(path)` (`:193`, `:275`), gesendet wird aus `buildBody` → `readShownFull(path)` (`quote.ts:27`). Beides liest denselben Speicher im selben Render-Zyklus. `termsHash` und Anzeige stammen aus demselben `terms`-Objekt (`:195`, `:221`).
  - Der E2E-Test prüft angezeigte 770,40 € gegen `body.shown` = 77040 und die Sätze aus der gemockten `booking_terms` gegen `body.termsHash` (Diff Z. 2414-2431, Log `:65`).
  - Nach einem angenommenen 409 mit Folgefehler: nein (R2-M1).
  - Bei einer Spanne ist die Anzeige auf Euro gerundet (R2-N3).
- **Bedingungen vollständig?** Ja. Alle fünf Werte erscheinen: `cancel_free_hours`, `cancel_late_percent`, `cancel_full_days_before`, `cancel_full_percent` in zwei Sätzen und `call_out_fee_cents` per `formatEuro`, nowrap, bei > 0 (`quote.ts:195-203`, `Zusammenfassung.tsx:295-304`). Die 409-Karte zeigt dieselben Sätze (`:355-365`). Im Zustand `terms_changed` ist „Stornierung“ ausgeblendet (`:291`), die alten Werte stehen also nicht neben den neuen. Nach der Annahme gilt R2-M1. Die Texte stimmen mit `S9_KONZEPT.md:352-353` überein: 0 Tage ergibt „ab dem Tag des Termins“ (`quote.ts:198`, Unit-Test Diff Z. 3576-3582).

**2. Neue Risiken durch die Änderung – Keine Schleife, kein Problem beim Erfolg, keine Gebühr.**
- **`Navigate`:**
  - `Zusammenfassung.tsx:194` führt zu `config.back` (`/transport`, `/umzug`, `/entruempelung/ergebnis`, `/montage`, `draft.ts:5-8`).
  - Keine dieser Seiten leitet zur Zusammenfassung um. Grep `Navigate` in `src/screens` findet nur `Ergebnis.tsx:63` (→ `/entruempelung`), `Gesendet.tsx:16` und `Auftraege.tsx:58`. Eine Schleife gibt es nicht.
  - Alle Hooks stehen vor den frühen Returns (`:161-189`), die Regeln für Hooks sind eingehalten.
- **Erfolg:**
  - `finishDraft` löscht die Schlüssel, und `navigate` zu `gesendet` folgt synchron (`:229-230`). Ein erneutes Rendern der Zusammenfassung würde zwar schon an `:191` umleiten (das war vorher genauso, `summary` wäre `null`). Die E2E-Tests landen aber auf `/gesendet` (Diff Z. 2427, 2455, 2475; `s9a3-e2e.log:102` EXIT=0).
  - `writeContact` (`:180`) schreibt nach dem Löschen nicht erneut, weil sich die Abhängigkeiten nicht ändern.
  - `shownCents: readShown(path)` wird vor dem Löschen gelesen (`:229`), siehe R2-M1 zur Abweichung.
- **Gebühr in Kunden-Screens:**
  - Grep `Gebühr|Provision|15 ?%|Plattform|0\.15|feeRate|fee_rate` in `src/` findet nichts.
  - Der E2E-Test prüft `main` ohne `Gebühr|Provision|15 ?%` (Diff Z. 2513).
  - Die Reviewer melden in 390, 430 und 1280 keinen Gebührenhinweis (`s9a3-shots-runde2.md:36`, `:94`).
  - Die App liest weder `fee_splits` noch `platform_settings`. Die Ausnahme `call_out_fee_cents` ist begründet (Diff Z. 2497-2498).
- **Stornoprozente:** Das sind Kundenbedingungen, keine Plattformgebühr. Sie stammen aus `booking_terms()` mit fester Schlüsselliste ohne `fee_*` (`S9_KONZEPT.md:291`, `:352-353`) und beziehen sich auf den Gesamtpreis, den der Kunde zahlt. „Inklusive 20 % USt.“ (`:276`) ist die Steuer.

**3. Rot-Beweis und Rest aus Runde 1 – Die Bezeichnungen sind ehrlich, ein „hoch“ bleibt nicht.**
- R2-N13: `OPEN_ISSUES.md:74` „Teilweise“. Die Datei nennt die Quelltext-Mutation im Prozess und die offene Live-Probe (S9a-4) richtig. `s9a3-0d.md:24` ebenso.
- N-15: `s9a3-0d.md:10` „teilweise“ mit genauer Lücke (Meldung zur Ref, Skript mit Exit 2). `OPEN_ISSUES.md:99` und `:112` (M-3) passen dazu.
- Was übrig ist (M-1 bis M-4, N-x), betrifft die Beweisführung und Härtung, nicht eine nachgewiesene Lücke.
  - Den SQL-Teil von `price_version_hold` (M-4) habe ich in Runde 1 gelesen, er ist richtig. Es fehlt nur der Test gegen echte Daten.
  - Server-seitig gilt weiter: gespeichert wird nur bei Betrags- und Hashgleichheit (`handler.ts:271-272`, `:319`, unverändert).
- R2-M1 ist kein „hoch“, Begründung siehe dort.

**4. Exit-Codes und Zahlen – Ja (an den Logs nachgelesen). Eine Einschränkung: R2-N6.**

| Log | Zeile | Ergebnis |
|---|---|---|
| `s9a3-check.log` | 7, 11, 15, 23-24, 42-44, 48 | Lint, Typecheck, Deno (60/60 Golden, 24/24 Beträge); 13 Dateien, **365** Tests, Start 17:37:04, `EXIT=0`. +4 gegenüber 361 = die vier neuen `draft.test`-Fälle (Diff Z. 3558-3583) ✓ |
| `s9a3-e2e.log` | 3, 6, 65, 68, 101-102 | `--project=e2e`, **89** Tests, die beiden neuen Fälle laufen (`:65`, `:68`), 89 bestanden, `EXIT=0` ✓ |
| `s9a3-shots-run5.log` | 2, 71-72 | 66 Tests = 11 Screens × 6 Projekte, 66 bestanden, `EXIT=0` ✓. Der Befehl steht nicht im Log, er steht nur in `s9a3-shots-runde2.md:5` (R2-N8) |
| `s9a3-rls.log` | 27, 162-164, 168 | 8 Dateien, **168** Tests, `EXIT=0`, Start 15:36:03 = Lauf aus Runde 1, ohne die neue Wartelogik (R2-N6) |
| `s9a3-migration-list.log` | 2, 5 | `20261102100000` local = remote, `EXIT=0` ✓ |
| `s9a3-rot-final.log` | 98-100 | „Definitionen vorher und nachher identisch“, `REDPROOF BESTANDEN`, `EXIT=0` ✓ |

**5. Punkt 0d – Überwiegend ja.**
- N-15 „teilweise“ (`s9a3-0d.md:10`) ✓.
- N-1-Zählung SQL 10 Sperren + 11 Schichten (`:24`) ✓. In `:7` steht aber weiter „DELETE (Schicht)“ (R2-N7).
- A1-N9 „teilweise“ (`:18`) mit Beleg `s9a3-0d-db.txt:24-30` (Abfragetext, `postgres` als einzige Rolle mit Execute, `EXIT=0` `:30`) ✓. `OPEN_ISSUES.md:95` verweist noch auf die alte Datei (R2-N7).
- N-6 korrigiert: `immutable_row` jetzt richtig abgefragt (`0d-db.txt:18-22`) ✓. Die übrigen Abschnitte haben keinen Abfragetext (R2-N7).
- R2-N13 als Quelltext-Mutation benannt (`:24`) ✓.

**6. Shot-Tabelle Runde 2 – Bildbeobachtungen sind vorhanden. Die Einordnung als vorbestehend stimmt.**
- **Stichproben mit Bildsicht:**
  - `s9a3-shots-runde2.md:13`: „770,40 € in einer Zeile … Fokusrahmen an Mailadresse … Button blass-teal“
  - `:19`: „Neuer Preis: 800,00 € mit Teal-Rand“
  - `:42`: Label, Betrag und Hinweis im Wortlaut
  - `:50`: „bis 24 Stunden“, „50 %“, „ab einem Tag vor dem Termin 100 %“
  - `:75`: Karton-Illustration in Braun und Beige
  - `:81`: rosa Rand, „Angaben ändern“
- **Schwache Zeilen:** `:18`, `:26` und `:32` (390 Dark: „Gleiche Abweichungen wie Light, Text lesbar“, „Gleicher Text, lesbar“) nennen keine eigene Bildbeobachtung. Nach CLAUDE.md gelten sie als ungeprüft. Gedeckt sind diese Zustände durch 430/1280 Dark (`:47`, `:55`, `:61`, `:76`, `:84`, `:90`). Das ist niedrig, für Geld und Sicherheit ohne Bedeutung.
- Geschätzte Pixelmaße kommen nicht mehr vor (anders als Runde 1, N-10).
- **Vorbestehend:**
  - `Strecke` (A/B-Marker ohne Linie) und `group('Umfang', summary.scope)` mit Montage, Kartons und Halteverbot stehen im Diff als Kontextzeilen, also schon in `6880eee` (Diff Z. 928-929, 1036-1037).
  - Der Streckentext („· innerhalb Wiens“) stammt aus `summaryOf` (`Zusammenfassung.tsx:42`) und ist im Diff nicht geändert.
  - Neu aus S9a-3 ist nur der Wien-Hinweis (Diff Z. 1039). Er steht in `OPEN_ISSUES.md:106` richtig unter „Neu, mittel“.
  - Die Einordnung „mittel, vor S10“ (`OPEN_ISSUES.md:104`) ist vertretbar: reine Optik, ohne Geld- oder Sicherheitswirkung.
- **Fehleinstufung:** Der Reviewer-Fund „Anfahrtspauschale fehlt in der Bedingungen-Karte“ (`:50`, `OPEN_ISSUES.md:105`) ist keiner. Der Shot hat `call_out_fee_cents: 0` (R2-N7).

---

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `src/lib/quote.ts:25-28` | `shown` nur aus `confirmed.shown` oder `readShownFull`, sonst `null` ✓ (H-1) |
| `src/lib/quote.ts:173-180` | `parseTerms` verlangt alle fünf Schlüssel als Zahl und einen Hash mit 64 Hexzeichen ✓ |
| `src/lib/quote.ts:190-203` | `shownLabel`, `termsText`: alle fünf Werte, 0/1/n Tage ✓ |
| `src/lib/draft.ts:106, 112-133` | `shownFullKey` im Entwurf; `readShownFull` prüft ganze Cent ✓ |
| `src/lib/draft.ts:207-216` | `restoreDraft` überschreibt nichts, nur erlaubte Schlüssel ✓ |
| `src/screens/anfrage/Zusammenfassung.tsx:191-195` | Umleitung ohne Preis, Hooks davor ✓ |
| `src/screens/anfrage/Zusammenfassung.tsx:272-307` | Preiskarte und Stornierung vor Einwilligung `:309` und Leiste `:388` ✓ |
| `src/screens/anfrage/Zusammenfassung.tsx:221, 248-249` gegen `:193, :195` | Senden aus `override`, Anzeige ohne `override` ✗ (R2-M1) |
| `src/screens/anfrage/Zusammenfassung.tsx:400-401` | „Erneut senden“ im 409-Zustand aktiv (R2-N1) |
| `src/screens/anfrage/Zusammenfassung.tsx:355, 248` | Leere 409-Karte bzw. fehlende `priceVersion` ohne Wirkung auf `override` (R2-N2) |
| `src/screens/anfrage/Gesendet.tsx:20-23` | Abweichung zum zuletzt gemerkten Preis wird sichtbar gemeldet ✓ (mildert R2-M1) |
| Grep `rememberShown` in `src/` | nur `Konfigurator.tsx:221`, `Montage.tsx:58`, `Ergebnis.tsx:154` ✓ |
| Grep `Navigate` in `src/screens` | keine Umleitung zur Zusammenfassung, keine Schleife ✓ |
| Grep `Gebühr\|Provision\|15 ?%\|Plattform\|0\.15\|feeRate\|fee_rate` in `src/` | keine Treffer ✓ |
| `docs/S9_KONZEPT.md:291, 352-354, 420, 487` | fünf Werte; Semantik der Stufen ✓; Pauschale nur bei `scope_impossible` (R2-N4); „centgenau“ (R2-N3) |
| `tests/e2e/anfrage.spec.ts` Diff Z. 2414-2441 | Anzeige gleich `body.shown`/`termsHash`; ohne Preis 0 Aufrufe ✓ |
| `tests/unit/draft.test.ts` Diff Z. 3558-3583 | `null` ohne Preis, gemerkter Preis geht mit, Labels, Bedingungen ✓ |
| `tests/shots/shots.spec.ts` Diff Z. 3208, 3244 | Umzug mit `shownfull`; Bedingungen-Shot mit Pauschale 0 ✓ |
| `tests/rls/quote.test.ts` Diff Z. 3080-3082 | Wartelogik neu, im RLS-Log nicht gelaufen (R2-N6) |
| `tmp/proof/s9a3-rls.log:164` | Start 15:36:03 wie in Runde 1 (R2-N6) |
| `tmp/proof/s9a3-0d.md:7, 9, 10, 18, 24` | `:7` DELETE als Schicht ✗; `:9` ohne run5 ✗; `:10`, `:18`, `:24` ✓ |
| `tmp/proof/s9a3-0d-db.txt:18-30` | `immutable_row` richtig; Grant-Abfrage mit Text und `EXIT=0` ✓; Abschnitte `:1`, `:8` ohne Abfragetext (R2-N7) |
| `docs/OPEN_ISSUES.md:74, 95, 104-107, 111-114` | R2-N13 teilweise ✓; A1-N9-Verweis veraltet, `:105`/`:107` überholt (R2-N7) |
| `scripts/redproof-s9a3.mjs:9, 26-37` | Dev-Guard zuerst ✓; Snapshot unverändert (M-2 offen) |
| `tmp/proof/s9a3-rot-final.log:98-100` | identisch, bestanden, `EXIT=0` ✓ |
| Glob `docs/proof/s9a3/**` | leer (Kopie steht noch aus) |

---

## Geprüfte Dateien

Diff `git diff 6880eee` (52 Dateien, Liste aus den Köpfen von `tmp/proof/s9a3-diff.patch`). Die mit * markierten Dateien habe ich in dieser Runde neu gelesen; die übrigen sind seit Runde 1 laut Auftrag unverändert und wurden dort geprüft:
- `CLAUDE.md`
- `docs/GOLIVE.md`
- `docs/OPEN_ISSUES.md`*
- `docs/PROGRESS.md`
- `docs/ROADMAP.md`
- `docs/S9_KONZEPT.md`
- `docs/S9a_PLAN.md`
- `package.json`
- `scripts/golive-check.mjs`
- `scripts/import-districts.mjs`
- `scripts/live-uploads.mjs`
- `scripts/redproof-s9a2.mjs`
- `scripts/redproof-uploads.mjs` (gelöscht)
- `scripts/s9a1-verify.mjs`
- `scripts/scan-proof.mjs`
- `src/lib/draft.ts`*
- `src/lib/preview.ts`
- `src/lib/quote.ts`*
- `src/screens/Auftraege.tsx`
- `src/screens/Konfigurator.tsx`
- `src/screens/Montage.tsx`
- `src/screens/anfrage/Gesendet.tsx`
- `src/screens/anfrage/Termin.tsx`
- `src/screens/anfrage/Zusammenfassung.tsx`*
- `src/screens/entruempelung/Ergebnis.tsx`
- `src/screens/konfigurator/Strecke.tsx`
- `supabase/functions/_shared/database.types.ts`
- `supabase/functions/_shared/quote/address.ts`
- `supabase/functions/_shared/quote/db.ts`
- `supabase/functions/_shared/quote/handler.ts`
- `supabase/functions/_shared/quote/hold.ts`
- `supabase/functions/_shared/quote/parse.ts`
- `supabase/functions/_shared/route/facts.ts`
- `supabase/functions/_shared/route/handler.ts`
- `supabase/functions/_shared/route/provider.ts`
- `supabase/migrations/20261102100000_0019_quote_hardening.sql`
- `tests/e2e/anfrage-helpers.ts`
- `tests/e2e/anfrage.spec.ts`*
- `tests/e2e/fotos-helpers.ts`
- `tests/e2e/konfigurator-helpers.ts`
- `tests/e2e/konfigurator.spec.ts`
- `tests/rls/quote-hardening.test.ts`
- `tests/rls/quote.test.ts`*
- `tests/rls/status.test.ts`
- `tests/shots/shots.spec.ts`*
- `tests/support/db.ts`
- `tests/support/quote-rls.ts`
- `tests/support/quote.ts`
- `tests/unit/draft.test.ts`*
- `tests/unit/quote-checks.test.ts`
- `tests/unit/quote.test.ts`
- `tests/unit/route.test.ts`

`src/lib/money.ts`, `tests/unit/money-cases.ts`: kein Abschnitt im Patch, also Diff gegen `6880eee` leer.

Unversioniert: `scripts/redproof-s9a3.mjs` (Stichprobe Z. 1-40).

Unterlagen:
- `tmp/proof/s9a3-abnahme.md` (Runde 1)
- `tmp/proof/s9a3-0d.md`
- `tmp/proof/s9a3-0d-db.txt`
- `tmp/proof/s9a3-shots-runde2.md`
- `tmp/proof/s9a3-check.log`
- `tmp/proof/s9a3-e2e.log`
- `tmp/proof/s9a3-shots-run5.log`
- `tmp/proof/s9a3-rls.log`
- `tmp/proof/s9a3-migration-list.log`
- `tmp/proof/s9a3-rot-final.log`
- `docs/S9_KONZEPT.md:291, 352-354, 420, 487`
- `src/screens/anfrage/Gesendet.tsx:16-23` (Grep)

Offene Findings hoch: 0
