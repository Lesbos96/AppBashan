Modell: claude-fable-5-2
Vorgaenger: tmp/proof/rs1-abnahme-1.md

# Abnahme 2 für Schritt rs1 (R2)

Datum: 2026-11-17
Umfang: Endstand Branch rs1, HEAD 5cdaded779890467ac2d889ee9d918ccd9105016 (`.git/HEAD` zeigt auf `refs/heads/rs1`, die Ref-Datei nennt diesen Commit; Arbeitsbaum laut Startstatus sauber). Vollständig gelesen: `tmp/proof/rs1-abnahme-1.md`, `src/lib/jobs.ts`, `src/lib/partnerJobs.ts`, `src/screens/auftrag/Angebote.tsx`, `src/screens/partner/Absage.tsx`, `src/screens/partner/Auftraege.tsx`, `src/screens/partner/Anfragen.tsx`, `tests/e2e/partner-absage.spec.ts`, `tests/shots/meldung.spec.ts`, `docs/BEKS.md`, `.claude/rules/geld.md`, `.claude/rules/daten.md`, `tmp/proof/rs1/runs.jsonl` (15 Zeilen), `tmp/proof/rs1/017-check.log`. Abschnittsweise: `tests/e2e/partner-anfragen.spec.ts:120-208`, `tests/e2e/auftrag-aktionen.spec.ts:118-242`, `docs/ENTSCHEIDUNGEN.md:201-203`, `docs/GOLIVE.md:64-68`, Migration 0047 Zeilen 10-39, `src/lib/partnerChange.ts` (Stellen zu `source`), `tests/e2e/jobs-helpers.ts:90-107`, Köpfe und Exit-Zeilen der Logs 015 bis 018.

SHA256-Zeilen: keine (laut Auftrag keine Datei der Pflichtmenge geändert).

Ergebnis: abgenommen unter Vorbehalt der noch laufenden Pflichtläufe. H1 und N1 bis N4 aus Runde 1 sind behoben, nichts Neues ist hoch oder mittel. Drei neue niedrige Funde (N5 bis N7). Die Läufe `e2e` und `rls` am Endstand liegen noch nicht vor: offen, kein Fund; über sie entscheidet das Gate.

## Grenzen der Prüfung
- Nur Lese- und Suchwerkzeuge, keine Shell. `git diff main...rs1` nicht ausgeführt; geprüft ist der Endstand der genannten Dateien. Dass keine Datei der Pflichtmenge geändert wurde (Functions, `money*`, `scripts/sys`, `tests/support`, `.claude`, `package.json`), ist weiter nicht von mir geprüft; die Hauptsession nennt das Ergebnis von `git diff main...rs1 --stat` in der Bewertung.
- `e2e`: Log 018 hat den Kopf (Commit 5cdaded, Baum sauber, keine Argumente, keine Schalter), aber keine Exit-Zeile und keinen Eintrag in `runs.jsonl`. Log 016 (Commit 6843d49) ebenso ohne Exit und ohne Eintrag: zählt nicht. `rls`: kein Log im Ordner. Beides offen.
- Die gezielten Läufe 12 bis 14 (alle grün) liefen auf 852b1e9 mit unsauberem Baum, also auf dem Arbeitsstand vor dem Commit 6843d49; für den Endstand zählen nur Lauf 17 und die noch offenen Volläufe.
- Serververhalten wie in Runde 1 aus den Migrationen hergeleitet, nicht gemessen.

## Stand der Funde aus Runde 1

