Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme R3, Schritt mail1, Runde 1

Datum: 2026-11-19
Stand laut Sitzungskontext: Branch `mail1`, HEAD 4edba99, Arbeitsbaum sauber.

Geprüft (vollständig gelesen): die zehn Pflichtdateien unten, dazu `supabase/migrations/20261118071002_0074_mail1_unterwegs.sql`, `supabase/migrations/20261118074249_0075_mail1_faellig.sql`, `scripts/setup-outbox.mjs`, `tests/rls/en-route.test.ts`, `tests/unit/brevo.test.ts`, `tests/unit/outbox-handler.test.ts`, `src/lib/partnerJobs.ts`. Von `database.types.ts` und `tests/support/positiv.ts` nur die Stellen zu den neuen Objekten (Suche), nicht die ganzen Dateien.
Zur Einordnung gelesen: `.claude/rules/geld.md`, `.claude/rules/daten.md`, `.claude/rules/tests.md`, Migration 0036 (ganz), 0023:90-105 und :242-249, 0031:19-27, 0064:120-172, `src/lib/arrival.ts`, `src/screens/Auftrag.tsx:23`, `:87`, `scripts/scan-proof.mjs`, `tmp/proof/mail1/runs.jsonl`, `tmp/proof/mail1/loesch-lauf.jsonl`, Logs 019 (ganz) und 020 (Kopf), Log 001 (nur Fehlerzeilen), Findings der DB-Freigaben 1 und 3, `docs/OFFEN.md:57-60`, `docs/GOLIVE.md:70-82`, `docs/ENTSCHEIDUNGEN.md` Nr. 175, 203, 207 bis 212, `docs/STAND.md:5-8`.

Hinweise zum Nachweis:
- Die Hash-Zeilen sind unverändert aus dem Auftrag übernommen, nicht nachgerechnet (kein Shell-Werkzeug). Das Gate vergleicht sie mit dem Endstand.
- Ich konnte nichts ausführen und habe keinen Zugriff auf die Datenbank, auf Brevo oder auf die Function-Logs. Aussagen über den Bestand auf Dev, die deployten Versionen und die Smoke-Aufrufe stammen aus dem Auftrag.
- Inhaltliche Abweichung von einem früheren Stand habe ich in keiner Pflichtdatei gesehen: `package.json` ohne SMTP-Paket, `database.types.ts` mit `en_route_eta` (`:1334`), `can_en_route` (`:1849`) und `set_en_route` (`:2163`), `loesch-register.json:33` nennt für `tests/support/positiv.ts` denselben Hash wie der Auftrag, die beiden Freigaben in `docs/freigaben/` tragen die Hashes a71f7b78… und 63cb9118… für `scripts/setup-outbox.mjs` und das Urteil frei. Die Kopien in `docs/freigaben/` habe ich nicht Byte für Byte mit `tmp/proof/mail1/loesch-freigabe-1..2.md` verglichen.
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.

SHA256: f6563a5a10cec3a8c2f73887b6d8f41f3cf5245a5b261b51355bccc68ef241d6 docs/freigaben/mail1-loesch-freigabe-1.md
SHA256: 4c5101e6bf4d596f37e39126a9314ec64fe3545e3b3266c72449834ecf3febf3 docs/freigaben/mail1-loesch-freigabe-2.md
SHA256: 0978be96367d86f8ec947eba1e21acb65d99ba959b716caed0911ac10ffdbc9e package.json
SHA256: 3837afa2db3641ed04feaa0c092697558496dcf029e5d5381d564f7a3155de5a scripts/sys/loesch-register.json
SHA256: 04eefaed9cc9ebc029785e8be5799a4cb14881ff118bb700201692b3f6da2231 supabase/functions/_shared/database.types.ts
SHA256: cb14a72b787783da030ac3634dc5256122c88435d87069b84e3b01187a320db5 supabase/functions/_shared/jobs/brevo.ts
SHA256: 42febb985f239c9b5bc630ad11b07423d14bb13439512e437829b131ffcea44b supabase/functions/_shared/jobs/db.ts
SHA256: 4bfad3a09420bd3d92196f44df2bc2129100ae1cdbfce4cc4a61e8a5c0c439d3 supabase/functions/_shared/jobs/handlers.ts
SHA256: a95e1227ed2275485262083b86fdb2dcdfc68bf8aa82083ae9e7a4ad6f0a6aef supabase/functions/outbox-send/index.ts
SHA256: 4abeb19ddd9d06863c2cace7d0b8d50e6155b182af1bad8018ca9fa8e781c07e tests/support/positiv.ts

