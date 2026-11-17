Modell: claude-fable-5-2
SHA256: a647674cd2ad1b75a3f9477a20c167c23b528a6f96823ade097b4b15e5520efe scripts/dev-testdaten-zuruecksetzen.mjs
SHA256: 1f72a00bbc085ae8af2ac4b7b609b6686e00b7b141ba0f20aee9733b98a6593a tests/support/marker.ts
Urteil: gesperrt

# Lösch-Freigabe 1, Schritt dev1 (R3)

Datum: 2026-11-17
Vorgängerbericht: keiner (Runde 1). Planprüfung: tmp/proof/dev1-plan.md (meine Antwort darauf liegt mir nicht vor; ich prüfe gegen die Auflagen, wie sie der Auftrag wiedergibt).
Geprüft (vollständig gelesen): scripts/dev-testdaten-zuruecksetzen.mjs (122 Zeilen, Commit e25704b), tests/support/marker.ts (11 Zeilen), tests/unit/dev-reset.test.ts (39 Zeilen).
Zur Einordnung gelesen: Regeln geld.md und daten.md, tests/support/owner.ts, tests/support/sweep.ts, scripts/dev-guard.mjs, scripts/sys/gate-loesch.mjs, gate-loesch-lib.mjs, gate-db-lib.mjs (Zeilen 33 bis 66), loesch-register.json, run.mjs (Zeilen 44 bis 133), Migrationen 0001, 0015, 0017, 0018, 0023, 0024, 0028, 0030, 0035, 0038, 0040, 0046, 0047, 0052 (jeweils die Stellen aus der Stichprobenliste), Suche über alle Migrationen nach Fremdschlüsseln, Löschtriggern und Buckets, tmp/proof/dev1/runs.jsonl.

Hinweise zum Nachweis:
- Die Hash-Zeilen oben sind unverändert aus dem Auftrag übernommen, nicht nachgerechnet (kein Shell-Werkzeug).
- Ich konnte nichts ausführen. Aussagen zur Syntax stützen sich auf Lektüre, Aussagen zum Verhalten der Datenbank auf die Migrationsdateien und auf meine Kenntnis von PostgreSQL. Wo das nicht reicht, steht es dabei.
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.
- `tests/support/marker.ts` ist ohne Fund. Die Sperre betrifft nur das Skript. Dieser Bericht wird nicht nach `docs/freigaben/` übernommen (`gate-loesch.mjs:31-32` weist ein gesperrtes Urteil ab), der unveränderte Hash von `marker.ts` bleibt für `sweep.ts` also frei.

## Ergebnis in einem Satz

Alle Auflagen bis auf eine sind erfüllt, Syntax und Logik halte ich für gültig; gesperrt ist die Datei wegen der zweiten Anweisung im Replica-Fenster (H1), die ich nicht freigebe, weil sie unbelegt ist und nach meiner Analyse nicht gebraucht wird. Weil die Datei dafür ohnehin einen neuen Hash bekommt, gehören M1 und N1 bis N3 in dieselbe Runde.

## Entscheidung zur Abweichung (UPDATE im Replica-Fenster)

Nicht freigegeben. Zuerst eine Probe ohne das UPDATE.

