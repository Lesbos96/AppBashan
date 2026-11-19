Modell: claude-fable-5-2
SHA256: a71f7b7859d220b5ccaf2c0bd9d4620508e2c0cf8ad9c7f96a62b594bf2e33c4 scripts/setup-outbox.mjs
Urteil: frei

# Lösch-Freigabe 1, Schritt mail1 (R3)

Datum: 2026-11-18
Vorgängerbericht: keiner (Runde 1).
Geprüft (vollständig gelesen): `scripts/setup-outbox.mjs` (76 Zeilen, laut Auftrag Commit 2f2ff10).
Zur Einordnung gelesen: `.claude/rules/daten.md`, `scripts/dev-guard.mjs`, `scripts/setup-photo-publish.mjs` (Muster), `scripts/sys/gate-loesch.mjs`, `scripts/sys/gate-loesch-lib.mjs`, `scripts/sys/gate-db-lib.mjs:33-66`, `scripts/sys/loesch-register.json`, `scripts/scan-proof.mjs`, `supabase/functions/outbox-send/index.ts`, `supabase/functions/_shared/jobs/handlers.ts` (ganz), `_shared/jobs/brevo.ts`, `_shared/jobs/db.ts:107-144`, Migrationen 0030 (Outbox-Tabelle), 0031 (`outbox_put`), 0036 (`outbox_expire`, `outbox_dispatch`), 0074 und 0075 (ganz), `supabase/config.toml:436-437`, `tests/unit/outbox-handler.test.ts:114-205`, `tests/rls/sweep.test.ts:1-68`, `tests/support/partner.ts`, `tests/support/marker.ts`, `docs/STAND.md`, `docs/OFFEN.md:57`, `tmp/proof/mail1/runs.jsonl`, Kopfzeilen von `db-freigabe-2.md` und `db-freigabe-3.md`, die drei Berichte in `docs/freigaben/`, Suchen über `tests/` und `scripts/` nach Adress-Domains und nach den Vault-Namen.

Hinweise zum Nachweis:
- Die Hash-Zeile oben ist unverändert aus dem Auftrag übernommen, nicht nachgerechnet (kein Shell-Werkzeug). Das Gate rechnet sie beim Übernehmen und beim Start gegen die Datei nach.
- Ich konnte nichts ausführen und habe keinen Zugriff auf die Datenbank. Aussagen über den Datenbestand auf Dev (Adressen, Vault leer, deployte Fassung der Function) stammen aus dem Auftrag und aus `docs/`, nicht aus eigener Abfrage.
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.
- Zum Auftrag: Für `scripts/setup-photo-publish.mjs` liegt in `docs/freigaben/` keine Freigabe (Suche nach beiden Setup-Namen: 0 Treffer; dort stehen nur die Berichte zu `sweep.ts`, `race-copy.ts` und zum Dev-Reset). Dieses Urteil stützt sich deshalb nicht auf einen Vorläufer, sondern auf die eigene Lektüre.

## Ergebnis in einem Satz

Das Skript hält die Regeln aus `daten.md` ein (Guard zuerst, kein Wert in Ausgabe oder Fehlertext, Formatprüfung vor dem SQL, Löschbedingung auf zwei Vault-Namen begrenzt, Vault zuletzt, jeder Fehlerweg endet vor dem Vault-Schritt); dass die Probe nur den Betreiber erreicht, sichert aber nicht das Skript, sondern der Datenbestand: frei mit den bindenden Auflagen unten.

## Findings hoch

Keine.

## Findings mittel

