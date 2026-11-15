Modell: claude-fable-5-2

# u3 · Abnahme (R3), Runde 2: Nachabnahme des Endstands

- Datum: 2026-11-15
- Branch: `u3`, Endstand committet (Commits 8fd44ab und 1482343); `git status` zeigt nur die unversionierte `docs/VERBESSERUNGSVORSCHLAEGE.md`
- Umfang: die sieben Dateien unten (vier seit Runde 1 geändert, eine neu in der Pflichtmenge), die sechs Änderungen aus dem Auftrag, die nach OFFEN u3-4 verschobenen Funde, Neubewertung der Funde aus Runde 1. Maßstab wie in Runde 1, dazu `scripts/sys/gate-loesch-lib.mjs` und `tests/unit/sys-gate-loesch.test.ts` für Punkt 6
- Werkzeuge: nur Read, Grep, Glob. Ich habe nichts ausgeführt: kein Test, kein `tsc`, kein `sha256sum`, kein `git diff`. Die Hashes sind aus dem Auftrag abgeschrieben. Aussagen zu Punkt 6 („nur ein Eintrag“) beruhen auf dem gelesenen Endstand und auf den Läufen 15 bis 17, nicht auf einem selbst gesehenen Diff
- Runde 1 steht unverändert im Wortlaut am Ende dieser Datei (Hash- und Schlusszeile dort umbenannt, weil vier Hashes veraltet sind)

SHA256: b8baa4d61cb3062153b6489f43b41ee6042c7caebc47685240c60c51806734f3 tests/support/positiv.ts
SHA256: e50e5f189207a4e0f4ef0309d8186bde0d76fe45638b7163a93bc9445f49bdf4 tests/rls/positiv.test.ts
SHA256: d55c2f2de17c89e7cf8f89221908dfa00e3151e69b4df02a197e3ea19e91e325 tests/unit/positiv-register.test.ts
SHA256: f79a0a436e9de7fc48861382f6306b40afe2618cb6b442faf3df83321ea7cb37 tests/e2e/backend.ts
SHA256: edbac371ee472263d3db8d67b12c0a193c6ac7e8b30ee6f8c62828a34a5ce5c2 tests/e2e/jobs-helpers.ts
SHA256: e0f7ddb11fca5567446782dc6944777826adbe125cfc09ad15a6ddd4e6986a4d docs/OFFEN.md
SHA256: edda00165a1a62386926d396c95a2829b96db78d7e01f0a244262a74e059d153 scripts/sys/loesch-register.json

## Runde 2

### Ergebnis

Abgenommen. Kein Fund „hoch“, auch keiner aus Runde 1 ist es inzwischen. Die vier mittleren Funde aus Runde 1 sind behoben (M2, M4) oder bis auf einen niedrigen Rest behoben (M1, M3). Die Ausnahme im Lösch-Register ist sachlich richtig und schwächt das Gate nicht ab; sie ist aber eine Änderung an einer Gate-Datei, die der freigegebene Plan nicht vorsah, und gehört deshalb ausdrücklich in den Bericht an Beks (M5, kein Codefix). Keine Migration, kein Geldweg, kein Recht geändert (letzte Migration weiterhin 0062).

Vorbehalte:
- `e2e`-Volllauf steht aus. Die Regex-Route in `mockRpc` (`backend.ts:79`) ist durch keinen gezählten e2e-Lauf belegt: die Läufe 10 und 11 liefen vor der Änderung. Ein Fehler wäre laut, nicht still: träfe die Route nicht, landete der Aufruf in der untersten Schicht und die Fixture ließe jeden betroffenen Test scheitern (`backend.ts:97-103, 135`).
- `rls`-Volllauf steht aus. `positiv.test.ts` lief zuletzt in Lauf 13 grün (6 Tests, nicht sauberer Arbeitsbaum auf 07cb20d).
- Abweichung vom Auftrag zu meinen Gunsten: Der Volllauf `check` nach Punkt 6 liegt bereits vor (Lauf 17, Commit 1482343, Arbeitsbaum sauber, 1764 Tests bestanden, `EXIT=0`).

### Findings Runde 2

#### hoch
Keine.

#### mittel
- **M5** `scripts/sys/loesch-register.json:30` – Planabweichung, kein Mangel am Inhalt: Der Schritt hat eine Gate-Datei geändert; weder `tmp/proof/u3-plan.md` noch `tmp/proof/u3-plan-berater.md` nennen das Lösch-Register (Suche nach „loesch“, „Lösch“, `scripts/sys` in beiden: kein Treffer), und Runde 1 hatte unter Frage 7 „kein Gate“ festgestellt. Der Weg selbst ist der vorgesehene: Der Vollständigkeitstest verlangt für jede Datei mit Lösch- oder Statusmuster eine Entscheidung, und die Meldung des Hash-Tests nennt „Abnahme nötig“ (`tests/unit/sys-gate-loesch.test.ts:122-124, 132`). Das Gate hat also nicht zu Unrecht blockiert, sondern eine Einordnung verlangt. – Fix: keine Dateiänderung. Im Bericht an Beks in der Bewertung nennen: Gate-Datei geändert, ein Eintrag, Anlass Lauf 15, Abnahme hier; dazu die Ausgabe von `git diff --stat 07cb20d -- scripts/sys` (soll genau diese eine Datei mit einer eingefügten Zeile zeigen; ich konnte den Diff nicht selbst ausführen).

