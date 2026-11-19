Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme 1, Schritt mail2 (R3, Kennung mail2-1911-a)

Datum: 2026-11-19
Geprüft: Endstand im Arbeitsbaum (laut Auftrag Commit 77f10df auf Branch mail2, Arbeitsbaum sauber) gegen `.claude/rules/daten.md`, `geld.md`, `tests.md`, den Plan `tmp/proof/mail2-plan.md`, die acht Auflagen der Planprüfung aus dem Auftrag und die DB-Freigabe `tmp/proof/mail2/db-freigabe-1.md`. Vollständig gelesen: Migration 0076, `handlers.ts` ab Zeile 200, `db.ts` ab Zeile 90, `scripts/outbox-status.mjs`, `scripts/setup-outbox.mjs`, `tests/rls/outbox.test.ts`, `tests/unit/outbox-handler.test.ts`, `tests/unit/outbox-db.test.ts`. In Auszügen wie beauftragt: `database.types.ts` (Zeilen 1-12, 1885-1899), `tests/support/positiv.ts` (452-470), `package.json` (Skriptnamen, Zeile 56). Zusätzlich nachgeschlagen: `brevo.ts`, `outbox-send/index.ts`, `scripts/dev-guard.mjs`, Migrationen 0075 und 0036 (Anfang), `tests/rls/en-route.test.ts:135-179`, `scripts/sys/loesch-register.json`, `scripts/sys/gate-loesch-lib.mjs:11-70`, `tests/unit/sys-gate-loesch.test.ts:119-134`, `supabase/config.toml:156-236`, `docs/BEKS.md:28-37`, `tmp/proof/mail2/runs.jsonl`, Logs 001, 003, 009 (nur Kopf und Fehlerzeilen).

SHA256: 293f39c1cb7b430a78825f39057286fa4aba81fc851daa0d9faf6cfadee1f049 supabase/functions/_shared/database.types.ts
SHA256: cac96b3f81227961e300102422ff063ab03caacc00a1c984e6178fef83831495 supabase/functions/_shared/jobs/db.ts
SHA256: 97422e76440367c51a3beb1211a6680a35929afeaa265ef6a8338926347c89c4 supabase/functions/_shared/jobs/handlers.ts
SHA256: 613028ec9712c1ba48f9dd148adeacfe42353154d5a64d240917db5c3c5457eb tests/support/positiv.ts
SHA256: 1f3b8e43b36712c9f8b77f99d64328199b27f620701d4e98e52e1219870aa2d8 package.json
SHA256: 02f20d6be94bc750a82252e27cc41b71ee5ae55980836c9679d383220fbbcc67 supabase/migrations/20261119031957_0076_mail2_konto_empfaenger.sql
SHA256: ca720d3c712a2c6345d3d45819f60206221b9fab98b39e21019e9e3ef66d5aff scripts/outbox-status.mjs
SHA256: 4952f64eee7a0cc355c0bdb521dc0d252979b8f3a2831e7dfdf4e770303a0ec0 scripts/setup-outbox.mjs
SHA256: 71ac6a180a7ec881a6419f45c74da22d1bcee5ade4fd9300caac8a4309566244 tests/rls/outbox.test.ts
SHA256: a53a4f94350a138af45af21aa02aea189961fb129e38b3b2345859cdd68e93bc tests/unit/outbox-handler.test.ts
SHA256: 13660b43752b8956bcca10dc614caee7a3a7ad576d88b6a649d424deb5958927 tests/unit/outbox-db.test.ts

Zu den Hashes: Alle elf sind aus dem Auftrag abgeschrieben. Selbst nachrechnen konnte ich keinen (kein Werkzeug dafür). Gegen Dateien abgeglichen sind zwei: die Migration (gleich in `db-antrag-1.json:4` und in beiden Push-Marken, `runs.jsonl:9-10`) und `tests/rls/outbox.test.ts` (gleich dem `dateiSha` des roten Laufs 3 und des grünen Laufs 9, `runs.jsonl:3`, `:11`). Die übrigen neun vergleicht erst das Gate.