M1. `scripts/setup-outbox.mjs:49-68` mit `supabase/functions/_shared/jobs/handlers.ts:332-340` – Der Dev-Schalter lässt nur Adressen mit reservierter Endung aus. Jede fällige Altzeile, deren Empfänger eine andere Endung hat, geht beim Probeaufruf als echte Mail raus. Das Skript prüft den Bestand vorher nicht, bricht bei mehr als einer gesendeten Mail nicht ab (`:65` prüft nur „mindestens eine“) und belegt mit „mindestens eine“ auch nicht, dass gerade die Probe-Zeile rausging. Die Annahme „alle Adressen auf Dev enden auf die Testdomain“ ist eine Aussage des Auftrags, die ich nicht prüfen kann. Im Repository gibt es Gegenbeispiele für kurzzeitig committete andere Adressen (`tests/rls/sweep.test.ts:56` Konto auf einer Beispiel-Domain mit Endung org, `:63` Firma mit Kontaktadresse auf einer at-Domain; beide `pending`, ohne Anfrage und ohne Zuordnung, also ohne Outbox-Zeilen, `afterAll` `:37-41` räumt sie ab), und von Hand angelegte Konten oder Firmen (Kontaktadresse wird nicht verifiziert) kennt kein Test. Folge bei falscher Annahme: veraltete Mails ohne personenbezogene Angaben und mit Link auf localhost an diese Adressen, nicht rückholbar. Fix (bei der nächsten Hash-Änderung): vor `:44` ein DO-Block, der wirft, wenn eine fällige Zeile einen Empfänger ohne reservierte Endung hat (Kunde über das Konto, Firma über `contact_email`), und nach der Schleife Abbruch vor dem Vault, wenn nicht genau eine Mail gesendet wurde. Für diesen Lauf: Auflagen 2 und 5.

M2. `scripts/sys/loesch-register.json:15` mit `scripts/setup-outbox.mjs:41` – Das Register bindet keine weitere Datei, das Skript deployt mit `--use-api` aber den Arbeitsbaum. Der Schutz der Probe steckt in `handlers.ts:274-276`, `:332-340` und `outbox-send/index.ts:31`; eine Änderung dort entwertet diese Freigabe nicht, und ein nicht committeter Stand würde deployt. Fix: entweder `supabase/functions/outbox-send/index.ts` und `supabase/functions/_shared/jobs/handlers.ts` im Register an das Skript binden (dann neue Freigabe bei jeder Änderung dort) oder es bei der Auflage je Lauf belassen. Für diesen Lauf: Auflage 3.

## Findings niedrig

N1. `tmp/proof/mail1/runs.jsonl:4-5` – Auf Dev liegt laut Marken nur 0074; für 0075 gibt es Freigabe 3 (frei), aber keine Push-Marke. Die Function des Endstands meldet verfallene „Unterwegs“-Zeilen mit dem Code für Verfall (`handlers.ts:328`); `outbox_mark` aus 0074 (`0074:159-172`) kennt ihn nicht und setzt die Zeile mit dem allgemeinen Fehlercode zurück auf wartend, sie würde bis zu fünfmal geholt. Kein Versand, aber Function und Datenbank passen erst mit 0075 zusammen (`daten.md:33`). Auflage 1.

N2. `scripts/setup-outbox.mjs:40`, `:74` – Das Secret steht als Argument eines Kindprozesses (lokale Prozessliste, kurz) und im SQL-Text des Vault-Schritts; scheitert dieser Befehl in der Datenbank, kann der Befehlstext im Datenbank-Log des Dev-Projekts landen. Gleiches Muster wie `setup-photo-publish.mjs:33`, `:38`. Kein Fix nötig; scheitert der Schritt `db query` nach bestandener Probe, an Beks berichten (er entscheidet über ein neues Secret).

N3. `scripts/setup-outbox.mjs:64` – Die Zahlen des Laufs stehen nur als Textzeile auf stdout; das Skript gibt keine Zahlzeilen im Format des Gates aus (`gate-loesch.mjs:77`), `loesch-lauf.jsonl` bleibt ohne Zahlen. Fix bei der nächsten Hash-Änderung: vier Zahlzeilen (gesendet, Fehler, übersprungen, verfallen). Bis dahin Auflage 5.