#### niedrig
- **N18** `tests/unit/positiv-register.test.ts:54` – Die zwei Geld-Wertfunktionen werden nur geprüft, wenn sie im Register stehen. `my_cancel_info` steht nicht in `NieAusnahme` (`positiv.ts:171-175`); wandert sie in die Ausnahmeliste, entfällt die Ganzzahl-Prüfung still. – Fix: im Test verlangen, dass beide Namen Schlüssel von `REGISTER` sind; oder `my_cancel_info` in `NieAusnahme` aufnehmen (mit u3-4).
- **N19** Läufe 12, 13 – Für die zwei neuen Tests („Geldspalten sind ganzzahlig“, „plpgsql_check: auf Dev verfügbar“) gibt es keinen roten Lauf. Das Gate verlangt ihn nicht (keine neue Datei unter `tests/rls/`). Gelesen: Der Geldtest greift (13 Einträge mit Geldspalten, Leerlaufschutz „mehr als 10“ in `:57`; ein `numeric` in einer `_cents`-Spalte ergäbe eine Zeile in `falsch`). – Fix (optional): beim Schritt zu u3-4 einmal `total_cents: 'numeric'` in einem Eintrag setzen, Lauf rot, zurücknehmen.
- **N20** `tests/rls/positiv.test.ts:89-92`, `docs/OFFEN.md:11` – Rest von M3. Der Lauf belegt, dass genau eine Zeile mit einer Version der Form Zahl.Zahl existiert, nicht den Wert „2.8“ und nicht „`installed_version` leer“; beides steht in u3-2 als geprüft. Dass u3 nichts eingeschaltet hat, folgt aus dem Fehlen einer Migration und daraus, dass `db:push` nicht lief, nicht aus diesem Test. Der Test bindet außerdem den rls-Lauf an das Angebot der Plattform: entfällt die Erweiterung im Image oder läuft die Suite gegen ein anderes Projekt, ist `rls` rot ohne Codeänderung. – Fix: `installed_version` mit abfragen und `null` erwarten (wird mit dem Schritt zu u3-2 bewusst umgestellt); den Wert 2.8 in u3-2 als „laut Abfrage in u3, nicht im Log“ kennzeichnen; den Test mit der Entscheidung zu u3-2 entfernen oder ersetzen.
- **N21** `scripts/sys/loesch-register.json:30` – Der Grund ist in der Wirkung wahr, im Wortlaut ungenau. „Nichts wird gelöscht“ stimmt nur für den Zustand nach dem Rollback: Innerhalb der Transaktion löschen und ändern die Proben, auch Zeilen, die nicht dem Test gehören (`positiv.ts:160` setzt alle wartenden Zeilen in `outbox` auf `sent`; `:332` `delete_account`; `:432, 436, 444` Aufräumfunktionen). Der Hash bindet nur die Datendatei; dass alles über `probes` läuft, steht in `tests/rls/positiv.test.ts:83` (nicht gebunden; einziger weiterer Importeur ist der Unit-Test, Suche über das Repo). – Fix: bei der nächsten Änderung des Eintrags Grund so fassen: „innerhalb der Transaktion wird geändert und gelöscht, auch fremde Dev-Zeilen in `outbox`; alles wird zurückgerollt“. Optional im Unit-Test prüfen, dass `SETUP` in `positiv.test.ts` nur als Argument von `probes(` vorkommt.
- **N22** `docs/OFFEN.md:138` (u3-4) – Folge der Ausnahme, im Eintrag nicht genannt: Jede Änderung an `tests/support/positiv.ts` macht `check` rot, bis der Hash im Lösch-Register nachgeführt ist; das ist eine Änderung an einer Gate-Datei mit Abnahme. Der Schritt zu u3-1 und u3-4 muss das einplanen. – Fix: beim Planen dieses Schritts nennen; ein Nachtrag in OFFEN jetzt würde den Hash dieser Abnahme ändern und ist dafür nicht nötig.

Hinweis zu den Fixes: N18 bis N22 verlangen keine Änderung an den sieben Dateien in diesem Schritt. Wer sie festhalten will, nennt sie in der Bewertung des Berichts; jede Änderung an einer der sieben Dateien braucht eine neue Hash-Zeile.

### Stand der Funde aus Runde 1

| Fund | Stand | Beleg |
|---|---|---|
| M1 | an den Daten behoben, Typebene niedrig offen (u3-4) | `positiv-register.test.ts:49-58`; Kette: Datenbank liefert `numeric` → rls rot, außer das Register sagt `numeric` → dann Unit-Test rot in `check`. Rest: N18, N19 |
| M2 | behoben | Lauf 14 über das Start-Programm, `EXIT=2`, drei Meldungen: `backend.ts(123,40)` TS2322 (falscher Typ im Mock), `positiv.ts(178,3)` TS2353 (`payout_preview` in der Ausnahmeliste abgelehnt), `positiv.ts(229,5)` TS2741 (`time_window` fehlt). Zurückgenommen: Lauf 17 grün auf sauberem 1482343; der Hash-Test des Lösch-Registers in diesem Lauf bestätigt für `positiv.ts` den Hash aus Runde 1 |
| M3 | weitgehend behoben, Rest N20 | `positiv.test.ts:88-92`, Lauf 13 (Log Zeile 19, bestanden). Offen aus dem Fix: Wortlaut der zwei gelöschten Abfragen in der Bewertung des Berichts |
| M4 | behoben | `docs/OFFEN.md:137`; alle Stellen nachgeschlagen (siehe Stichproben) |
| N1, N3 bis N8, N11 bis N13, N15 | verschoben nach OFFEN u3-4, vollständig aufgeführt | `docs/OFFEN.md:138` |
| N2 | unverändert, kein Fix nötig | `positiv.test.ts:43-46` |
| N9 | behoben | `backend.ts:78-79` |
| N10 | verschoben nach OFFEN u3-3 | `docs/OFFEN.md:137`, letzter Satz |
| N14 | Hinweis, unverändert | `positiv.test.ts:98` |
| N16 | eingehalten | Datei weiterhin unversioniert, nicht im Commit |
| N17 | behoben | `tmp/proof/u3-plan-berater.md` liegt vor |

### Prüffragen

#### 1. `tests/support/positiv.ts` byte-gleich
Bestätigt, soweit ohne eigenes Hashen möglich: Der Hash im Auftrag ist der aus Runde 1; der Text, den ich jetzt gelesen habe, entspricht in allen in Runde 1 zitierten Stellen dem damaligen Stand (`:21-22, 35, 39-40, 50-51, 171-175, 178-184, 192, 213, 298`). Unabhängig davon: Lauf 17 enthält den Test, der den Hash der Datei gegen den im Register eingetragenen Wert vergleicht (`sys-gate-loesch.test.ts:129-133`), und der Wert im Register ist der aus Runde 1.

#### 2. Neuer Test „Geldspalten sind ganzzahlig“
Stimmt und schwächt nichts ab. Geprüft wird jede Spalte mit Endung `_cents` und die fünf `prior_*`-Spalten über alle Einträge sowie `typ` der zwei Wertfunktionen; erlaubt sind nur `int4` und `int8`. Kein Geldfeld des Registers fällt durch das Namensmuster: `fee_vat_rate` ist ein Satz und zu Recht `numeric`, alle Betragsspalten enden auf `_cents` oder heißen `prior_*`. Die übrigen fünf Tests der Datei sind unverändert vorhanden (`:24, 30, 35, 42, 60`). Reste: N18, N19; Typebene in u3-4.

#### 3. Neuer Test „plpgsql_check“
Stimmt mit Einschränkung. Die Abfrage ist ein reines `select` auf `pg_available_extensions` über `ownerSql` (`owner.ts:20-37`), außerhalb jeder Transaktion, ohne Schreibwirkung. „Der Lauf belegt die Version“ gilt nur für die Form, nicht für den Wert (N20). Die Regel „kein `commit`, kein `db.ts`“ des Unit-Tests gilt weiter für diese Datei und ist in Lauf 17 grün. Katalogschritt und die vier Welten sind unverändert (`:79-86, 94-115`).

