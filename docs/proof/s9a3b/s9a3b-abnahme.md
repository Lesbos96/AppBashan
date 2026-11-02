# S9a-3b · Abnahme Runde 1 (Berater, Geld/Sicherheit/Schema)

- Datum: 2026-11-02
- Umfang: Arbeitsstand gegen `c56fb89`, nur die genannten Dateien. Vollständig gelesen: `src/screens/anfrage/Zusammenfassung.tsx`, `scripts/redproof-s9a3.mjs`, `.claude/agents/advisor-report.md`, `.claude/agents/reviewer.md`, `.claude/agents/test-runner.md`. In Teilen gelesen: `tests/e2e/anfrage.spec.ts` 200–430, `tests/shots/shots.spec.ts` 255–375, `CLAUDE.md` 58–69, `docs/OPEN_ISSUES.md` 98–118. Gegengelesen: `src/lib/quote.ts` 1–70, 96–112, 140–208, `src/lib/draft.ts` 105–142, `tests/unit/draft.test.ts` 129–157, `supabase/functions/_shared/quote/hold.ts`, `handler.ts` 266 und 319 (Grep). Nachweise: `tmp/proof/s9a3b-plan.md`, `s9a3b-e2e-rot.log`, `s9a3b-e2e-rot-preis.log`, `s9a3b-e2e-rot-karte.log`, `s9a3b-check.log`, `s9a3b-e2e.log`, `s9a3b-redproof-redeploy.log`, `s9a3b-shots.md`, `s9a3b-shots-run.log` (nur EXIT).
- Grundlage: eigener Plan-Bericht `tmp/proof/s9a3b-plan.md` (H-1, M-1, N-1 bis N-5).
- Hinweis: In der Tool-Liste dieses Beraters stand wieder ein eingebautes `advisor`-Tool ohne Parameter. Es wurde nicht benutzt.

## Findings

### Hoch

Keine.

### Mittel

**M-1 · `tmp/proof/s9a3b-e2e-rot-karte.log:23` mit `tests/e2e/anfrage.spec.ts:359-374`: Für die Kartensperre aus H-1 gibt es keinen Rot-Beweis.**
- Problem: Der Rot-Lauf bricht an der Erwartung zur Leiste ab (`:359`, `send(page)` ist „enabled“ statt disabled). Diese Zeile misst die Leistensperre aus R2-N1. Die Prüfungen der Kartensperre (`:361` ohne Einwilligung, `:374` nach Kontowechsel) laufen im Rot-Lauf nie. Damit ist nicht belegt, dass der Test die Umgehung aus H-1 überhaupt erkennt, also das Senden über die Karte ohne Einwilligung oder unter fremdem Konto. Nach `CLAUDE.md:66` zählt nur ein Rot-Beweis, der die Wirkung der gelockerten Sperre misst. H-1 war im Plan der einzige hohe Fund.
- Fix: Ein Rot-Lauf nur dieses Tests gegen den heutigen Code, in dem die Kartensperre gelockert ist: `disabled={!canSend}` an `Zusammenfassung.tsx:390` entfernen und `!canSend` in `:253` herausnehmen. Die Leistensperre bleibt dabei. Erwartet ist der Abbruch an `:361` mit „Received: enabled“, mit `EXIT=1` im Log (z. B. `tmp/proof/s9a3b-e2e-rot-h1.log`). Danach den Code zurücksetzen und den grünen Lauf wiederholen. Für die Variante `price_changed` ist kein eigener Rot-Lauf nötig, weil `canSend` für beide Arten gilt.

### Niedrig

**N-1 · `src/lib/quote.ts:15` und `:27`: `Confirmed.shown` bleibt ein zweiter Weg für `shown`.**
- Problem: Die App übergibt `shown` nicht mehr (`Zusammenfassung.tsx:226`, einziger Aufrufer). Nur noch die Unit-Tests (`tests/unit/draft.test.ts:131`, `:137`) benutzen das optionale Feld. Damit bleibt ein Pfad offen, auf dem ein künftiger Aufrufer einen Preis senden kann, der nicht aus der Quelle der Anzeige stammt. N-1 aus dem Plan verlangt eine einzige Quelle.
- Fix: `shown?` aus `Confirmed` streichen. `buildBody` nimmt nur `readShownFull(path)`. Die Tests setzen den Preis vorher mit `rememberShown`.

