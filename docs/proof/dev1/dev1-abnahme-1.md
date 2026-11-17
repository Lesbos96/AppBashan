Modell: claude-fable-5-2
Vorgaenger: keiner
SHA256: 0c7db6dddc0fdfaf9b20ac8ace1559f762f889c916c0172e85468def8df8655a scripts/sys/loesch-register.json
SHA256: ea6a0c2909fb861dab67bce3334544953736e024324264ff063bd782e5eb71da docs/freigaben/dev1-loesch-freigabe-2.md

# Abnahme 1, Schritt dev1 (R3)

Datum: 2026-11-17
Pflichtmenge (vollständig gelesen): scripts/sys/loesch-register.json (38 Zeilen), docs/freigaben/dev1-loesch-freigabe-2.md (148 Zeilen).
Zusätzlich bewertet (vollständig gelesen): scripts/dev-testdaten-zuruecksetzen.mjs (141 Zeilen, Hash laut Auftrag af6fb4f4…2069a, derselbe Hash in allen fünf Zeilen des Lauf-Logs), tests/unit/dev-reset.test.ts (61 Zeilen).
Nachweise gelesen: tmp/proof/dev1/loesch-lauf.jsonl (13 Zeilen), runs.jsonl (6 Zeilen), Logs 006 und 007 ganz, Log 001 nur Kopf und Suche nach der Exit-Zeile, tmp/dev1-sicherung/zaehlung-vorher.json und zaehlung-nachher.json, die Sicherungsdateien der erfolgreichen Probe, des Löschlaufs und der Gegenprobe (nur Schlüssel gezählt, keine Inhalte übernommen).
Zur Einordnung gelesen: tmp/proof/dev1-plan.md, tmp/proof/dev1/loesch-freigabe-1.md (Kopf bis Auflagentabelle) und loesch-freigabe-2.md, Regeln geld.md, daten.md, tests.md, tests/support/marker.ts, sweep.ts, partner.ts (Zeilen 40 bis 81), dev-guard-setup.ts, tests/rls/sweep.test.ts, tests/rls/default-privileges.test.ts, scripts/sys/gate-loesch.mjs, gate-loesch-lib.mjs, .claude/hooks/guard.mjs (Zeilen 192 bis 221), tests/unit/sys-gate-loesch.test.ts (Zeilen 117 bis 136), docs/OFFEN.md Zeile 87, docs/STAND.md (Treffer zu fh1-6), Suchen über alle Migrationen (Tabellenanlagen, gelöschte Tabellen) und supabase/seed.sql (Zieltabellen).

Hinweise zum Nachweis:
- Die Hash-Zeilen oben sind unverändert aus dem Auftrag übernommen, nicht nachgerechnet (kein Shell-Werkzeug). Das Gate vergleicht sie mit dem Endstand.
- Ich konnte nichts ausführen, auch kein `git diff`. Was daraus folgt, steht bei N3.
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.

## Ergebnis in einem Satz

Die Pflichtdateien sind ohne Fund, die Auflagen 1 bis 6 der Freigabe 2 sind nach dem Lauf-Log erfüllt, gelöscht wurden nur Testdaten (Stamm- und Seed-Daten und `audit_log` unverändert); offen sind drei mittlere Punkte zum Ablauf und zum Auftrag (Halt nach dem Rollen-Abbruch nicht eingehalten, Volllauf `rls` auf leerem Dev fehlt noch, Nachwachsen ist nicht verhindert, sondern nur als Frage vorgesehen).

## Findings hoch

Keine.

## Findings mittel