#### 4. `mockRpc` mit Regex
Stimmt, N9 ist behoben. Das Muster endet nach dem Namen mit optionalem Abfrageteil und Zeilenende: `withdraw` trifft `withdraw_offer` und `withdraw_change` nicht mehr, `partner_accept` nicht `partner_accept_basis`. Hostunabhängig wie zuvor (kein Anker am Anfang). Funktionsnamen bestehen nur aus Kleinbuchstaben, Ziffern und Unterstrich, also keine Regex-Sonderzeichen. Abfrageteile (`select`, `offset`, `limit`, GET-Parameter) bleiben getroffen. Typbindung unverändert (`:65, 77`). Kein gezählter e2e-Lauf seit der Änderung (Vorbehalt oben).

#### 5. `docs/OFFEN.md`
Stimmt. u3-3 (`:137`) nennt jetzt die fünf `booking_terms`-Mocks, die berichtigten Gründe für `partner.spec.ts:31` (Verzögerung und `abort`) und `partner-journal.spec.ts:91` (Verzögerung mit `fallback`, kein Mock), den Weg (asynchrone Antwortfunktionen, gemeinsamer Typ für `booking_terms`) und N10. u3-4 (`:138`) führt N1, N3 bis N8, N11 bis N13, N15 und die Typebene von M1 vollständig und sachlich richtig auf, mit Frist „mit dem Schritt zu u3-1 bündeln (R3, Fable-Abnahme)“. u3-1 (`:53`) und u3-2 (`:11`) sind inhaltlich wie in Runde 1 (u3-2: N20). Die übrigen Einträge habe ich nur überflogen, nicht gegen einen früheren Stand verglichen.

#### 6. `scripts/sys/loesch-register.json`
- Sachlich richtig: ja. `positiv.ts` enthält nur Typen, Konstanten und Funktionen, die SQL-Text liefern; beim Laden wird nichts ausgeführt (Importe aus `partner.ts` sind Textbausteine: `partner.ts:9, 14, 17, 19, 29, 32, 42`). Ausgeführt wird der Text nur in `positiv.test.ts:83` über `probes`, das alles in eine Transaktion mit Rollback klammert (`owner.ts:113`). Außerhalb davon laufen in `positiv.test.ts` nur zwei lesende Abfragen (`:90, 95`) und `currentFee()` (`:11`). Die Aussagen aus Runde 1, Frage 3 (kein Commit, `net.http_post` nur in der Warteschlange, keine sitzungsweiten Sperren) gelten unverändert, weil die Datei byte-gleich ist.
- Grund wahr: in der Wirkung ja, im Wortlaut ungenau (N21). Das Muster trifft tatsächlich die Namen der Admin-Funktionen (`positiv.ts:155, 158, 175, 340-364`) und zwei Aktualisierungen im Setup (`:103, 160`); andere Teile des Musters (Löschanweisung, Leeren einer Tabelle, Client-Löschaufruf, schreibende HTTP-Methode, Dev-Guard) kommen in der Datei nicht vor.
- Keine Abschwächung: Der Eintrag steht unter `ausgenommen` mit Grund und Hash wie bei `partner.ts` und `quote.ts`. Das ist die strengere der zwei Möglichkeiten: Eine Ausnahme bindet den Hash und wird in jedem `check` geprüft; jede Änderung an `positiv.ts` verlangt eine neue Entscheidung (N22). Muster und Logik liegen in `gate-loesch-lib.mjs:13-14, 64-72`, nicht im Register. Im Endstand hat das Register 13 Skripte (passt zu OFFEN u1b-1: zwölf ohne Freigabe plus `sweep.ts`) und 15 Ausnahmen; der Hash von `partner.ts` ist der aus den Abnahmen u1b (`docs/proof/u1b/u1b-abnahme.md:15`). Lauf 15 (sauber auf 8fd44ab) war nur in einem Test rot, mit genau einem Ist-Wert, `tests/support/positiv.ts`; die anderen 47 Tests des Gates, darunter der Hash-Test aller Ausnahmen, waren grün. Lauf 16 und Lauf 17 sind mit dem Eintrag grün. Dass sonst keine Zeile des Registers und keine andere Datei unter `scripts/sys` geändert wurde, habe ich nicht per Diff gesehen (M5, Fix).

#### 7. Tragen die verschobenen Funde die Abnahme noch
Ja. Alle zwölf sind niedrig geblieben; keiner beschreibt einen Weg, auf dem eine fehlende Funktion, ein falscher Betrag oder ein zu weites Recht grün bliebe:
- N1 (kein Verweis für `payout_preview`, `my_cancel_info`): die Ablehnung für Kunden ist anderswo belegt (`fee-schedule.test.ts:71, 112`, `cancellation-partner-preview.test.ts:186`).
- N3 (EXECUTE der Ausnahmen nicht exakt): `quote_save_booking` ist für `anon` und `authenticated` gesperrt und getestet (`quote.test.ts:278-286`); `outbox_dispatch` hat ein Recht zu viel, das ins Leere läuft (u3-1).
- N11 (Gegenakteur fremde Firma): dieser Fall ist für `job_contact` bereits getestet (`listings.test.ts:370`, `partner-my-jobs.test.ts:196`); der Fund ist damit schwächer als in Runde 1 beschrieben.
- N4 bis N8, N12, N13, N15: Härtungen und Aufräumen ohne Wirkung auf Geld oder Rechte.
Die Begründung „Pflichtdatei, deshalb nicht mehr geändert“ ist eine Entscheidung zum Umfang, kein Sachzwang (diese Nachabnahme hätte geänderte Hashes mit abgedeckt). Sie ist vertretbar, weil nichts davon mittel ist und die Bündelung mit der Migration zu u3-1 fachlich passt (N3, N6, N15 hängen an dieser Migration).

#### 8. Wäre ein Fund aus Runde 1 inzwischen „hoch“
Nein. Geprüft habe ich das an den drei Stellen, an denen sich die Lage geändert hat:
- N13 (pg_net) im Licht der Lösch-Ausnahme: Wäre die Premisse falsch, ginge der Aufräum-Aufruf von `photo_cleanup` tatsächlich hinaus. Das wäre derselbe Lauf wie stündlich im Cron (löscht nur abgelaufene Staging-Dateien) und kein Test-eigenes Löschen. Bleibt niedrig.
- M1: durch den Unit-Test jetzt in `check` erzwungen. Kein Geldrisiko.
- N9: behoben; bis zum e2e-Volllauf unbelegt, Fehler wäre laut.

### Stichproben Runde 2

