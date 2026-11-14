Modell: claude-fable-5-2

# Abnahme Schritt u2 (Doku-Umbau nach SYSTEM_VORSCHLAG 3 e und f)

Datum: 2026-11-14 · Berater: advisor-report · Runde 1

Umfang: die zehn Dateien unten, jede ganz gelesen. Verglichen mit `tmp/u2-claude-alt.md` (alter Stand, 125 Zeilen), `docs/SYSTEM_VORSCHLAG.md` (ganz), `scripts/sys/stufe.mjs`, `fertig.mjs`, `bericht.mjs`, `start-schritt.mjs`, `gate-db.mjs`, `gate-db-lib.mjs`, `gate-loesch.mjs`, `gate-loesch-lib.mjs`, `run.mjs`, `fingerabdruck.mjs`, `lib.mjs`, `loesch-register.json`, `.claude/hooks/guard.mjs`, `.claude/hooks/session.mjs`, `.claude/settings.json`, `package.json`, `scripts/scan-proof.mjs`, `playwright.config.ts`, `vite.config.ts`. Nicht Teil: `docs/OFFEN.md`, `BEKS.md`, `ENTSCHEIDUNGEN.md`, `GOLIVE.md`, `STAND.md`.

Zu den Hashes: Ich habe kein Hash-Werkzeug (nur Read, Grep, Glob, Write). Die Zeilen sind wörtlich aus dem Auftrag abgeschrieben; gelesen habe ich den Stand der Dateien zum Zeitpunkt dieser Prüfung. Ob Hash und gelesener Stand übereinstimmen, vergleicht das Gate.

SHA256: ae07ef06ec087e9b7fb098ae42cedb82a8cd13faadbe1b57c054e2cec8075ae4 CLAUDE.md
SHA256: 7f86f4737feeef30b4e214bcfcd4bc335a3e37a806de2537a366c168cd761dc2 .claude/rules/daten.md
SHA256: ce92c4cef3cdbe9eea8a8b70705109a8b10173e79ad09fd348c920e3ac933394 .claude/rules/geld.md
SHA256: 938b465528c4ff56e8c2689078488cab420d63d7474a41f00bbb72f91eefc675 .claude/rules/karten.md
SHA256: a6bac9b888557b2ce2781cf14f24e37b0e6f94632ccef1be4d37e5569beb1fa1 .claude/rules/tests.md
SHA256: 89c6ed0c7b4b96b448dc3bfc2c44d47350d12c75974692173d485405896bf186 .claude/rules/ui.md
SHA256: 14cef4863dd9b145a56cc54d5f286570e8bfcb97dca788185e1872034d9954d5 .claude/skills/schritt/SKILL.md
SHA256: 3d26c3085d36fcba4238eb6457d43051ad0527de9bd9576b436d5c336e03db3a .claude/agents/advisor-report.md
SHA256: c290db78268f54e7fc0298995aaf75ce66377a310eec5df394aca96ea464647d .claude/agents/advisor.md
SHA256: 87dac0cf91557bcd661b2f18b5a088c028f1b778bd31fd96d7d255c83d93e2c3 .claude/agents/reviewer.md

Ergebnis in einem Satz: Die Geld-, Daten- und Kartenregeln stehen wörtlich am neuen Ort, aber zwei Sicherheitsregeln haben an Reichweite bzw. Richtigkeit verloren (H1, H2); dazu elf mittlere Lücken zwischen Skill, Agent-Dateien und Gates. Kein Gate lässt sich über den Skill umgehen; wo Text und Gate abweichen, ist das Gate strenger (Ausnahme: H2).

---

## Findings hoch

