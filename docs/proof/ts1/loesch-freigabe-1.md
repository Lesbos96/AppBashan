Modell: claude-fable-5-2
SHA256: 9093ee3fd9ac32f23585fdff585e5e9ec381edb3cab9b0ff3372fcaeb36e75ed scripts/live-test.mjs
SHA256: ed1982c6c6b0d4637adc6b2db3a2dd7eea56dd4c3cacd4706530cb7f26e56cba scripts/live-uploads.mjs
SHA256: 83016ac6835f06705efee14362ac4bb9afdbae72de61524118244344f721c704 scripts/live-quote-app.mjs
SHA256: 3bc7bbf6990beeba7202e3c75c3474b54aeab7f58207f041cc88a727460d9e48 scripts/redproof-s9a4.mjs
Urteil: frei

# Lösch-Freigabe 1, Schritt ts1 (R3)

Datum: 2026-11-19
Vorgängerbericht: keiner. Für keines der vier Skripte und für keine der zwei gebundenen Dateien gibt es bisher eine Lösch-Freigabe in `docs/freigaben/` (Suche über die Hash-Zeilen aller sechs Dateien dort: nur `sweep.ts`, `marker.ts`, `race-copy.ts`, `dev-testdaten-zuruecksetzen.mjs`, `setup-outbox.mjs`). Der Auftrag spricht von „der Freigabe früherer Schritte“; im Sinn des Lösch-Gates gibt es sie nicht. Ich habe deshalb nicht nur die Änderung, sondern alle vier Dateien im Endstand ganz geprüft.
Geprüft (vollständig gelesen): `scripts/live-test.mjs` (128 Zeilen), `scripts/live-uploads.mjs` (236), `scripts/live-quote-app.mjs` (205), `scripts/redproof-s9a4.mjs` (703), laut Auftrag Branch ts1, Commit 89db12b.
Zur Einordnung gelesen: `scripts/redproof-lib.mjs`, `scripts/redproof-sql.mjs`, `scripts/dev-guard.mjs`, `scripts/sys/loesch-register.json`, `scripts/sys/gate-loesch.mjs`, `scripts/sys/gate-loesch-lib.mjs`, `scripts/sys/gate-db-lib.mjs`, `scripts/sys/fertig.mjs`, `scripts/scan-proof.mjs`, `tests/support/db.ts`, `tests/support/marker.ts`, `tests/rls/captcha-live.test.ts`, `supabase/functions/_shared/route/handler.ts` (alle ganz), `.claude/rules/daten.md`, `.claude/hooks/guard.mjs:185-234`, `supabase/functions/_shared/route/facts.ts:84-98`, `docs/freigaben/mail2-loesch-freigabe-1.md` (Vorlage), `docs/freigaben/dev1-loesch-freigabe-2.md:80-87`, `tmp/proof/ts1/runs.jsonl`, Fehlerzeilen der Logs 015 und 017, `docs/STAND.md` (Treffer zu ts1), `tmp/proof/ts1-plan.md` (Treffer), Suchen über `scripts/` und `tests/` (Anmeldewege, Aufrufe von `route`, Captcha), über `supabase/functions/` (Captcha), über `tests/support/sweep.ts`, `scripts/dev-testdaten-zuruecksetzen.mjs`, `scripts/redproof-cleanup.mjs` (Adressmuster der Aufräumwege), über `.env.example` (nur Variablennamen), über `docs/` nach Zeilenverweisen auf die vier Skripte.