| Stelle | Ergebnis |
|---|---|
| `tmp/proof/u3/runs.jsonl:12-17` | Läufe 12 (Unit, 6 bestanden), 13 (rls, 6 bestanden), 14 (`check`, Exit 2), 15 (`check` auf 8fd44ab, sauber, 1 von 1764 rot), 16 (Gate-Test, 48 bestanden), 17 (`check` auf 1482343, sauber, 1764 bestanden) |
| `tmp/proof/u3/014-check.log:18-20, 24` | drei TS-Meldungen wie in M2 verlangt, `EXIT=2` |
| `tmp/proof/u3/015-check.log:207-208, 229-230, 238` | einziger roter Test: Vollständigkeit des Lösch-Registers, Ist-Wert `tests/support/positiv.ts`; `EXIT=1` |
| `tmp/proof/u3/017-check.log:1-2, 146-147, 155` | Commit 1482343, sauber, 63 Dateien und 1764 Tests bestanden, `EXIT=0` |
| `tmp/proof/u3/013-…log:19, 31` | Test „plpgsql_check“ bestanden, `EXIT=0`; kein Wert im Log (N20) |
| `tests/unit/positiv-register.test.ts:49-58` | Geldprüfung wie beschrieben; 13 Einträge mit Geldspalten im Register gezählt |
| `tests/support/positiv.ts:197-328` | alle `_cents`- und `prior_*`-Spalten `int4` oder `int8`; `payout_preview` (`:213`) und `my_cancel_info` (`:298`) `int8` |
| `tests/rls/positiv.test.ts:88-92` | nur `select`, erwartet genau eine Zeile mit Versionsform |
| `tests/support/owner.ts:20-37, 92-115` | `ownerSql` führt eine Abfrage aus; `probes` beginnt, führt aus, rollt zurück |
| `tests/e2e/backend.ts:77-85, 110-125` | Regex-Route; sieben Standard-Mocks über `mockRpc` |
| `tests/e2e/jobs-helpers.ts:251, 269, 277, 314, 340-365` | unverändert gegenüber Runde 1 (Hash gleich), Aufrufe von `mockRpc` passen zur neuen Route |
| `scripts/sys/gate-loesch-lib.mjs:13-14, 64-72` | Muster und Suchbereich (Skripte ohne `sys/`, `tests/support`); `tests/rls` wird nicht durchsucht (bekannt: OFFEN u1b-2) |
| `tests/unit/sys-gate-loesch.test.ts:119-134` | Vollständigkeit, keine Überschneidung, Grund länger als 10 Zeichen, Hash je Ausnahme |
| `scripts/sys/loesch-register.json:2-16, 17-33` | 13 Skripte, 15 Ausnahmen; neuer Eintrag in Zeile 30, alphabetisch eingeordnet |
| `docs/proof/u1b/u1b-abnahme.md:15` | Hash von `tests/support/partner.ts` wie im Register, Zeile 29 |
| `tests/support/partner.ts:3-4, 9-42` | importierte Bausteine liefern nur Text; beim Import keine Abfrage |
| Suche nach Importen von `support/positiv` im Repo | nur `tests/rls/positiv.test.ts:9` und `tests/unit/positiv-register.test.ts:5` |
| `tests/e2e/anfrage-helpers.ts:72`, `anfrage.spec.ts:253, 359`, `wege.spec.ts:316`, `tests/shots/shots.spec.ts:278` | fünf `booking_terms`-Mocks per Regex, Zeilen wie in OFFEN u3-3 |
| `tests/e2e/partner.spec.ts:31-39` | `register_partner`: Verzögerung und `abort`, wie in OFFEN u3-3 |
| `tests/e2e/partner-journal.spec.ts:91-94` | Verzögerung mit `fallback`, kein Mock, wie in OFFEN u3-3 |
| `tests/rls/listings.test.ts:370`, `partner-my-jobs.test.ts:196` | `job_contact` mit fremder aktiver Firma ist getestet (zu N11) |
| `supabase/migrations/` | 62 Dateien, letzte 0062: keine neue Migration |
| `tmp/proof/u3-plan.md`, `u3-plan-berater.md` | kein Treffer für das Lösch-Register oder `scripts/sys` (M5) |

## Runde 1 (Wortlaut vom 2026-11-14, Hashes veraltet)

- Modell Runde 1: claude-fable-5-2

### u3 · Abnahme (R3): Testlücke Mocks ↔ Datenbank

- Datum: 2026-11-14
- Branch: `u3`, Arbeitsbaum nicht committet (Läufe 1 bis 11 in `tmp/proof/u3/runs.jsonl`, alle mit „sauber: false“ auf Commit 07cb20d)
- Umfang: Positivzeilen-Register, Unit-Abgleich, Katalogschritt, `mockRpc`, OFFEN-Einträge; Maßstab sind `tmp/proof/u3-plan.md`, meine Planprüfung (Auflagen 1 bis 7, Wortlaut aus dem Transkript des Subagents `advisor` dieser Session, 22:27 UTC; eine Datei dazu gibt es unter `tmp/proof/` nicht), `docs/SYSTEM_VORSCHLAG.md:180-187`, `.claude/rules/geld.md`, `daten.md`, `tests.md`
- Werkzeuge: nur Read, Grep, Glob. Ich habe nichts ausgeführt: kein `tsc`, kein Test, kein `sha256sum`. Die Hashes sind aus dem Auftrag abgeschrieben. Aussagen zur Typbindung beruhen auf Lesen.

Runde 1 (veraltet): b8baa4d61cb3062153b6489f43b41ee6042c7caebc47685240c60c51806734f3 tests/support/positiv.ts
Runde 1 (veraltet): 953633f1cb8aafc670afafd6b01d7e57fe268966e115fbaa4b197a6cde00ffcd tests/rls/positiv.test.ts
Runde 1 (veraltet): bfd245a89ceb7b5b04f84588b8f108c6c22be3c142cae2bacc5fbffd9d841a8d tests/unit/positiv-register.test.ts
Runde 1 (veraltet): a7e4718dae4ae52f71a07d01099997f846e935ef4fde7f3417081e334be2e58d tests/e2e/backend.ts
Runde 1 (veraltet): edbac371ee472263d3db8d67b12c0a193c6ac7e8b30ee6f8c62828a34a5ce5c2 tests/e2e/jobs-helpers.ts
Runde 1 (veraltet): c09a59bea3254090773a41bf4acf4e772ff6e04539b33aa9d4092908548cd2a0 docs/OFFEN.md

### Ergebnis (Runde 1)

Abgenommen mit Auflagen. Kein Fund „hoch“: keine Migration, kein Geldweg, kein Recht geändert; die Proben committen nichts. Vier mittlere Funde betreffen eine nur in den Daten erfüllte Auflage (`*_cents`), zwei fehlende Nachweise und eine unvollständige Liste in OFFEN. Jede Korrektur an einer der sechs Dateien ändert ihren Hash; dafür genügt eine Nachabnahme des Unterschieds.