**H1** · `.claude/rules/daten.md:3-8` mit `:16`, `CLAUDE.md:28-30` – Die Regel „`.env*` nie lesen, ausgeben oder committen, auch nicht über Umwege … Ein blockierter Tool-Aufruf ist endgültig“ hängt an keiner Datei, lädt jetzt aber nur bei sechs Pfadmustern. In einem R0- oder R1-Schritt und bei `vite.config.ts`, `playwright.config.ts`, `package.json`, `tests/e2e/**`, `tests/unit/**` steht sie nicht im Kontext; im alten Stand galt sie immer (`tmp/u2-claude-alt.md:103`). `CLAUDE.md:30` nennt nur das Stichwort. Mechanisch gesperrt sind allein die Werkzeuge Read, Edit und Write auf den benannten Dateien (`.claude/settings.json:21-38`); der Guard kennt `.env` nicht (`guard.mjs:16`, `:30`: dotenv nur als Hülle). Der Umweg über Shell oder Skript war bisher nur durch diesen Text gesperrt. Das ist eine abgeschwächte Sicherheitsregel.
Fix: in `CLAUDE.md` nach Zeile 52 (Abschnitt „Werkzeuge und Ausgaben“) diese Zeile einfügen (danach 55 Zeilen, Grenze 60); `daten.md:16` bleibt:
`- .env* (außer .env.example) nie lesen, ausgeben oder committen, auch nicht über Skripte, node -e oder andere Umwege. Werte gehen nur über die npm-Skripte (dotenv-cli) an Befehle. Ein blockierter Tool-Aufruf ist endgültig.`
(Dateinamen und `node -e` wie in `daten.md:16` in Backticks setzen.)

**H2** · `.claude/rules/tests.md:15`, `.claude/skills/schritt/SKILL.md:21` – Der Text sagt, `npm run bericht` lasse den Secret-Scan „vorher“ laufen. Das Skript kopiert zuerst nach `docs/proof/<schritt>/` (`bericht.mjs:39`, `:47-61`) und scannt danach (`bericht.mjs:89`, eigener Kopf `:2` „danach“); der Scanner liest `docs/proof` (`scan-proof.mjs:14`). Die alte Sitzungsregel „Exit 0 nötig“ (`tmp/u2-claude-alt.md:72`) ist entfallen, und nirgends steht, was bei einem Treffer zu tun ist. Das wiegt, weil `fertig` nicht selbst scannt und ein früher committetes `bericht.json` gültig bleibt, solange sich nur Doku ändert (`fertig.mjs:67`, `:116`; `fingerabdruck.mjs:4`, `:11`): Nach einem Treffer im zweiten Berichtslauf (z. B. Abnahme Runde 2) ist die Textregel die einzige Sperre vor Merge und Push der Kopien.
Fix `tests.md:15`, neuer Wortlaut:
„Nachweisdateien werden nach dem Schreiben nie verändert. `npm run bericht` kopiert sie nach `docs/proof/<schritt>/` und lässt danach den Secret-Scan über `docs/proof/` laufen (Exit 0 nötig). Meldet er einen Treffer, entsteht kein neues `bericht.json`: nichts committen, kein `npm run fertig`, anhalten und Beks berichten. Keine README in `docs/proof/`.“
Fix `SKILL.md:21`, Satz anhängen: „Scheitert `npm run bericht` am Secret-Scan: nichts committen, anhalten, Beks berichten.“
Dazu ein Eintrag in `docs/OFFEN.md` (eigener R3-Schritt, nicht u2): `fertig` soll den Scan selbst fahren oder ein `bericht.json` verlangen, das jünger ist als die letzte Änderung unter `docs/proof/<schritt>/`.

## Findings mittel

**M1** · `.claude/rules/daten.md:3-8` – `daten.md` lädt nicht bei `vite.config.ts` (dort steht `envPrefix`, `vite.config.ts:10`, Regel `daten.md:15`), `playwright.config.ts` (Umgebungswerte für den Build, `:39`), `index.html`, CSS und `public/**` (Font-Regel `daten.md:21`), `package.json` (dotenv-Ketten). Netze bestehen (Build-Scan in `package.json:46`, `reviewer.md:16`), der Regeltext fehlt dort aber. Fix, neuer `paths:`-Block: `"supabase/**"`, `"scripts/**"`, `"src/**"`, `"index.html"`, `"public/**"`, `"tests/rls/**"`, `"tests/support/**"`, `"vite.config.ts"`, `"playwright.config.ts"`, `"package.json"`, `".env.example"` (Datei danach 32 Zeilen).

