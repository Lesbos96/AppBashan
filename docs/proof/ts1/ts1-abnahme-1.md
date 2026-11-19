Modell: claude-fable-5-2
Vorgaenger: keiner
SHA256: fe7133d33c693ffec3a92a27e97e0856376d33baa70d0bbee28bf6b1d18000da supabase/functions/_shared/route/handler.ts
SHA256: 091d7846f2478f9afe059a2d862b278641a0f2fc73e194a3ae008232ad735695 supabase/functions/_shared/turnstile.ts
SHA256: 40d895b5ed429f882b492f233142e465e9468edae44908294ec6fc27d9293f61 supabase/functions/route/index.ts
SHA256: c77d7926f5f7226f49e343e618f4e5c20448678455c662101e00be8ad544fab5 tests/support/db.ts
SHA256: de007571db8d57e835e50d772f0adcd8f29c7aa1fd02d3f6f14877ff4c3ed022 scripts/sys/loesch-register.json
SHA256: e12be033a9c8d90c7db55f45a67ae5903a75aad6ad3b65619a6d5b881421616c docs/freigaben/ts1-loesch-freigabe-1.md

# Abnahme Runde 1, Schritt ts1 (R3): Turnstile an `route` und am Anmeldeweg

Datum: 2026-11-19
Stand laut Auftrag: Branch `ts1`, Commit 78fea24. Zwischenabnahme: Der Schritt hält an, weil das Auth-Captcha auf Dev noch nicht scharf ist.

Geprüft (vollständig gelesen): die sechs Pflichtdateien oben.
Zur Einordnung gelesen: `.claude/rules/daten.md`, `.claude/rules/tests.md`, `tmp/proof/ts1-plan.md`, `supabase/config.toml`, `src/lib/turnstile.ts`, `src/components/CaptchaHost.tsx`, `src/lib/auth.ts`, `src/lib/route.ts`, `tests/unit/turnstile.test.ts`, `tests/unit/route.test.ts:75-175` und `:250-328`, `tests/unit/auth.test.ts:1-96`, `tests/rls/captcha-live.test.ts`, `tests/e2e/captcha.spec.ts:1-60`, `.env.example` (nur Namen), `supabase/functions/_shared/http.ts`, `supabase/functions/_shared/route/facts.ts:60-98`, `scripts/scan-proof.mjs`, `scripts/golive-check.mjs`, `scripts/sys/fertig.mjs:1-40`, `docs/GOLIVE.md` (Punkte 1 bis 27, 48 bis 52), `docs/OFFEN.md:78`, `docs/ENTSCHEIDUNGEN.md:221-223`, `docs/STAND.md:1-20`, `docs/BEKS.md:30-44`, `docs/ARCHITECTURE.md:188-201`, `tmp/proof/ts1-review.md`, `tmp/proof/ts1/runs.jsonl`, Logs 016 bis 020 (ganz, sie sind kurz), Fehlerzeilen der Logs 008, 010, 015. Suchen über `src/`, `tests/`, `scripts/`, `supabase/functions/` (Anmeldewege, Aufrufer von `route`, Captcha, Testschlüssel-Werte).

Hinweise zum Nachweis:
- Die sechs Hash-Zeilen sind aus dem Auftrag abgeschrieben, nicht nachgerechnet (kein Shell-Werkzeug). Der Pin in `scripts/sys/loesch-register.json:30` ist Zeichen für Zeichen gleich dem Hash von `tests/support/db.ts` aus dem Auftrag.
- Kein `git diff`: Welche Dateien der Schritt sonst geändert hat, sehe ich nicht. Ob die Mindestmenge (`scripts/sys/fertig.mjs:16`) vollständig genannt ist, prüft das Gate.
- Keine `.env*` gelesen außer `.env.example`. Geschrieben wurde nur diese Datei.
- Den Cloudflare-Dummy-Wert und die Testschlüssel zitiere ich nicht wörtlich; gemeint ist der Wert in `tests/support/db.ts:19`.

## Ergebnis in einem Satz

Der Server-Teil (`handler.ts`, `turnstile.ts`, `route/index.ts`) ist richtig gebaut und durch Unit-Tests und den Live-Teil `route` belegt, die Testhelfer und der Register-Pin stimmen, ich finde keinen hohen Fund; nicht abgenommen ist die Wirkung des Auth-Wegs (auf Dev nicht scharf, deshalb nicht messbar) und der echte Widget-Weg, und die Launch-Doku widerspricht sich an drei Stellen. Die Abnahme gilt für die sechs Hashes und nur mit den Auflagen unten.