## Ergebnis in einem Satz

Rechte, Secret-Handhabung, Mailtexte, Dev-Schalter, Verfall und Wiederholung sind wie beschlossen gebaut und im Code belegt, kein hoher Fund; offen sind sechs mittlere Punkte, davon zwei neu (Firmen-Mails gehen an eine ungeprüfte, frei änderbare Adresse; Kontofehler des Anbieters verbrauchen die Versuche aller Mails ohne Alarm) und zwei zum Nachweis (kein Live-Beleg der „Unterwegs“-Kette, kein `check` auf dem Endstand).

## Findings hoch

Keine.

## Findings mittel

M1. `supabase/migrations/20261107100000_0023_partners.sql:242`, `:247-249` mit `supabase/migrations/20261118074249_0075_mail1_faellig.sql:29-30` und `supabase/functions/_shared/jobs/handlers.ts:322` – Firmen-Mails gehen an `contact_email`. Diese Adresse ändert jedes Mitglied einer Firma im Zustand pending, active oder payment_hold selbst, geprüft wird nur die Form (`0023:26`), nie der Besitz. Bisher ohne Wirkung, seit mail1 gehen echte Mails hinaus: Eine freigeschaltete Firma kann je Anfrage in ihrem Gebiet eine Mail von MoveNow an eine fremde Adresse auslösen (Missbrauch oder Tippfehler; unerwünschte Mails, Beschwerden und Rückläufer treffen den Absender). Inhalt ist unkritisch (kein Betrag, kein Kontakt), eine Einschleusung in Kopfzeilen gibt es über die HTTP-API nicht. Weder OFFEN noch GOLIVE nennen den Punkt (Suche: keine Treffer). – Fix: als Punkt nach OFFEN und als Pflicht vor `booking_open` nach GOLIVE; Beks entscheidet zwischen Bestätigung der Adresse (Mail mit Link, erst danach Versand) und Versand an die Anmeldeadresse des Kontos. Nicht in mail1 nachbauen.

M2. `supabase/functions/_shared/jobs/handlers.ts:289-291`, `:344-353` mit `supabase/functions/_shared/jobs/brevo.ts:41` und `0075:44-46` – Die Unterscheidung dauerhaft/vorübergehend hat in der Datenbank keine Wirkung: beide Codes bleiben wartend bis zum fünften Versuch (rund 21 Stunden), danach endgültig gescheitert. Ein Fehler, der das Konto betrifft (Schlüssel ungültig, Konto gesperrt, IP-Sperre, Tageskontingent des Gratis-Plans, `docs/GOLIVE.md:78`), trifft jede geholte Zeile: der Lauf arbeitet nach dem ersten solchen Fehler alle 25 Zeilen weiter ab, jede verbraucht einen Versuch. Dauert die Störung länger als die fünf Versuche, sind alle bis dahin wartenden Mails verloren; es gibt keinen Alarm und keinen beschriebenen Weg, gescheiterte Zeilen erneut zu senden. Beim Tageskontingent reicht eine Erschöpfung früh am Tag (fünfter Versuch vor der Rücksetzung). Auf Dev heute ohne Schaden (drei Läufe mit 401 haben nur Versuche der Probe und der Zeilen ohne Empfänger verbraucht). OFFEN mail1-1 fragt nur, ob 401 und 403 als vorübergehend gelten sollen; das ändert nichts, weil beide Codes gleich behandelt werden. – Fix: (a) OFFEN mail1-1 richtigstellen; (b) im späteren Schritt mit Migration: bei einem Kontofehler den Lauf abbrechen und die geholten Zeilen ohne Versuchszählung zurückgeben; (c) GOLIVE: Betrieb der Outbox (wer sieht gescheiterte Zeilen, wie werden sie erneut gesendet, Kontingent des Plans gegen die erwartete Menge an Firmen-Mails je Anfrage).