Hinweise zum Nachweis:
- Die vier Hash-Zeilen oben sind unverändert aus dem Auftrag übernommen, nicht nachgerechnet (kein Shell-Werkzeug). Das Gate rechnet sie beim Übernehmen und beim Start gegen die Dateien nach.
- Ich konnte nichts ausführen und habe kein `git diff`. Dass außer den genannten Stellen nichts geändert wurde, ist deshalb nur mittelbar belegt: (a) Zeilenverweise früherer Berichte passen genau zu „zwei Zeilen für die Konstante eingefügt, sonst nichts verschoben“ (`docs/freigaben/dev1-loesch-freigabe-2.md:85` nennt die Adresszeile in `live-test.mjs` bei 49, heute 51; in `live-quote-app.mjs` bei 25, heute 25; `:142` nennt `live-uploads.mjs:31`, heute 33; `docs/proof/r1/r1-abnahme-r2.md:25`, `:53`, `:80`, `:182` nennen in `redproof-s9a4.mjs` 525-528, 119, 140-157, 532, heute je zwei Zeilen tiefer); (b) eine Suche nach Captcha in `scripts/` trifft genau die im Auftrag genannten Stellen. Änderungen innerhalb einer Zeile kann ich so nicht ausschließen. Das Urteil stützt sich deshalb auf die vollständige Lektüre des Endstands; es gilt für die Hashes, nicht für den Diff. Auflage 6.
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen (`.env.example` nur nach Variablennamen durchsucht).
- Das Dummy-Token zitiere ich hier nicht wörtlich; gemeint ist überall der öffentliche Cloudflare-Testwert, der in den vier Skripten und in `tests/support/db.ts:19` steht.

## Ergebnis in einem Satz

Die Änderung ist in allen vier Skripten richtig und eng gebaut (ein öffentlicher Testwert, an genau den Aufrufen der Passwort-Anmeldung und der Function `route`; `supabase-js` kennt die Option, die Parser von `route` lassen das Zusatzfeld zu), Dev-Guard, Löschwege und Filter sind im Endstand in Ordnung und in den Dateien steht kein Geheimnis; offen bleiben eine Reihenfolge-Schwäche in `live-test.mjs`, die durch den neuen Fehlerweg eher zum Tragen kommt (M1), und dass `redproof-s9a4.mjs` mit dieser Freigabe allein am Gate nicht startet (M2): frei mit den bindenden Auflagen unten.

## Urteil je Datei

- `scripts/live-test.mjs`: frei, mit M1 (Auflagen 2 und 3).
- `scripts/live-uploads.mjs`: frei, ohne eigenen Fund.
- `scripts/live-quote-app.mjs`: frei, ohne eigenen Fund.
- `scripts/redproof-s9a4.mjs`: frei für diesen Hash; startbar erst, wenn eine Freigabe auch die zwei gebundenen Dateien nennt (M2).

## Findings hoch

Keine.

## Findings mittel

M1. `scripts/live-test.mjs:53-59` mit `:119-125` – Das Konto wird erst nach gelungener Anmeldung zum Aufräumen vorgemerkt (`:59`), angelegt wird es davor (`:53`). Scheitert die Anmeldung (`:56-57`), löscht das `finally` (`:121-122`) es nicht. Die Reihenfolge ist alt; neu ist die Ursache: Seit ts1 hängt die Anmeldung am Captcha. Ist das Auth-Captcha auf Dev mit einem anderen Secret scharf, Cloudflare nicht erreichbar oder die Prüfung sonst gestört, bleibt je Abbruch ein Konto `live-…@movenow.test` auf Dev. Kein Aufräumweg erfasst dieses Präfix: `tests/support/sweep.ts:62`, `:83` nur `pt-`, `scripts/dev-testdaten-zuruecksetzen.mjs:31` nur `pt-` und `live-up-`, `scripts/redproof-cleanup.mjs:23` nur `redproof-`. Folge begrenzt: ein leeres Testkonto unter reservierter Endung, keine Anfrage, kein Geld, keine echte Person; das Skript endet mit Exit ungleich 0 und nennt den Fehler von Auth (ohne Werte). – Fix: bei der nächsten Hash-Änderung die Vormerkung direkt nach dem Anlegen, vor der Anmeldung (Muster `scripts/live-uploads.mjs:37`). Für diesen Hash: Auflagen 2 und 3.