**N-2 · `docs/OPEN_ISSUES.md:115-116` gegen `:105`: Widerspruch im selben Dokument.**
- Problem: `:105` meldet R2-M1, R2-N1 und R2-N2 als erledigt, R2-N8 ebenfalls. `:115` führt R2-M1 weiter als „mittel, offen für S9a-4“, `:116` führt R2-N1, R2-N2 und R2-N8 weiter als offen.
- Fix: In `:115` und `:116` die erledigten Punkte mit „erledigt in S9a-3b“ markieren oder streichen. Offen bleiben R2-N3, R2-N4 und R2-N5.

**N-3 · `scripts/redproof-s9a3.mjs:4`: Der Kopfkommentar ist veraltet.**
- Problem: Dort steht noch, das Skript breche ab, wenn `handler.ts` nicht sauber committet ist. Die Prüfung in `:30` deckt inzwischen ganz `supabase/functions` ab.
- Fix: Den Kommentar auf `supabase/functions` ändern.

**N-4 · `scripts/redproof-s9a3.mjs:30-33`: Der Abbruchpfad mit Exit 2 ist nicht belegt.**
- Problem: Das Log zeigt nur den sauberen Fall (`PRECHECK_DIRTY=0`, `s9a3b-redproof-redeploy.log:2`). Kein Lauf belegt, dass das Skript bei einer Änderung unter `supabase/functions` mit Exit 2 und „ABBRUCH“ endet, bevor es Dev ändert. Der Code ist eindeutig: Die Prüfung steht nach dem Dev-Guard und vor jedem Zugriff auf die DB oder einem Deploy. Es fehlt also nur der Nachweis.
- Fix: Zusammen mit M-3 aus S9a-3 (OPEN_ISSUES `:113`) einen Negativbeweis führen: eine unversionierte Hilfsdatei unter `supabase/functions` anlegen, das Skript mit `--only` auf einen Code-Eintrag starten, Exit 2 und die Meldung erwarten, danach die Datei entfernen. Ins Log gehören `EXIT=` und die Ausgabe von `git status`. Der Termin S9a-4 genügt.

**N-5 · `tests/e2e/anfrage.spec.ts`: Testlücken aus Plan N-3 und N-4, in OPEN_ISSUES `:105` vermerkt.**
- Diese Tests fehlen: Preis-409 und danach Bedingungen-409 hintereinander, eine angenommene Spanne bzw. ein angenommenes Angebot, Neuladen nach der Annahme, und die Kartensperre im Zustand `price_changed`. Nach der Code-Analyse unten verhält sich jeder dieser Pfade richtig. Die Lücke ist korrekt als niedrig eingetragen und bleibt so.

**N-6 · `CLAUDE.md:68` gegen `docs/proof/s9a1/README.md`, `docs/proof/s9a3/README.md` und `docs/OPEN_ISSUES.md:114`: Neue Regel, alte Dateien.**
- Problem: Die neue Regel verbietet eine README in `docs/proof/`. Zwei solche Dateien liegen dort bereits, und OPEN_ISSUES verweist auf eine davon.
- Fix: Die beiden Dateien bleiben als Altbestand, denn Nachweisordner werden nicht nachträglich verändert. In `docs/PROGRESS.md` einmal festhalten, dass die Regel ab S9a-3b gilt. Für die Sicherheit ist das ohne Belang.

## Beantwortung der Prüffragen