M1. `tmp/proof/dev1/loesch-lauf.jsonl:5-11`, `tmp/proof/dev1/runs.jsonl:5-6` – Die Freigabe 2 verlangte unter N9 für den Abbruch an der Rollenprüfung: anhalten und berichten. Stattdessen liefen nach dem ersten Abbruch (07:39, Abdeckungsfirma) und nach dem zweiten (07:49, Rolle) gezielte Testläufe als Aufräumwerkzeug (Lauf 6 und 7), dann die dritte Probe. Bewertung der Wirkung: Die Bedingung wurde nicht gelockert (derselbe Hash in den Zeilen 5, 6, 11, 12, 13). Die Abdeckungsfirma des abgebrochenen Laufs entfernte der feste Aufbau jedes `rls`-Laufs (`tests/support/dev-guard-setup.ts:8-9`, `tests/support/partner.ts:59`), das Admin-Testkonto der Schlusslauf des Aufräumens (`tests/rls/sweep.test.ts:40`, `tests/support/sweep.ts:83-86`, nur Adressen mit dem Test-Präfix), beides über das Start-Programm und mit bestehender Freigabe von `sweep.ts` (Zeilen 7 bis 10 des Lauf-Logs, Lauf `dev1/7`). Kein Datenschaden, aber eine Auflage wurde nicht dem Wortlaut nach eingehalten. Fix: in der Bewertung unter Abweichungen nennen (beide Abbrüche, beide Läufe, Begründung); den Weg nach einem abgebrochenen `rls`-Lauf als Befund nach `docs/OFFEN.md` schreiben (ein gezielter `rls`-Lauf räumt die Abdeckungsfirma, `tests/rls/sweep.test.ts` räumt Testkonten ohne Aufträge, danach Probe); an den Daten ist nichts nachzuholen.

M2. `docs/STAND.md:17`, `tmp/proof/dev1-plan.md:12` – Der Auftrag heißt zurücksetzen und die Wanduhr von `rls` neu messen (OFFEN fh1-6). Gemessen ist nichts: der Basislauf wurde abgebrochen (N2), ein Volllauf nach dem Löschen liegt nicht vor. Zusätzlich hat sich die Vorbedingung der Suite geändert (Dev hat kein Konto, keine Firma, keine Anfrage mehr, `loesch-lauf.jsonl:13`); dass sie auf leerem Dev grün ist, ist unbelegt. Fix: der eine Volllauf `rls` am Ende auf dem committeten Endstand ist für diesen Schritt Pflicht, auch wenn das Gate einen älteren grünen Lauf übernähme; Dauer je Datei gegen `docs/OFFEN.md:87` stellen. Frühestens 15 Minuten nach seinem Ende eine Probe (rollt zurück, vorher greift die Altersprüfung `scripts/dev-testdaten-zuruecksetzen.mjs:68-69`) und deren Zahlen als Zuwachs eines Volllaufs in den Befund schreiben. Unterbleibt der Volllauf, muss der Bericht sagen, dass die Messung offen ist.

M3. `tmp/proof/dev1-plan.md:24`, `docs/OFFEN.md`, `docs/BEKS.md`, `docs/STAND.md` (noch nicht geschrieben) – Der Auftragsteil Nachwachsen verhindern ist nicht umgesetzt; vorgesehen sind Befund und Frage. Das ist richtig so (die Entscheidung gehört Beks), der Bericht darf den Teil aber nicht als erledigt führen. Der Befund braucht mindestens: (a) Ursache F6 (Live-Tests schließen Aufträge ab, Journal bindet Kunde, Anfrage und Firma); (b) der Volllauf am Ende dieses Schritts legt wieder Reste an, Dev ist nach dem Schritt nicht leer; (c) die harte Grenze: ab mehr als 1000 Testkonten oder Testfirmen wirft das Aufräumen in jedem Test (`tests/support/sweep.ts:15`, `:62-65`) und das Reset-Skript bricht ab (`scripts/dev-testdaten-zuruecksetzen.mjs:62`); vor dem Löschen standen 646 Firmen und 427 Konten; (d) die Zahlen zu den Aufrufstellen nachzählen: Plan F5 nennt 22 Dateien und rund 52 Stellen, ich finde 20 Aufrufe von `sweepTestResidue` in 9 Dateien unter `tests/rls/`; (e) die Frage an Beks mit Empfehlung (unten B1). Diese drei Dokumente liegen außerhalb dieser Abnahme; ich habe sie nicht gesehen.

