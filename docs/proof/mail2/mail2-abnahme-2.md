Modell: claude-fable-5-2
Vorgaenger: tmp/proof/mail2-abnahme-1.md

# Abnahme 2 (Kontrollrunde), Schritt mail2 (R3, Kennung mail2-1911-a)

Datum: 2026-11-19
Geprüft: nur, was sich seit Runde 1 (Commit 77f10df) geändert hat, und der Stand der Befunde aus Runde 1. Vollständig gelesen: `scripts/sys/loesch-register.json`, `docs/freigaben/mail2-loesch-freigabe-1.md`, `scripts/setup-outbox.mjs`, `scripts/outbox-status.mjs`, `tests/unit/outbox-handler.test.ts`, `docs/BEKS.md`, `tmp/proof/mail2/runs.jsonl`, `tmp/proof/mail2/loesch-lauf.jsonl`, `tmp/proof/mail2/positiv-diff.txt`, `tmp/proof/mail2/outbox-status-vorher.txt`, `tmp/proof/mail2/outbox-status-nachher.txt`, `tmp/proof/mail2-abnahme-1.md`. In Auszügen: `tests/support/positiv.ts:440-473` (dazu Kopf, Importe und Exporte per Suche), `supabase/functions/_shared/jobs/handlers.ts:294-376`, `docs/ENTSCHEIDUNGEN.md:219-221`, `docs/GOLIVE.md:80-84`, `docs/OFFEN.md:55-63`, `docs/STAND.md:5-12`, `supabase/config.toml:220-231`, Logs 014 bis 017 (Kopf, Ergebniszeilen, Fehlerstelle), `tmp/proof/mail2/loesch-freigabe-1.md` (Kopfzeilen), `tests/unit/sys-gate-loesch.test.ts:119-134`, `scripts/sys/gate-loesch.mjs`, `scripts/sys/gate-loesch-lib.mjs`, `scripts/sys/gate-db-lib.mjs:33-66`, `scripts/sys/fertig.mjs:14-99`, `:180-216`, `scripts/scan-proof.mjs`.

SHA256: 293f39c1cb7b430a78825f39057286fa4aba81fc851daa0d9faf6cfadee1f049 supabase/functions/_shared/database.types.ts
SHA256: cac96b3f81227961e300102422ff063ab03caacc00a1c984e6178fef83831495 supabase/functions/_shared/jobs/db.ts
SHA256: 97422e76440367c51a3beb1211a6680a35929afeaa265ef6a8338926347c89c4 supabase/functions/_shared/jobs/handlers.ts
SHA256: 613028ec9712c1ba48f9dd148adeacfe42353154d5a64d240917db5c3c5457eb tests/support/positiv.ts
SHA256: 1f3b8e43b36712c9f8b77f99d64328199b27f620701d4e98e52e1219870aa2d8 package.json
SHA256: 34dc3398c621003ed128371570e7b2382ef69881e44026f54b69e939c7929dbd scripts/sys/loesch-register.json
SHA256: d5e11ece971c9ad5ee71e1de2fbfe8dad8190068506cf569c39a139e02deaa30 docs/freigaben/mail2-loesch-freigabe-1.md
SHA256: 02f20d6be94bc750a82252e27cc41b71ee5ae55980836c9679d383220fbbcc67 supabase/migrations/20261119031957_0076_mail2_konto_empfaenger.sql
SHA256: ca720d3c712a2c6345d3d45819f60206221b9fab98b39e21019e9e3ef66d5aff scripts/outbox-status.mjs
SHA256: 650268a3837237896ed12c70626afd4cf34a428db298daa7c537189e05911293 scripts/setup-outbox.mjs
SHA256: 71ac6a180a7ec881a6419f45c74da22d1bcee5ade4fd9300caac8a4309566244 tests/rls/outbox.test.ts
SHA256: a5daf197b623153700456f186c9c8f240370b404ff9c19c30ded071d49391651 tests/unit/outbox-handler.test.ts
SHA256: 13660b43752b8956bcca10dc614caee7a3a7ad576d88b6a649d424deb5958927 tests/unit/outbox-db.test.ts