Begründung:
1. Die Auflage lautet: genau eine Löschanweisung im Fenster. Das UPDATE umgeht zusätzlich die Sperre `revision_immutable` (`0018_revisions_contacts.sql:83-84`) für eine zweite Tabelle. Eine Sperre wird nur umgangen, wenn es belegt nötig ist.
2. Die Probe mit UPDATE wäre kein Beleg für die Notwendigkeit: sie liefe mit und ohne Bedarf durch.
3. Die Annahme, die Fremdschlüssel würden in der Kaskade je Anfrage geprüft, trifft nach meiner Kenntnis nicht zu. PostgreSQL führt die Kaskaden-Anweisungen der Fremdschlüssel so aus, dass die von ihnen ausgelösten Nachlauf-Ereignisse (weitere Kaskaden und die NO-ACTION-Prüfungen) an die Warteschlange der äußeren Anweisung angehängt und in der Reihenfolge ihres Entstehens abgearbeitet werden, nicht am Ende der einzelnen Kaskaden-Anweisung. Phase B ist eine einzige äußere Anweisung für alle Testnutzer (`:77`). Ablauf: Stufe Nutzer löscht alle Profile, Stufe Profile löscht alle Anfragen (`0001_foundation.sql:107`), Stufe Anfragen löscht alle Revisionen (`0018:12`), erst danach laufen die Prüfungen der Stufe Revisionen. Quelle und Kopie liegen beide in der Testmenge (die Folgeanfrage erbt den Kunden, `0047_s9h2_abnahme.sql:36-42`), die Kopie ist also gelöscht, bevor die Prüfung von `copied_from_revision_id` (`0046_cancel_by_partner.sql:14`, NO ACTION) für die Quelle läuft. Dasselbe gilt für `reissued_from` (`0046:10`), `price_revisions_base` (`0040_change_orders.sql:17`) und `service_requests_current_revision` (`0018:116-117`), für die das Skript zu Recht keinen Umweg enthält. Die Löschtrigger der Kette sind reine Wächter (`immutable_row`, Tiefe größer 1, `0017_status_machine.sql:142`), keiner löscht selbst (Suche über alle Migrationen nach Löschtriggern).
4. Das ist nicht ausgeführt, also nicht belegt. Den Beleg liefert die Probe ohne UPDATE: sie rollt zurück, ein Fehlschlag kostet nichts. Scheitert sie mit 23503 am Fremdschlüssel von `copied_from_revision_id`, ist das Log der Beleg, und ich gebe das UPDATE in der nächsten Runde frei (dann mit der Zählprüfung wie jetzt in `:74`).

Datei-Änderung (H1):
- `:70` und `:71` streichen (UPDATE und die zweite Zeilenzählung).
- `:49` die Variable `w` streichen.
- `:74` auf die Journalprüfung kürzen (Ausnahme, wenn `v` ungleich `n_j`, Meldung mit zwei Platzhaltern und zwei Argumenten).
- `:5-6` Kopfkommentar: der Halbsatz zu den Revisionskopien entfällt.
- `:55` und die Zahl `kopien` (`:97`, `:38`, `:3`, `:15-16`) bleiben als reine Zählung: läuft die Probe mit `kopien` größer 0 durch, ist das der Beleg, dass die Kaskade die Kopien ohne Umweg löscht.
- `tests/unit/dev-reset.test.ts:27-33`: Erwartung im Fenster genau eine Anweisung, das Löschen im Journal; Titel anpassen.

## Findings hoch

H1. `scripts/dev-testdaten-zuruecksetzen.mjs:70-71` (mit `:5-6`, `:49`, `:74`) – Zweite verändernde Anweisung im Replica-Fenster, entgegen der Auflage; Notwendigkeit unbelegt und nach der Analyse oben nicht gegeben – streichen wie oben beschrieben, Probe ohne UPDATE, neue Freigaberunde mit neuem Hash.

## Findings mittel