Vorbehalt: In `runs.jsonl` steht noch kein `check`-Lauf. Die Typbindung (Register, `mockRpc`) ist damit durch keinen gezählten Lauf grün belegt; das leistet erst der Volllauf `check` auf dem committeten Endstand. `backend.ts` wirkt auf jede e2e-Spec, gezielt gelaufen sind nur zwei (Läufe 10, 11).

### Findings (Runde 1)

#### hoch
Keine.

#### mittel
- **M1** `tests/support/positiv.ts:21-22, 39-40` – Auflage 2 („jede Spalte `*_cents` als int4/int8“) ist nur in den Daten erfüllt, nicht erzwungen. `PgFor<number>` erlaubt für jede Zahlspalte auch `numeric` und `float8`; dasselbe gilt für `typ` der Geld-Wertfunktionen (`payout_preview` :213, `my_cancel_info` :298) und für die Geldspalten ohne Suffix (`prior_fee`, `prior_net`, `prior_payout`, `prior_total`, `prior_vat` :269-270). Liefert eine künftige Migration eine Cent-Spalte als `numeric`, wird das Register mit einer Zeile Anpassung wieder grün. – Fix: im Typ `Ergebnis<N>` für Schlüssel mit Endung `_cents` und die fünf `prior_*`-Spalten nur `'int4' | 'int8'` zulassen (Template-Literal-Schlüssel), für die zwei Wertfunktionen ebenso; oder eine Zeile im Unit-Test, die das über alle `spalten` prüft.
- **M2** Nachweis, Typseite – Der Rot-Beweis für `mockRpc` lief als `npx tsc` ohne Log und außerhalb des Start-Programms; nach `.claude/rules/tests.md:3` zählt er nicht. Für die zwei anderen Typsperren (Funktion aus `NieAusnahme` in `AUSNAHMEN`, fehlende oder überzählige Spalte in `spalten`) gibt es gar keinen roten Lauf. Belegt ist nur die Laufzeitseite (Lauf 8: Unit-Test rot, Ist-Wert `payout_preview` in der Meldung; Lauf 9: rls rot, Meldung mit den Ist-Spalten von `my_jobs`). – Fix: ein Lauf `npm run t -- check` mit drei vorübergehenden Fehlern (Mock `my_jobs` mit falschem Typ in `total_cents`; `payout_preview` nach `AUSNAHMEN`; eine Spalte in `spalten` entfernt), Log mit den drei TS-Meldungen, danach zurücknehmen und grün.
- **M3** `docs/OFFEN.md:11` (u3-2), Läufe 1 und 6 – Die Angabe „plpgsql_check verfügbar, Version 2.8, nicht eingeschaltet“ steht in keiner Nachweisdatei: Die Logs 001 und 006 enthalten nur „1 passed“, die Probe-Dateien `_katalog-probe.test.ts` und `_diag.test.ts` sind gelöscht. Der Plan (Punkt 5) hatte „Ergebnis im Lauflog“ zugesagt. Damit ist auch nicht prüfbar, was die beiden Eigentümer-Läufe gegen Dev abgefragt haben. – Fix: eine Prüfung mit Erwartung, deren Lauf den Wert belegt (z. B. ein `it` in `positiv.test.ts`: `pg_available_extensions` für `plpgsql_check` hat eine `default_version` und keine `installed_version`), oder u3-2 auf „unbelegt“ umformulieren; den Wortlaut der beiden gelöschten Abfragen in der Bewertung des Berichts nennen.
- **M4** `docs/OFFEN.md:137` (u3-3) – Die Liste der nicht umgestellten Mocks ist unvollständig. Es fehlen fünf Mocks für `booking_terms` mit Regex-Route: `tests/e2e/anfrage-helpers.ts:72`, `tests/e2e/anfrage.spec.ts:253`, `tests/e2e/anfrage.spec.ts:359`, `tests/e2e/wege.spec.ts:316` (nur Fehlerfall, sonst `fallback`), `tests/shots/shots.spec.ts:278`. Sie liefern Stornostufen und Pauschale; der Typ bindet sie wegen `Json` ohnehin nicht, gerade deshalb gehören sie in den Eintrag. Zwei Gründe sind ungenau: `partner.spec.ts:31` bleibt wegen verzögerter Antwort und `abort` stehen (den Körper könnte `mockRpc` lesen), `partner-journal.spec.ts:91` ist kein Mock, sondern eine Verzögerung mit `fallback`. – Fix: Eintrag ergänzen und berichtigen; als Weg nennen: `mockRpc` nimmt asynchrone Antwortfunktionen, und `booking_terms` bekommt einen von Hand geschriebenen Typ, den App und Mocks teilen.