**M2** · `.claude/rules/geld.md:3-7` – `geld.md` lädt nicht bei `scripts/**` (z. B. `scripts/export-commissions.mjs`, `scripts/gen-golden.mjs`), `src/components/**`, `src/app/**`, `tests/e2e/**` (Preis-Mocks) und `tests/support/**`. Die heutige Geldlogik der App liegt in `src/lib/**` und `src/screens/**` und ist gedeckt; die Regel „kein fester Satz im App-Code“ (`geld.md:15`) gilt aber für ganz `src/`. Fix, neuer `paths:`-Block: `"supabase/**"`, `"scripts/**"`, `"src/**"`, `"tests/**"`.

**M3** · `.claude/skills/schritt/SKILL.md:50` gegen `:15`, `:18` – „höchstens drei Aufrufe je Schritt (Plan, DB-Freigabe, Abnahme)“ widerspricht Punkt 5 (Frage nach 2 roten Runden), Punkt 8 (Kontrollrunde) und dem Gate, das je Migration eine Freigabe und nach jeder Änderung eine neue Abnahme erzwingt (`fertig.mjs:43`, `:52-55`). Zudem fehlt die alte Regel „Frage an den Berater, wenn unterwegs eine Entscheidung auftaucht, die der Plan nicht abdeckt“ (`tmp/u2-claude-alt.md:58`). Fix, neuer Wortlaut `SKILL.md:50`:
„- `advisor`, `advisor-report` (Fable): nur R3, im Regelfall drei Aufrufe je Schritt (Plan, DB-Freigabe, Abnahme). Zusätzlich nur: eine Kontrollrunde nach „hoch ≥ 1“, eine weitere DB-Freigabe je weiterem Antrag, eine Frage an `advisor`, wenn ein Fehler nach 2 Runden rot bleibt oder eine Geld- oder Sicherheitsentscheidung auftaucht, die der Plan nicht abdeckt. Jeder Zusatzaufruf steht in der Bewertung. Das eingebaute `advisor`-Tool ohne Parameter nie benutzen; steht es in der Tool-Liste, im ersten Satz melden.“

**M4** · `.claude/skills/schritt/SKILL.md:12` – „Herabstufen darf nur Beks im Prompt“ verspricht etwas, das es im Gate nicht gibt: `stufe.mjs:2` („Herabstufen gibt es nicht“), `fertig.mjs:127` rechnet die Stufe allein aus den Pfaden. Fix, neuer Schlusssatz: „Im Zweifel die höhere. Herabstufen gibt es nicht: Das Gate rechnet die Stufe selbst aus den Pfaden.“ (Weicht von Vorschlag 3 b ab; so ist es seit u1 gebaut und abgenommen.)

**M5** · `.claude/agents/advisor.md:12`, `:24` – `advisor` bietet weiter eine „Abnahme (Stufe R3)“ im Chat an. Er hat kein Write (`advisor.md:6`); das Gate verlangt die Datei `tmp/proof/<schritt>-abnahme.md` (`fertig.mjs:118`, `:49`), die nur `advisor-report` schreiben darf (`guard.mjs:285`). Widerspricht `SKILL.md:18`, `:43`. Fix `advisor.md:12`: „- Abnahmen und Freigaben gibst du nicht: Sie brauchen eine Datei für das Gate und gehen an `advisor-report`.“ Fix `advisor.md:24`: „- Entscheidung: ja / nein / ja mit Änderungen“. In `:10` „Zwei Arten“ durch „Eine Art“ ersetzen.

**M6** · `.claude/agents/reviewer.md:17` – Die Staffel ist genannt, die Suche nach festen Sätzen kennt aber nur den alten Flachsatz (0.15, 0,15, 15 %). Ein fest eingebauter Staffelsatz fiele nicht auf. Fix, Satz ersetzen durch: „Kein fester Gebührensatz und keine feste Stufengrenze im App-Code außerhalb von Tests (suche nach 0.15, 0.12, 0.10, 0.07, in Prozent 15, 12, 10, 7, in Basispunkten 1500, 1200, 1000, 700, Grenzen 50000 und 100000);“.