## Findings niedrig

N1. `scripts/sys/gate-loesch.mjs:66`, `:77-78`, `tmp/proof/dev1/loesch-lauf.jsonl:5-6` – Das Gate hält von einem Abbruch nur Exit-Code und Zahlen fest, die Meldung geht auf die Konsole. Die Gründe der zwei Probe-Abbrüche (Abdeckungsfirma, Rolle) stehen also in keinem Nachweis; ich stütze sie auf die Angabe im Auftrag und auf die Lektüre: Reihenfolge der Prüfungen im Skript (`:63` vor `:64`), Aufbau jedes `rls`-Laufs entfernt die Abdeckungsfirma (`partner.ts:59`), ihr Admin-Konto bleibt bis zum Aufräumen. Ein Abbruch an einem Fremdschlüssel der Kaskade (Auflage 1) ist ausgeschlossen, weil dieselbe Datei auf fast demselben Bestand danach mit `kopien=189` durchlief (Zeile 11). Fix: den Wortlaut der zwei Meldungen in der Bewertung zitieren. Vorschlag für später (Gate, nur mit Beks): die letzte Fehlerzeile des Skripts in die Zeile des Lauf-Logs aufnehmen.

N2. `tmp/proof/dev1/001-rls.log:1-6` – Abgebrochener Volllauf `rls` (Start 07:08:55 auf 953708d, keine Exit-Zeile, kein Eintrag in `runs.jsonl`, dort beginnt die Zählung bei 2). Abweichung von `tests.md` (im Schritt nur gezielte Läufe, ein Volllauf am Ende). Folgen: Reste auf Dev (Abdeckungsfirma mit zwei Konten, dazu 2 Konten, 15 Anfragen, 2 Firmen mit Journal gegenüber Plan F1 bis F3), sie haben die zwei Probe-Abbrüche ausgelöst und sind inzwischen gelöscht. Der Lauf zählt für nichts. Fix: Log unverändert lassen, in der Bewertung unter Abweichungen nennen.

N3. `scripts/sys/loesch-register.json:5` – Den Vergleich gegen `main` konnte ich nicht ausführen. Geprüft ist der Endstand: 15 Einträge unter `skripte`, der neue bindet `tests/support/marker.ts` wie `sweep.ts` (`:3`); 16 Einträge unter `ausgenommen`, jeder mit Grund und Hash; das Skript steht nicht unter `ausgenommen`. Die Zeilenlage passt zu früheren Freigaben (`docs/freigaben/u1b-loesch-freigabe-1.md:108` nennt `:3`, `docs/freigaben/sys1-loesch-freigabe-3.md:104` nennt `:4`). Ein Eintrag unter `skripte` lockert nichts: das Gate verlangt dafür eine Freigabe samt gebundener Datei (`gate-loesch.mjs:53-56`), der Hook sperrt den Direktaufruf (`.claude/hooks/guard.mjs:200-202`, `:210-215`). Die Hashes der Ausnahmen prüft der Unit-Test im Endlauf `check` (`tests/unit/sys-gate-loesch.test.ts:129-133`). Fix: in der Bewertung die Ausgabe von `git diff main -- scripts/sys/loesch-register.json` nennen (erwartet: genau eine ergänzte Zeile).

N4. `tmp/dev1-sicherung/zaehlung-vorher.json`, `zaehlung-nachher.json` – Die Zählung je Tabelle liegt nur lokal und unversioniert (Auflage 5 hält den Ordner aus dem Nachweis heraus), sie ist Rohausgabe der CLI. Dauerhafter Beleg für unveränderte Stamm- und Seed-Daten ist der Vergleich in der Transaktion (`scripts/dev-testdaten-zuruecksetzen.mjs:98`, acht Tabellen, sonst Ausnahme und Rollback) zusammen mit Exit 0 in `loesch-lauf.jsonl:12` und `bleibt_audit` in den Zeilen 11 bis 13. Fix: im Bericht die Zahlen je Tabelle als lokale Angabe kennzeichnen und für den Beleg auf das Lauf-Log verweisen.