M3. `supabase/functions/_shared/jobs/db.ts:133-143` (bekannter Punkt 1) – Ein Fehler der Auth-Abfrage ergibt eine leere Adresse und damit den Code für fehlenden Empfänger. Bewertung: Die Darstellung in `docs/GOLIVE.md:82` stimmt (die Zeile wird bis zu fünfmal geholt, verloren ist die Mail erst nach dem fünften Versuch); falsch ist nur der Code, und eine Störung des Auth-Dienstes über alle Versuche hinweg verliert die Mail. Die Ursache der 336 Dev-Zeilen (per SQL angelegte und gelöschte Konten) ist in `docs/OFFEN.md:59` nachvollziehbar belegt, von mir nicht nachprüfbar. Dass Beks den Umbau verschiebt, ist vertretbar, weil GOLIVE 46 ihn zur Pflicht vor `booking_open` macht. – Fix: wie GOLIVE 46; bleibt offen.

M4. `tests/rls/flow-live.test.ts:418`, `:436` mit `supabase/functions/_shared/jobs/db.ts:109-113` – Die Kette „Unterwegs“ (Aufruf der Firma, Outbox-Zeile, Abholen, Lesen der Ankunftszeit mit dem Secret Key, Mail oder Verfall) ist nirgends live belegt. Der Live-Test ruft nur die Kundenmeldung auf; `enRouteExpired` läuft in den Unit-Tests nur als Attrappe (`tests/unit/outbox-handler.test.ts:154-175`); der Lauf 11eb1bd2 meldet verfallen=0 und nur die Probe als gesendet. Die Datenbankseite ist belegt (`tests/rls/en-route.test.ts:58-66`, `:156-179`). Scheitert das Lesen live, wäre die Folge begrenzt (Wiederholungen, dann gescheitert; der Kunde sieht die Zeit in der App). – Fix: vor `npm run fertig` ein Live-Beleg auf Dev (Zeile der Art „Unterwegs“ wird von der Function abgeholt und endet je nach Ankunftszeit als übersprungen oder verfallen, Zahlen aus der Antwort) oder der Punkt mit Begründung nach OFFEN.

M5. `tmp/proof/mail1/runs.jsonl:20` – Der letzte `check` ist Lauf 018 auf b85bd92 mit unsauberem Arbeitsbaum, vor den späteren Änderungen an `brevo.ts` und `handlers.ts` (Diagnose des Anbieters; Commits bis 7a43439). Der Auftrag nennt „check grün (Lauf 0xx)“ ohne Nummer; einen `check` auf dem Endstand finde ich nicht, ebenso keine Volläufe `e2e` und `rls`. Auf dem Endstand bzw. dem letzten Code-Stand liegen nur die Unit-Läufe 030 und 031 (7a43439, sauber), `flow-live` 032 und `shots:all` 033 (4edba99, sauber). – Fix: die Volläufe wie in `docs/STAND.md:8` vorgesehen auf dem committeten Endstand; das Gate verlangt sie ohnehin. Diese Abnahme stützt sich auf die Lektüre, nicht auf einen grünen `check` des Endstands.

M6. `tests/rls/en-route.test.ts:137-154` gegen `0075:63` (M1 der DB-Freigabe 3, weiter offen) – Kein Test misst, dass `outbox_dispatch` den Aufruf der Function auslässt, solange nur Zeilen im Wiederholungs-Abstand warten. Steht in OFFEN mail1-1. – Fix wie dort.

## Findings niedrig

N1. `tmp/proof/mail1/loesch-lauf.jsonl:2` gegen `:1`, `:3`, `:4` – Lauf 3f441650 (22:23 UTC) meldet nur einen Fehler (die Probe), die Läufe davor und danach rund 336 Zeilen ohne Empfänger. Nach dem ersten Versuch um 09:05 UTC wären diese Zeilen um 22:23 fällig gewesen (Abstand 15 Minuten); die Läufe 3 und 4 passen dagegen zum Abstand (22:53, dann 00:12, mehr als eine Stunde später). Ich kann die Ursache nicht prüfen (denkbar: Zeilen zu dem Zeitpunkt gesperrt und deshalb übersprungen, oder ein weiterer Abruf dazwischen). Die Abstandsregel selbst ist per Test belegt (`en-route.test.ts:143-152`). – Fix: Erklärung in die Bewertung (Auflage 5 der Lösch-Freigabe 2 verlangt den Abgleich der Zahlen).