N4. `scripts/setup-outbox.mjs:8`, `:27` – Kommentar und Fehlermeldung nennen den direkten npm-Aufruf; freigegeben ist nur der Weg über das Gate. Eine Prüfung auf die Gate-Kennung wie im Dev-Reset fehlt. Der Guard-Hook sperrt Registerskripte am Gate vorbei (Muster `tests/unit/sys-guard.test.ts:300-316`). Fix bei der nächsten Hash-Änderung: Texte anpassen, Abbruch ohne Gate-Kennung.

N5. `handlers.ts:271` mit `scripts/setup-outbox.mjs:44`, `:52-55` – Die Probe-Mail trägt den Text einer echten Kundenmeldung. Jeder weitere Lauf legt eine neue Probe-Zeile an; eine Probe-Zeile, deren Versand scheiterte, bleibt wartend und geht nach dem Abstand von 15 Minuten erneut raus, sobald der Cron scharf ist. Anders als das Muster (`setup-photo-publish.mjs:45-46`) wiederholt das Skript einen Fehlstatus direkt nach dem Deploy nicht; das endet vor dem Vault (fail-closed), kostet aber einen zweiten Lauf mit zweiter Probe-Mail. Auflagen 4 und 6.

N6. `scripts/setup-outbox.mjs:40-51` – Das Skript kann vor dem ersten Abruf nicht feststellen, ob der Schalter in der Function wirkt. Er wird vor dem Deploy gesetzt (`:40` vor `:41`) und je Aufruf gelesen (`index.ts:31`), das halte ich für ausreichend. Wirkte er nicht, wäre es an den Zahlen zu sehen (übersprungen 0, gesendet größer 1): Auflage 5. Die bisher deployte Fassung kann nach Aktenlage nicht senden (ihr Zugang zum Mailserver wurde nie gesetzt, `docs/OFFEN.md:57`; Brevo-Fassung laut `docs/STAND.md:7` noch nicht deployt).

N7. `tmp/proof/mail1/runs.jsonl:18-21` – Kein Testlauf auf 2f2ff10; die letzten Läufe liefen auf b85bd92 mit unsauberem Arbeitsbaum, `en-route.test.ts` ist rot (erwartbar bis 0075 auf Dev liegt). Das Skript hat keinen Unit-Test. Die Freigabe stützt sich auf die Lektüre; die Pflichtläufe auf dem Endstand bleiben nötig.

N8. Für die Abnahme, nicht für dieses Skript: `handlers.ts:333-338` mit `_shared/jobs/db.ts:137-143` – Mit Schalter gilt eine Betreiber-Zeile als erledigt, wenn die Adresse des Kunden nicht gelesen werden kann (auch bei einem Fehler des Auth-Dienstes, der dort als leer zurückkommt). Betrifft nur Dev.

## Auflagen für den Lauf (bindend)

1. Erst Migration 0075 über `npm run db:push` auf Dev (Push-Marke in `runs.jsonl`), dann dieses Skript.
2. Vor dem Lauf belegt die Hauptsession die Datenannahme mit Zahlen aus einer nur lesenden Abfrage auf einem erlaubten Weg und nennt Quelle und Zeitpunkt in der Bewertung: wartende Outbox-Zeilen je Empfängerart und davon die mit einer Empfängeradresse ohne reservierte Endung (Kunden über das Konto, Firmen über `contact_email`). Die zweite Zahl muss 0 sein. Ist sie nicht 0 oder gibt es keinen erlaubten Leseweg: nicht starten, Beks berichten.
3. Start nur über `npm run loesch -- scripts/setup-outbox.mjs`, nach Übernahme und Commit dieser Freigabe, mit sauberem Arbeitsbaum; `supabase/functions/outbox-send/index.ts` und die Dateien unter `supabase/functions/_shared/jobs/` sind gegenüber 2f2ff10 unverändert (sonst neue Runde).
4. Endet der Lauf mit EXIT ungleich 0: Meldung im Wortlaut berichten. Höchstens eine Wiederholung, und nur, wenn die Meldung weder Status 401 noch 503 nennt (dann fehlen Secrets, die Beks setzt). Nie den Vault auf anderem Weg füllen.
5. Die Zeile „Probe: …“ steht im Wortlaut in der Bewertung. Erwartet ist genau eine gesendete Mail. Sind es mehr: sofort anhalten, nichts nachbessern, Beks die Zahl berichten (dann gingen Mails an Adressen ohne Testendung).
6. Beks erfährt im Bericht, dass an die Betreiber-Adresse eine Probe-Mail mit dem Text einer Kundenmeldung ging (je Lauf eine) und dass sie keine echte Meldung ist.
7. Die Freigabe gilt für Dev und diesen Hash. Produktion richtet GOLIVE 35 ein, nicht dieses Skript.