**(1) Sind die Plan-Funde eingearbeitet?**
- **H-1: ja.** `canSend` (`Zusammenfassung.tsx:251`) prüft Einwilligung, Kontakt, Sendezustand und Wartezeit. Die Prüfung steht in der Logik (`:253`) und am Knopf (`:390`). Ein Kontowechsel setzt `consent` auf false (`:173`), damit ist die Karte gesperrt. Der Test `anfrage.spec.ts:352-376` ist grün (`s9a3b-e2e.log:95`). Es fehlt der Rot-Beweis (M-1).
- **N-1: ja.** `shown` wird nicht übergeben (`:226`). Direkt nach `rememberShown` vergleicht der Code mit `readShownFull`, bei Abweichung gilt `unavailable` und es wird nichts gesendet (`:262-265`). Die Feldreihenfolge von `shownFromSnapshot` (`quote.ts:207`) und `readShownFull` (`draft.ts:127-128`) ist gleich, der Vergleich der JSON-Texte ist also gültig. Rest: N-1 oben.
- **N-2: ja.** Fehlen Snapshot, Version oder `terms`, bricht `acceptChange` ohne Senden ab (`:258`, `:268`).
- **N-5: ja.** Die Prüfung umfasst `git status --porcelain -- supabase/functions` (`redproof-s9a3.mjs:30`). Der Preiscode liegt unter `supabase/functions/_shared/pricing` und ist damit erfasst. Rest: N-3 und N-4 oben.
- **N-4: teilweise.** Vorhanden: Leiste im Zustand `terms_changed` gesperrt (`:359`), Kartensperre ohne Einwilligung und nach Kontowechsel (`:360-374`), Folgefehler nach Annahme für Preis und für Bedingungen (`:302`, `:320`). Was fehlt, steht als niedrig in OPEN_ISSUES `:105` (N-5 oben).
- **M-1 (Plan): ja**, mit Fix und der Bedingung „E2E zuerst rot“ in OPEN_ISSUES `:105`.

**(2) Gilt „angezeigt = gesendet“ in allen Pfaden?** Ja, für Betrag, Version und Bedingungen.

| Pfad | Anzeige | Body | Ergebnis |
|---|---|---|---|
| Erster Aufruf nach `acceptChange` | Preiskarte aus `readShownFull` (`:197`, `:297`); Stornierung aus `accepted.terms ?? terms` (`:199`) | `shown` aus `readShownFull` (`quote.ts:27`), Version und Hash aus `now` (`:226`) | gleich. `now` ist `next` und wird aus dem `accepted` des aktuellen Renders gebildet (`:266`, `:269`). Der veraltete State ist damit umgangen |
| Folgefehler, dann „Erneut senden“ | wie oben, State ist gesetzt | `send(id)` mit Standardwert `accepted` aus dem neuen Render (`:422`, `:213`) | gleich. E2E `:302`, `:320` grün |
| Zweites 409 nach Annahme | Die andere Karte zeigt den angenommenen Wert | Die zweite Annahme verbindet `accepted` (aus dem ersten `setAccepted`, längst gerendert) mit dem neuen Wert | gleich (in beiden Reihenfolgen). Ohne Test (N-5) |
| Remount oder Reload | Preis aus dem Speicher; Bedingungen frisch geladen | Preis aus dem Speicher; Hash aus derselben frisch geladenen Quelle; Version frisch geladen | Betrag und Bedingungen gleich. Eine abweichende Version führt höchstens zu einem weiteren 409 (sicher, OPEN_ISSUES `:105`) |
| Kontowechsel oder 401 nach `rememberShown` | Die Karte zeigt den angenommenen Preis (der Kunde hat ihn gesehen und angenommen) | Es wird nicht gesendet (`:221-223`) bzw. der Weg führt über `stashDraft` mit `shownFull` | gleich |
| Angebot oder Spanne angenommen | „Preis nach Prüfung“ bzw. „X bis Y“; `shownKey` gelöscht (`draft.ts:115`) | `{kind:'offer', reasons}` bzw. low/high in Cent | gleich. Die Rundung der Spanne ist bekannt (R2-N3). In Gesendet erscheint kein Hinweis |

**(3) Kann der Server einen Preis oder Bedingungen speichern, die der Kunde nicht gesehen hat?** Nein. Der Server speichert nur bei gleicher Version und exakt gleichem `shown` (`handler.ts:319`, `hold.ts:23-35`, ohne Toleranz). Die Bedingungen prüft er über den Hash. Auf der Client-Seite stammen `shown` und der Hash aus derselben Quelle wie die Anzeige (Tabelle oben). Ein Senden über die Karte ohne Einwilligung oder unter fremdem Konto ist jetzt gesperrt (H-1). Es bleibt der bekannte Fall der Rundung bei der Spanne (R2-N3, nicht verbindlich).