Zu den Hashes: Alle dreizehn sind aus dem Auftrag abgeschrieben, keinen konnte ich selbst nachrechnen (kein Werkzeug dafür). Gegen andere Quellen abgeglichen sind fünf:
- `tests/support/positiv.ts` und `scripts/outbox-status.mjs`: gleich den Pins im Register (`loesch-register.json:34`, `:26`); der Test `sys-gate-loesch.test.ts:129-133` rechnet jeden Pin gegen die Datei und lief im Volllauf `check` auf 8d51473 grün (`014-check.log:165`, `:389`).
- Migration 0076: gleich den Push-Marken (`runs.jsonl:9-10`).
- `tests/rls/outbox.test.ts`: gleich dem `dateiSha` des roten und des grünen Laufs (`runs.jsonl:3`, `:11`).
- `scripts/setup-outbox.mjs`: gleich Zeile 2 der Lösch-Freigabe; bei der Übernahme rechnet das Gate den Hash aus der Datei (`gate-loesch.mjs:31`, `gate-loesch-lib.mjs:32-34`).
Die übrigen acht vergleicht erst das Gate (`fertig.mjs:211`). Gegenüber Runde 1 haben sich zwei Hashes geändert (`setup-outbox.mjs`, `outbox-handler.test.ts`), zwei Dateien sind neu in der Liste (Register, Lösch-Freigabe), neun sind gleich.

Nicht ausgeführt und nicht selbst belegt:
- Kein `git`, kein Test, keine Abfrage. Was die Commits da52c6d, 8d51473 und 6a34845 genau geändert haben, kenne ich nur aus Auftrag und Lektüre des Endstands. Ob die Liste der Pflichtdateien vollständig ist, prüft das Gate selbst (`fertig.mjs:212`).
- Die neun Dateien mit unverändertem Hash habe ich nicht erneut gelesen (Ausnahme: die oben genannten Auszüge).
- Die Volläufe liefen auf 8d51473; der Auftragskontext nennt danach noch einen Commit mit Doku. Das Gate zählt die Läufe über den Fingerabdruck der Suite-Dateien (`fertig.mjs:33`), nicht über den Commit; dass der letzte Commit nur Doku berührt, habe ich nicht gesehen.
- Die Bewertung des Berichts (`npm run bericht`) gibt es noch nicht; Punkte, die dort stehen sollen (N12, N14), kann ich nicht abhaken.
- Den Prompt des Schritts sehe ich weiterhin nicht (siehe M4 unten).

## Findings

### Hoch
Keine. Aus Runde 1 war kein hoher Fund offen.

### Mittel
- M5 (neu) · `docs/GOLIVE.md:84` gegen `:50-51` – Die Zeile 48 hat zehn Zellen in einer Tabelle mit vier Spalten (die Unterpunkte (b) bis (e) sind mit eigenen „Wer“- und „Prüfweg“-Zellen in dieselbe Zeile geschrieben). In gerenderter Ansicht fällt alles ab der fünften Zelle weg: Zuständigkeit und Prüfweg von (b) sowie (c) Kontingent, (d) Betreiber-Sicht für Produktion (N9 aus Runde 1) und (e) Cron erst nach dem Deploy der Function vollständig. Im Rohtext steht alles. GOLIVE 48 ist Pflicht vor `booking_open` (`docs/STAND.md:12`); drei Pflichtpunkte, die nur im Rohtext sichtbar sind, gehen leicht verloren. – Fix: je Unterpunkt eine eigene Zeile (48a bis 48e) mit vier Zellen. `docs/GOLIVE.md` gehört nicht zur Pflichtmenge, die Korrektur braucht keine weitere Runde.

