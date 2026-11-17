Modell: claude-fable-5-2
SHA256: af6fb4f46ccf87ebcf9ba5738b614bf091896361934be1ecfe2ad2a86352069a scripts/dev-testdaten-zuruecksetzen.mjs
SHA256: 1f72a00bbc085ae8af2ac4b7b609b6686e00b7b141ba0f20aee9733b98a6593a tests/support/marker.ts
Urteil: frei
Vorgaenger: tmp/proof/dev1/loesch-freigabe-1.md

# Lösch-Freigabe 2, Schritt dev1 (R3)

Datum: 2026-11-17
Geprüft (vollständig neu gelesen): scripts/dev-testdaten-zuruecksetzen.mjs (141 Zeilen, Commit 0c0b639), tests/support/marker.ts (11 Zeilen, unverändert), tests/unit/dev-reset.test.ts (61 Zeilen).
Zur Einordnung gelesen: Vorgängerbericht, Regeln geld.md und daten.md, tests/support/owner.ts, tests/support/sweep.ts, scripts/dev-guard.mjs, scripts/sys/gate-loesch.mjs, gate-loesch-lib.mjs, gate-db-lib.mjs, loesch-register.json, run.mjs (Stellen zur Sperre), lib.mjs (Nachweisordner), scripts/scan-proof.mjs, Migrationen 0001, 0017, 0018, 0020, 0028, 0030, 0035, 0038, 0040, 0046, 0052 (Stellen aus der Stichprobenliste), Suchen über alle Migrationen (Fremdschlüssel, Löschtrigger, erzwungener Zeilenschutz, Rollenvergabe), tmp/proof/dev1/runs.jsonl, Log 005, loesch-lauf.jsonl.

Hinweise zum Nachweis:
- Die Hash-Zeilen oben sind unverändert aus dem Auftrag übernommen, nicht nachgerechnet (kein Shell-Werkzeug). Das Gate vergleicht sie beim Start mit dem Commit.
- Ich konnte nichts ausführen. Aussagen zur Syntax stützen sich auf Lektüre, Aussagen zum Verhalten der Datenbank auf die Migrationsdateien und auf meine Kenntnis von PostgreSQL. Ob die Kaskade ohne Umweg durchläuft, belegt erst die Probe; sie rollt zurück.
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.

## Ergebnis in einem Satz

H1 ist behoben (im Replica-Fenster steht genau eine verändernde Anweisung), M1, M2, N1, N2, N5 und N6 sind umgesetzt, Syntax und Logik halte ich für gültig; frei für den Weg Probe, dann Löschen, mit den Auflagen für den Lauf unten.

## Stand der Funde aus Runde 1

| Fund | Stand | Beleg |
|---|---|---|
| H1 zweite Anweisung im Fenster | behoben | Fenster `:72-75` enthält nur das Löschen im Journal und die Zeilenzählung; Variable `w` fehlt in `:54`; Prüfung `:77` mit zwei Platzhaltern und zwei Argumenten; Kopfkommentar `:5-6` ohne Halbsatz zu den Kopien; `kopien` nur noch Zählung (`:60`, `:100`) |
| M1 Sicherung | behoben | seitenweise je 300 nach `id` (`:113-117`, `id` ist Primärschlüssel, `0028:12`), in beiden Modi (`:107-120`), Abbruch vor der Transaktion bei Abweichung (`:121-124` vor `:129`) |
| M2 Test | behoben, Rest niedrig | zehn Tests, Lauf 5 auf 0c0b639, sauber, EXIT=0 (`runs.jsonl:4`, Log 005); Lücken siehe N7 |
| N1 Sperre nur `pid` | behoben | `:25` prüft `pid` und `kind`, passend zu `run.mjs:133` |
| N2 Kontrolle nur bei Erfolg | behoben | `:126-134` Kontrolle auch nach Fehler, `:141` Exit 1 ohne genau zehn Zahlen oder ohne zwei aktive Trigger |
| N3 TypeScript-Import unter Node | offen, kein Fix | unverändert; scheitert es, dann beim Laden vor jeder Datenbank-Aktion, die Probe zeigt es |
| N4 Dauer und unbekannter Ausgang | Auflage für den Lauf | siehe unten |
| N5 Start nur über das Gate | behoben | `:19-22`, Kennung setzt `gate-loesch.mjs:66` |
| N6 Testlauf nicht auf dem Commit | behoben | `runs.jsonl:4` |