M1. `scripts/dev-testdaten-zuruecksetzen.mjs:104-115` – Die Sicherung läuft nur im Modus `loeschen`, die Probe prüft diesen Weg nicht. Zwei Schwächen: (a) Das Journal kommt in einem einzigen CLI-Aufruf (`:111`). `ownerSql` startet die CLI ohne eigene Puffergrenze (`tests/support/owner.ts:24-27`), es gilt die Standardgrenze von Node von 1 MiB für die Ausgabe. Bei mindestens 1135 Journalzeilen (Plan F2) mit rund 20 Feldern je Zeile, davon vier UUIDs, liegt die Ausgabe nach meiner Schätzung bei 0,7 bis 2 MB. Wird die Grenze überschritten, ist die Ausgabe abgeschnitten, `owner.ts:29-34` wirft beim Parsen, das Skript endet vor der Transaktion. Das ist sicher (nichts gelöscht), fiele aber erst nach der Probe auf und verlangte dann wieder einen neuen Hash. (b) Die Zahlen der Sicherung werden nur ausgegeben (`:114`), nicht mit den übergebenen Zahlen verglichen; eine unvollständige Sicherung hielte das Löschen nicht auf. Fix: Journal seitenweise sichern (feste Seitengröße, sortiert nach `id`, bis eine Seite kürzer ist); die Sicherung in beiden Modi schreiben, damit die Probe den Weg belegt; im Modus `loeschen` vor dem Start der Transaktion abbrechen, wenn die Zahl der gesicherten Nutzer, Anfragen oder Journalzeilen von den übergebenen Zahlen abweicht. Die Schätzung in (a) ist nicht gemessen; die Probe mit Sicherung misst sie.

M2. `tests/unit/dev-reset.test.ts` – Der Test hält nur einen Teil der Auflagen fest (Register, Guard, Marker-Import, keine Triggeränderung, kein Fehlerfang, ein Fenster, Inhalt des Fensters, Meldung der Zahlenprüfung). Es fehlen: das Muster der Live-Konten mit Zusatz `up` und das Fehlen des breiteren Musters; die Abbruchbedingungen (Abdeckungsfirma vorhanden, Journalzeile einer Nicht-Testfirma, Gegenbuchung außerhalb, 15 Minuten, Dateien in den drei Buckets) und ihre Stellung vor dem Fenster; genau ein Aufruf von `ownerSql(sql)` und genau ein `begin`; das Schlusswort als einziger modusabhängiger Teil nach dem Block; der Umfang der Sicherung; die Kontrolle der Trigger am Ende. `:35-36` prüfen nichts: beide Wörter stehen schon in Kommentaren und in den Tabellendefinitionen. Fix: diese Punkte als Textprüfungen ergänzen, `:35-36` durch die Prüfung des Ausdrucks für das Schlusswort ersetzen. Ändert den Hash der geprüften Dateien nicht.

## Findings niedrig

N1. `scripts/dev-testdaten-zuruecksetzen.mjs:20` – Die Sperrprüfung liest nur `pid`. Das Start-Programm trägt auch die PID des Testkinds ein und wertet beide (`scripts/sys/run.mjs:76`, `:133`); stirbt das Start-Programm, läuft das Kind unter Windows weiter. Fix: auch `kind` prüfen. Abgemildert durch die Prüfungen in `:58` und `:63-64`.

N2. `scripts/dev-testdaten-zuruecksetzen.mjs:117-122` – Wirft der Hauptaufruf, läuft die Kontrolle der Trigger nicht; liefert er keine Zeilen, meldet das Skript trotzdem Erfolg. Fix: Kontrolle in `finally`; Exit 1, wenn nicht genau die zehn Zahlen zurückkommen.

N3. `scripts/dev-testdaten-zuruecksetzen.mjs:10-11` – Das Skript importiert zwei TypeScript-Dateien unter reinem Node; das Gate startet es ohne Schalter (`scripts/sys/gate-loesch.mjs:66`), `package.json:7` verlangt nur Node ab 22. Das geht erst mit Node-Versionen, die Typen von selbst entfernen. Kein anderes Skript unter `scripts/` tut das (Suche: nur diese Datei), der Unit-Test liest nur den Text. Von mir nicht prüfbar. Scheitert es, dann beim Laden, vor jeder Datenbank-Aktion; die Probe zeigt es sofort. Kein Fix, solange die Probe startet.