**(4) Sind die Rot-Beweise echt und die Logs vollständig?** Die Logs enthalten alle `EXIT=`: rot 1/1/1, check 0, e2e 0 (97 bestanden, kein Flake), Redeploy 0, Shots 0.
- `s9a3b-e2e-rot-preis.log:9-22`: echt. Ist-Wert: Der übernommene Preis 800,00 € fehlt auf der Seite. Der wiederholte Lauf nach dem Flake in der Anmeldung (`s9a3b-e2e-rot.log:111`, Klick auf „Code senden“ mit Timeout) ist gültig.
- `s9a3b-e2e-rot.log:152`: echt. Die übernommenen Stornostufen werden nicht gezeigt.
- `s9a3b-e2e-rot.log:193`: echt. Die Leiste ist im Zustand `price_changed` aktiv.
- `s9a3b-e2e-rot.log:234`, `:276`, `:317`: echt. Die Meldung „nicht verfügbar“ fehlt.
- „Preis ohne Snapshot“ ist ein Regressionstest. Er ist im Rot-Lauf unter den 3 bestandenen, so wie im Plan erwartet.
- `s9a3b-e2e-rot-karte.log`: misst nur die Leiste, nicht die Karte (M-1).

**(5) Redproof-Skript.**
- Wiederherstellung (`redproof-s9a3.mjs:309-324`): `original` wird vor dem Lockern gelesen. Bricht das Skript im `try` ab (Fehler beim Deploy oder beim Test), schreibt `finally` `original` zurück, deployt neu und testet. Danach geht die Ausnahme weiter, der Lauf endet mit einem Exit ungleich 0, und das äußere `finally` löscht den Testnutzer (`:373-375`). Wirft das Deploy im `finally`, bleibt Dev gelockert. Die Ausnahme macht das aber laut, wie im Plan akzeptiert.
- Die md5-Prüfung vergleicht den Dateiinhalt vor und nach dem Lauf, nicht den Inhalt aus Git. Zusammen mit dem leeren `git status` vor dem Lauf heißt das: Die Datei entspricht HEAD.
- Pfad mit Exit 2: Die Prüfung läuft vor `createClient` und `run()` (`:30-33`), also vor jeder Änderung an Dev, und nur, wenn Code-Teile laufen. Ein Nachweis fehlt (N-4).

**(6) Entspricht der Endzustand der deployten Function dem Git-Stand?** Ja, soweit die Belege reichen. `s9a3b-redproof-redeploy.log:1-2`: vor dem Lauf hat `handler.ts` den md5 `ae71b0da…` und `supabase/functions` ist sauber. `:3-17`: Jede Lockerung wurde rot, nach dem Neudeploy war der Test grün, der md5 ist vor und nach gleich. `:21-22`: nach dem Lauf derselbe md5 und weiter sauber. Das letzte Deploy (im `finally` des fünften Eintrags) lief also aus einem Arbeitsbaum, der HEAD entspricht. `supabase/functions` gehört nicht zum Diff gegen `c56fb89`, also entspricht der Stand dem von `c56fb89`. Was fehlt: die Commit-Kennung im Log und ein Live-Vergleich des Bundles. Beides ist schon als M-1 aus S9a-3 offen (OPEN_ISSUES `:113`). Das Deploy auf Dev war in Z5 verlangt. Weil der Endzustand dem Git-Stand entspricht, ist es kein Verstoß.