#### niedrig
- **N1** `tests/support/positiv.ts:213, 298` – `payout_preview` und `my_cancel_info` (Geld, `authenticated` darf ausführen) haben weder Gegenzeile noch den in Auflage 3 verlangten Verweis. Abgedeckt sind sie: `tests/rls/fee-schedule.test.ts:71, 112` (Kunde: `not_found`), `tests/rls/partner-mfa.test.ts:60`, `tests/rls/partner-functions-live.test.ts:154`, `tests/rls/cancellation-partner-preview.test.ts:186`. – Fix: Verweis als Kommentar oder Gegenzeile für Wertfunktionen (erwartet: Fehler).
- **N2** `tests/rls/positiv.test.ts:43-46` – Abweichung vom Wortlaut der Auflage 7: Die Zeilenzahl liest der Eigentümer aus der Temp-Tabelle des Akteurs. Sachlich gleichwertig, weil `create temp table … as select` als Akteur läuft und die Tabelle nur dessen Zeilen enthält; ohne TEMP-Recht oder Leserecht wird der Schritt rot, nicht grün. – Fix: keiner nötig; im Kopfkommentar festhalten.
- **N3** `tests/rls/positiv.test.ts:99` – Die EXECUTE-Menge wird nur für `REGISTER` festgenagelt, nicht für die zwei Ausnahmen. `quote_save_booking` schreibt eine Buchung mit `p_customer` und Betrag; für `anon` und `authenticated` prüft es heute `tests/rls/quote.test.ts:278-286`, die exakte Menge prüft niemand. – Fix: `Ausnahme` bekommt `ausfuehren`, die Schleife läuft über beide Listen.
- **N4** `tests/support/positiv.ts:171-175` – `NieAusnahme` ist nicht an `Name` gebunden: Nach einer Umbenennung schützt der alte Name still nichts mehr. – Fix: Typzeile, die `NieAusnahme extends Name` verlangt.
- **N5** `tests/support/positiv.ts:183` – Grund ungenau: `quote_save_booking` ist über die Edge Function `quote` erreichbar (`supabase/functions/_shared/quote/db.ts:183`); ohne passende Zeilen endet der Aufruf am Fremdschlüssel (`tests/rls/quote.test.ts:289`). – Fix: Grund so formulieren.
- **N6** `tests/support/positiv.ts:178-182` – Ein bekannter Fehler ist nur Text. Nach dem Fix von u3-1 zwingt nichts dazu, die Ausnahme zu streichen. – Fix: `bekannter_fehler` trägt den erwarteten SQLSTATE; ein Schritt ruft die Funktion als registrierter Akteur und erwartet genau ihn (bei `outbox_dispatch` gefahrlos: der Abbruch kommt in der ersten Anweisung, `0036:65`).
- **N7** `tests/rls/positiv.test.ts:39-40, 57` – Wertfunktionen werden nur auf den Typ geprüft; NULL oder ein Ablehnungsstatus als Text bliebe grün. – Fix (optional): für die Wertfunktionen aus `NieAusnahme` „nicht NULL“ verlangen.
- **N8** `tests/support/positiv.ts:50-51`, `tests/rls/positiv.test.ts:33, 64-66` – `davor` und der Zweig `einzeln` werden von keinem Eintrag benutzt. – Fix: entfernen.
- **N9** `tests/e2e/backend.ts:78` – Das Routenmuster endet offen: ein künftiges `mockRpc(…, 'withdraw', …)` träfe auch `withdraw_offer` und `withdraw_change`, `partner_accept` auch `partner_accept_basis`. – Fix: Regex mit Ende oder Fragezeichen nach dem Namen.
- **N10** `tests/e2e/jobs-helpers.ts:37-54, 85-97, 120` – `JobRow`, `ChangeRow`, `OfferRow` sind von Hand geschrieben. Über Variablen prüft der Typ nur fehlende und falsch getypte Spalten, keine überzähligen. – Fix: aus `RpcReturn<…>[number]` ableiten; `commissions` (:198) als `RpcReturn<'my_commissions'>` typen, auch ohne `mockRpc`.
- **N11** `tests/support/positiv.ts:240` – Die Gegenzeilen prüfen nur ein Konto ohne Firma. Der realistischere Missbrauch ist eine fremde aktive Firma; OFFEN S9i7b2-6 nennt diese Lücke für die Kontaktsperre. – Fix: für `job_contact` zusätzlich `U.pb` (Firma b, aal2) als Gegenakteur.
- **N12** `tests/support/positiv.ts:35` – Die Typregel greift nur bei `p_actor`. `quote_save_request`, `quote_save_booking` (`p_customer`) und `delete_account` (`p_user`) hängen allein an `ausfuehren: 's'` im Katalogschritt. – Fix (optional): Regel auf `p_customer` und `p_user` ausdehnen, `admin_grant_role` bleibt `owner`.
- **N13** Premisse pg_net – Im Repo nicht gemessen (siehe Frage 3). – Fix (optional): in der Welt `betrieb` nach `photo_cleanup` ein Eigentümer-Schritt, der die Warteschlange zählt (mindestens 1 innerhalb der Transaktion).
- **N14** `tests/rls/positiv.test.ts:92` – Der Katalogschritt sieht nur `prokind = 'f'`; Prozeduren und Aggregate in `public` blieben unsichtbar. Hinweis, kein Fix nötig.
- **N15** Elf Funktionen mit `auth.uid()`-Logik haben EXECUTE auch für `service_role` (`'us'`: `decline_listing`, `withdraw`, `my_jobs`, `my_job_partner`, `job_contact`, `start_job`, `report_not_done`, `complete_job`, `my_job_changes`, `my_cancel_info`, `my_commissions`). Keine Ausweitung (`service_role` umgeht RLS ohnehin), aber uneinheitlich neben den `'u'`-Funktionen. – Fix (optional): mit der Migration zu u3-1 entziehen.
- **N16** `docs/VERBESSERUNGSVORSCHLAEGE.md` – Unversioniert im Arbeitsbaum, Stand 8. November, gehört nicht zu u3. – Fix: nicht mitcommitten.
- **N17** Die Planprüfung liegt nicht als Datei unter `tmp/proof/`. – Fix: Wortlaut vor `npm run bericht` ablegen (wie bei früheren Schritten), sonst fehlt der Maßstab im Nachweisordner.

### Prüffragen (Runde 1)

#### 1. Auflagen der Planprüfung

| Nr. | Ergebnis | Beleg |
|---|---|---|
| 1 | erfüllt | Vereinigung und leerer Schnitt per Typ: `positiv.ts:184` (`satisfies` auf `Exclude<Name, NieAusnahme>`), `:192` (Schlüssel = `Name` ohne Ausnahmen). Parser bricht ab: `positiv-register.test.ts:13, 15` (Marker fehlen, weniger als 50 Namen), Gegenprobe `:30-33`. Katalogschritt: `positiv.test.ts:88-98` (beide Richtungen, ohne Trigger- und Erweiterungsfunktionen) |
| 2 | teilweise | Geldparameter nur aus `currentFee` und `splitFee`/`splitChange`: `positiv.test.ts:11-18`, `positiv.ts:186` (die Null-Aufteilung `zero` ist für Storno ohne Gebühr richtig). EXECUTE exakt und über Überladungen: `positiv.test.ts:99-103`. `*_cents` int4/int8: in den Daten ja, nicht erzwungen (M1); Ausnahmen ohne EXECUTE-Menge (N3) |
| 3 | erfüllt, Rest N1 | `p_actor` nur `service_role`: Typ `positiv.ts:35`, Laufzeit `positiv-register.test.ts:49-54`; ich habe alle Funktionen mit `p_actor` in `database.types.ts:1479-2004` gegen das Register gelesen, alle `als: 'service_role'`. `owner` nur ohne EXECUTE der drei API-Rollen: `positiv.test.ts:104-106`. Gegenzeilen: acht, Prüfung `positiv.test.ts:49, 70-73` |
| 4 | erfüllt | Zwei Arten: `positiv.ts:56`; Muster im Unit-Test `:35-40`; OFFEN-Eintrag `docs/OFFEN.md:53`; Ist-Wert des Funds im Log von Lauf 3, Zeile 95 (42501, Schema `private`). Kein Fund in einer Halte-Kategorie (Frage 4) |
| 5 | erfüllt | `positiv.ts:171-175`: 29 Namen, deckungsgleich mit der Auflage; erzwungen in `:184`. Alle 29 stehen im Register. Roter Lauf für die Sperre fehlt (M2), Namen nicht an `Name` gebunden (N4) |
| 6 | teilweise | Spaltenweise nullbare Zeilen: `backend.ts:60, 65`; Bindung `:77`; `Json` benannt (`backend.ts:63`, `OFFEN.md:137`). Ein Cast an der Aufrufstelle (`auftrag-absage.spec.ts:44`, begründet). Liste der nicht umgestellten Mocks unvollständig (M4) |
| 7 | erfüllt, Abweichung N2 | Nur `probes` und lesendes `ownerSql` (`positiv.test.ts:8, 83, 89`; `fee.ts:9`); Textprüfung `positiv-register.test.ts:42-47`. Kein Import von `db.ts`; `positiv.ts:7` zieht über `partner.ts` zwar `owner.ts` nach, das beim Import nichts tut (Lauf 2 im Projekt `unit` grün). Zeilenzahl nicht im Akteurschritt (N2) |