N5. `tests/unit/dev-reset.test.ts:29`, `:36-42`, `:49-54`, `scripts/dev-testdaten-zuruecksetzen.mjs:133-140` – N7 und N8 der Freigabe 2 sind unverändert offen (Lücken des Tests, zwei Schwächen der Meldungen). Kein Hindernis. Wird das Skript zur Routine (B1), gehören beide in die Runde, in der es einen neuen Hash bekommt. N3 der Freigabe 1 (Import von TypeScript unter Node) ist durch die fünf Läufe erledigt.

N6. `tmp/dev1-sicherung/` – Dort liegen fünf Sicherungen (drei Proben vor dem Löschen, Löschlauf, Gegenprobe) mit Testadressen und den Journalzeilen der Testanfragen. Lokal und unversioniert, Auflage 5 erfüllt. Fix: bis zum Merge behalten, danach entscheidet Beks über das Löschen des Ordners (B3).

## Antworten auf die Prüffragen

**(1) Pflichtdateien, Register.** Ohne Fund. Das Register ist gültiges JSON mit den zwei bekannten Abschnitten. Der Eintrag `:5` bindet `marker.ts`, damit braucht jeder Start eine Freigabe für Skript und Marker aus dem Commit; die liegt mit `docs/freigaben/dev1-loesch-freigabe-2.md:2-4` vor (Urteil frei, null hohe Funde, `:147`). Nichts im Endstand lockert: keine neue Ausnahme für das Skript, keine leere Bindung. Dass gegenüber `main` nur diese eine Zeile dazukam, ist von mir nicht ausführbar zu belegen (N3). Die Freigabe in `docs/freigaben/` ist nach vollständiger Lektüre beider Dateien inhaltsgleich mit `tmp/proof/dev1/loesch-freigabe-2.md` (kein Byte-Vergleich möglich). Ihr Vorgänger (Freigabe 1, gesperrt) liegt zu Recht nicht in `docs/freigaben/` (`gate-loesch.mjs:31-32`).

**(2) Auflagen 1 bis 6 der Freigabe 2.**

| Auflage | Stand | Beleg |
|---|---|---|
| 1 Probe zuerst, kein Fremdschlüssel-Abbruch, `kopien` größer 0 | erfüllt | `loesch-lauf.jsonl:5`, `:6` Proben mit Exit 1 vor jedem Löschen, Gründe laut Auftrag Abdeckungsfirma und Rolle (N1); `:11` Probe Exit 0 mit `kopien=189`: die Kaskade löscht die Kopien ohne Umweg |
| 2 Probe mit Exit 0, zwei aktiven Triggern, zehn Zahlen, höchstens 60 s, Sicherung gleich, Zahlen nahe am Plan | erfüllt | `:11` Exit 0, `appendOnlyAktiv=2`, zehn weitere Zahlen, 13 s. Sicherung der Probe (07-52-38): 3972 Schlüssel `id` gleich 427 + 1486 + 2059. Plan F1 bis F3: 425, 1471, 644; Probe: 427, 1486, 646; Abweichung rund 1 %, erklärt durch N2 |
| 3 Löschen mit genau diesen fünf Zahlen, kein Testlauf dazwischen | erfüllt | `:12` Argumente 427, 1486, 2059, 646, 189, Exit 0, 14,8 s; letzter Testlauf endete 07:52:27 (`runs.jsonl:6`, Start 07:51:51, 36 s), Probe begann 07:52:38, Löschen 07:53:25. Sicherung des Löschlaufs: 427 Konten, 2059 Journalzeilen, 3972 Schlüssel `id` |
| 4 unklarer Ausgang | nicht eingetreten | `:12` Exit 0 mit zehn Zahlen |
| 5 Sicherung nur lokal | erfüllt | Dateien unter `tmp/dev1-sicherung/`, nichts davon unter `tmp/proof/`, Arbeitsbaum laut Auftragsstand sauber |
| 6 Gegenprobe | erfüllt | `:13` `nutzer`, `anfragen`, `journal`, `firmen`, `kopien` 0; `bleibt_*` 0, 0, 0, 0 und `bleibt_audit` 16804 wie in `:12`; Sicherung der Gegenprobe leer |