- H1 (hoch) behoben. `tests/e2e/partner-anfragen.spec.ts:177` baut den Ausdruck jetzt mit `new RegExp` und `String.fromCharCode(160)`, kein rohes Sonderzeichen mehr. Suche nach dem Zeichen U+00A0 über `src`, `tests`, `supabase/functions` und `scripts`: Treffer nur noch in `tests/unit/draft.test.ts:214, 215, 265` (Zeichenketten, nicht von rs1, vom Linter nicht beanstandet). Pflichtlauf: `tmp/proof/rs1/runs.jsonl:15` (Lauf 17, `check`, Commit 5cdaded, Baum sauber, keine Argumente, keine Schalter, Exit 0, 2097 Tests) und `tmp/proof/rs1/017-check.log:1-6, 360-361, 369` (Kopf passt zum Eintrag, 71 Dateien, `EXIT=0`). Lint, Typecheck, Deno-Check und alle Unit-Tests liefen damit auf dem Endstand, darunter `tests/unit/jobs-client.test.ts` (48) und `tests/unit/cancel-client.test.ts` (17). Der Zwischenlauf 15 (Commit 6843d49, Exit 2, `015-check.log:20`: Typfehler in `tests/shots/meldung.spec.ts:62`) ist durch 5cdaded behoben (`meldung.spec.ts:30, 32`: Typ aus `RpcReturn`, nur Typangabe).
- N1 behoben. `src/screens/partner/Auftraege.tsx:264` übergibt dreiwertig (`change ? change.source === 'partner_offer' : undefined`), `src/screens/partner/Absage.tsx:52` typisiert `boolean | undefined`, `:197` sagt die Weitervermittlung nur bei `fixedOffer === false` und vor Terminbeginn zu, `:233` zeigt den Festangebot-Satz nur bei `true`. E2E: `tests/e2e/partner-absage.spec.ts:66-72` prüft bei leerer Preisgrundlage „keine Weitervermittlung“ und „kein Festangebot-Satz“. Der Kommentar an der Prop (`Absage.tsx:51`) nennt jetzt beide Folgen.
- N2 behoben. `docs/ENTSCHEIDUNGEN.md:203` und `docs/GOLIVE.md:66` nennen für die Montage „BEKS Frage 1“; das passt zu `docs/BEKS.md:24` und `docs/OFFEN.md:23`.
- N3 behoben. `src/screens/partner/Absage.tsx:196` verweist auf 0047:26; dort steht die Bedingung (Quelle Festangebot oder kein Gesamtpreis: keine Folgeanfrage).
- N4 behoben. `src/lib/jobs.ts:127` ist die einzige Fassung von `viennaTime` und schreibt das geschützte Leerzeichen über `String.fromCharCode(160)`. `src/screens/auftrag/Angebote.tsx:4, 29` nutzt sie (die eigene Funktion `until` ist weg), `src/screens/partner/Anfragen.tsx:24` und `src/screens/partner/Auftraege.tsx:6` importieren aus `jobs`. `tests/e2e/auftrag-aktionen.spec.ts:139` prüft die Kundenseite, `tests/e2e/partner-anfragen.spec.ts:177` die Firmenseite. Kein Importkreis: `partnerJobs.ts:1` importiert aus `jobs`, `jobs.ts:1-3` nicht zurück.

## Findings

### hoch
Keine.

### mittel
Keine.

### niedrig
- N5 `src/lib/partnerJobs.ts:177` – Nach dem Umzug von `viennaTime` blieb der Doc-Kommentar „Zeitpunkte immer in Wiener Zeit …“ ohne Funktion stehen (darunter Leerzeile und der nächste Abschnitt). Irreführend, ohne Wirkung. – Fix: Zeilen 177 und 178 löschen.
- N6 `tests/e2e/partner-absage.spec.ts:38` – Kein E2E-Fall prüft, dass die Zusage bei bekanntem Festpreis (`fixedOffer === false`, vor dem Termin) erscheint; geprüft ist nur das Fehlen bei Festangebot (`:61`) und ohne Preisgrundlage (`:71`). Eine Bedingung, die die Zusage immer unterdrückt, bliebe grün. Kein Geldweg. – Fix: im Fall „ohne Pauschale“ (`:33-53`, Quelle `submit` laut `tests/e2e/jobs-helpers.ts:107`) `toContainText('Weitervermittlung, wenn der Termin es zulässt')` ergänzen.
- N7 `docs/STAND.md:17, 20` und `docs/GOLIVE.md:66` – STAND nennt „BEKS Frage 1“ noch als die Frage zu den Festangebot-Texten; die ist beantwortet (Nr. 196, `docs/BEKS.md:21`), Frage 1 ist jetzt die Montage (`docs/BEKS.md:24`). In GOLIVE 32 steht im Kopf der Zeile noch „Frage 5 in `docs/BEKS.md`“ (beantwortet als Nr. 152, schon vor rs1 veraltet). – Fix: STAND mit dem Bericht des Schritts nachziehen; in GOLIVE 32 „ENTSCHEIDUNGEN Nr. 152“ statt der BEKS-Nummer.

### Hinweise ohne Fix
- `src/lib/jobs.ts:127` ersetzt die Stelle „ um “ in der Ausgabe von `toLocaleString`. Formatiert eine Laufzeitumgebung anders (etwa mit Komma), greift das Ersetzen nicht: der Text bleibt richtig, nur der Umbruchschutz entfällt. Die E2E-Fälle messen Chromium.
- Der Lauf `shots:all` (Lauf 9) stammt vom Stand vor den Korrekturen dieser Runde. Sichtbar geändert hat Runde 2 nur die Absage-Maske ohne geladene Preisgrundlage (ein Satzteil entfällt). Ob neue Aufnahmen nötig sind, beurteilt der `reviewer`.
- Die zwei Hinweise aus Runde 1 (`reject_offers` trifft auch ein nie gesehenes Angebot; Wortlaut „vor deiner Annahme“) gelten unverändert.

## Prüffragen