**M7** · `CLAUDE.md:45`, `.claude/rules/tests.md:10`, `.claude/skills/schritt/SKILL.md:17` gegen `SKILL.md:42` – Die Pflicht nennt 1280 und 430 px, der einzige genannte Weg `npm run t -- shots` liefert nur 390 px (`package.json:55`). Das Ziel `shots:all` gibt es (`run.mjs:12`, `package.json:56`), es steht aber in keiner der drei Dateien; der direkte Aufruf ist gesperrt (`guard.mjs:194`). Fix: in allen drei Ziellisten `shots|shots:all`; in `CLAUDE.md:45` ergänzen „`shots:all` zusätzlich 430×932, 768×1024, 1280×800“; `SKILL.md:17`: „UI geändert: `npm run t -- shots` (390) bzw. `npm run t -- shots:all` (430, 768, 1280), dann `reviewer` …“.

**M8** · `.claude/skills/schritt/SKILL.md:56` gegen `:11` – Nach dem Stopp bei 150.000 Tokens ist keine Fortsetzung möglich: `start-schritt` verlangt `main` (`start-schritt.mjs:10`) und legt den Branch neu an (`:22`); Punkt 1 sagt „Bricht es ab: Stopp“. Fix, Satz an `SKILL.md:56` anhängen: „Fortsetzung: Beks startet `/schritt <name>` mit dem Wort „Fortsetzung“; dann entfällt Ablauf-Punkt 1 (der Branch besteht schon), stattdessen prüfen: `git branch --show-current` ist `<name>`, Arbeitsbaum sauber; dann `docs/STAND.md` lesen.“

**M9** · `.claude/skills/schritt/SKILL.md:18`, `.claude/agents/advisor-report.md:23` – Nirgends steht, woher die Hashes einer Abnahme kommen (der Berater hat kein Hash-Werkzeug, `advisor-report.md:6`) und welche Dateien das Gate mindestens verlangt (`MUSS_ABNAHME`, `fertig.mjs:15`; „nur Geld- und Sicherheitsdateien“ ist enger). Folge wäre ein blockiertes Gate und ein weiterer Fable-Aufruf. Fix, an `SKILL.md:18` anhängen: „Der Auftrag nennt je Datei die Zeile `SHA256: <hash> <pfad>` aus `sha256sum`. Pflichtmenge laut Gate: jede geänderte Datei unter `supabase/functions/`, `src/lib/money*`, `scripts/sys/*.mjs`, `tests/support/`, `docs/freigaben/`, `.claude/hooks/`, `.githooks/`, dazu `scripts/sys/loesch-register.json`, `.claude/settings.json` und `package.json`.“ Fix `advisor-report.md:23`: „… bei Abnahmen den Hash aus dem Auftrag, bei DB- und Lösch-Freigaben den Hash aus dem Antrag abschreiben; DB- und Lösch-Freigaben brauchen zusätzlich die Zeile mit dem Urteil (frei oder gesperrt)“.

**M10** · `.claude/skills/schritt/SKILL.md:54`, `CLAUDE.md:12` – „Effort hoch bei R3“ prüft niemand: Der Hook vergleicht nur das Modell (`session.mjs:19-22`), die Vorgabe steht auf mittel (`.claude/settings.json:3`). Die alte Erinnerung im ersten Satz (`tmp/u2-claude-alt.md:47`) fehlt ersatzlos. Fix `SKILL.md:54`: „- Modell der Hauptsession: Sonnet 5.5, Effort hoch bei R3, sonst mittel. Der Hook blockt `/schritt` bei falschem Modell, den Effort prüft er nicht: bei R3 im ersten Satz an „Effort hoch“ erinnern. Läuft die Session auf Beks' Wort mit einem anderen Modell, steht das im Bericht.“