Nicht ausgeführt und nicht selbst belegt:
- Kein Test, kein Skript, keine Abfrage gegen Dev. Aussagen zu Dev-Zahlen (Fenster rund 26 Sekunden, Outbox-Stände, Firmen mit echter Inhaber-Adresse = 0) stehen nur im Auftrag, eine Datei dazu gibt es nicht (M3).
- Den Deploy von `outbox-send` kann ich nicht sehen; belegt sind nur die Push-Marken (`runs.jsonl:9-10`, 03:29:06 und 03:29:18 UTC).
- Kein Diff gegen den Vorstand: was sich in `package.json`, `positiv.ts` und `database.types.ts` außerhalb der gelesenen Zeilen geändert hat, habe ich nicht geprüft.
- Den Prompt des Schritts (Beks-Wort, Auflage 1) kann ich nicht einsehen (M4).
- Volläufe `check`, `e2e`, `rls` stehen aus; die elf Läufe in `runs.jsonl` sind gezielte Läufe vor dem Commit (Stand f77543b, Arbeitsbaum nicht sauber).

## Findings

### Hoch
Keine.

### Mittel
- M1 · `scripts/sys/loesch-register.json:2-37` gegen `scripts/outbox-status.mjs:6` – Das neue Skript importiert den Dev-Schutz; dessen Name ist eines der Muster, mit denen `scanne()` die Dateien direkt unter `scripts/` prüft (`scripts/sys/gate-loesch-lib.mjs:13-14`, `:64-68`). Das Register nennt das Skript weder unter `skripte` noch unter `ausgenommen`. Folge: `tests/unit/sys-gate-loesch.test.ts:122-124` wird im Volllauf `check` rot; der Test lief im Schritt nicht (`runs.jsonl`, elf Läufe ohne ihn). – Fix: Eintrag unter `ausgenommen` mit Grund und dem Hash aus dem Auftrag. Grundlage dafür aus dieser Abnahme: Ich habe das Skript vollständig gelesen; es führt genau eine Leseabfrage aus (`:10-16`), schreibt nichts, gibt nur Zähler und Minuten aus (`:36-39`) und zeigt bei Fehlern nur feste Texte (`:21-34`).
- M2 · `scripts/sys/loesch-register.json:33` gegen `tests/support/positiv.ts` – Die Ausnahme pinnt die Datei auf einen Hash, der mit c2439ae7 beginnt; der Auftrag nennt für den Endstand einen Hash, der mit 613028ec beginnt (die Datei wurde im Schritt geändert, `positiv.ts:460`). Stimmt der Hash aus dem Auftrag, wird `tests/unit/sys-gate-loesch.test.ts:129-133` im Volllauf `check` rot. – Fix: Pin nachführen. Für die gelesenen Einträge (`positiv.ts:458-464`) trägt der Ausnahmegrund weiter: nur Spaltenliste und Aufruftext, ausgeführt in Rollback-Proben. Ob die Änderung der Datei im Schritt auf Zeile 460 beschränkt ist, habe ich nicht geprüft; die Hauptsession belegt das im Bericht mit dem Diff der Datei zwischen f77543b und dem Endstand.
- M3 · Auflagen 5 und 6 (DB-Freigabe M1) – Die Zahlen nach dem Fenster zwischen Push und Deploy und die Zahl der Firmen mit Inhaber-Adresse ohne reservierte Endung stehen nur im Auftrag. Unter `tmp/proof/` und `docs/` gibt es keine Datei mit der Ausgabe von `npm run outbox`. Nach `tests.md` zählt eine Zusammenfassung allein nicht. Auflage 6 ist sicherheitsrelevant: der Dev-Schutz überspringt nur reservierte Endungen, eine Firma mit echter Inhaber-Adresse bekäme auf Dev echte Mail. – Fix: die Ausgabe von `npm run outbox` (vorher, direkt nach dem Deploy, am Ende) wörtlich in die Bewertung des Berichts; dazu der Satz, dass die 251 Firmen- und 195 Kunden-Altzeilen erst mit ihrem Wiederholungs-Abstand (bis 16 Stunden) endgültig werden, mit dem dann abgelesenen Stand.
- M4 · `docs/BEKS.md:32` – Frage 1 steht noch als offen, mit zwei Teilfragen (welche Adresse, welches Mitglied). Der Schritt setzt beide Antworten um (Anmeldeadresse, nur Inhaber). Den Prompt mit dem Beks-Wort kann ich nicht einsehen; die Angabe im Auftrag ist für mich kein Beleg. – Fix: vor `npm run fertig` das Wort mit Wortlaut und Datum in `docs/ENTSCHEIDUNGEN.md` und `docs/BEKS.md` (Frage als beantwortet). Steht es nicht im Prompt des Schritts: anhalten.