## Findings hoch

Keine.

## Findings mittel

Keine.

## Findings niedrig

N7. `tests/unit/dev-reset.test.ts:29`, `:36-42`, `:49-54` – Restlücken des Tests: (a) das Muster für Anweisungen im Fenster erfasst nur Tabellen im Schema `public` am Zeilenanfang, eine Anweisung auf ein anderes Schema im Fenster fiele nicht auf; (b) die Abbruchbedingungen werden über das erste Vorkommen des Texts geprüft, für die Zahlenprüfung ist das die Definition in `:43` des Skripts, nicht die Einsetzung in `:61`; (c) Seitengröße, Sortierung und der Umfang der Sicherung (nur Konto-ID und E-Mail, Anfrage-IDs, Journal) sowie die Stellung des Abbruchs `:121-124` vor dem Hauptaufruf sind nicht festgehalten. Fix: Muster auf beliebige Schemata weiten, Stellung der Einsetzung `erwartung` und des Sicherungsabbruchs prüfen, die drei Abfragen der Sicherung als Text festhalten. Ändert den Hash der geprüften Dateien nicht; kein Hindernis für den Lauf.

N8. `scripts/dev-testdaten-zuruecksetzen.mjs:133-140` – Zwei Schwächen der Meldungen, beide ohne Wirkung auf die Daten: (a) wirft nach einem Fehler des Hauptaufrufs auch die Kontrollabfrage `:133`, geht die ursprüngliche Fehlermeldung verloren (Exit bleibt ungleich 0); (b) `:140` meldet das Schlusswort auch dann, wenn `:141` gleich darauf mit Exit 1 endet. Maßgeblich ist der Exit-Code im Lauf-Log. Kein Fix nötig; falls die Datei aus anderem Grund einen neuen Hash bekommt, mitnehmen (Fehler vor der Kontrolle ausgeben, Schlusswort nur bei zehn Zahlen und zwei Triggern).

N9. `scripts/dev-testdaten-zuruecksetzen.mjs:64` – Die Tests vergeben an Testkonten auch andere Rollen als `customer` (`tests/rls/status.test.ts:25-26`, `tests/rls/rls.test.ts:100-102`). Liegt so ein Konto als Rest auf Dev, bricht schon die Probe mit der Meldung zur Rolle ab. Das ist gewollt (nichts gelöscht). Dann anhalten und berichten; die Bedingung nicht ohne neue Runde lockern.

N10. `scripts/dev-testdaten-zuruecksetzen.mjs:113-118` – Die Seiten der Sicherung und die Transaktion sind getrennte Aufrufe ohne gemeinsamen Schnappschuss. Abgedeckt durch die Sperrprüfung `:25`, die 15-Minuten-Bedingung `:68-69`, den Vergleich `:121` und die Zahlenprüfung `:61`. Im Modus `probe` vergleicht das Skript die Sicherung nicht selbst mit den Zahlen: siehe Auflage 2. Kein Fix.

## Auflagen für den Lauf