M2. `scripts/sys/loesch-register.json:14` mit `scripts/sys/gate-loesch.mjs:53-56` – `redproof-s9a4.mjs` bindet `scripts/redproof-lib.mjs` und `scripts/redproof-sql.mjs`. Das Gate verlangt beim Start eine Freigabe für Pfad und Hash aller drei Dateien. Für die zwei gebundenen gibt es keine (siehe Kopf), und ich kann sie hier nicht nennen: Der Auftrag gibt ihre Hashes nur gekürzt, eine Hash-Zeile braucht 64 Zeichen, und eine falsche Zeile würde die Übernahme der ganzen Freigabe sperren (`gate-loesch.mjs:31`). Diese Freigabe erfüllt damit für `redproof-s9a4.mjs` nur die zweite Ebene (`scripts/sys/fertig.mjs:89`, `:191-195`: geänderte Registerdateien brauchen eine Freigabe für den neuen Hash; die gebundenen sind unverändert und dort nicht gefordert). `npm run loesch -- scripts/redproof-s9a4.mjs` bleibt gesperrt (fail closed, kein Schaden). Inhaltlich habe ich beide gebundenen Dateien ganz gelesen und nichts gefunden, das gegen eine Freigabe spräche (Lockerung nur im Fenster mit Markierung, Totmann, Soll-Vergleich und Restore; im lesenden und im Druckmodus nur Selects, `redproof-lib.mjs:157-159`). – Fix: Soll das Skript laufen, eine neue Runde mit den vollen Hashes beider gebundener Dateien im Auftrag; bis dahin nicht starten und das Gate nicht umgehen.

## Findings niedrig

N1. `scripts/live-test.mjs:56`, `scripts/live-uploads.mjs:39`, `scripts/redproof-s9a4.mjs:69` gegen `docs/STAND.md:7`, `tmp/proof/ts1/017-tests_rls_captcha-live.test.ts.log:27-28` – Der Anmeldeweg mit Token ist auf Dev noch nicht gegen ein scharfes Auth-Captcha belegt: Lauf 017 ist im Auth-Teil rot, weil Dev bei der Anmeldung ohne Token noch nichts ablehnt (Dashboard-Schalter fehlt). Solange das so ist, ignoriert Auth das mitgeschickte Token, die Skripte laufen wie bisher. Belegt ist der Weg über `route` mit Token (Lauf 017, Teil `route` grün; `tests/rls/captcha-live.test.ts:39-46`). Keines der vier Skripte ist mit diesem Hash gelaufen. – Fix: Auflage 2.

N2. `scripts/redproof-s9a4.mjs:62-72` mit `:144-147`, `:665` – Gleiche Klasse wie M1: Ein Konto, dessen Anmeldung scheitert, steht in keiner der vier Variablen und wird im `finally` nicht gelöscht. Anders als bei M1 gibt es einen Aufräumweg (`scripts/redproof-cleanup.mjs:23`) und eine Warnung beim nächsten Start (`scripts/redproof-lib.mjs:341-342`). – Fix beim nächsten Anfassen: Konto vor der Anmeldung vormerken. Für diesen Hash: Auflage 3.

N3. `scripts/live-test.mjs:2`, `scripts/live-uploads.mjs:4`, `scripts/live-quote-app.mjs:4`, `scripts/redproof-s9a4.mjs:11` – Die Startzeilen im Kopf nennen weiter den Direktstart mit dotenv; keines der vier Skripte bricht ohne Gate-Kennung ab (Muster in `setup-outbox.mjs`, siehe `docs/freigaben/mail2-loesch-freigabe-1.md:61`). Für Claude sperrt der Hook den Direktstart (`.claude/hooks/guard.mjs:209-224`); ein Direktstart von Hand liefe ohne Eintrag in `loesch-lauf.jsonl`. Unverändert gegenüber vorher. – Fix beim nächsten Anfassen: Startzeile auf `npm run loesch -- <skript>` bringen; bei `redproof-s9a4.mjs` beachten, dass es sich selbst als Kind startet (`:632-636`, die Kennung wird vererbt).