### Niedrig
- N1 · `scripts/setup-outbox.mjs:98` gegen `:103` – Beim Abbruch wegen Kontofehler druckt das Skript die Schlüssel der Anbieter-Diagnose ungefiltert; zwei Zeilen weiter filtert es dieselben Schlüssel auf Status und Kürzel. Heute ohne Wirkung, weil die Quelle das Kürzel schon begrenzt (`brevo.ts:19`, `:40`). – Fix beim nächsten Anfassen (das Skript braucht ohnehin eine neue Lösch-Freigabe): denselben Filter vor der Ausgabe.
- N2 · `0076:65` – Offen aus der DB-Freigabe (N1 dort): bei leerem `p_ok` mit dem Kontofehler-Code sinkt der Zähler nicht. Nicht erreichbar (`db.ts:130` übergibt immer einen Wahrheitswert). – Nächste Outbox-Migration.
- N3 · `handlers.ts:353-360` mit `0076:60-68` – Keine Altersgrenze für Zeilen unter Kontofehler (DB-Freigabe N2). Dazu: die Zeilen werden nach ID geholt (`0076:21`); lieferte der Anbieter einen Kontofehler-Status nur für eine bestimmte Mail, hielte diese Zeile alle späteren Zeilen des Laufs dauerhaft auf. Bei Brevo sind die vier Status kontoweit, ein Beleg aus dem Betrieb fehlt. – Auflage 8 (Frage in `docs/BEKS.md`, GOLIVE 48) steht noch aus; dort beide Punkte nennen.
- N4 · `handlers.ts:317-323` mit `:359` – Scheitert während eines Kontofehlers auch das Markieren, bleibt die Zeile `sending` und der Versuch ist verbraucht (nach der Lease erneut, nach fünf solchen Läufen `failed` mit dem Lease-Code, also sichtbar). Kein Test für diesen Zweig. – Unit-Fall ergänzen, kein Umbau.
- N5 · `tmp/proof/mail2/003-tests_rls_outbox.test.ts.log:31-32` – Im roten Lauf scheitert der erste mail2-Test schon im Setup am CHECK (23514), nicht an der Prüfung von `outbox_mark`: der Ist-Wert für „`no_recipient` endgültig“ steht nicht im Log. Die beiden anderen Tests zeigen Ist-Werte (`:46`, `:62`). Die Datei ist nicht neu, das Gate verlangt den Rot-Beweis hier nicht. – Kein Fix; im Bericht nicht als Rot-Beweis für diesen Punkt führen.
- N6 · `tests/rls/outbox.test.ts:165` – Der Titel nennt Lease und Limit, gemessen werden sie in anderen Tests (`outbox.test.ts:26-30`, `:47`; `en-route.test.ts:144-151`). Die Reihenfolge bei gleicher Anlagezeit zweier Inhaber (`0076:30`) misst kein Test. – Titel kürzen oder Fall ergänzen, bei Gelegenheit.
- N7 · `handlers.ts:328` – Der Kommentar nennt die Anmeldeadresse „bestätigt“. Das hängt daran, dass eine Adressänderung des Kontos erst nach Bestätigung gilt. `supabase/config.toml:225-227` sagt dazu etwas, wird aber nie gepusht; für Dev und Produktion ist das nicht belegt. – Prüfzeile in GOLIVE (bei 46/47): im Produktivprojekt gilt eine geänderte Adresse erst nach Bestätigung; sonst kann ein Inhaber wie bisher über `contact_email` Mails an fremde Adressen auslösen.
- N8 · `database.types.ts:1890` – `owner_id` ist als nicht leer typisiert, die Funktion liefert für Firmen ohne Inhaber und für Kunden leer. Der Handler prüft das (`handlers.ts:330`), `OutboxRow` trägt den richtigen Typ (`handlers.ts:226`). Einen Generierungsvermerk hat die Datei nicht (`:1-12`); dass sie neu erzeugt wurde, zeigt nur der Inhalt (kein `partner_email` mehr in `supabase/functions`). – Kein Fix.
- N9 · `scripts/outbox-status.mjs:6` – Die Betreiber-Sicht läuft nur gegen Dev (wie im Plan). Für Produktion fehlt sie damit. – In den Rest von GOLIVE 48.
- N10 · Plan Zeile 30 gegen `0076:48`, `0076:5`, `handlers.ts:299` – Zwei Abweichungen vom Plantext, beide durch Auflagen gedeckt: 402 zählt als Kontofehler (Auflage 2), und die Pause nach einem Kontofehler ist nicht fest 15 Minuten, sondern der Abstand zu den verbleibenden Versuchen, bis 16 Stunden (Auflage 4). – Im Bericht benennen.