1. Zuerst die Probe. Scheitert sie mit 23503 am Fremdschlüssel von `copied_from_revision_id` (oder an einem anderen Fremdschlüssel der Kaskade): nichts weiter starten, Log nennen, Runde 3. Läuft sie mit `kopien` größer 0 durch, ist das der Beleg, dass die Kaskade die Kopien ohne Umweg löscht.
2. Die Probe zählt nur mit EXIT=0, `appendOnlyAktiv=2`, zehn weiteren Zahlen und Dauer höchstens 60 s (Feld `sek` in `loesch-lauf.jsonl`). Die Zeile `Sicherung:` der Probe muss dieselben drei Zahlen nennen wie `nutzer`, `anfragen`, `journal`. Weichen die Zahlen grob von der Erwartung des Plans ab (Plan F2), anhalten und berichten.
3. Löschen nur mit den fünf Zahlen dieser Probe, unverändert, ohne Testlauf dazwischen. Bricht das Löschen an der Zahlenprüfung oder am Sicherungsvergleich ab: neue Probe, nicht die Zahlen von Hand anpassen, ohne die Abweichung zu berichten.
4. Endet ein Lauf im Modus `loeschen` ohne klares Ergebnis (Abbruch der CLI oder der Verbindung): vor jedem weiteren Schritt eine Probe starten und deren Zahlen berichten.
5. Die Sicherungsdateien bleiben lokal unter `tmp/dev1-sicherung/` (nicht nach `tmp/proof/`, nicht in einen Commit).
6. Nach dem Löschen eine Probe als Gegenprobe: `nutzer`, `anfragen`, `journal`, `firmen` müssen 0 sein, die Zahlen `bleibt_*` gleich denen des Löschlaufs.

## Antworten auf die Prüffragen

**Syntax des Template-Literals?** Nach Lektüre gültig. Das Literal reicht von `:46` bis `:105` und enthält keinen Backtick und keinen Backslash. Einsetzungen: `NUTZER` (`:48`, `:94`), `FIRMEN` (`:50`, `:95`), `F8` (`:54`, `:98`), `erwartung` (`:61`), `COVER_FIRM` (`:63`), Schlusswort (`:105`). Der Begrenzer des Blocks (`:52`, `:103`) ist keine Einsetzung. Der Marker endet mit einem Dollarzeichen vor dem Hochkomma; im Block beendet nur der volle Begrenzer den Text, dasselbe Muster läuft in `sweep.ts:19` und `:59-90`. Die Tabellenanlagen `:48-51` haben die Klauseln in gültiger Reihenfolge. `erwartung` (`:43`): Zeilenvergleich mit fünf Werten gegen fünf Ziffernfolgen (nur Ziffern, `:15`), fünf Platzhalter, fünf Argumente; im Modus `probe` leer. Der SQL-Text bleibt nach meiner Schätzung (rund 7000 bis 8000 Zeichen) unter der Grenze von 12000 Zeichen (`owner.ts:13`) und enthält keine doppelten Anführungszeichen. Die drei Abfragen der Sicherung (`:111`, `:114`, `:118`) sind eigenständig gültig: `FIRMEN` und die temporären Tabellen kommen dort nicht vor, die Aliasse `c`, `s`, `u`, `p` überschneiden sich nicht.

**plpgsql?** In Ordnung.
- Deklaration `:54`: neun Variablen (`n_u`, `n_r`, `n_j`, `n_f`, `n_c`, `v`, `f`, `f8`, `grenze`); keine trägt den Namen einer unqualifiziert benutzten Spalte (`id`, `request_id`, `partner_id`, `user_id`, `name`, `role`, `created_at`, `bucket_id`, `reverses_entry_id`, `copied_from_revision_id`, `k`, `n`, Aliasse `t`, `c`).
- Zählungen `:56-60` vor jeder Änderung, Zahlenprüfung `:61` direkt danach, acht weitere Abbruchbedingungen `:62-70`, alle vor dem Fenster.
- Platzhalter und Argumente aller Ausnahmen stimmen (`:43` fünf, `:62` zwei, `:77` zwei, `:82` zwei, sonst keine Platzhalter; die Prozentzeichen der LIKE-Muster stehen nicht in Meldungen).
- Fenster `:72-75`: Einstellung nur für die Transaktion, eine Löschanweisung, Zeilenzählung direkt dahinter, Rücksetzen, Prüfung der Einstellung `:76`, Zählprüfung `:77`, Prüfung auf Gegenbuchungen ohne Ursprung `:78`, alles vor Phase B (`:80`). Im Fenster entfällt auch die Prüfung des Selbstverweises im Journal (`0028:17`); dafür stehen `:67` (vorher) und `:78` (nachher). Auf das Journal verweist sonst nichts (Suche über alle Migrationen).
- Phase B `:80-82`: eine Anweisung für alle Testkonten mit allen Triggern. Die Wächter der Kette lassen das Löschen nur als Kaskade zu (`immutable_row`, Tiefe größer 1, `0017:142`), und zwar auf Anfrage (`0018:127-128`), Revision (`0040:141-142`), Statusereignissen (`0017:165-166`), Fotos (`0020:70-71`), Zuordnungen (`0030:81-82`), Belegen (`0035:58-59`) und Angeboten (`0038:53-54`). Meine Einschätzung aus Runde 1 zur Reihenfolge der Prüfungen (die Kopien sind gelöscht, bevor die Prüfung von `copied_from_revision_id` läuft) bleibt; belegt wird sie durch die Probe.
- Phase C `:84-92` wie `sweep.ts:70-76`; eine noch gebundene Firma lässt die Anweisung an RESTRICT scheitern (`0023:41-63`, `0028:13`, `0030:57`, `0035:20`, `0038:20`) und rollt alles zurück.
- Endprüfungen `:94-98` vor der Rückgabe `:100-102` und vor dem Schlusswort `:105`. Die Rückgabe hat zehn Zeilen mit eindeutigen Schlüsseln, passend zu `:141` und zum Zahlenformat des Gates (`gate-loesch.mjs:77`).
- Erzwungenen Zeilenschutz gibt es in keiner Migration (Suche); löschte das Fenster trotzdem null Zeilen, schlägt `:77` an.