**M11** · `CLAUDE.md:52` – „Verschieben mit `git mv` ist erlaubt“ gilt dem Wortlaut nach auch für `docs/proof/`. `tests.md:15` (Nachweise nie verändern) lädt in einem R0-Schritt nicht, und der Guard sperrt `git mv` nur für `docs/freigaben` und Berater-Dateien (`guard.mjs:261`, `:273`). Fix: „Verschieben mit `git mv` ist erlaubt, außer in `docs/proof/` und `docs/freigaben/`.“

## Findings niedrig

- **N1** · `.claude/rules/daten.md:13` – „nur über `npm run loesch`“ stimmt für die `.mjs`-Skripte des Registers. `tests/support/sweep.ts` läuft im Testlauf und prüft die Freigabe selbst (`gate-loesch-lib.mjs:37-44`; `gate-loesch.mjs:51` nimmt nur `.mjs`). Der Weg der Lösch-Freigabe (`npm run loesch -- uebernehme …`, dann committen; `gate-loesch.mjs:22-38`) steht in keiner der geprüften Dateien. Fix: Satz ergänzen „(`tests/support/sweep.ts` läuft im Testlauf und prüft dieselbe Freigabe selbst; Freigaben übernimmt `npm run loesch -- uebernehme <bericht>`, sie zählen erst aus dem Commit)“.
- **N2** · `.claude/skills/schritt/SKILL.md:27-30` – In der Stufentabelle fehlen `tests/unit/sys-*` (R3, `stufe.mjs:12`) und `docs/reference/design/tokens.json` (R1, `stufe.mjs:17`). Ohne Folge, weil das Skript maßgeblich ist.
- **N3** · `.claude/skills/schritt/SKILL.md:40` – „`rls` voll: R3 ja“ erzwingt das Gate nur bei geändertem Fingerabdruck (`fertig.mjs:37`). Der Text ist strenger als das Gate; so lassen (Vorschlag 3 c), aber wissen.
- **N4** · `.claude/skills/schritt/SKILL.md:41` – „Live-Aufruf der berührten Function“ in Spalte R2 ist leer: jede Function liegt unter `supabase/` und ist R3 (`stufe.mjs:13`).
- **N5** · `.claude/skills/schritt/SKILL.md:54` – Der Hook blockt nicht, wenn das Modellfeld fehlt (`session.mjs:20`); und ein „anderes Modell auf Beks' Wort“ kommt an `/schritt` nur vorbei, wenn Beks die Vorgabe in `settings.json` ändert (`session.mjs:21-22`). Beides fail-closed bzw. im Bericht sichtbar („unbekannt“).
- **N6** · `.claude/skills/schritt/SKILL.md:51` – In der Delegations-Spec fehlen die „passenden Referenz-Screens“ (`tmp/u2-claude-alt.md:62`). Fix: „Ziel, Dateien, Akzeptanzkriterien, Läufe, bei UI die Referenz-Screens“.
- **N7** · `.claude/rules/tests.md:15` – Der Ort für Hinweise zu Nachweisen (früher `PROGRESS.md`, `tmp/u2-claude-alt.md:75`) hat keinen Nachfolger. Vorschlag: „Hinweise dazu stehen in der Bewertung“.
- **N8** · `.claude/skills/schritt/SKILL.md:17`, `:49` – Der Name der Berichtsdatei des `reviewer` ist offen; `*-abnahme.md` ist dem Berater vorbehalten (`guard.mjs:12`, `:285`). Vorschlag: `tmp/proof/<name>-review.md` (wird von `bericht.mjs:51` mitkopiert).
- **N9** · `.claude/agents/advisor.md`, `advisor-report.md` – `maxTurns` aus Vorschlag 3 f fehlt im Frontmatter. Kein Risiko, nur Kostenbremse.
- **N10** · `.claude/rules/daten.md:24` – Die Kurzform nennt nur „SHA-256 je Datei, Urteil frei“. Das Gate verlangt zusätzlich Modell Fable und genau eine Zeile mit null hohen Findings (`gate-db-lib.mjs:58-60`). `advisor-report.md:21-27` deckt das ab.
- **N11** · außerhalb u2, für `docs/OFFEN.md`: `run.mjs:28` schickt eine Datei unter `tests/shots/` an `test:e2e`; dessen Projekte greifen nur `e2e/**` (`playwright.config.ts:45`, `:50`). Ein gezielter Shot-Lauf über den Dateinamen findet vermutlich keinen Test (nicht ausgeführt). Der Kommentar `supabase/functions/_shared/pricing/fee.ts:1` verweist noch auf „CLAUDE.md Geld“.