## Findings hoch

Keine.

## Findings mittel

M1. `docs/GOLIVE.md:19`, `:33`, `:54` gegen `docs/GOLIVE.md:37`, `:47`, `:90` und `.claude/rules/daten.md:20`; `docs/ARCHITECTURE.md:190-195` gegen `supabase/functions/_shared/route/handler.ts:60-69` und `supabase/functions/route/index.ts:22` – Die Doku widerspricht dem gebauten Stand.
- GOLIVE Punkt 4 (`:19`) und Punkt 21 (`:54`) sagen, die Build-Umgebung bekomme nur URL und Publishable Key. Seit ts1 braucht der Build den Site Key (`src/lib/turnstile.ts:77-78`): ohne ihn scheitern Anmeldung und Adresssuche mit „nicht verfügbar“ (fail closed, aber die App ist dann unbenutzbar).
- GOLIVE Punkt 9 (`:33`) nennt fünf Function-Secrets und prüft „die fünf Namen“. `route` startet ohne `TURNSTILE_SECRET_KEY` nicht (`route/index.ts:12-16`, `:22`).
- ARCHITECTURE nennt für `route` weder das Pflichtfeld `captcha` noch die Antworten 403 und 503, die Secret-Liste (`:195`) nennt das Turnstile-Secret nicht.
Fix (nur Doku, ändert keinen Hash dieser Abnahme): Punkt 4 und 21 um den Site Key ergänzen, Punkt 9 auf sechs Namen, ARCHITECTURE-Abschnitt „Routing“ nachziehen (Feld, Reihenfolge Eingabe → Captcha → Zähler, 403/503, Secret).

M2. `src/lib/turnstile.ts:59-110` gegen `tests/e2e/captcha-helpers.ts:46`, `playwright.config.ts:39`, `tests/rls/captcha-live.test.ts:41`, `:71` – Der echte Widget-Weg ist nirgends gelaufen. Alle e2e- und Shot-Läufe ersetzen das Cloudflare-Skript durch einen Stub mit Platzhalter-Key; der Live-Test schickt den Dummy-Wert direkt an Server und Auth. Dass das echte Skript mit diesen Optionen (`:92-105`: Ausführung auf Abruf, nur bei Interaktion sichtbar, Reset nach jeder Ausgabe) in dem geschlossenen, 1 Pixel großen Dialog (`src/components/CaptchaHost.tsx:25`, `:34`) ein Token liefert und dass `route` und Auth dieses Token annehmen, ist nicht belegt. Folge bei einem Fehler: Anmeldung und Adresssuche gehen nicht (fail closed), also kein Sicherheits-, aber ein Startrisiko. – Fix: in der Fortsetzung ein Durchgang im Browser gegen Dev mit dem Test-Site-Key (Code anfordern, eine Adresse suchen, Konsole ohne Fehler), Ergebnis mit Datum in der Bewertung. Keine Datei ändern. Für Produktion steht der Prüfweg in `docs/GOLIVE.md:90`.

M3. `tmp/proof/ts1/runs.jsonl:16-17`, `tmp/proof/ts1/017-tests_rls_captcha-live.test.ts.log:21`, `:27-34` gegen `tmp/proof/ts1-plan.md:14`, `:21` – Offene Nachweise: Der Auth-Teil ist rot, weil Dev ohne Token noch nichts ablehnt; die Positivfälle im selben Lauf (Anmeldung mit Token, `makeUser`, `:23`) beweisen in diesem Zustand nichts, weil Auth das Token ignoriert. Auflage 9 (voller `rls` nach dem Deploy von `route` und `quote`) ist offen: Seit dem Deploy lief nur die eine Datei, der Geldweg `quote` ist auf Dev mit dem neuen Bündel ungemessen. Ein grüner `check` auf dem Endstand fehlt (Lauf 15 rot wegen des alten Pins, `tmp/proof/ts1/015-check.log:435-438`). – Fix: Auflagen 1 bis 4 unten. Das Gate erzwingt die grünen Läufe; nicht erzwungen ist, dass spätere Änderungen an `src/lib/auth.ts`, `src/lib/turnstile.ts`, `src/lib/route.ts`, `supabase/config.toml` oder `tests/rls/captcha-live.test.ts` noch einmal geprüft werden (diese Pfade stehen nicht in der Mindestmenge): Auflage 5.