N4. Alle vier Skripte gegen `scripts/sys/gate-loesch.mjs:77` – Keines meldet Zahlzeilen im Format des Gates; `loesch-lauf.jsonl` enthält je Lauf nur EXIT und Dauer. Was gelöscht wurde, steht nur in der Ausgabe (`live-test.mjs:125`, `live-uploads.mjs:233`, `live-quote-app.mjs:195-201`, Endprüfung `redproof-s9a4.mjs:698-699`). – Fix beim nächsten Anfassen: Zahl der gelöschten Konten und Dateien als Zahlzeile ausgeben. Für diesen Hash: Auflage 4.

N5. `scripts/live-test.mjs:13`, `scripts/live-uploads.mjs:20`, `scripts/live-quote-app.mjs:60`, `scripts/redproof-s9a4.mjs:30` (und `tests/support/db.ts:18`, `tests/rls/captcha-live.test.ts:3`) – Der Kommentar sagt, mit dem Testsecret gelte jedes Token als gültig. Belegt ist live nur, dass das Dummy-Token durchgeht; die Negativfälle des Live-Tests (`captcha-live.test.ts:31`) scheitern alle schon an der Formprüfung vor Cloudflare (`handler.ts:61`). Nach meiner Kenntnis der Cloudflare-Dokumentation nimmt ein Testsecret das Dummy-Token an und ein Produktiv-Secret lehnt es ab; ob ein Testsecret beliebige andere Token annimmt, ist hier nicht geprüft. Für die Skripte ohne Folge (sie senden genau das Dummy-Token). – Fix beim nächsten Anfassen: Kommentar auf das Belegte kürzen; die Abnahme sollte die Aussage in `db.ts` und im Live-Test gleich einordnen.

N6. `scripts/live-quote-app.mjs:62` gegen `:13-15` – Der Wert steht hier in der Zeile statt in einer Konstante wie in den drei anderen Skripten; derselbe Wert steht damit an fünf Stellen (vier Skripte, `tests/support/db.ts:19`). Kosmetisch. – Kein Fix nötig; ändert sich der Wert, brauchen alle vier Skripte eine neue Runde.

N7. `scripts/sys/loesch-register.json:30` gegen `tmp/proof/ts1/runs.jsonl:15` – Der neue Pin von `tests/support/db.ts` ist nachvollziehbar (siehe Prüffrage), aber ein grüner `check` auf dem Endstand fehlt noch: Lauf 015 ist rot (genau wegen des alten Pins), auf einem früheren Commit und mit unsauberem Arbeitsbaum. Der Volllauf am Ende misst den Pin neu (fail closed). Register und `tests/support/db.ts` gehören zur Mindestmenge der Abnahme (`scripts/sys/fertig.mjs:16`). – Fix: nichts am Register; Volllauf `check` grün auf dem Endstand, Abnahme nennt beide Dateien.

## Auflagen für den Lauf (bindend)

1. Start jedes der vier Skripte nur über `npm run loesch -- <skript.mjs>`, nach Übernahme und Commit dieser Freigabe, mit sauberem Arbeitsbaum, nur gegen Dev. `redproof-s9a4.mjs` zusätzlich erst nach einer Freigabe, die beide gebundenen Dateien mit vollem Hash nennt (M2).
2. Vor dem ersten Start von `live-test.mjs`, `live-uploads.mjs` oder `redproof-s9a4.mjs`, sobald das Auth-Captcha auf Dev scharf ist: `tests/rls/captcha-live.test.ts` läuft über `npm run t` grün auf dem Endstand (belegt die Anmeldung mit Token, `:71-73`). Die Bewertung nennt, in welchem Zustand von Auth der Lauf stattfand (Captcha scharf oder nicht).
3. Bricht `live-test.mjs` oder `redproof-s9a4.mjs` mit einem Fehler der Anmeldung ab: keine Wiederholung. Die verbliebenen Konten mit dem Präfix des Skripts nur lesend zählen, Beks die Zahl und die Meldung im Wortlaut berichten. Kein Löschen von Hand und kein Weiten eines Aufräummusters ohne eigene Freigabe (für `live-…`-Konten aus `live-test.mjs` gibt es heute keinen freigegebenen Weg; Beks entscheidet).
4. Je Lauf stehen EXIT aus `loesch-lauf.jsonl`, die Aufräumzeile(n) und die Schlusszeile des Skripts im Wortlaut in der Bewertung. Meldet ein Skript Reste (`live-test.mjs:125` rot, `live-quote-app.mjs:201` rot, „Dev weicht vom Soll ab“ oder Exit 3 bei `redproof-s9a4.mjs`): anhalten, nichts nachbessern, Beks berichten; bei `redproof-s9a4.mjs` gilt der Wiederherstellungsweg der Bibliothek, der ein eigenes Registerskript mit eigener Freigabe ist.
5. Nie parallel zu `rls`, `e2e`, Shots oder einem anderen der vier Skripte (gemeinsame Limits von Auth, `quote` und `route`; Kopf `redproof-s9a4.mjs:10`).
6. Die Bewertung nennt die Ausgabe von `git diff --stat main -- <die vier Skripte> scripts/sys/loesch-register.json`. Zeigt der Diff mehr als die Konstante, die Option an der Passwort-Anmeldung, das Feld im Body von `route` und im Register den einen Pin: neue Runde. Jede spätere Änderung an einer der vier Dateien oder, für `redproof-s9a4.mjs`, an einer gebundenen: neue Runde.