## Auflagen der Planprüfung

| Nr. | Ergebnis |
|---|---|
| 1 Beks-Wort | nicht prüfbar (M4) |
| 2 Kontofehler mit 402 | erfüllt: `handlers.ts:299`, gemessen für 401, 402, 403, 429 in `outbox-handler.test.ts:125-138` |
| 3 Fall-Reihenfolge `outbox_mark` | erfüllt: `0076:57-63`, `:66-71`; gemessen in `outbox.test.ts:134-163` (Erfolg vor Code, endgültig vor Kontofehler, Kontofehler vor fünftem Versuch) |
| 4 Pause 15 Min. × 4^(Versuche − 1) | erfüllt: `0076:48`; gemessen beidseitig für 0, 1, 2, 4 verbleibende Versuche in `outbox.test.ts:165-181` |
| 5 Deploy direkt nach Push, Zahlen | nicht belegt (M3); die Angaben im Auftrag widersprechen dem Code nicht |
| 6 Firmen mit echter Inhaber-Adresse = 0 | nicht belegt (M3); die Zählung selbst ist richtig gebaut (`outbox-status.mjs:14-16`, zählt jeden Inhaber, also eher zu viel als zu wenig) |
| 7 Skripte | erfüllt: `setup-outbox.mjs:49-62` wählt den Inhaber wie `0076:28-30` und bricht bei wartender echter Adresse ab; `:97-100` bricht bei `paused` über null vor dem Vault ab; `outbox-status.mjs:6` Dev-Schutz als erster Import, Ausgabe nur Zahlen (`:36-39`) |
| 8 Altersgrenze nur als Frage | steht aus (N3), laut Auftrag nach der Abnahme |

## Prüffragen