M4. `docs/GOLIVE.md:37`, `:47`, `:90` mit `docs/OFFEN.md:78` (d) und `scripts/golive-check.mjs:45-50` – Die eine Richtung, in der das Captcha offen ausfällt, ist ein Testsecret im Produktivprojekt (als Function-Secret oder im Auth-Dashboard): Dann geht der öffentlich bekannte Dummy-Wert durch. Dagegen steht nur ein Handgriff in der Checkliste; `golive-check` prüft nichts davon, und OFFEN (d) nennt nur den Test-Site-Key im Build (die Richtung, die ohnehin geschlossen ausfällt). Der Prüfweg in Punkt 18 und 49 nennt außerdem `signInWithOtp`: Stünde in Produktion doch ein Testsecret, legte genau diese Probe ein Konto an und löste eine Mail aus. – Fix: OFFEN ts1-1 (d) erweitern: `golive-check` additiv um zwei Proben mit dem Dummy-Wert (an `route`: 403 erwartet; an Auth als Passwort-Anmeldung mit erfundenen Zugangsdaten: `captcha_failed` erwartet, in jedem Fall ohne Wirkung). In GOLIVE 18 und 49 den Prüfweg auf diese wirkungsfreie Probe umstellen. Der Umbau von `golive-check` ist ein eigener R3-Schritt (Register-Pin `scripts/sys/loesch-register.json:24`), die zwei Doku-Zeilen gehen jetzt.

## Findings niedrig

N1. `tests/support/db.ts:18`, `tests/rls/captcha-live.test.ts:3`, `docs/OFFEN.md:78` (b), `scripts/live-test.mjs:13`, `scripts/live-uploads.mjs:20`, `scripts/live-quote-app.mjs:60`, `scripts/redproof-s9a4.mjs:30` – Die Aussage „mit dem Testsecret gilt jedes Token“ ist nicht belegt. Live belegt ist nur: Der Dummy-Wert geht durch (`017…log:18`); die vier Negativfälle (`captcha-live.test.ts:31`) scheitern alle an der Formprüfung vor Cloudflare (`handler.ts:61`). – Fix: in der Fortsetzung eine Probe an `route` auf Dev mit einem kurzen anderen Text als Token; Status in die Bewertung. Kommt 403, lässt sich „von Cloudflare abgelehnt“ künftig live testen und OFFEN (b) stimmt nicht; kommt 200, stimmt der Kommentar. Kommentare erst beim nächsten Anfassen ändern (`db.ts` ist gepinnt, die Skripte sind freigegeben).

N2. `tests/rls/captcha-live.test.ts:59-61`, `:67`, `:87` – Das Konto des Auth-Tests wird erst am Ende des zweiten Tests gelöscht; scheitert dort eine Prüfung davor (`:81-86`), bleibt es, und kein Aufräumweg erfasst das Präfix. Zeile 67 prüft nur den Fehlercode, nicht, dass kein Konto entstand. In den roten Läufen wurde Zeile 67 nicht erreicht (Abbruch in `:65`, `016…log:55`, `017…log:36`). – Fix: Datei jetzt nicht ändern (sonst braucht sie einen neuen roten Lauf); Auflage 2 c. Beim nächsten Anfassen: Konto in die Aufräumliste, nach Zeile 68 lesend prüfen, dass die Adresse kein Konto hat.

N3. `docs/GOLIVE.md:59` gegen `docs/BEKS.md:41` – Punkt 26 verweist auf „BEKS Frage 2“, in BEKS ist es Frage 1. – Fix: Nummer angleichen.

N4. `docs/ENTSCHEIDUNGEN.md:223` – „wörtlich sinngemäß“ ist keines von beiden. Für eine geänderte Regel von Beks (`daten.md:20`) verlangt CLAUDE.md das wörtliche Ja. – Fix: den Satz aus dem Prompt ts1-1911-b im Wortlaut eintragen.