---

## Antworten auf die Prüffragen

**1 · Geld, Daten, Karten verlustfrei?** Im Wortlaut ja. `geld.md:11-18` entspricht alt `:89-96` Wort für Wort (Staffel, Rundung, Journal, Leserechte, `payout_preview`, Kaution und Kraftstoff). `daten.md:12-21` entspricht alt `:99-107`, `:109`; `karten.md:10-13` entspricht alt `:112-115`. Verschoben, nicht verloren: „Integrationstests sequenziell und gepaced“ (alt `:108`) steht wörtlich in `tests.md:17`. Geändert: `daten.md:16` „nur über die npm-Skripte (dotenv-cli)“ ist enger als vorher, keine Lockerung. Abgeschwächt in der Reichweite: die `.env`-Regel (H1).
Zusätze: Lösch-Gate-Satz (`daten.md:13`) stimmt für Registerskripte (`gate-loesch.mjs:53-56`, `guard.mjs:163-178`, `package.json:70`, Ask-Regel `settings.json:112`), ungenau bei `sweep.ts` (N1), lockert nichts. „Datenbank-Weg“ (`daten.md:24-25`) stimmt: `package.json:68-69`, `gate-db.mjs:52-68`, `:75`, Sperren `guard.mjs:197`, `:292` und die Deny-Regel für den Connector in `settings.json:68`; lockert nichts. `daten.md:26` (Functions im selben Schritt deployen) ist eine neue, strengere Betriebsregel; „fail closed“ habe ich nur an einer Stelle belegt (`_shared/jobs/handlers.ts:84`). Der Deploy selbst hat weiter kein Gate, nur die Ask-Regel (`settings.json:76-77`); `CLAUDE.md:15` streicht sie nicht.

**2 · Übrige Regeln.** UI vollständig in `ui.md:11-20` (alt `:118-125`, dazu „nativ“ aus dem Stack und die UI-Session-Regel). Werkzeuge und Ausgaben in `CLAUDE.md:51-54`; die `cp`-Ausnahme ersetzt `npm run bericht` (Vorschlag a3). Arbeits-Loop: 5 Runden, OFFEN, Bildsicht, Maße, Rot-Beweis, Nachweis-Regeln vorhanden (`SKILL.md:15`, `ui.md:23-25`, `tests.md:13-15`); `test-runner`, EXIT per `echo`, Shot-Größen je Runde und die `shots:all`-Regel sind durch Vorschlag a1, 3 b und 3 f ausdrücklich ersetzt. Sessions und Modelle: vorhanden in `CLAUDE.md:10-13` und `SKILL.md:46-59`. Ersatzlos oder verändert: Secret-Scan-Regel (H2), Frage bei ungeplanter Entscheidung (M3), Effort-Erinnerung (M10), Referenz-Screens in der Spec (N6), Ort für Hinweise (N7). Das Beispiel unter „Später“ (`CLAUDE.md:5`: Admin-Oberfläche, Zahlung, Miete statt Partner-Portal) passt jetzt zu `docs/ROADMAP.md:139-145`; der alte Text widersprach dort.