1. Verhalten statt Existenz: ja. Die rls-Tests lesen Status, Zähler, Code und `claimed_at` nach dem Aufruf, die Fälligkeit beidseitig der Grenze, den gewählten Inhaber gegen einen älteren `staff` und einen jüngeren Inhaber, die Rechte der drei Rollen und den echten Aufruf als `anon` und als Konto (`outbox.test.ts:117-118`, `:130-131`, `:197-202`). Die Unit-Tests prüfen Antwort, Markierungen, gesendete Empfänger und das Log im Wortlaut. Die Form des Auth-Fehlers ist live gemessen (`outbox.test.ts:207-212`). Lücken: N4, N6.
2. Stiller Verlust: keinen gefunden. `no_recipient` und der Verfall enden als `failed` mit Code; Kontofehler bleiben `pending` mit Code; ein Lesefehler der Auth-API wirft und wiederholt (`db.ts:147-150`, gemessen `outbox-db.test.ts:32-42`); ein gescheitertes Markieren fängt die Lease (`0076:49`, `0036:16-17`). Nicht still, aber endgültig ohne Mail: Firma ohne Inhaber-Konto und Kunde ohne Konto (gewollt).
3. Endloses Kreisen: nur unter anhaltendem Kontofehler, mit begrenzter Häufigkeit (ein Aufruf beim Anbieter je Lauf, danach wartet der ganze Lauf; der Cron ruft nur bei fälligen Zeilen, `0075:63`) und ohne zeitliche Grenze (N3).
4. Geheimnisse und Adressen: keine in Logs, Antworten oder Skriptausgaben. Der Kontofehler-Eintrag trägt Status, Kürzel und Anzahl (`handlers.ts:358`), das Kürzel ist an der Quelle auf Kleinbuchstaben und Unterstrich begrenzt (`brevo.ts:19`, `:40`); der Auth-Lesefehler wird zu einem festen Text (`db.ts:149`). Die Tests prüfen das Log auf Adressen (`outbox-handler.test.ts:81`, `:102`, `:118`, `:137`, `:197`). Die Logs des Schritts enthalten nur die Testadressen der Unit-Tests (Log 002). Rest: N1.
5. Mail an Firmen nur an das Inhaber-Konto: ja. `outbox_claim` liefert keine Adresse mehr (`0076:12`, `:26-32`), der Handler liest nur `ownerId` (`handlers.ts:330`), und der Test zeigt, dass für eine Firma nur dieses Konto nachgefragt wird (`outbox-handler.test.ts:162-171`). `contact_email` kommt in `supabase/functions` nur noch in den Typen und in einem Kommentar vor; in `scripts/` und `tests/support/` nur als Merkmal von Testfirmen (Aufräumen), nicht zum Senden.
6. Rechte: `outbox_claim` nach `drop` und `create` mit genau einem Grant an `service_role` (`0076:36`), gemessen (`outbox.test.ts:197-202`, `:117`, `:130`). `outbox_mark` per `create or replace`, Rechte unverändert, `anon` gemessen (`:118`, `:131`); beide stehen in der Liste „nur service_role“ (`tests/rls/rls.test.ts:497`) und im Register (`positiv.ts:458-464`). Keine Ausweitung.
7. Dev-Schutz und Inhaber-Adresse: abgedeckt. Die Prüfung läuft auf der aufgelösten Adresse, also auf der des Inhabers (`handlers.ts:342-349`); gemessen mit Firmen-Zeilen (`outbox-handler.test.ts:190-207`). Die Vorprüfung in `setup-outbox.mjs:49-62` und die Zählung in `outbox-status.mjs:14-16` nutzen dieselben Endungen wie `handlers.ts:276`.
8. Geld (`geld.md`): kein Geldweg berührt. Mailtexte unverändert, ohne Betrag und ohne Gebührenwort (Tests `outbox-handler.test.ts:260`, `:285`, `:296`, `:316`, `:330`).
9. `tests.md`: gezielte Läufe über das Start-Programm, Kopfzeilen ohne Argumente und Schalter (Logs 003, 009). Roter Lauf 3 und grüner Lauf 9 mit der Datei des Endstands. Volläufe stehen aus; M1 und M2 machen `check` nach heutigem Stand rot.
10. DB-Freigabe: M1 dort (Deploy sofort) siehe Auflage 5; N1, N2 dort offen (N2, N3 hier); N3 dort benannt (N10 hier); N4 dort erledigt (`database.types.ts:1890`).