## Antworten auf die Prüffragen

**Wurde außer dem Captcha etwas geändert (Löschwege, Filter, Sweep-Logik, Dev-Guard)?** Nach allem, was ich ohne Diff prüfen kann, nein (siehe Hinweise). Im Endstand gilt je Datei:
- `live-test.mjs`: Guard ist der erste Import (`:4`). Token an der Anmeldung (`:56`) und am Body der zwölf Aufrufe von `route` (`:115`); der Aufruf mit fremder Origin (`:91`) bleibt absichtlich ohne Token, er prüft nur den fehlenden CORS-Header, und die Function antwortet dort schon vor der Captcha-Prüfung (`handler.ts:53`). Einziger Löschweg: Konten aus der eigenen Liste (`:121-122`), Anfragen gehen mit dem Konto. Kein SQL, kein Sweep. Offen: M1.
- `live-uploads.mjs`: Guard `:7`. Token `:39` und `:175`. Löschwege: Dateien nur in den Ordnern der eigenen Konten (`:91-97`, `:230`), Konten nur aus der eigenen Liste (`:205`, `:232`; vorgemerkt vor der Anmeldung, `:37`), Rückdatieren nur für zwei eigene Konto-IDs (`:53-54`, `:209`), zwei Schreibversuche auf `request_photos` mit Filter auf den eigenen Pfad, die scheitern müssen (`:196-199`). Der Aufruf von `photo-cleanup` (`:215-222`) entfernt wie der stündliche Job alle Waisen auf Dev, nicht nur eigene; das ist die Aufgabe der Function und unverändert.
- `live-quote-app.mjs`: Guard `:7`. Token nur am Aufruf von `route` (`:62`); die Anmeldung läuft über Link und Code (`:85-87`) und braucht nach Plan und Live-Test kein Token (`tests/rls/captcha-live.test.ts:76-86`). Einziger Löschweg: das eine eigene Konto (`:193-194`, ID gesetzt direkt nach dem Anlegen, `:84`). Rohantworten nach `tmp/proof/s8b2-live-raw.json` (`:191-192`), ohne Token und ohne Adresse des Kontos.
- `redproof-s9a4.mjs`: Guard `:12`. Token `:69` und `:560`. Im Druckmodus keine Anmeldung (`:63`), im lesenden Modus Ende vor jeder Aktion (`:658`); die Live-Probe mit dem Aufruf von `route` läuft nur ohne `--only` und ohne `--no-live` (`:539`). Löschwege: eigene Konten und eigene Dateien im `finally` (`:664-667`); alles andere (Lockerungen, Fenster, Restore, Cron-Pause) liegt in der Bibliothek und ist nach den Zeilenverweisen der R1-Abnahme unverschoben.
Die Sweep-Logik (`tests/support/sweep.ts`, `marker.ts`) wird von keinem der vier Skripte benutzt; `marker.ts` habe ich gelesen, das Muster ist das der Freigaben u1b und dev1.