N2. `tmp/proof/mail1/019-tests_rls_en-route.test.ts.log:4-5`, `:46-57`, `:71-74` – Rot-Beweis: Zeile `Schalter:` leer, `Argumente:` leer, gleicher `dateiSha` wie der grüne Lauf 020 (`runs.jsonl:21`, `:24`), Rot vor Grün, Grün auf sauberem Baum ohne Schalter. Der zweite Fehlschlag misst einen Ist-Wert (Zeile bleibt wartend statt endgültig verfallen), der erste nur die fehlende Hilfsfunktion (42883). Das Rot der Endfassung deckt nur die Teile aus 0075; für `set_en_route` und die Betreiber-Zeile gibt es Rot nur mit früheren Fassungen der Datei (Lauf 001: Betreiber-Zeile fehlt, Ist-Wert leer). Die Bedingung des Gates ist erfüllt; ich zähle den Lauf.

N3. `supabase/functions/_shared/jobs/brevo.ts:30-34` mit `handlers.ts:309-310` – Ein zweiter Weg zur Doppel-Mail ist nicht benannt: Zeitüberschreitung nach 5 Sekunden, obwohl der Anbieter die Mail schon angenommen hat; die Zeile wird nach 15 Minuten erneut gesendet. Entscheidung 209 und der Kommentar nennen nur das gescheiterte Markieren. Durch „mindestens einmal“ gedeckt. – Fix: ein Halbsatz im Kommentar und in Nr. 209 bei der nächsten Änderung.

N4. `0075:9-11` mit `handlers.ts:327-332` (bekannter Punkt 3) – Nach einem Fehlversuch kommt die „Unterwegs“-Mail frühestens 15 Minuten später: bei der Wahl 15 Minuten nie, sonst genau ein weiterer Versuch. Durch den Verfall begrenzt, die App zeigt die Zeit unabhängig von der Mail. Kein Fix (Entscheidungen 209, 211).

N5. `handlers.ts:275-276` mit `tests/unit/outbox-handler.test.ts:131-138` – Der Dev-Schutz kennt nur die vier reservierten Endungen, nicht die reservierten Beispiel-Domains unter den üblichen Endungen (so gewollt, der Unit-Test nutzt sie als „echte“ Adressen). Seit Lauf 11eb1bd2 ist der Cron auf Dev scharf: jede committete Testzeile an eine Adresse ohne reservierte Endung wird über Brevo echt versendet (Rückläufer belasten das Konto). – Fix: Testdaten mit committeten Zeilen nur auf reservierten Endungen; optional ein Unit-Test, der das für `tests/support/**` prüft.

N6. `docs/GOLIVE.md:71` mit `handlers.ts:334-342` – Dass der Dev-Schalter in Produktion fehlt, prüft nur ein Mensch (Liste der Secret-Namen). Wäre er dort gesetzt, gälte eine Betreiber-Meldung als erledigt, sobald die Adresse des Kunden nicht lesbar ist (still verloren). – Fix: Prüfpunkt bleibt Pflicht; optional beim Einrichten der Produktion ein Probeaufruf, dessen Antwort „übersprungen“ gleich 0 zeigt.

N7. `package.json:65` mit `scripts/setup-outbox.mjs:16-19` – Das npm-Skript `setup:outbox` ist ein toter Weg: ohne Gate-Kennung bricht das Skript sofort ab. – Fix: bei der nächsten freigegebenen Änderung an `package.json` streichen (Gate-Datei, nur mit Beks).

N8. `scripts/sys/loesch-register.json:15` und `scripts/setup-outbox.mjs:24-31` – Unverändert aus Lösch-Freigabe 2 (M1, M3): keine gebundenen Function-Dateien, Vorprüfung hängt am Exit-Code der CLI. Der Hash des Skripts ist unverändert, beides steht in OFFEN mail1-1.