## Bekannte Grenzen aus dem Auftrag
- Kontofehler nicht live ausgelöst: einverstanden. Der Zweig ist an beiden Enden gemessen (Handler mit Stub, Datenbank mit `outbox_mark`); ungemessen bleibt nur die Verbindung dazwischen, die aus einem Aufruf besteht (`db.ts:129-132`).
- `setup-outbox.mjs` läuft in diesem Schritt nicht und braucht eine neue Lösch-Freigabe: einverstanden; die geänderte Vorprüfung ist damit gelesen, aber nie gelaufen. Die Lösch-Freigabe ist eine eigene Prüfung, diese Abnahme ersetzt sie nicht.
- Volläufe nach der Abnahme: siehe M1 und M2. Ändert die Behebung eine der elf Dateien oben, braucht es Runde 2; die zwei Registerzeilen allein ändern keine davon.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `0076:9-36` | `drop`, `create`, ein Grant; Inhaber nur Rolle `owner`, ältester zuerst |
| `0076:47-49` gegen `0075:9-11` | Limit und Lease gleich; Klausel für null Versuche entfernt, Exponent mit Untergrenze |
| `0076:57-77` gegen `0075:43-52` | Fälle in der verlangten Reihenfolge; wirkt nur auf `sending` |
| `handlers.ts:299`, `:353-361` | Kontofehler nur aus dem Versand, Abbruch, Rest mit dem Kontofehler-Code zurück, zählt nicht als `failed` |
| `handlers.ts:329-333` | Firma über `ownerId`, ohne Inhaber `no_recipient` ohne Auth-Aufruf |
| `handlers.ts:342-349` | Dev-Schutz auf der aufgelösten Adresse |
| `handlers.ts:375` | Antwort nur Zähler und Diagnose-Schlüssel |
| `db.ts:125-128`, `:145-152` | `ownerId` aus `owner_id`; nur 404 mit dem Code für „Konto fehlt“ ergibt leer |
| `brevo.ts:39-41` | Kürzel begrenzt; 429 nicht dauerhaft; Fehler ohne Text und Empfänger |
| `outbox-send/index.ts:25-35` | Log nur das Ereignisobjekt; Dev-Schalter aus der Umgebung |
| `outbox-status.mjs:6-39` | Dev-Schutz zuerst; eine Leseabfrage; feste Fehlertexte |
| `setup-outbox.mjs:45-63` | Vorprüfung mit Inhaber-Ausdruck, bricht vor jeder Änderung ab |
| `setup-outbox.mjs:97-103` | Abbruch bei Kontofehler vor dem Vault; Ausgabe ungefiltert (N1) |
| `dev-guard.mjs:7-22` | drei Quellen der Ref, Abbruch bei Abweichung |
| `outbox.test.ts:134-163`, `:165-181`, `:183-203` | messen Wirkung (siehe Prüffrage 1) |
| `en-route.test.ts:142-153` | bestehender Fälligkeits-Test passt zu 0076 (neu und alt ohne `claimed_at` fällig); Lauf 11 grün |
| `outbox-handler.test.ts:125-158`, `:162-186` | Kontofehler, Nicht-Kontofehler, Empfänger, Lesefehler |
| `outbox-db.test.ts:23-48` | echte Fehlerklassen der Auth-Bibliothek, sieben Lesefehler werfen |
| `positiv.ts:458-464` | Spalten mit `owner_id`, ohne `partner_email`; `outbox_mark` unverändert |
| `database.types.ts:1885-1895` | Rückgabe mit `owner_id` |
| `package.json:56` | Skript `outbox` über dotenv-cli wie die Nachbarzeilen |
| `loesch-register.json:15`, `:33`, ganze Datei | `setup-outbox.mjs` registriert; `outbox-status.mjs` fehlt (M1); Pin von `positiv.ts` alt (M2) |
| `runs.jsonl:3`, `:9-11` | rot vor dem Push, grün danach, gleicher `dateiSha`; Push-Marken mit dem Hash der Migration |
| Log 003 `:31-32`, `:46`, `:62` | Ist-Werte des roten Laufs (N5) |
| `config.toml:179`, `:225-227` | anonyme Konten aus, doppelte Bestätigung an, wird nicht gepusht (N7) |
| `docs/BEKS.md:32` | Frage 1 noch offen (M4) |

Offene Findings hoch: 0