Nicht eingehalten wurde der Halt aus N9 der Freigabe 2 (kein Teil der sechs Auflagen): M1.

**(3) Nur Testdaten betroffen?** Ja.
- Vor dem Löschen deckte die Testmenge den ganzen Bestand: `auth.users` 427 gleich `nutzer`, `partners` 646 gleich `firmen`, `service_requests` 1486 gleich `anfragen`, `commission_entries` 2059 gleich `journal`; die Probe meldet nach dem Löschen innerhalb der Transaktion `bleibt_nutzer`, `bleibt_firmen`, `bleibt_anfragen`, `bleibt_journal` 0 (`:11`). Es gab also kein Konto, keine Firma, keine Anfrage und keine Journalzeile außerhalb der Definition, die ich in Runde 2 freigegeben habe (Plan F1: keine anderen Konten auf Dev).
- Stamm- und Seed-Daten: `fee_schedules` 2, `fee_schedule_tiers` 4, `price_versions` 1, `price_config` 28, `platform_settings` 30, `rental_offers` 3, `geo_boundaries` 2, `geo_districts` 23 vorher und nachher gleich; in der Transaktion erzwungen (`:98` des Skripts). Die Seed-Datei schreibt nur in vier dieser Tabellen (`supabase/seed.sql:5`, `:10`, `:83`, `:121`, `:126`).
- `audit_log` 16804 vorher, im Löschlauf und in der Gegenprobe; beide Sperren aktiv nach jedem der fünf Läufe.
- Die Zählung umfasst alle 31 Tabellen in `public` (32 Anlagen in den Migrationen, `fee_splits` entfiel mit `0028:224`; keine Tabelle im Schema `private`), sechs Tabellen in `auth` und `storage.objects`. Alles, was auf 0 fiel, hängt per Kaskade an Konto, Anfrage oder Firma (Zuordnungen, Listen, Angebote, Belege, Revisionen, Kontakte, Statusereignisse, Outbox, Firmenstammtabellen, Sitzungen). `storage.objects` war und ist 0.
- Geld: kein Betrag gerechnet oder geändert; ein Journal echter Firmen gab es nicht. Sicherheit: keine Rechte, keine Trigger, kein Katalog geändert; keine Geheimnisse in Log oder Bericht.
- Grenze der Aussage: die Zählung je Tabelle ist eine lokale Datei (N4); Tabellen außerhalb der Liste (weitere Tabellen von `auth` und `storage`) sind nicht gezählt, das Skript fasst sie nicht an.

**(4) Schritt zu Auftrag.** Entfernen: erfüllt und belegt. Neu messen: offen (M2). Nachwachsen verhindern: nicht umgesetzt, als Entscheidung an Beks vorgesehen (M3); das ist der richtige Weg, weil eine Routine das Löschen im Journal auf Dev zum Normalfall macht. Der Schritt blieb im Umfang (kein Schema, keine Migration, keine Function, kein App-Code). `sweep.ts` ist unverändert (Hash in `loesch-lauf.jsonl:1-4` und `:7-10` gleich).

Zur Wiederholung des Skripts: Die Freigabe 2 gilt für den Hash und deckt einen weiteren Weg Probe, Löschen, Gegenprobe unter denselben sechs Auflagen; an die Stelle der Erwartung aus dem Plan tritt der Zuwachs seit dem letzten Löschen (Größenordnung eines oder weniger Volläufe, belegt durch die Probe aus M2). Zahlen in der alten Größenordnung, ein Konto außerhalb der drei Muster oder ein Abbruch: anhalten und berichten. Eine feste Routine (vor jedem Volllauf) ist davon nicht gedeckt, sie braucht das Ja von Beks.

## Offene Fragen an Beks (mit Empfehlung)