N4. `scripts/dev-testdaten-zuruecksetzen.mjs:42` – Die Grenze von 600 s gilt in der Datenbank. Bricht die CLI oder die Verbindung vorher ab, ist der Ausgang im Modus `loeschen` für das Skript unbekannt (entweder alles oder nichts, nie ein Teil). Dann vor jedem weiteren Schritt eine Probe starten und deren Zahlen berichten. Die Dauer der Probe (Feld `sek` in `loesch-lauf.jsonl`) vor dem Löschen ansehen; über 60 s: anhalten und berichten.

N5. `scripts/dev-testdaten-zuruecksetzen.mjs` (ganze Datei) – Keine eigene Prüfung, dass der Start über das Gate kam. Fix (billig, kein echter Schutz, nur gegen Versehen): abbrechen, wenn die vom Gate gesetzte Lauf-Kennung in der Umgebung fehlt (`gate-loesch.mjs:66`).

N6. `tmp/proof/dev1/runs.jsonl:1-3` – Die Läufe des Unit-Tests liefen auf Commit 953708d mit unsauberem Arbeitsbaum, also vor e25704b; sie belegen den committeten Stand nicht. Meine Aussagen stützen sich auf die Lektüre. Nach der Änderung gezielt neu laufen lassen.

## Auflagen aus der Planprüfung

| Auflage | Stand | Beleg |
|---|---|---|
| Abdeckungsfirma ausschließen, bei Vorhandensein abbrechen | erfüllt | `:30` (Ausschluss im Marker-Zweig; der Altfirmen-Zweig verlangt einen festen anderen Namen), `:58` |
| Live-Konten nur mit Zusatz `up` | erfüllt | `:26` |
| Abbruch bei Journalzeile einer Nicht-Testfirma | erfüllt | `:61`; umgekehrter Fall (Testfirma mit Journal einer fremden Anfrage) scheitert in Phase C an RESTRICT (`0028_commission_journal.sql:13`) und rollt alles zurück |
| Abbruch bei Anfrage oder Journal jünger als 15 Minuten | erfüllt | `:49`, `:63-64`; `created_at` vorhanden (`0001:125`, `0028:30`) |
| Abbruch bei Dateien in storage.objects | erfüllt | `:65`; die drei Buckets sind alle, die die Migrationen anlegen (`0011`, `0024:201-205`, `0035:6`) |
| Marker aus marker.ts | erfüllt | `:10`, `:30`, `:58`; Register `loesch-register.json:5` bindet die Datei |
| Phasen A, B, C in einer Transaktion und einem CLI-Aufruf | erfüllt | `:41` bis `:102`, ein Aufruf `:117` |
| Probe und Löschen mit demselben SQL-Text | erfüllt mit Anmerkung | Unterschied: Schlusswort `:102` und die Zahlenprüfung `:38`/`:56`, die nur abbrechen kann und aus der Auflage zu den Zahlen folgt |
| Kein Fehlerfang | erfüllt | kein Ausnahmeblock in der Datei; Test `:19` |
| Replica-Fenster mit genau einer Löschanweisung | nicht erfüllt | H1 |
| Danach origin und Prüfung vor Phase B | erfüllt | `:72-75` vor `:77` |
| Zahl der gelöschten Journalzeilen gleich vorher gezählt | erfüllt | `:54`, `:69`, `:74` |
| Keine Gegenbuchung auf Gelöschtes | erfüllt | vorher `:62`, nachher `:75`; einziger Fremdschlüssel auf das Journal ist der Selbstverweis (`0028:17`, Suche über alle Migrationen) |
| Löschen nimmt die Zahlen der Probe, Abbruch bei Abweichung | erfüllt | `:15`, `:37-39`, `:56` (vor jeder Änderung) |
| Endprüfungen vor commit | erfüllt | `:91-95` vor `:102` |
| Sicherung nur Journal, IDs, Konto-ID und E-Mail | erfüllt | `:108-112`; Ziel unter `tmp/` (`.gitignore:14`), nicht unter `tmp/proof/`; Schwächen siehe M1 |
| Kontrolle der Append-only-Trigger nach dem Lauf | erfüllt | `:119-122`; Triggernamen stimmen (`0015_versions_published.sql:40`, `0028:47`); Schwäche siehe N2 |