### Niedrig
- N11 (neu) · `docs/GOLIVE.md:82` – Die Prüfzeile zu N7 nennt als Einstellung die doppelte Bestätigung (alte und neue Adresse, lokal `supabase/config.toml:223-225`). Für N7 zählt, dass die neue Adresse bestätigt ist, bevor sie Anmeldeadresse wird. Ob dafür im gehosteten Projekt auch die Einstellung zur Bestätigung von Adressen eine Rolle spielt (lokal aus, `config.toml:226-227`), weiß ich nicht sicher. Der Prüfweg „Einstellung gelesen“ misst das Verhalten nicht. – Fix: Prüfweg als Messung fassen: im Produktivprojekt die Adresse eines Testkontos ändern, ohne zu bestätigen; das Konto trägt weiter die alte Adresse. Beide Einstellungen im Bericht nennen.
- N12 (neu) · `tmp/proof/mail2/positiv-diff.txt:1-7` – Die Datei nennt sich wörtliche Ausgabe, ist aber gekürzt (kein Diff-Kopf, keine Kontextzeilen). Inhalt und Lage passen zur Datei (`tests/support/positiv.ts:460`, Einträge `:458-464` wie in Runde 1 gelesen); die Zeilennummern vor der Änderung stimmen mit dem Plan überein (`tmp/proof/mail2-plan.md:12`). Dass sonst keine Zeile geändert ist, kann ich ohne `git` nicht selbst belegen. Maschinell belegt ist der Pin (Lauf 14). Der Ausnahmegrund trägt für das, was ich gelesen habe: die Datei importiert nur Typen und Test-Fixtures und exportiert Daten und SQL-Text (`positiv.ts:6-7`, `:64-192`). – Fix: in der Bewertung „gekürzt“ statt „wörtlich“ schreiben. Die Datei selbst nicht ändern (Nachweise bleiben unverändert).
- N13 (neu) · `tmp/proof/mail2/outbox-status-vorher.txt:1`, `outbox-status-nachher.txt:1` – Beide Dateien sind von Hand übertragen (der Guard sperrt die Umleitung), also kein maschineller Nachweis. Die Zahlen sind in sich stimmig (Kunde wartend 205 = 10 endgültig + 195 wartend, `vorher.txt:3`, `:15-16`). Zwei Ungenauigkeiten ohne Folge: (a) `vorher.txt:13` nennt für den Push 04:28:59, die Marken liegen bei 04:29:06 und 04:29:18 Ortszeit (`runs.jsonl:9-10`); das Fenster war also höchstens 19 Sekunden, „rund 26“ ist eine Obergrenze. (b) `nachher.txt:15` nennt die 38 und 35 wartenden Zeilen „Altzeilen“; die älteste wartende Zeile ist aber nur 234 Minuten alt (`nachher.txt:12`, vorher 2597), der alte Bestand ist also schon vollständig endgültig, es warten nur Zeilen aus den Stunden vor dem Push. – Kein Fix. OFFEN mail2-1 (g) schließen, sobald `npm run outbox` keine wartende Zeile ohne Empfänger mehr zeigt.
- N14 (neu) · `docs/OFFEN.md:59` – N5 aus Runde 1 (der rote Lauf 3 zeigt für „ohne Empfänger endgültig“ keinen Ist-Wert) steht anders als im Auftrag genannt nicht in OFFEN mail2-1. Er verlangt keinen Eintrag, nur eine Formulierung: in der Bewertung Lauf 3 nicht als Rot-Beweis für diesen Punkt führen. – Fix: beim Schreiben der Bewertung beachten.
- N15 (neu) · `docs/OFFEN.md:58` gegen `docs/freigaben/mail2-loesch-freigabe-1.md:40`, `:77` – mail1-1 führt die Bindung der Function-Dateien im Register weiter als offen; die Lösch-Freigabe hat das entschieden (nicht binden, Prüfung je Lauf). Der zweite Teil dort (Exit der CLI) steht jetzt doppelt (mail1-1 und mail2-1 a). – Fix beim nächsten Anfassen von OFFEN: Halbsatz streichen.

## Stand der Befunde aus Runde 1