#### 2. Typbindung und Lücken

Wirkt, soweit lesbar. `REGISTER` verlangt jeden Namen aus `keyof Functions` außer den Ausnahmen und lehnt fremde Schlüssel ab (`positiv.ts:192`); `AUSNAHMEN` lehnt Namen aus `NieAusnahme` und unbekannte Namen ab (`:184`). Die Spaltenmenge ist über `-?` und die Prüfung überzähliger Schlüssel an `Returns` gebunden, die Kategorie (Text, Zahl, Bool, Json, Array) über `PgFor` (`:17-27, 36-40`); den genauen Typ misst erst die Datenbank (`positiv.test.ts:66`). Jede Welt wird ausgeführt, `Welt` ist eine geschlossene Menge (`positiv.ts:29`, `positiv.test.ts:80`).

Eine neue Funktion ohne Eintrag bleibt nicht grün: Mit neuen Typen ist `tsc` rot und der Unit-Test rot (Lauf 8); mit veralteten Typen ist der Katalogschritt rot (`positiv.test.ts:97`); eine Überladung fängt `:102`. Restlücken, alle ohne grünen Weg für eine fehlende Funktion: M1, N3, N4, N12, N14. Die Typseite ist durch keinen gezählten Lauf belegt (M2, Vorbehalt oben).

#### 3. Rollback

Kein Schritt committet. `probes` klammert alles in eine Transaktion mit Rollback (`tests/support/owner.ts:113`); die Schritte laufen in einem DO-Block innerhalb dieser Transaktion, ein `commit` darin wäre ein Fehler, kein Commit. `SETUP` (`positiv.ts:138-166`) enthält kein `commit`; der Unit-Test prüft es am Text (`:45`). Außerhalb von `probes` laufen nur zwei lesende Abfragen (`fee.ts:9`, `positiv.test.ts:89`).

Funktionsrümpfe: `net.http_post` rufen nur `photo_cleanup` (`0020:139`), `photo_publish_dispatch` (`0035:232`) und `outbox_dispatch` (`0036:70`). Die ersten zwei stehen im Register (`positiv.ts:436, 437`), die dritte ist Ausnahme und wird nicht aufgerufen. `cron.schedule` steht nur als eigene Anweisung in Migrationen, in keinem Rumpf; `dblink` kommt nicht vor; Vault wird nur gelesen; `storage.objects` wird nur per SQL in der Transaktion beschrieben. Eine Suche nach sitzungsweiten Sperren (`pg_advisory_lock`) in den Migrationen blieb ohne Treffer.

Die Premisse zu pg_net stimmt nach meinem Wissen über die Erweiterung: `net.http_post` fügt eine Zeile in die Warteschlangentabelle ein, der Hintergrundprozess sieht nur committete Zeilen, ein Rollback verwirft die Anfrage; es bleibt nur die verbrauchte Sequenznummer. Im Repo belegt ist das nicht (N13). Wäre sie falsch, wäre die Wirkung auf Dev trotzdem harmlos: der Aufräum-Lauf ist derselbe wie stündlich im Cron, ein Veröffentlichungs-Aufruf ohne gültigen Claim tut nichts.

Nebenwirkung innerhalb der Transaktion: Die Welt `betrieb` sperrt alle offenen Zeilen in `outbox`, bis zu 50 wartende Fotos und alles, was die Fristen-Funktionen anfassen, bis zum Rollback (Sekunden; Lauf 7 dauerte 10 s). Ein gleichzeitiger Cron wartet oder scheitert einmal. Das ist hinnehmbar; nie neben einem zweiten rls-Lauf starten (OFFEN S9t-3, nicht erzwungen).

#### 4. Funde und Ausnahmen

- `outbox_dispatch`: Einordnung bestätigt. Kein Geld, kein Zuschlag, keine Rechte-Ausweitung: Die Funktion ist `security invoker` (`0036:59`), ruft zuerst `private.outbox_expire()` (`:65`), und `service_role` hat kein USAGE auf `private` (`0001:13-14`). Das Recht aus `0033:21` läuft seit 0036 ins Leere, also zu wenig wirksames Recht, nicht zu viel. Kein Code ruft die Funktion als `service_role` (Suche in `supabase/functions`, `scripts`, `src`: nur Kommentare); der Eigentümer-Weg ist getestet (`tests/rls/outbox.test.ts:56`). Sie fällt unter keine Halte-Kategorie der Auflage 4 (der Statuswechsel betrifft die Mail-Warteschlange, nicht den Auftrag). Der Fix in `OFFEN.md:53` (EXECUTE entziehen, Eintrag als `owner`) ist richtig. Verbesserung: N6.
- `quote_save_booking`: als Ausnahme zulässig (Auflage 5 nennt die Miete ausdrücklich); Grund präzisieren (N5), EXECUTE festnageln (N3).
- `*_cents` als `int8` in Tabellenfunktionen: kein Fund. Ganzzahl-Cent wie in `geld.md` verlangt; `bigint` entsteht aus Summen und aus den Casts nach 0061; PostgREST liefert Zahlen, die Typdatei sagt `number`.
- `my_request_offers.amount_cents` als `int4`: kein Fund. Passt zu `send_offer(uuid, integer)` (`tests/rls/rls.test.ts:480`); uneinheitlich neben `confirm_offer_basis.amount_cents` (`int8`), ohne Wirkung.
- `partner_quality.cancels` als `int8`: kein Fund (Zählung). `billing_month` als `date`: kein Fund.
- Weitere Beobachtung aus dem Katalog: N15.

#### 5. Gegenzeilen

Die acht Zeilen decken alle Tabellenfunktionen, die `authenticated` ausführen darf (alle Einträge mit `'u'` oder `'us'` und `ergebnis: 'zeilen'`). Für `authenticated` gibt es keine Funktion mit Fotodaten (`job_photo_list`, `admin_photo` nur `service_role`). Es fehlen die zwei Geld-Wertfunktionen `payout_preview` und `my_cancel_info` (N1; die Prüfung `count(*)` passt für Wertfunktionen nicht, sie bräuchte „Fehler erwartet“). Der Gegenakteur mit aal2 ist richtig gewählt, weil eine Ablehnung dann nicht an fehlender MFA liegt. Empfehlung: zweiter Gegenakteur fremde Firma (N11).