**Die Änderungen im Einzelnen?**
- H1: umgesetzt wie verlangt, siehe Tabelle.
- M1: Die Sicherung nutzt dieselbe Definition wie die Transaktion (Nutzer `:31-32`, Anfragen über `customer_id`, Journal über `request_id`). Eine Seite mit 300 Journalzeilen liegt nach meiner Schätzung bei 200 bis 300 KB und damit unter der Puffergrenze von 1 MiB (`owner.ts:24-27`, keine eigene Grenze gesetzt); nicht gemessen, die Probe misst es. Eine abgeschnittene Ausgabe wirft beim Parsen (`owner.ts:34`), vor der Transaktion.
- N2: Der JavaScript-Fang `:128-132` hält nur den Fehler fest, damit die Kontrolle läuft; danach Exit 1 (`:135-138`). Im SQL gibt es weiter keinen Ausnahmeblock.
- N5 und N1: Reihenfolge Argumente (`:15`), Gate-Kennung (`:19`), Sperre (`:25`), alles vor dem ersten Datenbankaufruf (`:114`).

**Hält der Test die Auflagen fest?** Im Wesentlichen ja (zehn Prüfungen, darunter Fenster mit genau einer Anweisung, Live-Muster, Abbruchbedingungen vor dem Fenster, eine Transaktion und ein Aufruf, Schlusswort, Sicherung, Start-Kontrollen). Restlücken N7.