| Nr. | Stand | Beleg |
|---|---|---|
| M1 Register-Eintrag `outbox-status.mjs` | behoben | `loesch-register.json:26` unter „ausgenommen“; der Grund passt zum Skript (39 Zeilen erneut gelesen: eine Leseabfrage `:10-16`, Ausgabe nur Zähler `:36-39`, Dev-Schutz als erster Import `:6`); Hash wie im Auftrag; Test grün in Lauf 13 und im Volllauf 14 (`014-check.log:165`) |
| M2 Pin `positiv.ts` | behoben | `loesch-register.json:34` trägt den Hash des Endstands; Volllauf 14 grün; zum Diff siehe N12 |
| M3 Ausgaben von `npm run outbox` | behoben | drei Stände als Datei: vorher, direkt nach Push und Deploy, nach den Volläufen; Firmen mit echter Inhaber-Adresse 0 in allen drei (`vorher.txt:11`, `:24`, `nachher.txt:13`), pausierte Zeilen 0; keine Firmenzeile im Fenster endgültig geworden (`vorher.txt:7`, `:20`); der verlangte Satz zu den wartenden Zeilen steht in `nachher.txt:15`; Güte des Nachweises siehe N13 |
| M4 Beks-Wort | behoben nach Aktenlage | Wortlaut, Datum und Schritt in `docs/ENTSCHEIDUNGEN.md:221`; Frage als beantwortet in `docs/BEKS.md:31`; die zwei Teilfragen (welche Adresse, welches Mitglied) deckt der zitierte Satz. Den Prompt sehe ich nicht, im Plan steht der Satz nicht wörtlich; die Echtheit des Zitats bestätigt nur Beks, der Eintrag liegt ihm mit dem Merge vor |
| N1 Filter der Diagnoseschlüssel | behoben | `setup-outbox.mjs:98`: nur Schlüssel aus drei Ziffern, Doppelpunkt und höchstens 40 Kleinbuchstaben, Unterstrichen oder Bindestrichen; sonst „ohne Kürzel“. Rest (Rohwert der Anzahl) in OFFEN mail2-1 (a) |
| N2 leeres `p_ok` | offen, eingetragen | `docs/OFFEN.md:59` (b) |
| N3 Altersgrenze, eine Mail hält den Lauf auf | offen, eingetragen | Frage in `docs/BEKS.md:34` (Auflage 8 erfüllt: nur als Frage), `docs/OFFEN.md:59` (c), `docs/GOLIVE.md:84` (b) |
| N4 Unit-Fall Markierfehler | behoben | `outbox-handler.test.ts:146-160` misst Antwort 200, vier Markierversuche, Log-Reihenfolge und kein Adress-Text; passt zu `handlers.ts:317-323`, `:356-360`; Lauf 12 (27 bestanden) und Volllauf 14 |
| N5 roter Lauf ohne Ist-Wert | nur Formulierung | siehe N14 |
| N6 Titel, Reihenfolge zweier Inhaber | offen, eingetragen | `docs/OFFEN.md:59` (d) |
| N7 Adressänderung erst nach Bestätigung | eingetragen | `docs/GOLIVE.md:82`; siehe N11 |
| N8 Typ von `owner_id` | offen, eingetragen | `docs/OFFEN.md:59` (e) |
| N9 Betreiber-Sicht für Produktion | eingetragen | `docs/GOLIVE.md:84` (d); in gerenderter Ansicht unsichtbar (M5) |
| N10 Abweichungen vom Plantext | benannt | `docs/ENTSCHEIDUNGEN.md:221` nennt 402 und die Pause nach verbleibenden Versuchen |

## Prüffragen des Auftrags