## Antworten auf die Prüffragen

**Dev-Guard als erster Import?** Ja, `:9` vor `:10-12`. Der Guard prüft drei Quellen der Ref und legt sie für Kindprozesse fest (`dev-guard.mjs:7-22`); das Gate lädt ihn zusätzlich (`gate-loesch.mjs:62`). Die Aufrufadresse der Function entsteht aus derselben, vom Guard geprüften URL (`:26`, `:36`), das Secret im Header geht also nur an das Dev-Projekt.

**Kein Wert in Ausgabe, Fehlertext oder Log?** Ja. Die CLI läuft ohne jede Ausgabe (`:19`), ihr Fehler wird verworfen und durch eine feste Meldung mit den ersten zwei Wörtern des Befehls ersetzt (`:20-22`; die Werte stehen ab dem dritten Argument). Die Ausnahmen `:27`, `:34`, `:37` haben festen Text. Die Meldungen `:32`, `:53`, `:61`, `:64`, `:66`, `:76` nennen nur Variablennamen, Status und Zahlen. Ungefangene Fehler (`appendFileSync`, `fetch`, `res.json`) tragen Pfad, Hostnamen oder einen Anfang der Antwort, nie Header oder Secret. Die Function loggt nur Ereignis, Zeilennummer, Art und festen Code (`handlers.ts:313`, `:327`, `:336`, `:345`). Rest: N2.

**Hex-Regex vor dem SQL?** Ja: `:34` vor der ersten Verwendung in `:40` und vor `:74`; die Function-URL wird in `:37` auf ein Muster ohne Hochkomma geprüft. In den SQL-Text gehen nur diese beiden geprüften Werte; der SQL-Text der Probe (`:44`) ist fest.

**Löschbedingung eng?** Ja: `:74` löscht in `vault.secrets` genau die zwei Namen des Mailversands und legt sie im selben Befehl neu an. Die Namen der Foto-Pipeline sind andere (`setup-photo-publish.mjs:38`, `setup-photo-cleanup.mjs:36`). Bleibt der Befehl halb stehen, ruft der Cron nicht auf (`0075:66`, auf dem heutigen Stand `0036:69`): fail-closed.

**Andere Tabellen berührt?** Das Skript selbst schreibt nur den Vault und eine Outbox-Zeile über `private.outbox_put` (`:44`; zulässig nach `0074:103-110`, `request_id` ist leer erlaubt, `0030:107`). Die aufgerufene Function ändert zusätzlich den Zustand aller fälligen Outbox-Zeilen (übersprungene Testzeilen gelten danach als gesendet, verfallene als gescheitert). Das ist beabsichtigt, aber nicht umkehrbar. Sonst liest sie nur (`db.ts:109-143`).

**Reihenfolge?** Function-Secrets `:40`, Deploy `:41`, Probe-Zeile `:44`, Aufrufe `:49-59`, Vault `:70-75`. Der Cron wird erst mit dem Vault scharf, sofern der Vault heute leer ist (`docs/OFFEN.md:57`, nicht in der Datenbank geprüft). Wäre er schon gefüllt, träfe der Cron bis zum Deploy die alte Fassung ohne Mailzugang (N6).