## Antworten auf die Prüffragen

**UPDATE im Replica-Fenster freigeben?** Nein, siehe oben. Erst Probe ohne UPDATE.

**SQL-Syntax des Template-Literals?** Nach Lektüre gültig. Das Literal reicht von `:41` bis `:102` und enthält keinen Backtick und keinen Backslash. Einsetzungen: `NUTZER` (`:43`, `:91`), `FIRMEN` (`:45`, `:92`), `F8` (`:49`, `:95`), `erwartung` (`:56`), `COVER_FIRM` (`:58`), Schlusswort (`:102`). Die Begrenzer des Blocks (`:47`, `:100`) sind keine Einsetzung (keine geschweifte Klammer nach dem Dollarzeichen). Der Marker endet mit einem Dollarzeichen vor dem Hochkomma; im Block beendet nur der volle Begrenzer den Text, außerhalb (`:45`) steht er in einer Zeichenkette. Dasselbe Muster läuft in `sweep.ts:19` und `:59-92` bereits. `NUTZER`: zwei LIKE-Muster ohne Unterstrich, Klammerung der dritten Bedingung stimmt. `FIRMEN`: Klammern stimmen, verweist auf `tu`, das in `:43` vor `:45` entsteht und in `:92` noch besteht; in der Sicherung wird `FIRMEN` nicht benutzt (dort gäbe es `tu` nicht). `F8`: acht Unterabfragen, Klammern stimmen, kein Semikolon (wichtig für die Deklaration `:49`), alle acht Tabellen existieren. `erwartung`: Zeilenvergleich mit fünf Werten gegen fünf Ziffernfolgen (nur Ziffern, `:15`), fünf Platzhalter und fünf Argumente. Die Tabellenanlage mit Abwurf am Transaktionsende steht in der richtigen Reihenfolge der Klauseln (`:43-46`). Der SQL-Text bleibt nach meiner Schätzung unter der Grenze von 12000 Zeichen und geht als Argument an die CLI (`owner.ts:13`), ohne doppelte Anführungszeichen.

**plpgsql-Logik?** In Ordnung.
- Temporäre Tabellen: `tu` aus den drei Nutzerzweigen, `tr` als Anfragen dieser Kunden, `tf` als Testfirmen ohne Mitglied außerhalb von `tu`, `zahl` für die Rückgabe. Alle fallen am Transaktionsende weg, auch bei der Probe.
- Zählungen `:51-55` vor jeder Änderung, Zahlenprüfung `:56` direkt danach.
- Platzhalter und Argumente aller Ausnahmen stimmen (`:38` fünf, `:57` zwei, `:74` vier, `:79` zwei, sonst keine Platzhalter).
- Zeilenzählungen stehen jeweils direkt hinter der Anweisung (`:69`, `:71`, `:78`).
- Keine Variable trägt den Namen einer benutzten Spalte (Variablen: `n_u`, `n_r`, `n_j`, `n_f`, `n_c`, `v`, `w`, `f`, `f8`, `grenze`; Spalten der Rückgabetabelle `k`, `n`; Aliasse `t`, `c` in `:98`).
- Schleife `:81-89`: je Firma Schalter setzen, Kinder löschen, Firma löschen, wie `sweep.ts:70-76`; die Wächter lassen genau das zu (`0023_partners.sql:194`, `:203`, `0024_partner_admin.sql:158-159`). Eine noch gebundene Firma lässt die Anweisung scheitern und rollt alles zurück (kein Teilstand).
- Nach Phase B hängt an Testfirmen nichts mehr, sofern alle Bindungen an Testanfragen hingen: Zuordnungen, Angebote, Listings, Belege und Revisionen fallen mit der Anfrage (`0030_job_listings.sql:32-34`, `:56`, `0038_partner_offers.sql:19-21`, `0035_job_photos.sql:17-19`, `0018:12`).
- Endprüfungen `:91-95`: Eine übrig gebliebene Testanfrage hätte kein Profil mehr und fiele in `:93` auf. `rental_offers` hängt per Kaskade am Profil (`0001:144-146`); wäre ein Testnutzer Anbieter, schlüge `:95` an.
- Replica-Fenster: gilt nur für die Transaktion, wird in `:72` zurückgesetzt und in `:73` geprüft; ein Fehler rollt auch die Einstellung zurück. Im Katalog ändert das Skript nichts.
- Umgeht das Löschen im Journal Zeilenschutz oder Rechte, sodass null Zeilen gelöscht würden, schlägt `:74` an.