1. Änderungen seit Runde 1: An Code geändert sind eine Zeile in `scripts/setup-outbox.mjs` (`:98`, Filter; alle übrigen Zeilenlagen wie in Runde 1 und wie in der Lösch-Freigabe genannt) und ein neuer Unit-Fall (`outbox-handler.test.ts:146-160`). Beide ohne Wirkung auf Rechte, Schema oder Versandweg. Keine Rechte-Ausweitung, kein Geheimnis, keine Adresse in Ausgabe oder Log. Geld ist nicht berührt.
2. Lösch-Freigabe `docs/freigaben/mail2-loesch-freigabe-1.md`: Format in Ordnung. Genau eine Modell-Zeile (`:1`), eine Hash-Zeile (`:2`), eine Urteilszeile mit „frei“ (`:3`), eine Schlusszeile mit null hohen Funden (`:129`). Die Hash-Zeile ist zeichengleich mit dem Hash des Auftrags für `scripts/setup-outbox.mjs`. Das Original unter `tmp/proof/mail2/` trägt dieselben vier Zeilen an denselben Stellen; die Übernahme kopiert ohne Überschreiben (`gate-loesch.mjs:35`). Die heutige Datei passt zeilengenau zu den Stellen, die die Freigabe nennt (`:11`, `:16-19`, `:45-63`, `:96-100`, `:123`). Das Skript lief in diesem Schritt nicht: `loesch-lauf.jsonl` enthält 46 Zeilen, nur `sweep.ts` und `race-copy.ts` aus den Läufen 16 und 17. Die acht Auflagen der Freigabe gelten für einen späteren Lauf weiter; `docs/STAND.md:23` und OFFEN mail2-1 (a) verweisen darauf. Der mittlere Fund der Freigabe (Vorprüfung hängt am Exit der CLI) bleibt offen und ist eingetragen.
3. Volläufe (alle auf 8d51473, Arbeitsbaum sauber, ohne Argumente und Schalter, Logs 014 bis 017 Zeilen 1-5):
   - `check`, Lauf 14: 74 Dateien, 2135 Tests, EXIT 0, 48,3 s (`014-check.log:380-381`, `:388-389`).
   - `e2e`, Lauf 15: 723 bestanden, 1 übersprungen, EXIT 0, 689,2 s (`015-e2e.log:745-750`). Der übersprungene Test ist der bewusst stillgelegte Rot-Beweis in `backend.spec.ts` (`015-e2e.log:85`), kein Test dieses Schritts.
   - `rls`, Lauf 16: rot, 1 von 407. Die Fehlerstelle ist ein Transportfehler der Verwaltungs-API beim Eigentümer-SQL einer Rollback-Probe (`016-rls.log:552-562`, `tests/support/owner.ts:35`, `partner-my-jobs.test.ts:210`), kein Ist-Wert einer Prüfung. Die Outbox-Tests dieses Schritts sind in diesem Lauf grün (`016-rls.log:216-226`). Einverstanden: kein Befund am Code des Schritts.
   - `rls`, Lauf 17: 53 Dateien, 407 Tests, EXIT 0, 1315,7 s (`017-rls.log:553-554`, `:561-562`). Gleicher Commit und gleicher Fingerabdruck wie Lauf 16 (`runs.jsonl:18-19`), also unverändert wiederholt; Start nach dem letzten Push (`runs.jsonl:10`, `:19`). Die Laufzeit liegt über der Grenze von 1200 s; das steht in `docs/OFFEN.md:62` und `docs/STAND.md:10`. Der Transportfehler ist der zweite dieser Art in zwei Schritten (mail1 Lauf 044); auch das steht dort.