**Abbruch ohne Vault-Änderung, wenn die Probe scheitert?** Ja. Jeder Fehlstatus (`:52-55`), eine nicht leere Outbox nach 80 Aufrufen (`:60-63`), keine gesendete Mail (`:65-68`), ein Fehler der CLI (`:22`) und jede ungefangene Ausnahme beenden den Prozess vor `:70`. Fehlen Felder in der Antwort, wird die Summe keine Zahl, die Schleife läuft aus und endet in `:60-63`.

**Kann der Probeaufruf an echte Adressen senden?** Nicht an Adressen mit reservierter Endung: Kundenzeilen `handlers.ts:322`, `:333-334`, Firmenzeilen über `contact_email` (`0075:29-30`), Betreiber-Zeilen zu Anfragen von Testkonten oder ohne lesbaren Kunden `:333-334`; fehlt die Adresse ganz, gibt es keinen Versand (`:323`). Die Probe-Zeile ohne Anfrage geht an den Betreiber (`:333`, Unit-Test `outbox-handler.test.ts:198-199`). An jede andere Adresse im Bestand würde gesendet; das schließt das Skript nicht aus: M1, Auflagen 2 und 5. Die Tests und Live-Skripte legen Konten und Firmen fast durchweg auf der Testdomain an (`tests/support/partner.ts:12`, `:15`, `tests/support/db.ts:31`, Live-Skripte), der Seed enthält keine Adressen (Suche: 0 Treffer).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/setup-outbox.mjs:9` | Guard ist der erste Import: in Ordnung |
| `scripts/setup-outbox.mjs:17-24` | CLI ohne Ausgabe, feste Fehlermeldung ohne Werte: in Ordnung |
| `scripts/setup-outbox.mjs:28-34` | Secret aus der Umgebung oder neu erzeugt und nur angehängt, Formatprüfung vor jeder Verwendung: in Ordnung |
| `scripts/setup-outbox.mjs:36-37` | URL aus der geprüften Projekt-URL, Muster ohne Hochkomma: in Ordnung |
| `scripts/setup-outbox.mjs:40-41` | drei Function-Secrets in einem Befehl, danach Deploy; Brevo-Werte werden nicht angefasst: in Ordnung |
| `scripts/setup-outbox.mjs:44` | eine Zeile, Betreiber, ohne Anfrage, Schlüssel je Lauf neu: in Ordnung; N5 |
| `scripts/setup-outbox.mjs:47-59` | Abbruch bei jedem Status ungleich 200, Ende bei weniger als 25 angefassten Zeilen: in Ordnung |
| `scripts/setup-outbox.mjs:60-68` | zwei Abbrüche vor dem Vault; Prüfung nur auf mindestens eine gesendete Mail: M1 |
| `scripts/setup-outbox.mjs:70-75` | einzige Löschanweisung, zwei Namen, sofort neu angelegt, letzter Schritt: in Ordnung; N2 |
| `scripts/dev-guard.mjs:7-22` | Abbruch bei abweichender Ref aus drei Quellen, Ref für Kindprozesse festgelegt |
| `scripts/sys/gate-loesch.mjs:53-56`, `:62`, `:66` | Register und Freigabe aus dem Commit, Guard, Kennung für das Kind |
| `scripts/sys/gate-db-lib.mjs:39-66` | Format der Freigabe: dieser Bericht hält es ein |
| `scripts/sys/loesch-register.json:15` | Eintrag ohne gebundene Dateien: M2 |
| `supabase/functions/outbox-send/index.ts:28-32` | Secret, Schalter je Aufruf gelesen, Versand nur mit allen vier Werten |
| `supabase/functions/_shared/jobs/handlers.ts:274-276` | reservierte Endungen (vier), nur die letzte Endung zählt |
| `supabase/functions/_shared/jobs/handlers.ts:298-302` | Methode, Secret (401), dann Einrichtung (503), erst danach Zugriff auf die Outbox |
| `supabase/functions/_shared/jobs/handlers.ts:316-351` | je Zeile: Empfänger, Verfall, Schalter, Versand; Fehler stoppt den Lauf nicht |
| `supabase/functions/_shared/jobs/handlers.ts:332-340` | mit Schalter: Testadresse oder Betreiber-Zeile zu Testkonto wird übersprungen und als erledigt markiert |
| `supabase/functions/_shared/jobs/db.ts:133-143` | Adresse über die Auth-Verwaltung; Fehler ergibt leer (kein Versand bzw. übersprungen): N8 |
| `supabase/functions/_shared/jobs/brevo.ts:15-35` | Fehler ohne Empfänger und ohne Antworttext |
| `supabase/config.toml:436-437` | Function ohne JWT-Prüfung des Gateways, Schutz allein über den Header |
| `supabase/migrations/20261108130000_0030_job_listings.sql:101-113` | `request_id` darf leer sein, Schlüssel eindeutig |
| `supabase/migrations/20261108140000_0031_distribute_accept.sql:19-27` | `outbox_put`: reines Einfügen, bei gleichem Schlüssel nichts |
| `supabase/migrations/20261118071002_0074_mail1_unterwegs.sql:102-110` | Art und Empfängerart der Probe erlaubt, Empfänger-ID leer genau beim Betreiber |
| `supabase/migrations/20261118071002_0074_mail1_unterwegs.sql:137-172` | Stand auf Dev: Abstand nach Fehlversuch, kein Verfallscode: N1 |
| `supabase/migrations/20261118074249_0075_mail1_faellig.sql:6-12`, `:55-69` | fällig-Definition; Cron ruft ohne beide Vault-Werte nicht auf |
| `supabase/migrations/20261108190000_0036_outbox_harden.sql:58-72` | heutiger Cron-Stand: ebenfalls kein Aufruf ohne Vault-Werte |
| `tests/unit/outbox-handler.test.ts:118-136`, `:192-200` | Testadressen übersprungen, andere gesendet, Probe ohne Anfrage gesendet |
| `tests/rls/sweep.test.ts:33`, `:56`, `:63`, `:37-41` | zwei committete Fixtures mit nicht reservierter Endung, `pending`, werden abgeräumt: M1 |
| `tests/support/partner.ts:12`, `:15` | Testfirmen und Testnutzer auf der Testdomain |
| `tests/rls/partners.test.ts:73`, `:260-261`, `:420` | andere Adressen nur in Rollback-Proben bzw. in einem abgewiesenen Aufruf |
| Suche `supabase/seed.sql` nach Adressen | 0 Treffer |
| Suche `scripts/` nach den Vault-Namen | drei Skripte, drei getrennte Namenspaare |
| Suche `docs/freigaben/` nach den Setup-Skripten | 0 Treffer: kein Vorläufer |
| `tests/unit/sys-guard.test.ts:300-316` | Registerskripte am Gate vorbei werden gesperrt (Muster am Nachbarskript): N4 |
| `docs/OFFEN.md:57` | Mailversand bisher nicht eingerichtet, Vault-Werte fehlen (Aktenlage) |
| `docs/STAND.md:6-7` | 0075 nicht gepusht, `outbox-send` noch nicht neu deployt (Stand der Datei) |
| `tmp/proof/mail1/runs.jsonl:4-5`, `:18-21` | Push-Marke nur für 0074; letzte Läufe auf b85bd92, unsauber: N1, N7 |
| `tmp/proof/mail1/db-freigabe-3.md:9`, `:13`, `:117` | Freigabe für 0075 liegt vor (frei, hoch 0), Hash wie Antrag 3 |

Offene Findings hoch: 0