N9. `0075:6-12`, `:63` – Die Hilfsfunktion wird wegen der SET-Klausel nicht eingesetzt; der Cron prüft jede Minute alle Zeilen der Outbox einzeln, erledigte Zeilen bleiben für immer. Steht in OFFEN mail1-1 (Aufbewahrung). Kein Fix jetzt.

N10. `handlers.ts:325` vor `:327` – Eine „Unterwegs“-Zeile zu einem gelöschten Kundenkonto verfällt nicht, sondern verbraucht fünf Versuche. Folgt aus OFFEN mail1-2. Kein eigener Fix.

N11. `docs/STAND.md:7`, `docs/OFFEN.md:57` gegen `tmp/proof/mail1/loesch-lauf.jsonl:4` – Beide Dateien sagen noch „Probe abgelehnt, Vault leer, Cron aus“; der Lauf 11eb1bd2 endete mit Exit 0 und einer gesendeten Mail. `docs/GOLIVE.md:72` verweist für den Text der Pauschalen-Mail auf `handlers.ts:240`, er steht in `:265`. – Fix: beim Fertigstellen der Doku nachführen.

## Prüffragen

**Rechte.** `set_en_route`: SECURITY DEFINER mit leerem `search_path` (`0074:11`), EXECUTE nur für `authenticated` (`0074:41`); der Test misst authenticated ja, anon, PUBLIC und service_role nein (`en-route.test.ts:54`, `:98`) und 42501 für anon und service_role (`:83-84`, `:124-125`). aal2 wird in der Funktion geprüft (`0074:21`, Test `:82`, `:123`) und zusätzlich in `private.my_job_partner_id` (`0023:97-102`, Firma active oder payment_hold). Aufruferprüfung: Zeile gesperrt, dann Zuordnung der eigenen Firma ohne Ende (`0074:24-27`); fehlende Anfrage und fremde Firma liefern denselben Code (kein Existenz-Orakel); Kunde als Aufrufer scheitert an der Firma (`:81`, `:122`). Wiederholung: erst nach der Zuordnungsprüfung, liefert die gespeicherte Zeit ohne Schreiben (`0074:28`; Test: Audit und Outbox bleiben bei 1, `:63-65`, `:107-109`; auch nach dem Start, `:95`). Wiener Tag: Vergleich der Kalendertage in Europe/Vienna (`0074:31`), `termin_at` ist Pflichtspalte (`0018:114`), Test an der Tagesgrenze (`:51-52`, `:71-72`, `:114-115`). Direktes UPDATE der Spalte scheitert für Kunde und Firma (`:68-69`, `:112-113`). `my_jobs`: nach drop und create neuer Grant nur für `authenticated` (`0074:45-46`, `:99`), Rumpf bis auf die zwei neuen Spalten wie 0064:123-169, Beträge unverändert aus dem Journal. `report_not_done`: `create or replace`, Rechte bleiben; Betreiber-Zeile einmal je Anfrage (früher Rücksprung `0074:126`, Dedupe-Schlüssel `:131`, Test `:187-190`). `private.outbox_is_due`: kein Grant, Aufrufer sind nur Funktionen des Eigentümers (`0075:23`, `:63`); `outbox_dispatch` hat laut Register keinen Aufrufer außer dem Eigentümer (`positiv.ts:466`). Register: `set_en_route` und `my_jobs` eingetragen (`positiv.ts:173`, `:240-246`, `:264`); das Register führt nur Funktionen in `public`. Keine Rechte-Ausweitung gefunden. Wie ein Kunde oder eine Firma das missbrauchen kann: je Auftrag höchstens eine „Unterwegs“-Mail und eine Betreiber-Mail; offen ist nur M1.

**Secrets.** Der Brevo-Schlüssel steht nur im Header der Anfrage (`brevo.ts:28`), nie im Fehler (`:6-14`, `:39-41`), nie im Log. `index.ts:12-16` nennt bei fehlendem Wert nur den Namen. Aufruf ohne oder mit falschem Header: 401 vor jedem Zugriff (`handlers.ts:298-302`, Vergleich über Hashwerte `:279-285`). Das Setup-Skript gibt keinen Wert aus (`setup-outbox.mjs:24-31`, feste Meldungen), prüft Secret und URL auf ein enges Format, bevor sie in SQL gelangen (`:38`, `:41`). Rest wie Lösch-Freigabe 1, N2 (Secret kurz als Prozessargument und im SQL-Text des Vault-Schritts).