B1. Nachwachsen. Wege: (a) Reset als Routine vor jedem Volllauf `rls`; (b) Ursache der Laufzeit beheben: `sweep.ts:83-89` versucht in jedem Aufruf jedes Testkonto zu löschen und scheitert an den gebundenen (20 Aufrufe in 9 Dateien); die Schleife auf Konten ohne gebundene Aufträge begrenzen, dann hängt die Laufzeit nicht mehr an der Zahl der Reste; dazu Reset nach Schwelle; (c) Live-Tests ohne Journal: nicht machbar, sie prüfen gerade den committeten Weg. Empfehlung: erst die Messung aus M2 abwarten. Fällt die Wanduhr auf leerem Dev deutlich, dann (b) als eigener kleiner R3-Schritt (engt das Löschen ein, braucht eine neue Lösch-Freigabe für `sweep.ts`) und der Reset nur nach Schwelle, etwa ab 300 Testkonten oder 500 Testfirmen laut Probe, weit vor der Grenze von 1000 (M3 c). Kein Reset im Testlauf selbst und keiner aus `sweep.ts`.

B2. Grenze von 1200 s für `rls` (fh1-6). Empfehlung: erst nach der Messung aus M2 entscheiden; bleibt die Suite auch auf leerem Dev darüber, liegt es nicht an den Resten.

B3. Sicherungsordner `tmp/dev1-sicherung/`. Empfehlung: bis zum Merge behalten, danach von Hand löschen; ein Zurückspielen ist nicht vorgesehen und nicht nötig (nur Testdaten).