N5. `supabase/functions/_shared/turnstile.ts:16` gegen `tmp/proof/ts1-plan.md:15`; `tests/unit/turnstile.test.ts:20-26` – „Antwort fehlt“ zählt als abgelehntes Token (403); Auflage 3 nannte den Code in keiner der zwei Gruppen. Ich nehme die Zuordnung an: Der Handler schickt nie ein leeres Token (`handler.ts:61`), der Code kann nur vom Token des Aufrufers kommen. Im Unit-Test fehlt der gemischte Fall (Token-Code plus Secret-Code muss werfen, `turnstile.ts:36-37`). – Fix: Testfall beim nächsten Anfassen.

N6. `supabase/functions/_shared/turnstile.ts:2` – „Die IP geht nicht an Cloudflare“ gilt nur für die Prüfung in `route`. Das Widget im Browser spricht direkt mit Cloudflare, und Supabase Auth gibt bei seiner Prüfung nach meiner Kenntnis die IP des Aufrufers mit (nicht gemessen). – Fix: in GOLIVE 51 als Punkt für den Datenschutztext vermerken; Kommentar beim nächsten Anfassen.

N7. `tests/support/db.ts:41` – Sobald das Auth-Captcha scharf ist, hängt jede Anmeldung der `rls`-Suite an der Erreichbarkeit von Cloudflare. Ein Ausfall dort macht die Suite rot (fail closed, gewollt). – Kein Fix; in der Bewertung einen solchen Lauf nicht als Code-Fehler deuten und nicht wiederholen, bis die Ursache klar ist.

## Auflagen für die Fortsetzung (bindend)

1. `tests/rls/captcha-live.test.ts` läuft über `npm run t` grün, unverändert (Datei-Hash wie in `runs.jsonl:16-17`), bei scharfem Auth-Captcha. Die Bewertung nennt den Zustand von Auth beim Lauf.
2. Gemessen und im Wortlaut in der Bewertung: (a) Status und Code von Auth bei fehlendem Token, je für Passwort-Anmeldung und Mail-Anforderung; kommt der Code nicht als 4xx an, greift `src/lib/auth.ts:38-39` nicht, dann anhalten und neue Runde; (b) die Probe aus N1; (c) lesend: kein Konto mit dem Präfix des Auth-Tests bleibt nach dem Lauf übrig.
3. Der Durchgang im Browser aus M2.
4. Volläufe `check`, `e2e`, `rls` nacheinander auf dem committeten Endstand mit sauberem Baum; `rls` deckt `quote` nach dem Deploy und die MFA-Wege ohne Token ab (Auflage 9 des Plans, Risiko b).
5. Ändert die Fortsetzung eine der sechs Pflichtdateien oder `src/lib/auth.ts`, `src/lib/turnstile.ts`, `src/lib/route.ts`, `src/components/CaptchaHost.tsx`, `supabase/config.toml`, `tests/rls/captcha-live.test.ts`: neue Abnahmerunde mit dieser Datei als Vorgänger. Doku-Änderungen aus M1, M4, N3, N4, N6 brauchen keine.
6. Die Auflagen der Lösch-Freigabe (`docs/freigaben/ts1-loesch-freigabe-1.md:60-65`) gelten weiter; keines der vier Skripte läuft vor Auflage 1.

## Stand der neun Auflagen aus der Planprüfung