**Adress- oder Betragsleck.** Texte: `handlers.ts:249-272` ohne Betrag, Kontakt, Namen, Auftragsnummer; „Unterwegs“ ohne Uhrzeit (`:269`), Betreiber-Mail ohne Link und ohne Auftrag (`:271`); alle 21 Arten des CHECK (`0074:104-106`) haben einen Text. Logs: nur Ereignis, Zeilennummer, Art, fester Code, Status, Kürzel (`:315`, `:329`, `:338`, `:350-351`). Antwort: Zähler und „Status:Kürzel“ (`:348-349`, `:358`), das Kürzel besteht nur aus Kleinbuchstaben und Unterstrich (`brevo.ts:19`, `:40`). Tests dazu: `brevo.test.ts:25-36`, `outbox-handler.test.ts:79`, `:100`, `:116`, `:128`, `:191`, `:216`. Geld ist nicht berührt: keine Rechnung geändert, `my_jobs` liefert dieselben Summen, kein Gebührenwort in Kundenmails.

**Dev-Guard nur mit Schalter.** `index.ts:31` (genau der Wert 1), `handlers.ts:334-342`; ohne Schalter normaler Versand, der Kunde der Anfrage wird nicht einmal gelesen (`outbox-handler.test.ts:141-152`). Dokumentiert in Nr. 211 und GOLIVE 35. Rest: N5, N6.

**Verfall.** Nur Art „Unterwegs“ mit Anfrage, nach erreichter oder fehlender Ankunftszeit (`handlers.ts:327-332`, `db.ts:109-113`); gilt auch ohne Dev-Schalter (`outbox-handler.test.ts:168-170`); die Datenbank macht die Zeile sofort endgültig, ohne `claimed_at` (`0075:44-46`, Test `en-route.test.ts:166-167`, `:175`); Freitext als Code wird zum allgemeinen Fehlercode (`:170`, `:177`). Ein Lesefehler ist ein Versuch, kein Verfall (`outbox-handler.test.ts:171-173`).

**Backoff und Lease.** Eine Definition für Abholen und Cron (`0075:6-12`, `:23`, `:63`): wartend mit 0 Versuchen oder ohne `claimed_at` sofort, sonst nach 15 Minuten × 4^(Versuche − 1); in Arbeit nach 10 Minuten; nie ab fünf Versuchen. Vorrang der Operatoren stimmt. Test mit zwölf Grenzfällen (`en-route.test.ts:143-152`). Ein Fehlversuch behält `claimed_at` (`0075:46`), der fünfte endet endgültig; eine Zeile, die nach dem fünften Versuch in Arbeit hängen bleibt, räumt `outbox_expire` ab (`0036:13-18`). Gleichzeitige Läufe holen dank Zeilensperre mit Überspringen keine Zeile doppelt. Bekannter Punkt 4: M2.

**At-least-once.** Benannt in Entscheidung 209 und in `handlers.ts:309-310`; der Unit-Test belegt, dass nach gescheitertem Markieren keine Gegenbuchung folgt und der Lauf weitergeht (`outbox-handler.test.ts:67-80`). Bekannter Punkt 2 ist damit sauber: Zeile bleibt in Arbeit, nach der Lease erneut, bei „Unterwegs“ nur vor der Ankunftszeit. Rest: N3.