**3 · Skill gegen Gates.** Passt: `PFLICHT` (`fertig.mjs:13`) zu den Zeilen `check`, `e2e`, `rls`; Abnahme-Pfad (`fertig.mjs:118`, `SKILL.md:18`); Fable, genau eine Schlusszeile mit null, mindestens eine Hash-Zeile (`fertig.mjs:51-53`); Rot vor Grün je neuer Datei unter `tests/rls/` (`fertig.mjs:57-61`, `:138`; `tests.md:14` sagt es genau); STAND höchstens 40 Zeilen (`fertig.mjs:71`, `:141`); Reihenfolge Endstand, Läufe, Doku-Commit, Bericht, Commit, fertig (`bericht.mjs:12-14`, `fertig.mjs:67`); `start-schritt` (`start-schritt.mjs:8-24`); DB-Weg (`SKILL.md:16`, `gate-db.mjs:50`, `fertig.mjs:134`). Stufentabelle deckt `stufe.mjs:7-28` bis auf N2.
Abweichungen: Herabstufen (M4), Obergrenze der Berateraufrufe (M3), Fortsetzung (M8), Hash-Herkunft und Pflichtmenge (M9), Shots (M7), `rls` bei R3 (N3), Modell-Hook (N5), Secret-Scan (H2). Einen Weg an einem Gate vorbei erlaubt der Skill nicht; überall außer H2 ist das Gate gleich streng oder strenger als der Text. Grenze, unverändert aus u1: Die Hash-Bindung der Abnahme beweist, dass die genannte Datei dem Endstand gleicht, nicht wie gründlich gelesen wurde; die Hashes liefert die Hauptsession.

**4 · `paths:`.** Gedeckt: `supabase/functions/**`, `src/lib/money.ts`, `tests/rls/**` laden beide Dateien; `scripts/**` und `tests/support/**` laden `daten.md`. Lücken: `daten.md` bei `vite.config.ts`, `playwright.config.ts`, `index.html`, CSS, `public/**`, `package.json`, `src/screens/**`, `src/components/**`, `src/app/**` (M1; Foto-Grenzen und EXIF liegen in `src/lib/photos.ts` und sind gedeckt); `geld.md` bei `scripts/**`, `src/components/**`, `src/app/**`, `tests/e2e/**`, `tests/support/**` (M2). Der Satz in `CLAUDE.md:28` („für Pläne und Abnahmen selbst lesen“) hilft Berater und Reviewer, nicht der bauenden Session; für die Regel ohne Dateibezug reicht er nicht (H1). `karten.md` lädt nicht bei `supabase/migrations/**` und `scripts/import-*.mjs` (Stadtgrenze); niedrig, `"supabase/**"` und `"scripts/import-*"` ergänzen.

**5 · Agent-Dateien.** Alle drei verweisen auf `.claude/rules/` (`advisor.md:14`, `:17`; `advisor-report.md:12`; `reviewer.md:15`, `:17`). `advisor-report.md` ist in sich stimmig; „Rundung wie `splitFee`“ gilt weiter (`fee.ts:45-51`); Ergänzung M9. `advisor.md` ist nicht stimmig mit Skill und Gate (M5). `reviewer.md` nennt die Staffel, sucht aber nur den alten Satz (M6). Kein Verweis mehr auf `test-runner` oder archivierte Doku in `.claude/agents/`, `rules/`, `skills/` (Grep; einziger Treffer ist ein Kommentar in `guard.mjs:259`, durch `CLAUDE.md:24` gedeckt).

**6 · `CLAUDE.md` gegen Regeln und Skill.** Kein inhaltlicher Widerspruch bei Geld, Rollen, Modell, Ablauf, Gates (`CLAUDE.md:9-15` zu `SKILL.md:11-22`, `:54-58`, `tests.md:19`). Drei Reibungen: `git mv` gegen Unveränderlichkeit der Nachweise (M11), Zielliste ohne `shots:all` gegen die Bildsicht-Pflicht (M7), Effort ohne Prüfer (M10). Grenzen eingehalten: `CLAUDE.md` 54 Zeilen, Regeln 14 bis 27 Zeilen, Skill 60 Zeilen.

---

## Stichproben