**Wirkt die Änderung, wie sie soll?** Ja. `supabase-js` kennt die Option an der Passwort-Anmeldung (Typen von `auth-js`, Suche). `route` liest das Feld `captcha` aus dem Body (`handler.ts:60-69`), die Parser beider Modi lassen Zusatzfelder zu (`facts.ts:84-98`). Die Prüfung steht vor dem Zähler; der Test in `live-test.mjs:112-118` (zehnmal 200, dann 429) misst weiter das IP-Limit, weil jeder der zwölf Aufrufe mit Token den Zähler erreicht. `quote` verlangt kein Token (Suche in `supabase/functions/`: Captcha nur in `route`). Gegen ein Produktivprojekt scheitern Anmeldung und `route` mit diesem Wert (gewollt, Plan Punkt 7), zusätzlich zum Dev-Guard.

**Register (`scripts/sys/loesch-register.json`)?** In Ordnung. 16 Registerskripte, 17 Ausnahmen; die vier Skripte stehen unverändert unter `skripte` (`:8-10`, `:14`), die Bindung von `redproof-s9a4.mjs` ist da. Der neue Pin von `tests/support/db.ts` (`:30`, beginnt mit c77d7926) ist genau der Wert, den der Register-Test in Lauf 015 an der Datei gemessen hat; der alte begann mit c60da712 (`tmp/proof/ts1/015-check.log:435-438`). Der Grund der Ausnahme trägt weiter: `db.ts` löscht nur Konten aus der eigenen Liste (`:31`, `:38`, `:47-49`); neu sind dort nur der exportierte Testwert (`:18-19`) und die Option an der Anmeldung (`:41`). Einen Vergleich des Registers mit `main` konnte ich nicht ziehen (Auflage 6); die Zeilenlage passt zu früheren Verweisen (`setup-outbox.mjs` weiter in Zeile 15). Rest: N7.

**Steht ein Geheimnis in den Dateien?** Nein. Schlüssel und Secrets kommen in allen vier Skripten nur aus der Umgebung (`live-test.mjs:8-10`, `live-uploads.mjs:13-17`, `live-quote-app.mjs:12-14`, `redproof-s9a4.mjs:32-35`) und werden nie ausgegeben. Feste Werte sind: das öffentliche Dummy-Token, Platzhalter aus einem wiederholten Zeichen (`'f'`, `'0'`, `'a'`), Test-Kontaktdaten unter reservierter Endung, ein Mini-JPEG in Base64, Koordinaten. Das Dummy-Token trifft keines der vier Muster des Proof-Scans (kein Supabase-Secret-Schlüssel, kein dreiteiliges Sitzungstoken, kein Zugriffstoken der CLI, keine Verbindungsadresse mit Passwort) und ist kein Wert einer Geheimnis-Variable (`.env.example` nennt dafür nur das Turnstile-Secret und das CLI-Token; das Secret steht in keiner der Dateien). Ausgaben: Status, Zähler, Fehlercodes, Fehlermeldungen von Auth und Storage, bei `live-uploads.mjs:222` die Zählantwort von `photo-cleanup`; keine Token, keine signierten Adressen.

**Rechte-Ausweitung, Missbrauch?** Keine. Der Wert ist öffentlich dokumentiert und gilt nur, wo ein Testsecret hinterlegt ist; dass in Produktion kein Testschlüssel steht, sichern GOLIVE 13 und 18 (Plan Punkt 7), nicht diese Skripte. Die Skripte arbeiten mit dem Secret-Key nur gegen die vom Guard geprüfte Dev-Adresse.