1. Site Key erst nach Beks' Ja: erfüllt nach Aktenlage (`.claude/rules/daten.md:20`, `docs/ENTSCHEIDUNGEN.md:223`, `docs/BEKS.md:35`). Die Reihenfolge der Commits 7604841 und 89db12b kann ich nicht einsehen; laut Plan nannte schon der erste Prompt die Variable. Rest: N4.
2. Token in allen Helfern vor Schalter und Deploy: erfüllt. Alle Passwort-Anmeldungen senden es (`tests/support/db.ts:41`, `tests/rls/route.test.ts:34`, `tests/rls/rls.test.ts:39`, `scripts/live-test.mjs:56`, `scripts/live-uploads.mjs:39`, `scripts/redproof-s9a4.mjs:69`), alle Aufrufer von `route` ebenso (`scripts/live-test.mjs:115`, `scripts/live-uploads.mjs:175`, `scripts/live-quote-app.mjs:62`, `scripts/redproof-s9a4.mjs:560`, `src/lib/route.ts:35`); `scripts/golive-check.mjs:49` ruft absichtlich ohne Schlüssel und erwartet 401, das kommt vor dem Captcha (`handler.ts:44`). Zeitfolge belegt: `db.ts` hatte den neuen Hash um 06:22 (`015-check.log:438`), `route` antwortete um 06:24 noch 200 ohne Token (`016…log:28`). Vermerk für andere Branches: `docs/STAND.md:9`, OFFEN (e).
3. Abbildung der Cloudflare-Antworten, Log nur mit Code: erfüllt (`turnstile.ts:16-17`, `:24-37`; `handler.ts:67`), Abweichung N5.
4. Client: erfüllt nach Code und Unit-Test (`src/lib/auth.ts:38-39`, `:42-49`; `tests/unit/auth.test.ts:67-86`). Live offen (Auflage 2 a).
5. Widget: erfüllt nach Code (`src/lib/turnstile.ts:59-74` Laden erst im Aufruf, `:84` Reset, `:90` eigene Zeitgrenze, `:113-117` nacheinander; `CaptchaHost.tsx:15-30` Modal, Esc, Fokus vom Browser) und e2e mit Stub (`captcha.spec.ts:27-48`). Echtes Skript: M2. Bildsicht: `tmp/proof/ts1-review.md`, nicht mein Teil.
6. Secret und Testwerte: erfüllt. Kein Testschlüssel-Wert in `src/`, `tests/`, `scripts/`, `supabase/`, `docs/`, `tmp/proof/`, `public/` (Suche nach der Form der Cloudflare-Testschlüssel: kein Treffer); Unit-Test mit Platzhalter (`tests/unit/turnstile.test.ts:5`), e2e mit Platzhalter-Key (`playwright.config.ts:39`); `supabase/config.toml:216-219` mit `env(...)`; `.env.example:5-9` nur Namen. `scripts/scan-proof.mjs` enthält nichts zu Turnstile.
7. Schutz vor Testschlüsseln in Produktion: erfüllt wie verlangt (Nachweis in `docs/GOLIVE.md:37`, `:47`, `:90`; Build-Prüfung als OFFEN (d)). Schwäche: M4.
8. GOLIVE: erfüllt. 13 und 18 nicht abgehakt, 26 offen mit BEKS-Frage (N3), neu 49 (Hostnamen, Capacitor), 50 (CSP), 51 (Hinweistext, Rechtsfrage), 52 (beliebige Token).
9. Voller `rls` nach dem Deploy: offen (M3, Auflage 4). Der Unit-Fall zur Body-Größe ist da (`tests/unit/route.test.ts:321-326`).

## Antworten auf die Prüffragen

**Reihenfolge im Handler.** Richtig: Preflight (`handler.ts:33`), Methode (`:42`), apikey (`:44`), Body mit Grenze (`:46`), JSON (`:48-52`), Modus (`:53`), Eingabe (`:57`), Form des Tokens (`:60-61`), Prüfung bei Cloudflare (`:62-69`), erst dann IP und Zähler (`:71-86`), dann Anbieter. Belegt durch `tests/unit/route.test.ts:264-275` (Formfehler: keine Prüfung, kein Zähler, kein Anbieter, kein Cache), `:277-286` (abgelehnt: ohne Wirkung), `:301-307` (ungültige Eingabe: kein Aufruf bei Cloudflare), `:309-319` (Prüfung vor dem Zähler, je Anfrage einmal) und live durch `captcha-live.test.ts:29-37` (Zählersumme unverändert) mit Positivkontrolle `:39-46`.

**Abbildung der Cloudflare-Antworten.** Richtig und fail closed. 403 nur, wenn Cloudflare `success: false` meldet und alle Codes das Token betreffen (`turnstile.ts:36`); jedes andere Ergebnis wirft und wird 503: Netz oder Zeitgrenze (`:24-26`), HTTP-Fehler (`:27`), kein JSON (`:31-33`), fehlendes oder falsches Secret, `bad-request`, `internal-error`, unbekannter Code, fehlende Codes, gemischte Codes (`:37`). `true` nur bei exakt `success === true` (`:34`). Der Handler macht aus jedem Wurf 503 ohne Wirkung (`handler.ts:65-68`).