| Datei:Zeile | Ergebnis |
|---|---|
| `tmp/u2-claude-alt.md:91` ↔ `.claude/rules/geld.md:13` | Staffel, Grenzen, Rundung, Version 1 und 2: wortgleich |
| `tmp/u2-claude-alt.md:92` ↔ `geld.md:14` | Journal, Leserechte mit aal2, Staffeltabellen: wortgleich |
| `tmp/u2-claude-alt.md:101` ↔ `daten.md:14` | `p_actor`, aal2: wortgleich |
| `tmp/u2-claude-alt.md:103` ↔ `daten.md:16` | `.env`-Regel: enger („npm-Skripte“), sonst gleich |
| `tmp/u2-claude-alt.md:108` ↔ `tests.md:17` | Integrationstests: verschoben, wortgleich |
| `supabase/functions/_shared/pricing/fee.ts:38`, `:49-50` | einmal half-up nach Summe; netto = fee/(1+USt.); Auszahlung = total − fee: passt zu `geld.md:13` |
| `src/lib/supabase.ts:6-7`, `vite.config.ts:10` | nur `NEXT_PUBLIC_`-Werte in der App: passt zu `daten.md:15` |
| Grep feste Sätze in `src/` | kein Gebührensatz gefunden (Treffer nur Farben und Filter) |
| `package.json:68-70` | `db:antrag`, `db:push` (mit `db:types`), `loesch` wie in `daten.md` und `CLAUDE.md:46-47` |
| `scripts/sys/gate-db.mjs:43`, `:62-68`, `:75` | Dev-Guard, Freigabe je Pfad und Hash, erst dann Push |
| `scripts/sys/gate-db-lib.mjs:38-49`, `:58-60` | Format streng zeilenverankert; Fable, Urteil frei, hoch 0 |
| `scripts/sys/gate-loesch.mjs:51-56`, `:62` | nur Registerskripte `.mjs`, Freigabe aus dem Commit, Dev-Guard |
| `.claude/hooks/guard.mjs:194`, `:197`, `:292` | Tests direkt, `db push`, `migration repair`, Connector-Werkzeuge gesperrt |
| `.claude/hooks/guard.mjs:285` | Abnahmen und Freigaben nur von `advisor-report` |
| `.claude/hooks/guard.mjs:16`, `:30` | keine `.env`-Prüfung im Guard (Beleg H1) |
| `.claude/settings.json:21-38`, `:66-70`, `:72-120` | Deny und Ask unverändert vorhanden; Ask für commit, merge, push, rm, dotenv bleibt (`CLAUDE.md:15`) |
| `scripts/sys/stufe.mjs:7-28` | Tabelle im Skill deckt sie bis auf N2; `CLAUDE.md` und `.claude/**` sind R3 |
| `scripts/sys/fertig.mjs:13`, `:15`, `:37`, `:49-61`, `:67`, `:71`, `:118` | Pflichten, Pflichtmenge, Übernahme, Abnahme, Rot vor Grün, Bericht, STAND, Abnahme-Pfad |
| `scripts/sys/bericht.mjs:39`, `:47-61`, `:89-90` | Kopie vor Scan, `bericht.json` erst nach Scan (Beleg H2) |
| `scripts/scan-proof.mjs:14`, `:44` | scannt `docs/proof`, Exit 1 bei Treffer |
| `scripts/sys/start-schritt.mjs:10`, `:22` | verlangt `main`, legt Branch neu an (Beleg M8) |
| `scripts/sys/run.mjs:12`, `:28` | Ziel `shots:all` vorhanden; Shot-Datei geht an `test:e2e` |
| `package.json:55-56`, `playwright.config.ts:3-8`, `:53-59` | `shots` nur 390; übrige Größen nur über `shots:all` |
| `.claude/hooks/session.mjs:19-22` | Block nur bei `/schritt` und bekanntem, falschem Modell |
| `docs/ROADMAP.md:139-145` | Partner-Portal ist Phase 1; „Später“ = Admin-Oberfläche, Miete, Zahlung |
| `docs/OFFEN.md:13` | Function-Deploy ohne Gate ist dort vermerkt (u1-2) |

Nach den Fixes ändern sich die Hashes von `CLAUDE.md`, `tests.md`, `SKILL.md` (H1, H2) und je nach Umfang der mittleren Fixes weiterer Dateien; die Kontrollrunde braucht neue `sha256sum`-Zeilen.

Offene Findings hoch: 2