#### 6. mockRpc

- Bindung: ja für Wert- und Zeilenfunktionen. `N` wird allein aus `name` bestimmt, die Antwort muss `RpcReturn<N>` sein (`backend.ts:65, 77`): fehlende Spalte oder falscher Typ ist ein Fehler, überzählige Spalte nur bei direkt geschriebenen Objekten (N10). `void` antwortet mit 204 wie PostgREST. `Json` ist nicht gebunden und so benannt. Kein gezählter roter Lauf (M2).
- Cast in `auftrag-absage.spec.ts:44`: vertretbar. `my_cancel_info` liefert nie NULL (`0059:151-154`, `coalesce … ::bigint`), der Kommentar stimmt; der Test prüft bewusst eine Antwort außerhalb des Vertrags, `State.fee` bleibt `number | null`, ein anderer Typ käme nicht durch.
- OFFEN u3-3: nicht vollständig und in zwei Gründen ungenau (M4). Richtig benannt: `complete_job` und `report_not_done` (`auftrag-aktionen.spec.ts:91-96`, verzögerte Antwort), `my_commissions` (`jobs-helpers.ts:214`, Range und `content-range`).

#### 7. Nichts Unerlaubtes

Erfüllt. Geändert oder neu sind laut Stand des Arbeitsbaums nur `docs/OFFEN.md`, fünf Dateien unter `tests/e2e` und `tests/shots`, `tests/rls/positiv.test.ts`, `tests/support/positiv.ts`, `tests/unit/positiv-register.test.ts`. Keine Migration (letzte ist 0062), keine Edge Function, kein App-Code, kein Gate (`scripts/sys`, `.claude`, `.githooks`, `package.json`), nichts aus „Später“. Die Probe-Dateien unter `tests/rls/_*` sind gelöscht (Glob leer). `plpgsql_check` wurde laut OFFEN nicht eingeschaltet; der Beleg fehlt (M3). Fremd im Arbeitsbaum: N16.

### Stichproben (Runde 1)

| Stelle | Ergebnis |
|---|---|
| `supabase/functions/_shared/database.types.ts:1478-2129` | 79 Funktionen gezählt; Register 77 (10, 26, 20, 21 je Welt) plus 2 Ausnahmen; Spaltennamen von `my_jobs` (16), `decide_change_basis` (11), `admin_correct_basis` (9) stimmen mit `positiv.ts` überein |
| `tests/support/positiv.ts:171-175` | 29 Namen wie Auflage 5 |
| `tests/support/positiv.ts:192-450` | alle Funktionen mit `p_actor` als `service_role`; `owner` nur bei `admin_grant_role`, `photo_claim`, `photo_publish_dispatch`, je `ausfuehren: ''` |
| `tests/rls/positiv.test.ts:88-107` | Katalog: beide Richtungen, Überladungen, exakte Rollenmenge, Akteur in der Menge |
| `tests/support/owner.ts:92-115` | eine Transaktion, Savepoint je Schritt, Rolle und Claims je Schritt zurückgesetzt, Rollback am Ende |
| `supabase/migrations/…0036_outbox_harden.sql:58-72` | `security invoker`, erste Anweisung `private.outbox_expire()` |
| `supabase/migrations/…0001_foundation.sql:13-14` | USAGE auf `private` nur für `authenticated` |
| `supabase/migrations/…0020_photo_staging.sql:125-141` | `photo_cleanup`: `security invoker`, liest Vault, ein `net.http_post` |
| `supabase/migrations/…0035_job_photos.sql:213-238` | `photo_publish_dispatch`: Vault vor dem Claim, `net.http_post` je Claim |
| `supabase/migrations/…0062_fee_schedule.sql:114-126` | `payout_preview`: aal2 und Firmenmitglied, sonst Fehler; EXECUTE nur `authenticated` (Register `'u'`) |
| `supabase/migrations/…0059_partner_cancel_preview.sql:142-159` | `my_cancel_info`: nur der Kunde, nie NULL |
| `tmp/proof/u3/003-…log:95` | Ist-Wert des Funds: `outbox_dispatch`, `service_role`, 42501 Schema `private` |
| `tmp/proof/u3/008-…log:20` | Unit-Test rot, Ist `payout_preview` |
| `tmp/proof/u3/009-…log:31` | rls rot, Meldung nennt die Ist-Spalten von `my_jobs` |
| `tmp/proof/u3/001-…log`, `006-…log` | nur „1 passed“, kein Wert (M3) |
| `tmp/proof/u3/runs.jsonl` | 11 Läufe, rot vor grün für `positiv.test.ts` (3 bis 5 vor 7); kein `check`, kein Volllauf |
| `tests/rls/outbox.test.ts:56` | `outbox_dispatch` als Eigentümer in einer Rollback-Probe, grüner Weg vorhanden |
| `tests/rls/rls.test.ts:437-499` | bestehende EXECUTE-Liste für SECURITY DEFINER; der neue Katalogschritt ist strenger (exakt, auch `service_role`, auch `security invoker`) |
| `tests/rls/quote.test.ts:278-289` | `quote_save_booking`: `anon` und `authenticated` 42501, `service_role` erreicht die Funktion |
| `tests/e2e/backend.ts:59-84` | `RpcReturn`, `RpcFail`, `mockRpc` wie beschrieben |
| `tests/e2e/jobs-helpers.ts:251, 269, 277, 314, 340-351, 352, 360` | umgestellt; `:214` nicht (in OFFEN genannt) |
| `tests/e2e/auftrag-aktionen.spec.ts:65, 91-96` | ein Mock umgestellt, zwei nicht (in OFFEN genannt) |
| `tests/shots/absage.spec.ts:49` | umgestellt, Wert `number` |
| `tests/shots/shots.spec.ts:278`, `tests/e2e/anfrage.spec.ts:253, 359`, `anfrage-helpers.ts:72`, `wege.spec.ts:316` | `booking_terms` per Regex-Route, fehlen in OFFEN u3-3 (M4) |
| `supabase/functions/_shared/quote/db.ts:183` | `quote` ruft `quote_save_booking` (N5) |
| `package.json:49, 51`, `tsconfig.node.json:7`, `vite.config.ts:23` | `check` enthält `tsc` über `tests/` und das Projekt `unit` |

(Runde 1: hoch 0)

## Schluss

Runde 2: hoch 0, mittel 1 (M5, nur Berichtspflicht), niedrig 5 neu (N18 bis N22); aus Runde 1 verschoben nach OFFEN u3-3 und u3-4 wie oben.

Offene Findings hoch: 0