B4. Lauf-Log des Lösch-Gates ohne Abbruchgrund (N1). Empfehlung: bei Gelegenheit eines sys-Schritts ergänzen, kein eigener Schritt.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/sys/loesch-register.json:3`, `:5` | `sweep.ts` und das Reset-Skript binden beide `marker.ts`: in Ordnung |
| `scripts/sys/loesch-register.json:19-36` | 16 Ausnahmen, jede mit Grund und Hash, das Reset-Skript nicht darunter: in Ordnung |
| `docs/freigaben/dev1-loesch-freigabe-2.md:1-5`, `:147` | Modell, zwei Hash-Zeilen, Urteil frei, Vorgänger, null hohe Funde: Format in Ordnung |
| `docs/freigaben/dev1-loesch-freigabe-2.md:54-61` | sechs Auflagen, wortgleich mit `tmp/proof/dev1/loesch-freigabe-2.md:54-61` |
| `scripts/sys/gate-loesch.mjs:24-35` | Übernahme nur aus `tmp/proof/`, nur mit bekannten Pfaden, nie überschreibend |
| `scripts/sys/gate-loesch.mjs:53-56`, `:62`, `:66`, `:77-78` | Register und Freigabe aus dem Commit, Guard, Kennung, Zahlen und Exit ins Lauf-Log; Fehlertext nicht (N1) |
| `scripts/sys/gate-loesch-lib.mjs:26-29`, `:48-61` | Freigaben nur aus HEAD; Zeile des Lauf-Logs mit Hash der Datei zum Zeitpunkt des Laufs |
| `.claude/hooks/guard.mjs:200-202`, `:210-215` | Registerskripte sind für den Direktaufruf gesperrt; unlesbares Register sperrt alles |
| `tests/unit/sys-gate-loesch.test.ts:122-133` | Vollständigkeit, keine Überschneidung, Hash je Ausnahme |
| `tests/unit/dev-reset.test.ts:10-12` | Test hält die Bindung an `marker.ts` fest |
| `tmp/proof/dev1/runs.jsonl:4` | Unit-Test des Skripts: 10 bestanden, Exit 0, sauber, auf 0c0b639 |
| `tmp/proof/dev1/runs.jsonl:5-6` | Läufe 6 und 7 auf 180c4a8, sauber, Exit 0, ohne Argumente und Schalter |
| `tmp/proof/dev1/loesch-lauf.jsonl:5`, `:6` | Proben mit Exit 1, 29,2 s und 10 s, `appendOnlyAktiv=2`, keine weiteren Zahlen |
| `tmp/proof/dev1/loesch-lauf.jsonl:7-10` | Aufräumen im Lauf `dev1/7`, Hash von `sweep.ts` wie in `:1-4`, keine aktiven oder ungebundenen Testfirmen danach |
| `tmp/proof/dev1/loesch-lauf.jsonl:11` | Probe Exit 0, 13 s, 427 / 1486 / 2059 / 646 / 189, `bleibt_audit` 16804 |
| `tmp/proof/dev1/loesch-lauf.jsonl:12` | Löschen mit denselben fünf Zahlen, Exit 0, 14,8 s, zehn Zahlen, zwei Trigger aktiv |
| `tmp/proof/dev1/loesch-lauf.jsonl:13` | Gegenprobe Exit 0, 6,5 s, alle fünf Mengen 0, `bleibt_audit` 16804 |
| `tmp/proof/dev1/001-rls.log:1-6` | Volllauf auf 953708d, Start 07:08:55; Suche nach der Exit-Zeile ohne Treffer (N2) |
| `tmp/proof/dev1/006-…default-privileges.test.ts.log:34`, `007-…sweep.test.ts.log:30` | beide mit Exit 0 |
| `tests/rls/default-privileges.test.ts:5-7` | die Datei selbst löscht nichts; die Abdeckungsfirma räumt der Aufbau des Projekts |
| `tests/support/dev-guard-setup.ts:8-9`, `tests/support/partner.ts:59`, `:66-69` | Aufbau entfernt eine alte Abdeckungsfirma nach Namen, Abbau löscht die neue samt ihren zwei Konten |
| `tests/rls/sweep.test.ts:34`, `:40` | legt ein Admin-Testkonto an, Schlusslauf des Aufräumens mit `final` |
| `tests/support/sweep.ts:15`, `:62-65`, `:83-89` | Grenze 1000; Schleife über alle Testkonten, Fehler je Konto verschluckt |
| `scripts/dev-testdaten-zuruecksetzen.mjs:62-64`, `:68-69`, `:98` | Reihenfolge der Abbrüche, Altersprüfung 15 Minuten, Vergleich der acht Stammtabellen |
| `tmp/dev1-sicherung/zaehlung-vorher.json:5` | 427 Konten, 646 Firmen, 1486 Anfragen, 2059 Journalzeilen, 16804 Auditzeilen, Stammdaten 2 / 4 / 1 / 28 / 30 / 3 / 2 / 23 |
| `tmp/dev1-sicherung/zaehlung-nachher.json:5` | alle abhängigen Tabellen 0, Auditzeilen und Stammdaten wie vorher |
| Sicherung 07-52-38 (Probe), Schlüsselzählung | 3972 Schlüssel `id` |
| Sicherung 07-53-25 (Löschen), Schlüsselzählung | 427 Schlüssel `email`, 2059 Journalzeilen, 3972 Schlüssel `id` |
| Sicherung 07-53-52 (Gegenprobe), Schlüsselzählung | kein Schlüssel `id` |
| Suche über alle Migrationen: Tabellenanlagen, gelöschte Tabellen | 32 Anlagen in `public`, `fee_splits` entfernt (`0028:224`), nichts in `private` |
| `supabase/seed.sql:5`, `:10`, `:83`, `:121`, `:126` | Seed schreibt nur Preisversion, Preiskonfiguration, Einstellungen, Mietangebote |
| Suche nach Aufrufen von `sweepTestResidue` unter `tests/` | 20 Aufrufe in 9 Dateien (Plan F5 nennt andere Zahlen, M3 d) |
| `docs/OFFEN.md:87`, `docs/STAND.md:12`, `:17` | Auftrag: zurücksetzen und Wanduhr neu messen; Grenze 1200 s |
| `scripts/scan-proof.mjs:7-12` | vier Muster für Schlüssel, Token und Verbindungsadressen mit Passwort: dieser Bericht enthält nichts davon |

Offene Findings hoch: 0