4. Bekannte Grenzen: Kontofehler von Brevo nie live ausgelöst (belegt durch Unit-Tests und rls-Tests, eingetragen in OFFEN mail2-1 (f) und `docs/STAND.md:11`) und `setup-outbox.mjs` nicht gelaufen: wie in Runde 1 einverstanden.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `scripts/sys/loesch-register.json:26` | Eintrag mit Grund und Hash, Grund passt zum Skript (M1 behoben) |
| `scripts/sys/loesch-register.json:34`, `:35` | Pin von `positiv.ts` auf dem Endstand; Pin von `positiv.test.ts` gleich `dateiSha` in `runs.jsonl:12` |
| `scripts/sys/loesch-register.json:15` | `setup-outbox.mjs` weiter ohne gebundene Dateien (so entschieden in der Lösch-Freigabe) |
| `tests/unit/sys-gate-loesch.test.ts:122-124`, `:129-133` | Vollständigkeit und Pins werden gegen die Dateien gerechnet |
| `tmp/proof/mail2/014-check.log:1-5`, `:165`, `:380-381`, `:389` | 8d51473, sauber, Register-Test grün, EXIT 0 |
| `tmp/proof/mail2/runs.jsonl:14-15` | Läufe 12 und 13 auf 77f10df, nicht sauber (gezielte Läufe vor dem Commit) |
| `tmp/proof/mail2/runs.jsonl:16-19` | vier Volläufe auf 8d51473, sauber; 16 und 17 mit gleichem Fingerabdruck |
| `tmp/proof/mail2/016-rls.log:552-562` | Transportfehler in `ownerSql`, keine fehlgeschlagene Erwartung |
| `tmp/proof/mail2/017-rls.log:553-554`, `:562` | 53 Dateien, 407 Tests, EXIT 0 |
| `tmp/proof/mail2/015-e2e.log:85`, `:745-750` | ein bewusst übersprungener Test, 723 bestanden |
| `tmp/proof/mail2/loesch-lauf.jsonl:1-46` | kein Lauf von `setup-outbox.mjs` |
| `scripts/setup-outbox.mjs:96-103` | Filter vor der Ausgabe (N1 behoben); Anzahl weiter als Rohwert (eingetragen) |
| `scripts/setup-outbox.mjs:11`, `:45-63`, `:119-124` | Dev-Schutz zuerst, Vorprüfung vor jeder Änderung, Vault zuletzt: unverändert |
| `tests/unit/outbox-handler.test.ts:146-160` | neuer Fall misst Verhalten (N4 behoben) |
| `supabase/functions/_shared/jobs/handlers.ts:317-323`, `:353-361`, `:375` | Markierfehler wird geloggt und geschluckt, Abbruch bei Kontofehler, Antwort mit Zählern: wie in Runde 1 |
| `tests/support/positiv.ts:458-464` | Spalten mit `owner_id`, ohne die alte Adress-Spalte; `outbox_mark` unverändert |
| `tmp/proof/mail2/positiv-diff.txt:5-7` | passt zu `positiv.ts:460`; gekürzt (N12) |
| `tmp/proof/mail2/outbox-status-vorher.txt:3-11`, `:15-24` | Zahlen stimmig, Firmen mit echter Adresse 0 |
| `tmp/proof/mail2/outbox-status-nachher.txt:3-13` | nur noch Zeilen ohne Empfänger warten, älteste 234 Minuten (N13) |
| `docs/freigaben/mail2-loesch-freigabe-1.md:1-3`, `:129` | Format und Hash in Ordnung |
| `scripts/sys/gate-db-lib.mjs:39-51` | Format der Berichte: je eine Urteils- und Schlusszeile, Hash-Zeilen verankert |
| `scripts/sys/fertig.mjs:16`, `:211-212` | Pflichtmenge und Hash-Vergleich macht das Gate |
| `docs/ENTSCHEIDUNGEN.md:221` | Nr. 214 mit Wortlaut, Datum, Schritt; nennt 402 und die Pausenformel |
| `docs/BEKS.md:31`, `:34` | alte Frage beantwortet; neue Frage 1 zur Altersgrenze |
| `docs/OFFEN.md:59` | mail2-1 (a) bis (g) vorhanden; N5 fehlt (N14) |
| `docs/GOLIVE.md:82` | Prüfzeile zur Adressänderung (N11) |
| `docs/GOLIVE.md:84` gegen `:50-51` | zehn Zellen in vier Spalten (M5) |
| `supabase/config.toml:223-227` | doppelte Bestätigung an, Bestätigung von Adressen aus; nur lokal |
| `docs/STAND.md:9-11`, `:23` | Zahlen wie in den Logs; Hinweis auf Auflagen der Lösch-Freigabe |

Offene Findings hoch: 0