**Geld und Sicherheit sonst?** Kein Betrag wird gerechnet oder geändert. Das Journal echter Firmen ist durch `:66`, `:67`, `:78` und die RESTRICT-Schlüssel geschützt; `audit_log` wird nicht berührt (kein Fremdschlüssel auf Konten, Suche; Zahl `bleibt_audit` zur Kontrolle). Keine Secrets in Ausgabe oder Sicherung (Test-Adressen, IDs, Journal der Testanfragen, lokal unter `tmp/`, `.gitignore:14`). Keine Rechteänderung, keine Änderung an Triggern oder Katalog. Der Dev-Guard ist der erste Import (`:8`), das Gate lädt ihn zusätzlich (`gate-loesch.mjs:62`). Die Argumente gehen nur als Ziffernfolgen in den SQL-Text (`:15`, `:43`). Die Live-Konten sind auf den Zusatz `up` begrenzt (`:31`); die anderen Live-Skripte nutzen andere Zusätze (`scripts/live-test.mjs:49`, `live-quote-app.mjs:25`, `live-auth.mjs:18`) und bleiben unberührt.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/dev-testdaten-zuruecksetzen.mjs:8` | Guard ist der erste Import: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:15` | nur `probe` ohne Zahlen oder `loeschen` mit fünf Ziffernfolgen: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:19-22` | Abbruch ohne Gate-Kennung: N5 behoben |
| `scripts/dev-testdaten-zuruecksetzen.mjs:23-28` | Sperre mit `pid` und `kind`, Pfad passt zu `lib.mjs:9-10`: N1 behoben |
| `scripts/dev-testdaten-zuruecksetzen.mjs:31-32` | drei Nutzerzweige, Live-Konten mit Zusatz: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:34-36` | Marker aus `marker.ts`, Abdeckungsfirma ausgeschlossen, Altfirmen mit fester Adresse und festem Namen, kein Mitglied außerhalb der Testkonten: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:46`, `:105` | Grenzen des Literals, kein Backtick dazwischen: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:54` | Deklaration ohne `w`: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:61-70` | Zahlenprüfung und acht Abbruchbedingungen vor dem Fenster: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:72-75` | Fenster mit genau einer verändernden Anweisung: H1 behoben |
| `scripts/dev-testdaten-zuruecksetzen.mjs:76-78` | Rücksetzprüfung, Zählprüfung, Gegenbuchung ohne Ursprung, vor Phase B: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:80-82` | eine Anweisung für alle Testkonten, Zählprüfung: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:94-98` | fünf Endprüfungen vor Rückgabe und Schlusswort: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:100-102` | zehn Zeilen, eindeutige Schlüssel: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:107-124` | Sicherung in beiden Modi, seitenweise, Abbruch vor der Transaktion: M1 behoben; N10 |
| `scripts/dev-testdaten-zuruecksetzen.mjs:126-141` | Kontrolle auch bei Fehler, Exit 1 ohne zehn Zahlen: N2 behoben; N8 |
| `tests/support/marker.ts:8`, `:11` | Marker ohne Hochkomma, endet mit Dollarzeichen; Firmenname ohne Sonderzeichen; reine Konstanten: in Ordnung |
| `tests/unit/dev-reset.test.ts:27-31` | erwartet genau eine Anweisung im Fenster; Muster nur für `public`: N7 |
| `tests/unit/dev-reset.test.ts:36-42` | neun Texte vor dem Fenster, Prüfung über erstes Vorkommen: N7 |
| `tests/unit/dev-reset.test.ts:43-48` | ein Aufruf, ein Transaktionsbeginn, Schlusswort als einziger modusabhängiger Teil des Literals: in Ordnung |
| `tests/unit/dev-reset.test.ts:55-60` | Gate-Kennung, Sperre, Kontrolle vor der Fehlerausgabe, zehn Zahlen: in Ordnung |
| `tmp/proof/dev1/runs.jsonl:4` | Lauf 5 auf 0c0b639, sauber, Exit 0, 10 bestanden, ohne Argumente und Schalter |
| `tmp/proof/dev1/005-tests_unit_dev-reset.test.ts.log:1-2`, `:17`, `:24` | Kopf nennt Commit und sauberen Arbeitsbaum, 10 Tests, EXIT=0 |
| `tmp/proof/dev1/loesch-lauf.jsonl:1-4` | bisher nur Läufe von `sweep.ts`, kein Lauf des Reset-Skripts |
| `tests/support/owner.ts:13` | Grenze 12000 Zeichen für die Übergabe als Argument |
| `tests/support/owner.ts:24-37` | keine eigene Puffergrenze; abgeschnittene Ausgabe und Datenbankfehler werfen: fail-closed |
| `tests/support/sweep.ts:19`, `:70-76` | dasselbe Marker-Muster und dieselbe Löschfolge je Firma laufen bereits |
| `scripts/dev-guard.mjs:12-22` | Abbruch bei abweichender Ref, legt die Ref für Kindprozesse fest |
| `scripts/sys/gate-loesch.mjs:31-32` | Übernahme prüft Urteil und Zahl der hohen Funde |
| `scripts/sys/gate-loesch.mjs:53-56`, `:62`, `:66`, `:77` | Register und Freigabe aus dem Commit, Guard, Kennung in der Umgebung, Zahlenformat |
| `scripts/sys/gate-db-lib.mjs:39-51`, `:54-66` | Format der Freigabe: dieser Bericht hält es ein; jede Freigabe zu Pfad und Hash muss frei sein |
| `scripts/sys/loesch-register.json:5` | Skript bindet `marker.ts` |
| `scripts/sys/run.mjs:76`, `:133` | Sperre mit `pid` und `kind` |
| `scripts/sys/lib.mjs:9-10` | Nachweisordner `tmp/proof`, dort liegt die Sperrdatei |
| `scripts/scan-proof.mjs:7-12` | vier Muster für Schlüssel, Token und Verbindungsadressen: dieser Bericht enthält nichts davon |
| `supabase/migrations/20261029141616_0001_foundation.sql:29`, `:107`, `:146`, `:174` | Profil per Kaskade am Konto; Anfrage, Mietangebot und Mietanfrage per Kaskade am Profil |
| `supabase/migrations/20261101180000_0017_status_machine.sql:138-146`, `:156`, `:165-166` | Löschen nur in Triggertiefe größer 1; Statusereignisse per Kaskade an der Anfrage |
| `supabase/migrations/20261101190000_0018_revisions_contacts.sql:12`, `:116-117`, `:127-128` | Revision per Kaskade an der Anfrage; Zeiger ohne Löschaktion; Wächter auf der Anfrage |
| `supabase/migrations/20261102110000_0020_photo_staging.sql:70-71` | Fotos: Löschen nur als Kaskade |
| `supabase/migrations/20261108110000_0028_commission_journal.sql:12-17`, `:31`, `:47-50` | Primärschlüssel `id`; RESTRICT auf Firma, Anfrage, Revision, Selbstverweis; Trigger `append_only` |
| `supabase/migrations/20261108130000_0030_job_listings.sql:56-57`, `:81-82` | Zuordnung per Kaskade an der Anfrage, RESTRICT auf die Firma, Löschen nur als Kaskade |
| `supabase/migrations/20261108180000_0035_job_photos.sql:58-59` | Belege: Löschen nur als Kaskade |
| `supabase/migrations/20261109100000_0038_partner_offers.sql:19-21`, `:53-54` | Angebot per Kaskade an Anfrage und Revision, Löschen nur als Kaskade |
| `supabase/migrations/20261109120000_0040_change_orders.sql:140-144` | Wächter der Revision: Löschen nur als Kaskade, Ändern eigener Wächter |
| `supabase/migrations/20261109180000_0046_cancel_by_partner.sql:10`, `:14`, `:16` | `reissued_from` und `copied_from_revision_id` ohne Löschaktion |
| `supabase/migrations/20261110100000_0052_account_deletion.sql:66`, `:74-78` | Anonymisierung setzt beide Löschzeitpunkte und leert die E-Mail: passt zum dritten Nutzerzweig |
| `supabase/migrations/20261101160000_0015_versions_published.sql:40-43` | Trigger `append_only` auf `audit_log` |
| Suche über alle Migrationen: Fremdschlüssel auf Konten, Profile, Journal | Konten: Profil und Mitgliedschaft (Kaskade); Journal: nur der Selbstverweis |
| Suche über alle Migrationen: Löschtrigger | nur Wächter, keiner mit eigener Löschanweisung |
| Suche über `supabase/`: erzwungener Zeilenschutz, Replica-Trigger | keine Treffer |
| Suche über `supabase/`: Testdomain | keine Treffer, Seed legt keine Konten mit Test-Adresse an |
| Suche über Skripte und Tests: Live-Adressen | `live-up-` nur in `scripts/live-uploads.mjs:31`; andere Zusätze bleiben außerhalb des Musters |
| `tests/rls/status.test.ts:25-26`, `tests/rls/rls.test.ts:100-102` | Testkonten mit anderen Rollen: N9 |
| `package.json:7` | Node ab 22: N3 |
| `.gitignore:14` | `tmp/` nicht versioniert |

Offene Findings hoch: 0