**Geheimnisse und Logs.** In Ordnung. Das Secret kommt nur aus der Umgebung (`route/index.ts:22`), fehlt es, nennt der Fehler nur den Namen (`:14`). Es geht nur im POST-Body an Cloudflare, nie in eine URL (`turnstile.ts:23`); der Netzfehler wird verworfen (`:24-26`), die eigene Fehlermeldung trägt nur einen Bezeichner aus einer festen Liste (`:10`, `:37`: Codes von Cloudflare werden nur übernommen, wenn sie in der Liste stehen). Geloggt werden Modus, Status, Dauer, Code (`handler.ts:37`, `route/index.ts:32`); bei fremden Fehlern nie die Meldung (`handler.ts:67`, Test `route.test.ts:296-298`); das Token steht in keinem Log (Test `:318`). Die IP wird erst nach der Prüfung gelesen und nur als HMAC benutzt (`handler.ts:71-72`), an Cloudflare geht sie nicht (Test `turnstile.test.ts:16`). Die Antwort an den Aufrufer nennt nur `captcha_failed` oder `captcha_unavailable`.

**Dummy-Wert in `tests/support/db.ts`.** Unbedenklich. Er ist ein öffentlich dokumentierter Testwert, kein Geheimnis und kein Wert einer Geheimnis-Variable. Er trifft keines der vier Muster des Proof-Scans (Supabase-Secret-Schlüssel, dreiteiliges Sitzungstoken, Zugriffstoken der CLI, Verbindungsadresse mit Passwort); der Wertvergleich des Scans erfasst zusätzlich das Turnstile-Secret selbst, weil sein Variablenname auf das Namensmuster passt. Der Wert wirkt nur, wo ein Testsecret hinterlegt ist; die Helfer laufen nur gegen Dev. Rest: N1 (Kommentar), M4 (Produktion).

**Pin im Register.** Korrekt: `scripts/sys/loesch-register.json:30` trägt den Hash aus dem Auftrag, derselbe Wert, den der Register-Test in Lauf 15 gemessen hat (`015-check.log:438`). Der Grund der Ausnahme trägt weiter: `db.ts` löscht nur die selbst angelegten Konten (`:31`, `:38`, `:47-49`); neu sind nur die Konstante (`:18-19`) und die Option an der Anmeldung (`:41`). Die vier Skripte stehen unverändert im Register (`:8-10`, `:14`).

**Übernommene Lösch-Freigabe.** `docs/freigaben/ts1-loesch-freigabe-1.md` stimmt in Stichproben mit `tmp/proof/ts1/loesch-freigabe-1.md` überein (Zeilenzahl 134, Kopf mit vier Hash-Zeilen und Urteil, N2, N4, N6, Auflagen 1 bis 6, Schlusszeile). Kein Byte-Vergleich. Die Auflagen daraus stehen in OFFEN (g).

**Dummy-Wert in Produktion.** Es gibt keine technische Sperre und sie wäre im Code auch falsch (Dev braucht den Wert). Der Schutz ist der Nachweis in GOLIVE 13, 18 und 49. Das reicht für diesen Schritt (Auflage 7), ist aber Handarbeit: M4.

**Auth-Weg, soweit ohne scharfes Captcha beurteilbar.**
- `supabase/config.toml:214-219`: richtig (Abschnitt, Anbieter, Secret über `env(...)`), der Kommentar sagt zutreffend, dass Dev und Produktion im Dashboard eingestellt werden; `config push` bleibt verboten (`docs/GOLIVE.md:44`).
- `src/lib/auth.ts`: richtig. Adresse wird vor dem Token geprüft (`:57`), je Anforderung ein frisches Token (`:58`), `captcha_failed` vor der Statusauswertung (`:38-39`), Ladefehler ergibt offline (`:47`), kein Wiederholversuch. `verifyOtp` und Abmelden ohne Token (`:70`, `:77`). Die App nutzt keinen weiteren Auth-Einstieg, den das Captcha trifft (Suche in `src/`: keine Registrierung per Passwort, kein Passwort-Reset, kein erneutes Senden über die Auth-API).
- `tests/support/db.ts:41`: richtig; die Option ist die des Clients, dieselbe wie in der App.
- Was live fehlt: Auflagen 1 bis 4. Zusätzlich für die Bewertung: Die Edge Functions rufen Auth nur über Admin-Wege und Token-Prüfung auf (Suche in `supabase/functions/`: keine Anmeldung), sie sind vom Schalter nicht betroffen; das zeigt der volle `rls`.