**Setup-Skript.** Guard als erster Import (`:11`), Abbruch ohne Gate-Kennung (`:16-19`), Vorprüfung vor jeder Änderung (`:44-58`), Function-Secrets und Deploy (`:66-67`), Probe-Zeile nur für den Betreiber ohne Anfrage (`:75-76`), Vault nur bei genau einer gesendeten Mail und als letzter Schritt (`:104-114`), Löschbedingung auf zwei Vault-Namen begrenzt (`:113`). Datei gleich der in Lösch-Freigabe 2 geprüften (115 Zeilen, Inhalt wie dort beschrieben). Lauf 11eb1bd2: Hash der Freigabe 2, Exit 0, gesendet 1, Fehler 336, übersprungen 0, verfallen 0 (`loesch-lauf.jsonl:4`). Die Bedingung „genau eine“ war erfüllt; dass keine Mail an eine Testadresse ging, folgt daraus (die einzige gesendete Mail ist die Probe, sofern die Zählung stimmt). Offen: N1, N8.

**Bekannter Punkt 1 (336 Zeilen).** M3. Die Zeilen sind ein Testdaten-Effekt; sie verbrauchen ihre restlichen Versuche und enden gescheitert, ohne Versand.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `0074:10-11`, `:41` | SECURITY DEFINER, leerer `search_path`, Grant nur `authenticated`: in Ordnung |
| `0074:19-23` | Minuten, Anmeldung, aal2, Firma in dieser Reihenfolge: in Ordnung |
| `0074:24-27` | Zeilensperre, dann Zuordnung; ein Code für „fehlt“ und „fremd“: in Ordnung |
| `0074:28-31` | Wiederholung ohne Schreiben; Meldung, Status, Wiener Tag: in Ordnung |
| `0074:32-36` | Server rechnet die Zeit, Audit mit Person, Outbox mit Dedupe-Schlüssel: in Ordnung |
| `0074:45-46`, `:83-85`, `:99` | `my_jobs` neu mit Grant; `can_en_route` deckt sich mit den Prüfungen in `set_en_route` |
| `0064:153-167` | früherer Rumpf von `my_jobs`: bis auf zwei Spalten gleich |
| `0074:102-110` | Arten, Empfängerart Betreiber, Empfänger-ID leer genau beim Betreiber |
| `0074:113-133` | Meldung wie zuvor, dazu Betreiber-Zeile; Wiederholung endet vor dem Einfügen |
| `0075:6-12` | Fällig-Definition, kein Grant, STABLE, leerer `search_path`: in Ordnung; N9 |
| `0075:14-32` | Abholen nur fälliger Zeilen, Sperre mit Überspringen, höchstens 50 |
| `0075:36-53` | Verfallscode im CHECK; sofort endgültig; nur auf Zeilen in Arbeit |
| `0075:55-69` | Cron ruft ohne fällige Zeile und ohne beide Vault-Werte nicht auf |
| `0036:13-18` | Abräumen hängender Zeilen nach dem fünften Versuch |
| `0023:97-102` | Firma des Aufrufers: Mitglied, active oder payment_hold, aal2 |
| `0023:26`, `:242`, `:247-249` | `contact_email` nur formgeprüft, vom Mitglied änderbar: M1 |
| `0031:19-25` | `outbox_put`: reines Einfügen, bei gleichem Schlüssel nichts |
| `0018:114` | `termin_at` ist Pflicht (Tagesvergleich nie leer) |
| `brevo.ts:16-19`, `:26-34` | fester Endpunkt, 5 Sekunden, Netzfehler ohne Status: in Ordnung; N3 |
| `brevo.ts:35-41` | Erfolg verwirft den Rumpf; Fehler nur Status und gefiltertes Kürzel |
| `db.ts:109-113` | Verfall bei erreichter oder fehlender Zeit; Lesefehler wirft |
| `db.ts:125-131` | Abholen und Markieren über die RPCs, Fehler als fester Typ |
| `db.ts:133-143` | Fehler der Auth-Abfrage wird nicht ausgewertet: M3 |
| `handlers.ts:249-272` | 21 Texte, ohne Betrag, Kontakt, Uhrzeit; Betreiber ohne Link |
| `handlers.ts:275-276` | vier reservierte Endungen, Teil nach dem letzten At-Zeichen: N5 |
| `handlers.ts:289-294` | feste Codes; dauerhaft und vorübergehend nur als Etikett: M2 |
| `handlers.ts:298-302` | Methode, Secret (401), Einrichtung (503) vor dem Zugriff auf die Outbox |
| `handlers.ts:311-317` | Markieren getrennt vom Versand, Fehler nur als festes Ereignis im Log |
| `handlers.ts:320-343` | Empfänger, Verfall, Schalter, Versand in dieser Reihenfolge: N10 |
| `handlers.ts:344-358` | Zähler und Log ohne Adresse und Text; Lauf geht nach Fehler weiter: M2 |
| `outbox-send/index.ts:12-22`, `:28-33` | Werte nur aus der Umgebung, Schalter genau 1, Versand nur mit allen vier Werten |
| `database.types.ts:1334`, `:1849`, `:1852`, `:2163-2166` | Typen passen zu 0074 |
| `positiv.ts:173`, `:240-246`, `:264-265`, `:458-466` | Register führt die neuen und geänderten Funktionen |
| `loesch-register.json:15`, `:33` | Setup-Skript ohne gebundene Dateien (N8); Hash von `positiv.ts` wie im Auftrag |
| `package.json:65`, `:70`, `:78` | toter Weg `setup:outbox` (N7); Gate-Weg vorhanden; `outbox-send` im Deno-Check |
| `docs/freigaben/mail1-loesch-freigabe-1.md:1-3`, `-2.md:1-3` | Modellzeile, Hash des Skripts, Urteil frei |
| `setup-outbox.mjs:11`, `:16-19`, `:44-58`, `:104-114` | Guard, Gate-Kennung, Vorprüfung, Vault nur bei genau einer Mail |
| `en-route.test.ts:54`, `:98` | Rechte gemessen, nicht nur behauptet |
| `en-route.test.ts:51-52`, `:71-72`, `:114-115` | Wiener Tagesgrenze unabhängig von der Uhrzeit des Laufs |
| `en-route.test.ts:143-152`, `:165-179`, `:186-199` | Fälligkeit, Verfall, Betreiber-Zeile und CHECK |
| `brevo.test.ts:10-23`, `:25-36`, `:38-47` | Schlüssel nur im Header; Fehlerbild; nie Adresse im Fehler |
| `outbox-handler.test.ts:38-52`, `:67-80`, `:141-152`, `:155-175` | 401 vor 503; Markieren; ohne Schalter; Verfall |
| `partnerJobs.ts:259-260`, `:285-295`, `:312-313` | leere Zeit zulässig, Codes zugeordnet, nur vier Minutenwerte |
| `src/screens/Auftrag.tsx:87`, `src/lib/arrival.ts:5-11` | Kunde sieht die Zeit nur bei angenommenem Auftrag, Wiener Zeit |
| `tmp/proof/mail1/runs.jsonl:21`, `:24` | Rot 019 und Grün 020 mit gleichem `dateiSha`, ohne Argumente und Schalter |
| `tmp/proof/mail1/019-…log:1-6`, `:46-57`, `:71-74`, `:96` | Kopf, zwei Fehlschläge, einer mit Ist-Wert, Exit 1: N2 |
| `tmp/proof/mail1/runs.jsonl:20`, `:34-37` | letzter `check` vor dem Endstand (M5); Läufe 030 bis 033 grün und sauber |
| `tmp/proof/mail1/loesch-lauf.jsonl:1-4` | vier Läufe des Skripts, der vierte mit Exit 0 und einer gesendeten Mail: N1 |
| `tests/rls/flow-live.test.ts:418`, `:436` | live nur die Kundenmeldung, kein „Unterwegs“: M4 |
| `docs/ENTSCHEIDUNGEN.md:216-218` | mindestens einmal, Abstand, „Unterwegs“, Verfall, Schalter beschlossen |
| `docs/GOLIVE.md:71`, `:78`, `:82` | Produktion ohne Schalter, Kontingent, Pflicht vor `booking_open` |
| `docs/OFFEN.md:57-59` | Zeile 57 veraltet (N11); mail1-1 und mail1-2 führen die verschobenen Punkte |
| Suche `docs/OFFEN.md`, `docs/GOLIVE.md` nach geprüfter Firmenadresse | keine Treffer: M1 |
| Suche `supabase/functions` nach Importen der drei Dateien | vier Functions binden Handler direkt ein; die übrigen nur gemeinsame Helfer, deren Teil unverändert ist |

Offene Findings hoch: 0