**Geld:** nicht berührt. `live-quote-app.mjs` prüft weiter, dass Antworten keine Gebührenfelder tragen (`:45`, `:132`, `:154`) und der Kunde weder Journal noch Einstellungen liest (`:181-186`); `live-test.mjs:81` prüft, dass `quote` nichts ins Journal bucht. Unverändert.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/live-test.mjs:4`, `:13-14` | Guard erster Import; Konstante mit dem öffentlichen Testwert: in Ordnung; Kommentar N5 |
| `scripts/live-test.mjs:50-61` | Anlegen `:53`, Anmeldung mit Token `:56`, Vormerkung erst `:59`: M1 |
| `scripts/live-test.mjs:91`, `:112-118` | Aufruf mit fremder Origin ohne Token (nur Header geprüft); zwölf Aufrufe mit Token, Erwartung unverändert: in Ordnung |
| `scripts/live-test.mjs:119-128` | Löschen nur der eigenen Liste, Restzählung, Exit nach Prüfungen: in Ordnung |
| `scripts/live-uploads.mjs:7`, `:20-21`, `:32-42` | Guard; Konstante; Vormerkung `:37` vor der Anmeldung mit Token `:39`: in Ordnung |
| `scripts/live-uploads.mjs:52-54`, `:209` | Rückdatieren über CLI nur für zwei eigene Konto-IDs, Ausgabe verworfen: in Ordnung |
| `scripts/live-uploads.mjs:91-97`, `:229-236` | Dateien nur in eigenen Ordnern, Konten nur aus der Liste, Exit-Code gesetzt: in Ordnung |
| `scripts/live-uploads.mjs:175-177` | `route` (Adresssuche) mit Token, Kandidat geprüft: in Ordnung |
| `scripts/live-uploads.mjs:196-199`, `:215-225` | zwei Schreibversuche, die scheitern müssen; `photo-cleanup` ohne, mit falschem und mit richtigem Secret: unverändert |
| `scripts/live-quote-app.mjs:7`, `:60-65` | Guard; Token im Body von `route`, Wert in der Zeile: in Ordnung; N6 |
| `scripts/live-quote-app.mjs:82-88`, `:190-203` | Anmeldung über Link und Code ohne Token; ein eigenes Konto, im `finally` gelöscht und nachgezählt: in Ordnung |
| `scripts/live-quote-app.mjs:45`, `:132`, `:154`, `:181-186` | Gebührenfelder und Journal aus Kundensicht: unverändert |
| `scripts/redproof-s9a4.mjs:12`, `:22-25`, `:30-31` | Guard; Modus; Konstante: in Ordnung |
| `scripts/redproof-s9a4.mjs:62-72`, `:144-147` | Druckmodus ohne Anmeldung; Anmeldung mit Token; Konto erst nach Erfolg zugewiesen: N2 |
| `scripts/redproof-s9a4.mjs:119-127`, `:527-535` | einziges Fenster je Schritt; Probelauf und Cron-Pause, je zwei Zeilen tiefer als in der R1-Abnahme: unverschoben |
| `scripts/redproof-s9a4.mjs:539`, `:545-562` | Live-Probe nur im vollen Lauf; `route` mit Token, Abbruch ohne Kandidat: in Ordnung |
| `scripts/redproof-s9a4.mjs:624-653` | Werkzeugteil startet nur lesende Kinder, Hilfsdatei wird entfernt: unverändert |
| `scripts/redproof-s9a4.mjs:657-668`, `:697-702` | lesender Modus endet vor jeder Aktion; Aufräumen eigener Konten und Dateien; Exit nach Soll-Vergleich: in Ordnung |
| `scripts/redproof-lib.mjs:157-167`, `:308-347`, `:350-389` | nur Selects außerhalb des Schreibmodus; Startprüfungen; Fenster mit Markierung, Totmann, Restore: in Ordnung (M2) |
| `scripts/redproof-lib.mjs:341-342` | Warnung bei verbliebenen Redproof-Konten mit Verweis auf das Aufräumskript: N2 |
| `scripts/redproof-sql.mjs:1-40` | reine Textbausteine, Originale über Selects, Restore idempotent: in Ordnung (M2) |
| `scripts/dev-guard.mjs:7-22` | Abbruch bei abweichender Ref aus drei Quellen, Ref für Kindprozesse festgelegt |
| `scripts/sys/loesch-register.json:8-10`, `:14`, `:27`, `:30` | vier Skripte registriert, Bindung von `redproof-s9a4.mjs`; `redproof-lib.mjs` als Ausnahme gepinnt; neuer Pin von `db.ts` |
| `scripts/sys/gate-loesch.mjs:27-31`, `:53-56`, `:62`, `:77` | Übernahme rechnet jede genannte Datei nach; Start verlangt Freigabe für Skript und gebundene Dateien; Guard; Zahlzeilen: M2, N4 |
| `scripts/sys/gate-db-lib.mjs:39-51`, `:54-66` | Format der Freigabe; Prüfung je Pfad und Hash |
| `scripts/sys/fertig.mjs:16`, `:89`, `:191-195` | Mindestmenge der Abnahme; zweite Ebene nur für geänderte Registerdateien: M2, N7 |
| `.claude/hooks/guard.mjs:209-224` | Direktstart und npm-Alias eines Registerskripts für Claude gesperrt: N3 |
| `tests/support/db.ts:18-19`, `:31-49` | Testwert exportiert; Anmeldung mit Token; gelöscht wird nur die eigene Liste: Grund der Ausnahme trägt |
| `tests/support/marker.ts:8-11` | Muster der Testfirmen und Abdeckungsfirma, von den vier Skripten nicht benutzt |
| `tests/support/sweep.ts:62`, `:83`; `scripts/dev-testdaten-zuruecksetzen.mjs:31`; `scripts/redproof-cleanup.mjs:23` | Aufräumwege erfassen `pt-`, `live-up-`, `redproof-`, nicht die Konten aus `live-test.mjs`: M1 |
| `supabase/functions/_shared/route/handler.ts:53-69`, `:71-86` | Modus und Eingabe vor dem Captcha, Captcha vor dem Zähler, Formprüfung vor Cloudflare |
| `supabase/functions/_shared/route/facts.ts:84-98` | Parser lesen nur ihre Felder, Zusatzfeld stört nicht |
| `tests/rls/captcha-live.test.ts:29-46`, `:58-74`, `:76-88` | Negativfälle nur Formfehler; Anmeldung mit Token; Code-Weg ohne Token: N1, N5 |
| `tmp/proof/ts1/017-tests_rls_captcha-live.test.ts.log:17`, `:21`, `:27-28` | Teil `route` grün, Teil Auth rot (Dev lehnt ohne Token noch nicht ab): N1 |
| `tmp/proof/ts1/015-check.log:434-438` | Register-Test rot wegen des alten Pins; gemessener Wert gleich dem neuen Pin: N7 |
| `tmp/proof/ts1/runs.jsonl:15-19` | kein grüner `check` auf dem Endstand, kein Lauf eines der vier Skripte: N1, N7 |
| `docs/STAND.md:7-8` | Auth-Captcha auf Dev nicht scharf; Reihenfolge der Fortsetzung |
| `docs/freigaben/dev1-loesch-freigabe-2.md:85`, `:142` | alte Zeilenlage der Adresszeilen: passt zu zwei eingefügten Zeilen je Skript mit Konstante |
| `docs/proof/r1/r1-abnahme-r2.md:25`, `:53`, `:80`, `:182` | alte Zeilenlage in `redproof-s9a4.mjs`: durchgehend zwei Zeilen Versatz |
| Suche `docs/freigaben/` nach Hash-Zeilen | keine Freigabe für die vier Skripte, `redproof-lib.mjs`, `redproof-sql.mjs`: Kopf, M2 |
| Suche `scripts/` nach Captcha | Treffer nur an den im Auftrag genannten Stellen der vier Skripte |
| Suche `scripts/`, `tests/` nach Passwort-Anmeldung, Mail-Anforderung, `route` | übrige Registerskripte melden sich über Link und Code an oder gar nicht; `golive-check.mjs:49` ruft `route` absichtlich ohne Schlüssel |
| Suche `.env.example` (nur Namen) | Turnstile-Site-Key (öffentlich), Turnstile-Secret, CLI-Token; kein Name für den Testwert |

Offene Findings hoch: 0