**Rot-Beweis der neuen rls-Datei.** Zählt. Lauf 16 und 17 liefen ohne Argumente und ohne Schalter (`016…log:4-5`, `017…log:4-5`), mit demselben Datei-Hash, und die roten Prüfungen messen die Wirkung der fehlenden Sperre: `route` antwortete ohne Token mit 200 statt 403 (`016…log:28`), die Passwort-Anmeldung ohne Token lieferte keinen Fehler (`016…log:47`, `017…log:28`). `tests/support/db.ts` war bei beiden Läufen nach Aktenlage auf dem heutigen Hash (`015-check.log:438`, zwei Minuten vor Lauf 16). Ob der Datei-Hash zum Endstand passt, rechnet das Gate.

**Geld.** Nicht berührt. `quote` importiert aus `route/handler.ts` nur Grenzwerte und einen Typ (`supabase/functions/_shared/quote/handler.ts:19`), verlangt kein Token und braucht das neue Secret nicht. Weil das Bündel neu deployt ist, gilt Auflage 4.

**Missbrauch, Rechte.** Keine Ausweitung. Bekannt und eingetragen: beliebige Token lösen je einen Aufruf bei Cloudflare aus, bevor ein Zähler greift (OFFEN (a), `docs/GOLIVE.md:93`). Angemeldete Konten erreichen Adresssuche und Strecke weiter über `quote` ohne Captcha, begrenzt je Konto und global (`quote/handler.ts:32-35`, `:126-131`, `:177-181`); das Konto selbst entsteht nur über den Anmeldeweg, der das Captcha tragen soll. Auf Dev schützt das Captcha mit Testsecret nichts (gewollt, Zähler gelten weiter).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `supabase/functions/_shared/route/handler.ts:33-57` | Preflight, Methode, apikey, Body-Grenze, JSON, Modus, Eingabe in dieser Folge |
| `supabase/functions/_shared/route/handler.ts:60-69` | Formprüfung (Typ, leer, über 2048 Zeichen) vor Cloudflare; Wurf ergibt 503, `false` ergibt 403 |
| `supabase/functions/_shared/route/handler.ts:71-86` | IP und Zähler erst nach dem Captcha; Limiter-Ausfall 503 unverändert |
| `supabase/functions/_shared/route/handler.ts:99-104` | Fehlerweg unverändert, Log ohne Meldung |
| `supabase/functions/_shared/turnstile.ts:8-13`, `:16-17` | eigener Fehlertyp mit Bezeichner; zwei feste Code-Listen (N5) |
| `supabase/functions/_shared/turnstile.ts:20-38` | POST-Formular mit Secret und Token, Zeitgrenze 5 s, keine IP; Abbildung fail closed |
| `supabase/functions/route/index.ts:12-16`, `:22`, `:31-32` | Secret Pflicht beim Start, nur an die Prüfung gereicht, Log nur das Eintragsobjekt |
| `supabase/functions/_shared/http.ts:18-46`, `:50-51` | Body-Grenze per Stream; IP-Ermittlung unverändert |
| `supabase/functions/_shared/route/facts.ts:84-98` | Parser lesen nur ihre Felder, das Zusatzfeld stört nicht |
| `supabase/functions/_shared/quote/handler.ts:19` | `quote` nimmt aus dem Handler nur Grenzwerte und Typ |
| `tests/support/db.ts:18-19`, `:33-45`, `:47-49` | Konstante, Anmeldung mit Token, Löschen nur der eigenen Liste |
| `scripts/sys/loesch-register.json:8-10`, `:14`, `:30` | vier Skripte registriert, Bindung, Pin gleich Auftrag |
| `docs/freigaben/ts1-loesch-freigabe-1.md:1-6`, `:60-65`, `:134` | Kopf, Auflagen, Schlusszeile wie im Original unter `tmp/proof/ts1/` |
| `supabase/config.toml:214-219` | Captcha-Abschnitt mit `env(...)`, kein Wert |
| `src/lib/turnstile.ts:59-74`, `:76-110`, `:113-117` | Laden erst im Aufruf, Reset nach jeder Ausgabe, Zeitgrenze, Warteschlange |
| `src/components/CaptchaHost.tsx:15-35` | Modal nur bei Interaktion, sonst geschlossen und inert (M2) |
| `src/lib/auth.ts:38-39`, `:42-49`, `:55-60` | Code vor Status, Abbildung der Widget-Fehler, Prüfung der Adresse zuerst |
| `src/lib/route.ts:26-41` | frisches Token je Aufruf, 403 wird „Sicherheitsprüfung“, 429 und Rest unverändert |
| `tests/unit/turnstile.test.ts:9-40` | Formular ohne IP, drei Token-Codes `false`, fünf andere werfen, Secret nie in der Meldung, Zeitgrenze |
| `tests/unit/route.test.ts:264-326` | sechs Fälle zu Form, Ablehnung, Ausfall, Reihenfolge, Log, Body-Größe |
| `tests/unit/auth.test.ts:55-86` | ungültige Adresse ohne Prüfung, eigenes Token je Anforderung, Fehlerabbildung, kein Wiederholversuch |
| `tests/rls/captcha-live.test.ts:29-50`, `:58-93` | `route` mit Zählermessung und Positivkontrolle; Auth-Teil (N2) |
| `tests/e2e/captcha-helpers.ts:46`, `playwright.config.ts:39` | Cloudflare-Skript gestubbt, Platzhalter-Key (M2) |
| `tmp/proof/ts1/016-tests_rls_captcha-live.test.ts.log:4-5`, `:17-23`, `:28`, `:47` | ohne Schalter; vor dem Deploy `route` 200 ohne Token; Auth ohne Fehler |
| `tmp/proof/ts1/017-tests_rls_captcha-live.test.ts.log:4-5`, `:16-23`, `:28` | ohne Schalter; Teil `route` grün, Auth-Teil rot |
| `tmp/proof/ts1/018-shots.log:20-29`, `019-shots_all.log:20-29`, `020-shots_all.log:20-29` | je 4 bestanden, EXIT=0, mit Argumenten (gezielte Läufe) |
| `tmp/proof/ts1/runs.jsonl:8`, `:10`, `:11` | zwei rote e2e-Läufe (4 und 1 Fehler laut Log `008:187`, `010:70`), dann grün; Zwischenstände |
| `tmp/proof/ts1/runs.jsonl:15-20` | kein grüner `check`, kein voller `e2e`, kein voller `rls`, alle Läufe mit unsauberem Baum (M3) |
| `tmp/proof/ts1/015-check.log:435-438` | Register-Test rot wegen des alten Pins, gemessener Wert gleich dem neuen |
| `.env.example:5-9` | zwei neue Namen ohne Werte |
| `scripts/scan-proof.mjs:7-23` | vier Muster und Wertvergleich über Geheimnis-Variablen; nichts zu Turnstile geändert erkennbar |
| `scripts/golive-check.mjs:29-50` | keine Probe zum Captcha (M4); der Aufruf ohne Schlüssel bleibt 401 |
| `scripts/sys/fertig.mjs:16` | Mindestmenge der Abnahme: die sechs Pflichtdateien fallen darunter, `src/lib/auth.ts` und `tests/rls/` nicht (Auflage 5) |
| `docs/GOLIVE.md:19`, `:33`, `:54` | alte Angaben zu Build-Umgebung und Secrets (M1) |
| `docs/GOLIVE.md:37`, `:47`, `:59`, `:90-93` | 13 und 18 nicht abgehakt, Nachweis mit Dummy-Wert; 26 mit BEKS-Frage; 49 bis 52 neu |
| `docs/OFFEN.md:78` | ts1-1 (a) bis (g) |
| `docs/ENTSCHEIDUNGEN.md:222-223` | Nr. 215 und 216 (N4) |
| `docs/STAND.md:6-9`, `docs/BEKS.md:37-41` | Zwischenstand und Mini-Schritt für Beks beschrieben, Vermerk für andere Branches |
| `docs/ARCHITECTURE.md:190-195` | Abschnitt „Routing“ ohne Captcha (M1) |
| Suche `src/`, `tests/`, `scripts/` nach Passwort-Anmeldung, Mail-Anforderung, Aufrufen von `route` | alle Stellen senden das Token, Ausnahme `golive-check.mjs:49` (gewollt) |
| Suche `supabase/functions/` nach Captcha und Anmeldung | Captcha nur in `route`; keine Function meldet sich bei Auth an |
| Suche nach der Form der Cloudflare-Testschlüssel in `src/`, `tests/`, `scripts/`, `supabase/`, `docs/`, `tmp/proof/`, `public/` | kein Treffer |

Offene Findings hoch: 0