**Agentendateien.** Bei `reviewer` und `test-runner` begrenzt nur der Prompt das Schreibrecht auf `tmp/proof/`, nicht die Technik. Beide hatten schon Bash, die Rechte wachsen also nicht. `advisor-report` ist unverändert im Sinne dieses Auftrags. Kein Fund.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `src/screens/anfrage/Zusammenfassung.tsx:173-174` | `consent` gilt nur für das Konto zur Zeit des Hakens; ein Kontowechsel hebt es auf |
| `src/screens/anfrage/Zusammenfassung.tsx:197-199` | Preiskarte aus `readShownFull`, Stornierung aus `accepted.terms ?? terms` |
| `src/screens/anfrage/Zusammenfassung.tsx:213`, `:226` | `now` mit Standardwert `accepted`; Version und Hash aus `now`, `shown` nicht übergeben |
| `src/screens/anfrage/Zusammenfassung.tsx:232` | `clientRef` ohne Version, Hash und `shown`: bleibt stabil |
| `src/screens/anfrage/Zusammenfassung.tsx:240-241` | unvollständige 409 werden zu `unavailable` |
| `src/screens/anfrage/Zusammenfassung.tsx:251-253` | `canSend` mit Einwilligung, Kontakt, Senden und Wartezeit, Prüfung in der Logik |
| `src/screens/anfrage/Zusammenfassung.tsx:258`, `:268` | Wächter aus N-2 vorhanden |
| `src/screens/anfrage/Zusammenfassung.tsx:260-265` | `rememberShown`, danach Gegenprüfung mit `readShownFull`, sonst nichts senden |
| `src/screens/anfrage/Zusammenfassung.tsx:390` | Kartenknopf `disabled={!canSend}` |
| `src/screens/anfrage/Zusammenfassung.tsx:422` | Leiste gesperrt mit `!canSend` oder offenem 409 |
| `src/lib/quote.ts:15`, `:27` | optionales `shown` besteht weiter, kein Aufrufer in der App (N-1) |
| `src/lib/quote.ts:101`, `:207` | Angebotsgründe nur bekannte, Reihenfolge des Servers übernommen |
| `src/lib/draft.ts:112-120`, `:127-128` | Schreiben von `shownFull` vor `shownKey`; beim Lesen gleiche Feldreihenfolge wie `shownFromSnapshot` |
| `supabase/functions/_shared/quote/handler.ts:319` | Speichern nur bei gleicher Version und `matchesShown` |
| `supabase/functions/_shared/quote/hold.ts:23-35` | exakter Vergleich, Gründe nach Reihenfolge |
| `scripts/redproof-s9a3.mjs:30-33` | Abbruch mit Exit 2 vor jeder Änderung an Dev, gilt für ganz `supabase/functions` |
| `scripts/redproof-s9a3.mjs:309-324` | Original vor dem Lockern gelesen, `finally` schreibt zurück, dann Deploy und Test |
| `scripts/redproof-s9a3.mjs:4` | Kommentar nennt nur `handler.ts` (N-3) |
| `tests/e2e/anfrage.spec.ts:302-318` | Folgefehler Preis: Karte zeigt 800,00 €, Body sendet 80000, Version 2, gleiche Ref |
| `tests/e2e/anfrage.spec.ts:352-376` | Kartensperre ohne Einwilligung und nach Kontowechsel, `calls` = 1 |
| `tests/shots/shots.spec.ts:275-287`, `:359-369` | Helfer `afterAccept`, zwei Routen; nur Mocks, keine Preisberechnung |
| `tmp/proof/s9a3b-e2e-rot-preis.log:9`, `:45` | rot an „800,00 €“, EXIT=1 |
| `tmp/proof/s9a3b-e2e-rot-karte.log:23`, `:47` | rot an der Leiste `:359`, nicht an der Karte, EXIT=1 (M-1) |
| `tmp/proof/s9a3b-e2e.log:84-99`, `:111-112` | neue Tests grün, 97 bestanden, EXIT=0 |
| `tmp/proof/s9a3b-check.log:42-43`, `:48` | 13 Dateien und 365 Tests bestanden, EXIT=0 |
| `tmp/proof/s9a3b-redproof-redeploy.log:1-2`, `:20-22` | md5 vorher und nachher gleich, Arbeitsbaum sauber, EXIT=0 |
| `docs/OPEN_ISSUES.md:105` gegen `:115-116` | erledigt gegen offen (N-2) |
| `CLAUDE.md:68` | keine README in `docs/proof`; zwei Alt-READMEs vorhanden (N-6) |

Offene Findings hoch: 0