1. **H1 behoben?** Ja. Rohes Zeichen ersetzt (`partner-anfragen.spec.ts:177`), `check` am Endstand grün (Lauf 17, Exit 0, Baum sauber, Kopf passt zu `runs.jsonl:15`).
2. **N1 bis N4 behoben?** Ja, alle vier; Belege oben.
3. **Etwas Neues hoch?** Nein.
   - Geld: Kein Rechenweg geändert. `jobs.ts:112-121, 205-208` unverändert (nur `p_request`, Fehler über `asKind`). `Angebote.tsx:27, 54, 62` zeigt Beträge weiter nur über `formatEuro` und sendet den gezeigten Betrag (`:55`). `Anfragen.tsx:102-113, 158` „Du erhältst“ nur vom Server. `Absage.tsx:167` sendet weiter genau die gezeigte Pauschale oder 0.
   - Gebühr beim Kunden: Suche über `src/screens/auftrag` nach Gebühr, Provision, Plattform, Prozentangaben, Auszahlung: ein Treffer, ein Kommentar (`auftrag/Absage.tsx:10`). Die Zeile „Gebühr“ steht nur in der Absage-Maske der Firma (`partner/Absage.tsx:239`, nach `geld.md` erlaubt).
   - Sicherheit: kein neuer Aufruf, kein neues Recht, kein Schlüssel; die Änderungen sind Anzeige, Import und Tests. `fixedOffer` kommt weiter aus der Serverquelle (`partnerChange.ts:67, 75`), fehlt sie, sagt die Maske weniger zu, nie mehr.
   - Aussage gegenüber dem Server: Die Zusage der Weitervermittlung erscheint nur noch bei bekanntem Festpreis vor Terminbeginn; der Server vermittelt ein Festangebot nie weiter (0047:26) und entscheidet sonst nach Termin (0047:25, 29). Die Maske verspricht damit in keinem Fall mehr als der Server hält.
   - Schema: keine Migration, keine Function geändert (laut Auftrag; siehe Grenzen).
4. **Pflichtläufe?** `check` grün am Endstand. `e2e` läuft (Log 018 ohne Exit), `rls` ohne Log: offen, kein Fund.

## Stichproben
- `.git/HEAD`, `.git/refs/heads/rs1:1` – Branch rs1 auf 5cdaded. In Ordnung.
- `tmp/proof/rs1/runs.jsonl:15`, `tmp/proof/rs1/017-check.log:1-6, 45-46, 360-361, 369` – `check` am Endstand: Deno 60 und 24 Fälle, 71 Dateien, 2097 Tests, `EXIT=0`. In Ordnung.
- `tmp/proof/rs1/runs.jsonl:14`, `tmp/proof/rs1/015-check.log:20, 26` – Zwischenstand 6843d49 rot (Typfehler Shot-Spec), durch 5cdaded behoben. In Ordnung.
- `tmp/proof/rs1/018-e2e.log:1-6` – Kopf am Endstand, ohne Exit. Offen.
- `tests/e2e/partner-anfragen.spec.ts:177` – Ausdruck ohne rohes Sonderzeichen. In Ordnung.
- `tests/e2e/auftrag-aktionen.spec.ts:139` – Kundenseite prüft das geschützte Leerzeichen. In Ordnung.
- `tests/e2e/auftrag-aktionen.spec.ts:202-236` – „Alle Angebote ablehnen“: Aufrufkörper nur `p_request`, Fokus, `invalid_transition`. Unverändert in Ordnung.
- `src/lib/jobs.ts:127` – `viennaTime` einmal, Wiener Zeit, Zeichen über `fromCharCode`. In Ordnung.
- `src/lib/partnerJobs.ts:1, 177` – Import aus `jobs`, kein `viennaTime` mehr; verwaister Kommentar (N5).
- `src/screens/auftrag/Angebote.tsx:4, 29` – nutzt `viennaTime`. In Ordnung.
- `src/screens/partner/Anfragen.tsx:24, 154, 167, 299` – Import und drei Verwendungen. In Ordnung.
- `src/screens/partner/Auftraege.tsx:6, 190, 252, 264` – Import, zwei Verwendungen, dreiwertige Übergabe. In Ordnung.
- `src/screens/partner/Absage.tsx:51-52, 196-197, 232-233, 266` – Typ, Bedingung, Sätze. In Ordnung.
- `tests/e2e/partner-absage.spec.ts:55-72` – Festangebot und fehlende Preisgrundlage ohne Zusage; positive Gegenprobe fehlt (N6).
- `supabase/migrations/20261109190000_0047_s9h2_abnahme.sql:25-29` – Bedingungen der Weitervermittlung, Zeile 26 Festangebot. In Ordnung.
- `tests/shots/meldung.spec.ts:30-35, 62` – Typ aus `RpcReturn` (`tests/e2e/backend.ts:68`), Platzhalterdaten nur im Mock. In Ordnung.
- `docs/ENTSCHEIDUNGEN.md:203`, `docs/GOLIVE.md:66`, `docs/BEKS.md:24`, `docs/OFFEN.md:23` – Montage einheitlich „BEKS Frage 1“. In Ordnung; Reste in STAND und im Kopf von GOLIVE 32 (N7).

Offene Findings hoch: 0