**Hält der Test die Auflagen fest?** Teilweise, siehe M2. Nach der Änderung zu H1 muss `:27-33` genau eine Anweisung im Fenster erwarten.

**Geld und Sicherheit sonst?** Kein Betrag wird gerechnet oder geändert. Das Journal echter Firmen ist durch `:61`, `:62`, `:75` und die RESTRICT-Schlüssel geschützt. Keine Secrets in Ausgabe oder Sicherung (Test-Adressen, Journal von Testanfragen, lokal unter `tmp/`). Keine Rechteänderung. Der Dev-Guard ist der erste Import (`:8`), das Gate lädt ihn zusätzlich (`gate-loesch.mjs:62`).

## Reihenfolge für die nächste Runde

1. Datei ändern: H1, M1, N1, N2, nach Wahl N5. Test ergänzen: M2. Gezielter Lauf des Unit-Tests auf dem committeten Stand.
2. Auftrag Lösch-Freigabe 2 mit neuem Hash (Datei `tmp/proof/dev1/loesch-freigabe-2.md`, Vorgänger dieser Bericht).
3. Nach Freigabe und Übernahme in den Commit: Probe. Scheitert sie mit 23503 an `copied_from_revision_id`: nichts weiter starten, Log nennen, dann Runde 3 mit dem UPDATE.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/dev-testdaten-zuruecksetzen.mjs:8` | Guard ist der erste Import: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:15` | nur `probe` ohne Zahlen oder `loeschen` mit fünf Ziffernfolgen: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:20` | nur `pid` geprüft: N1 |
| `scripts/dev-testdaten-zuruecksetzen.mjs:26-27` | drei Nutzerzweige, Live-Konten mit Zusatz: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:29-31` | Marker aus `marker.ts`, Abdeckungsfirma ausgeschlossen, Altfirmen mit fester Adresse und festem Namen: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:41`, `:102` | Grenzen des Literals, kein Backtick dazwischen: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:57-65` | neun Abbruchbedingungen vor dem Fenster: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:67-72` | Fenster mit zwei verändernden Anweisungen: H1 |
| `scripts/dev-testdaten-zuruecksetzen.mjs:73-75` | Rücksetzprüfung, Zählprüfung, Gegenbuchung ohne Ursprung, vor Phase B: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:77-79` | eine Anweisung für alle Testnutzer, Zählprüfung: in Ordnung |
| `scripts/dev-testdaten-zuruecksetzen.mjs:104-115` | Sicherung nur im Modus `loeschen`, ein Aufruf für das Journal, kein Zahlenvergleich: M1 |
| `scripts/dev-testdaten-zuruecksetzen.mjs:117-122` | Kontrolle nur bei Erfolg, leere Rückgabe unbemerkt: N2 |
| `tests/support/marker.ts:8`, `:11` | Marker ohne Hochkomma, endet mit Dollarzeichen; Firmenname ohne Sonderzeichen: in Ordnung |
| `tests/support/owner.ts:13` | Grenze 12000 Zeichen für die Übergabe als Argument |
| `tests/support/owner.ts:24-27` | CLI-Start ohne eigene Puffergrenze: M1 |
| `tests/support/owner.ts:29-35` | abgeschnittene Ausgabe wirft beim Parsen, Datenbankfehler werden geworfen: fail-closed |
| `scripts/sys/gate-loesch.mjs:53-56` | Register und Freigabe aus dem Commit vor dem Start |
| `scripts/sys/gate-loesch.mjs:66` | Start ohne Node-Schalter, Lauf-Kennung in der Umgebung: N3, N5 |
| `scripts/sys/gate-loesch.mjs:77` | Zahlenformat passt zu `:118` und `:120` des Skripts |
| `scripts/sys/gate-db-lib.mjs:39-51` | Format der Freigabe: dieser Bericht hält es ein |
| `scripts/sys/loesch-register.json:5` | Skript bindet `marker.ts` |
| `scripts/sys/run.mjs:76`, `:133` | Sperre mit `pid` und `kind`: N1 |
| `supabase/migrations/20261029141616_0001_foundation.sql:29`, `:107` | Profil hängt per Kaskade am Konto, Anfrage per Kaskade am Profil, Kunde Pflichtfeld |
| `supabase/migrations/20261101160000_0015_versions_published.sql:40-43` | Trigger `append_only` auf `audit_log` |
| `supabase/migrations/20261101180000_0017_status_machine.sql:138-146` | Löschen nur in Triggertiefe größer 1 |
| `supabase/migrations/20261101190000_0018_revisions_contacts.sql:12`, `:83-84`, `:116-117`, `:127-128` | Revision per Kaskade an der Anfrage; Wächter auf Revision und Anfrage; Zeiger auf die aktuelle Revision ohne Löschaktion |
| `supabase/migrations/20261107100000_0023_partners.sql:194`, `:203` | Firmen- und Kindlöschung nur mit gesetztem Schalter |
| `supabase/migrations/20261108110000_0028_commission_journal.sql:13-17`, `:31`, `:47-50` | Journal: RESTRICT auf Firma, Anfrage, Revision und Selbstverweis; Trigger `append_only` |
| `supabase/migrations/20261109120000_0040_change_orders.sql:11`, `:17` | Verweise der Revision auf Firma und Basisrevision ohne Löschaktion |
| `supabase/migrations/20261109180000_0046_cancel_by_partner.sql:10`, `:14`, `:16` | `reissued_from` und `copied_from_revision_id` ohne Löschaktion; Prüfregel lässt den leeren Wert zu |
| `supabase/migrations/20261109190000_0047_s9h2_abnahme.sql:36-42` | Folgeanfrage erbt den Kunden, Kopie verweist auf die aktuelle Revision der Quelle |
| `supabase/migrations/20261110100000_0052_account_deletion.sql:66`, `:74-78` | Anonymisierung setzt beide Löschzeitpunkte und leert die E-Mail: passt zum dritten Nutzerzweig |
| Suche über alle Migrationen: Fremdschlüssel auf das Journal | nur der Selbstverweis `0028:17` |
| Suche über alle Migrationen: Löschtrigger | nur Wächter, keiner mit eigener Löschanweisung |
| Suche über `scripts/`: Import von TypeScript-Dateien | nur das geprüfte Skript: N3 |
| Suche über das Repository: Adresse und Name der Altfirmen | nicht in `supabase/seed.sql`, nur in Tests und im Skript |
| `package.json:7`, `:71` | Node ab 22; `loesch` läuft mit den Werten aus der Umgebungsdatei über das Gate |
| `.gitignore:14` | `tmp/` nicht versioniert |
| `tmp/proof/dev1/runs.jsonl:1-3` | Läufe 2 bis 4 auf 953708d, Arbeitsbaum nicht sauber: N6 |

Offene Findings hoch: 1
