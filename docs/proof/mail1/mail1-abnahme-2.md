Modell: claude-fable-5-2
Vorgaenger: tmp/proof/mail1-abnahme-1.md

# Abnahme R3, Schritt mail1, Kontrollrunde 2

Datum: 2026-11-19
Stand laut Sitzungskontext: Branch `mail1`, HEAD d8ab5ca, Arbeitsbaum sauber.

Geprüft (vollständig gelesen): `tests/support/positiv.ts` (473 Zeilen), `scripts/sys/loesch-register.json`, `package.json`, `supabase/functions/_shared/jobs/brevo.ts`, `_shared/jobs/db.ts`, `_shared/jobs/handlers.ts`, `supabase/functions/outbox-send/index.ts`, `docs/freigaben/mail1-loesch-freigabe-1.md`, `docs/freigaben/mail1-loesch-freigabe-2.md`, der Vorgängerbericht. Von `supabase/functions/_shared/database.types.ts` wie in Runde 1 nur die Stellen zu den neuen Objekten (Suche).
Zur Einordnung gelesen: `.claude/rules/geld.md`, `.claude/rules/daten.md`, `.claude/rules/tests.md`, `tests/rls/positiv.test.ts` (ganz), `tests/support/owner.ts` (ganz), `tests/rls/rls.test.ts:440-511`, `tests/rls/en-route.test.ts:1-60`, `tests/rls/offers.test.ts:268-304`, `tests/unit/brevo.test.ts` (ganz), Migration 0074 (ganz), `0038:244-259`, `0062:486-497`, `0023:40-47` und `:88-105`, `tests/support/partner.ts:14-51`, `tmp/proof/mail1/runs.jsonl` (ganz), `tmp/proof/mail1/loesch-lauf.jsonl`, Log 037 (`:578-657`), Kopf- und Endzeilen der Logs 038, 040, 041, `docs/OFFEN.md:57-64` und `:242`, `docs/GOLIVE.md:68-84`, `docs/BEKS.md` (ganz), `docs/STAND.md:1-14` und `:28-36`, Suchen über `tests/rls`, `tests/support`, `scripts` nach der Art „Unterwegs“ und ihrem Aufruf.

Hinweise zum Nachweis:
- Die Hash-Zeilen sind unverändert aus dem Auftrag übernommen, nicht nachgerechnet (kein Shell-Werkzeug). Das Gate vergleicht sie mit dem Endstand.
- Ich habe kein `git diff`. Für die acht als byte-gleich genannten Dateien habe ich den Arbeitsbaum erneut gelesen und mit den Zeilenverweisen der Runde 1 verglichen (alle Stichproben stehen an denselben Zeilen mit demselben Inhalt). Für `positiv.ts` und das Register kenne ich den Vorstand nur aus Runde 1 und aus Log 037; ein Byte-Vergleich des Registers gegen den Vorstand ist mir nicht möglich.
- Ich konnte nichts ausführen und habe keinen Zugriff auf die Datenbank oder die Function-Logs. Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.

SHA256: f6563a5a10cec3a8c2f73887b6d8f41f3cf5245a5b261b51355bccc68ef241d6 docs/freigaben/mail1-loesch-freigabe-1.md
SHA256: 4c5101e6bf4d596f37e39126a9314ec64fe3545e3b3266c72449834ecf3febf3 docs/freigaben/mail1-loesch-freigabe-2.md
SHA256: 0978be96367d86f8ec947eba1e21acb65d99ba959b716caed0911ac10ffdbc9e package.json
SHA256: a6f775d1d485933555a31093b911d038c37403135023bd89bbe7b76f9fe81bd5 scripts/sys/loesch-register.json
SHA256: 04eefaed9cc9ebc029785e8be5799a4cb14881ff118bb700201692b3f6da2231 supabase/functions/_shared/database.types.ts
SHA256: cb14a72b787783da030ac3634dc5256122c88435d87069b84e3b01187a320db5 supabase/functions/_shared/jobs/brevo.ts
SHA256: 42febb985f239c9b5bc630ad11b07423d14bb13439512e437829b131ffcea44b supabase/functions/_shared/jobs/db.ts
SHA256: 4bfad3a09420bd3d92196f44df2bc2129100ae1cdbfce4cc4a61e8a5c0c439d3 supabase/functions/_shared/jobs/handlers.ts
SHA256: a95e1227ed2275485262083b86fdb2dcdfc68bf8aa82083ae9e7a4ad6f0a6aef supabase/functions/outbox-send/index.ts
SHA256: c2439ae7b639b34bb2afd7667afe6ec8278556c766e60c6e0331be3055d1e005 tests/support/positiv.ts

## Ergebnis in einem Satz

Die beiden geänderten Pflichtdateien sind richtig und schwächen nichts ab (der Wechsel auf Firma b ändert weder Akteur-Art noch Prüfschärfe der Probe), kein hoher Fund; aber der angekündigte Live-Beleg für M4 kann so nicht entstehen, weil kein rls-Test eine „Unterwegs“-Zeile committet: M4 bleibt offen und steht bisher auch nicht in OFFEN.

## Findings hoch

Keine. Aus Runde 1 mitzuzählen: keine (dort hoch 0).

## Findings mittel

M4 (aus Runde 1, offen, verschärft). `tests/rls/en-route.test.ts:2`, `tests/support/positiv.ts:264` mit `tests/rls/positiv.test.ts:80` und `tests/support/owner.ts:113` – Der im Auftrag beschriebene Weg („aus den beim Volllauf rls entstandenen Zeilen auf Dev“) liefert keinen Beleg:
1. Beim Volllauf entsteht keine committete Zeile dieser Art. Die Funktion wird nur an zwei Stellen aufgerufen, beide in Rollback-Proben (`en-route.test.ts:2` „es bleibt nichts zurück“; das Register läuft in `probes`, `owner.ts:113` endet mit Rollback). Suche über `tests/rls`, `tests/support`, `scripts`: Treffer nur in `en-route.test.ts`, `positiv.ts`, `partner-my-jobs.test.ts:72` (Signatur) und `rls.test.ts:482` (Liste). `flow-live.test.ts` ruft sie nicht auf (`:191-195`, `:414-418`, `:431-437`: nur Start, Abschluss, Kundenmeldung).
2. Auch eine committete Zeile belegt die Kette nur, wenn das Kundenkonto über die Auth-API entstand. Für per SQL angelegte Konten (`tests/support/partner.ts:15`) liefert die Adressabfrage nichts (`docs/OFFEN.md:59`), die Zeile endet mit dem Code für fehlenden Empfänger (`handlers.ts:324-325`), bevor die Ankunftszeit gelesen wird (`:327`). Genau dieses Lesen mit dem Secret Key (`db.ts:109-113`) ist der unbelegte Teil.
3. Das Konto muss beim Abholen noch bestehen (`tests/support/db.ts:44-45` löscht die Testkonten am Ende).
Weder OFFEN noch GOLIVE führen den Punkt (Suche in `docs/OFFEN.md`, `docs/GOLIVE.md`, `docs/STAND.md`, `docs/BEKS.md`: keine Treffer). – Fix, einer von beiden vor `npm run fertig`:
(a) echter Beleg: in `tests/rls/flow-live.test.ts` (Konten aus der Auth-API, `:108`, `db.ts:33`; Firma mit aal2 vorhanden) ein Auftrag mit Termin am heutigen Wiener Tag, Aufruf als Firma, danach vor dem Aufräumen warten, bis die Zeile den wartenden Zustand verlässt. Erwarteter Endzustand auf Dev: erledigt, ein Versuch, kein Fehlercode (das heißt: Adresse gelesen, Ankunftszeit gelesen und nicht erreicht, Dev-Schutz übersprungen; ein Lesefehler ließe die Zeile wartend mit Fehlercode zurück, `handlers.ts:344-353`). Im Bericht: Zeilennummer, Art, Zustand, Versuche, Fehlercode, dazu das Ereignis „übersprungen“ aus dem Function-Log oder die Zähler der Antwort. Die Änderung gehört vor den Volllauf rls (geänderte Datei unter `tests/rls`), `positiv.ts` und die übrigen Pflichtdateien bleiben dabei unberührt.
(b) oder ein eigener Punkt in OFFEN mit Begründung und einem Prüfschritt in GOLIVE 35 (einmal beim Einrichten der Produktion: Zeile der Art „Unterwegs“ wird abgeholt und endet gesendet oder verfallen).

M5 (aus Runde 1, zum Teil behoben). `tmp/proof/mail1/runs.jsonl:45` – `check` liegt jetzt auf dem Endstand vor (Lauf 041: d8ab5ca, sauber, ohne Argumente und Schalter, EXIT 0, 2117 Tests; Log `041-check.log:1-5`, `:368`, `:376`). `e2e` (Lauf 036, `runs.jsonl:40`) lief auf 43c4e32, also vor d8ab5ca; ob er für den Endstand zählt, entscheidet der Fingerabdruck im Gate. Der Volllauf `rls` ist rot (Lauf 037, `runs.jsonl:41`), ein grüner fehlt. – Fix: Volllauf `rls` auf dem committeten Endstand (nach einer etwaigen Änderung für M4 a); das Gate verlangt ihn. Diese Runde stützt sich auf die Lektüre und die Einzelläufe 038 bis 041.

M1, M2, M3, M6 (aus Runde 1): nicht behoben, aber angemessen festgehalten, siehe Prüffragen. Sie bleiben als verschobene Punkte offen (Pflicht vor `booking_open`: GOLIVE 46 bis 48).

## Findings niedrig

N12 (neu). `tests/rls/offers.test.ts:272`, `:300` mit `0062:493-495` und `docs/OFFEN.md:242` – Die Prüfung „Snapshot ohne Gebühr“ sucht ihre drei Wörter im ganzen Snapshot-Text, darin steht die zufällige Angebots-ID (Hex). Das ist ein Geld-Wächter mit bekanntem Fehlalarm; OFFEN S9h4-8 nennt nur zwei e2e-Dateien, nicht diese Stelle (nur `docs/STAND.md:35`). Dass der Fehlschlag in Lauf 037 der Fehlalarm war, ist ein Schluss, kein Messwert: das Log zeigt nur den Wahrheitswert (`037-rls.log:582-590`), nicht die ID. Der Schluss trägt: Der Snapshot entsteht mit festen Schlüsseln ohne Gebührenfeld (`0062:493-495`), zwischen 037 und 040 gab es keine Migration (`runs.jsonl:41-44`), und Lauf 040 ist auf d8ab5ca grün (12 von 12). Ein echtes Leck wäre nicht zufällig. – Fix: die Stelle in S9h4-8 nachtragen; bei der nächsten Änderung der Datei den Schlüssel der Angebots-ID vor dem Vergleich entfernen. Schlägt die Stelle im nächsten Volllauf wieder an: nicht als bekannt abtun, sondern die ID der betroffenen Zeile als Ist-Wert festhalten.

N13 (neu). `tests/support/positiv.ts:146-150` mit `0038:255-257` – Die Welt „auftrag“ hat keinen Spielraum mehr: Firma a hält vier Aufträge und nimmt in der Probe den fünften an (`:225`), Firma b hält nach dem Setup fünf. Der Kommentar `:108` („Aufträge, an denen Firma a nichts tun muss, nimmt Firma b an“) passt für j6 nicht mehr ganz, `:150` erklärt es. Kein Fix nötig; die nächste Fixture dieser Welt braucht Firma c (in `:67` angelegt, aktiv, gleiche Bezirke).

N14 (neu). `docs/BEKS.md:32`, `docs/GOLIVE.md:83` mit `0023:40-47` – „Anmeldeadresse des Kontos“ ist bei Firmen mit mehreren Mitgliedern nicht eindeutig (das Schema lässt mehrere Mitglieder je Firma zu). – Fix: Frage 1 um „welches Mitglied (alle oder nur Inhaber)“ ergänzen.

N11 (aus Runde 1, zum Teil behoben). `docs/OFFEN.md:57` ist nachgeführt (Cron scharf, Probe angenommen), `docs/GOLIVE.md:72` nennt jetzt `handlers.ts:265`. Offen: `docs/STAND.md:5-8` sagt weiter „blockiert, Vault leer, Cron aus“; `docs/BEKS.md:29` verweist für den Ablauf auf diese Datei, in der er noch nicht steht; `docs/BEKS.md:3` trägt den Stand 2026-11-17. – Fix: beim Schreiben von STAND am Ende des Schritts.

N1 (aus Runde 1, offen). Die Erklärung der Zahlen von Lauf 3f441650 (`tmp/proof/mail1/loesch-lauf.jsonl:2`) gehört in die Bewertung; die gibt es noch nicht, ich kann sie nicht prüfen.

Übrige niedrige Funde der Runde 1: N3, N5, N7, N10 stehen in OFFEN mail1-5 (`docs/OFFEN.md:62`); N8, N9 in mail1-1 (`:58`); N6 ist durch das Prüfkriterium von GOLIVE 35 gedeckt (`docs/GOLIVE.md:71`: Liste der Secret-Namen ohne den Dev-Schalter); N2, N4 ohne Fix.

## Prüffragen

**`tests/support/positiv.ts`: wird eine Prüfung abgeschwächt?** Nein.
- `set_en_route` steht weiter in `NIE_AUSNAHME` (`:173`), die Liste ist an die Funktionsnamen typgebunden (`:175`), `AUSNAHMEN` enthält unverändert nur die Mietfunktion (`:178-183`).
- Der Eintrag (`:264`) verlangt weiter Rolle `authenticated` mit aal2, EXECUTE genau für `authenticated`, Ergebnisart Wert, Typ `timestamptz`. Der Ausführer ist unverändert: der im Register gepinnte Hash von `tests/rls/positiv.test.ts` (`loesch-register.json:34`) ist der `dateiSha` von Lauf 038 (`runs.jsonl:42`). Er wertet jeden Fehler des Aufrufs als Fehlschlag (`positiv.test.ts:53-54`) und vergleicht den Typ (`:56`); der Katalogtest verlangt, dass die Rolle des Akteurs EXECUTE hat (`:111-112`).
- Die Welt bleibt gültig. Setup `:146-150`: Firma a hält j1, j4, j5, c2 (vier), Firma b j2, j3, c1, c3 und j6 (fünf). Die Grenze zählt offene Zuordnungen mit Zustand angenommen oder laufend und wirft ab dem Grenzwert (`0038:255-257`): b nimmt j6 als fünften an (4 ≥ 5 falsch), a nimmt in der Probe q0 als fünften an (`:225`). Der Fehler aus Lauf 037 (`037-rls.log:605`) passt dazu: mit j6 bei Firma a wäre q0 der sechste gewesen. Die Schritte einer Welt laufen nacheinander in einer Transaktion, erfolgreiche Schritte bleiben bis zum Rollback bestehen (`owner.ts:110-113`); vor `set_en_route` ändert kein Schritt j6 oder Firma b (Reihenfolge `:218-264`).
- j6 erfüllt alle Bedingungen der Funktion (`0074:19-31`): Termin `now()`, also derselbe Wiener Tag; Zustand angenommen über `partner_accept` mit dem Konto und dem Listing von Firma b (`:107`, `:109`); keine Meldung, keine frühere Ankunftszeit.
- Der SQL-Text enthält keinen Kommentar und kein Transaktionsende (der Kommentar `:150` steht außerhalb des Template-Strings); der Unit-Test dazu (`tests/unit/positiv-register.test.ts:40-50`) lief in `check` 041 grün.

**Mindert der Wechsel auf Firma b die Aussagekraft?** Nein. Die Aussage der Probe ist „ein berechtigter Akteur bekommt einen Wert vom erwarteten Typ, ohne Fehler“. Berechtigt heißt hier: Mitglied einer aktiven Firma mit aal2 (`0023:97-102`) und laufende Zuordnung dieser Firma (`0074:25`). Das Konto von Firma b entsteht mit demselben Helfer und im selben Zustand wie das von Firma a (`:67`, `partner.ts:42-47`) und hält die Zuordnung zu j6. Die Probe durchläuft damit dieselben Prüfungen wie vorher (Minuten, Anmeldung, aal2, Firma, Zuordnung, Zustand, Tag). Nichts anderes hing an j6: `my_jobs` prüft nur Zeilenzahl und Spaltentypen (`:240-247`, weiter vier Zeilen für Firma a), und das Konto von Firma b bleibt für `job_contact` zu j1 eine fremde Firma (`:190`, `:259`). Die Gegenproben zur Funktion (fremde Firma, Kunde, aal1, anon, service_role) liegen unverändert in `tests/rls/en-route.test.ts:80-84`, nicht im Register.

**Register: nur der Hash?** Soweit prüfbar ja. `loesch-register.json:33` trägt den Hash aus dem Auftrag; die Verweise der Runde 1 (`:15` Setup-Skript ohne gebundene Dateien, `:33` Eintrag zu `positiv.ts`) stehen an denselben Zeilen, Skriptliste und übrige Ausnahmen lesen sich wie dort beschrieben. Einen Byte-Vergleich gegen den Vorstand kann ich nicht führen (kein `git diff`); wer ihn braucht: `git diff 43c4e32 d8ab5ca -- scripts/sys/loesch-register.json` muss genau eine geänderte Zeile zeigen. Die Begründung der Ausnahme gilt für den neuen Inhalt weiter: nur Daten und SQL-Text, kein Datenbankzugriff, Ausführung allein in Rollback-Proben; die Änderung fügt keine löschende oder lockernde Anweisung hinzu. Kein Abschwächen eines Gates.

**Die drei Fehler aus Lauf 037.**
(a) `tests/rls/rls.test.ts:482`: Die Ergänzung ist richtig und keine Lockerung. Die Funktion ist SECURITY DEFINER mit leerem `search_path` (`0074:11`), EXECUTE nur für `authenticated` (`0074:41`), der Kommentar der Zeile deckt sich mit `0074:19-37`. Der rote Lauf zeigt den Ist-Wert (35 statt 34 Einträge, genau diese Funktion, `037-rls.log:619-630`); Lauf 039 ist grün (39 von 39, d8ab5ca, sauber).
(b) wie oben; Lauf 038 grün (6 von 6, d8ab5ca, sauber, ohne Argumente und Schalter, `038-…log:1-5`, `:25`, `:34`).
(c) N12.

**M1 bis M4 in den Dokumenten festgehalten?**
- M1: ja. `docs/OFFEN.md:60` (mail1-3) gibt den Fund mit Stellen und Folge wieder, `docs/GOLIVE.md:83` (47) macht ihn zur Pflicht vor dem Öffnen mit messbarem Kriterium, `docs/BEKS.md:32` stellt die Entscheidung mit Empfehlung und Antwortformat. Rest: N14.
- M2: ja. `docs/OFFEN.md:58` stellt mail1-1 richtig (die Frage nach 401 und 403 ändert nichts), `:61` (mail1-4) beschreibt Folge und Umbau, `docs/GOLIVE.md:84` (48) verlangt Betriebsweg, Kontingent und eine Probe mit gesperrtem Schlüssel.
- M3: ja. `docs/OFFEN.md:59` (mail1-2) mit belegter Ursache und der verbleibenden Lücke, `docs/GOLIVE.md:82` (46) als Pflicht mit Unit- und rls-Kriterium. Die Stellenangaben stimmen (`db.ts:133-136`, `:137-143`).
- M4: nein, siehe oben. Weder belegt noch eingetragen.

**Die acht unveränderten Pflichtdateien.** Erneut gelesen, keine Abweichung von Runde 1 und kein neuer Fund: `brevo.ts` (Schlüssel nur im Header `:28`, Fehler ohne Antworttext `:39-41`), `db.ts` (`:109-113`, `:133-143`), `handlers.ts` (Texte `:249-272`, Aufruferprüfung `:298-302`, Reihenfolge je Zeile `:320-343`, Zähler `:344-358`), `outbox-send/index.ts` (`:28-32`), `package.json` (`:65`, `:70`, `:78`), `database.types.ts` (`:1334`, `:1849`, `:1852`, `:2163-2166`), die beiden Freigaben (Modellzeile, Hash des Skripts, Urteil frei, je `:1-3`). `tests/unit/brevo.test.ts` (nicht Pflichtmenge, nur Typen geändert): die Erwartungen sind so scharf wie in Runde 1 beschrieben (`:16-22`, `:35-43`, `:48-54`); der Helfer `:26-33` wirft, wenn kein Fehler kommt.

**Geld.** Nicht berührt. Keine Rechnung, kein Journalweg, keine Rundung geändert; die Register-Einträge der Geldwege (`:218-351`) sind unverändert und liefen in 038 grün; die Beträge der Welt stammen weiter aus `splitFee` (`positiv.test.ts:13-17`).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `tests/support/positiv.ts:64-67` | drei aktive Firmen a, b, c mit demselben Helfer und denselben Bezirken |
| `tests/support/positiv.ts:106-109` | Annahme je Firma mit eigenem Konto und eigenem Listing |
| `tests/support/positiv.ts:145-150` | Welt „auftrag“: a vier, b fünf offene Aufträge; j6 mit Termin jetzt bei b |
| `tests/support/positiv.ts:170-175`, `:178-183` | `set_en_route` in der Nie-Ausnahme-Liste, typgebunden; Ausnahmen unverändert |
| `tests/support/positiv.ts:223-226` | Probe `partner_accept` nimmt q0 für Firma a an (fünfter Auftrag) |
| `tests/support/positiv.ts:240-247`, `:258-262` | `my_jobs` und `job_contact` hängen nicht an j6 |
| `tests/support/positiv.ts:264` | Akteur Konto der Firma b, aal2, EXECUTE u, Wert `timestamptz`, 30 Minuten |
| `tests/rls/positiv.test.ts:36-39`, `:53-56` | Fehler des Aufrufs ist Fehlschlag, Typ wird verglichen |
| `tests/rls/positiv.test.ts:106-113` | Katalog: EXECUTE laut Register, Akteur-Rolle muss EXECUTE haben |
| `tests/support/owner.ts:92-114` | Schritte nacheinander in einer Transaktion, Rollback am Ende |
| `supabase/migrations/…0038_partner_offers.sql:255-257` | Grenze: offene Zuordnungen, Fehler ab dem Grenzwert |
| `supabase/migrations/…0074_mail1_unterwegs.sql:10-11`, `:19-37`, `:41` | Prüfungen der Funktion, Rechte: wie Runde 1 |
| `supabase/migrations/…0023_partners.sql:97-102` | Firma des Aufrufers: Mitglied, active oder payment_hold, aal2 |
| `supabase/migrations/…0023_partners.sql:40-47` | mehrere Mitglieder je Firma möglich: N14 |
| `tests/support/partner.ts:42-47` | Firma im Zustand active über Registrierung und Freigabe |
| `scripts/sys/loesch-register.json:15`, `:33`, `:34` | Setup-Skript unverändert ohne gebundene Dateien; neuer Hash für `positiv.ts`; Ausführer gepinnt |
| `tmp/proof/mail1/runs.jsonl:41-45` | 037 rot (3 von 403), 038 bis 041 grün auf d8ab5ca, sauber, ohne Argumente und Schalter |
| `tmp/proof/mail1/runs.jsonl:42` gegen `loesch-register.json:34` | `dateiSha` von 038 gleich dem gepinnten Hash des Ausführers |
| `tmp/proof/mail1/037-rls.log:581-590` | Fehlschlag „Snapshot ohne Gebühr“, nur Wahrheitswert im Log: N12 |
| `tmp/proof/mail1/037-rls.log:597-606` | `partner_accept` scheitert an der Auftragsgrenze: Ursache wie im Auftrag |
| `tmp/proof/mail1/037-rls.log:618-634` | Liste: genau eine zusätzliche Funktion |
| `tmp/proof/mail1/038-…log:1-5`, `:25`, `:34` | Kopf d8ab5ca, keine Argumente, keine Schalter, 6 von 6, EXIT 0 |
| `tmp/proof/mail1/040-…log:1-5`, `:36`, `:44` | 12 von 12, EXIT 0 |
| `tmp/proof/mail1/041-check.log:1-5`, `:368`, `:376` | 2117 Tests, EXIT 0 |
| `tests/rls/rls.test.ts:448-487` | Liste der für anon oder authenticated offenen Funktionen, neue Zeile `:482` |
| `tests/rls/offers.test.ts:272`, `:300` | Wortsuche im ganzen Snapshot-Text: N12 |
| `supabase/migrations/…0062_fee_schedule.sql:493-495` | Snapshot mit festen Schlüsseln und Angebots-ID, kein Gebührenfeld |
| `tests/rls/en-route.test.ts:2`, `:44-60` | nur Rollback-Proben, Firma a als Akteur: M4 |
| `tests/rls/flow-live.test.ts:108`, `:191-195`, `:414-418`, `:431-437` | Live-Test mit Konto aus der Auth-API, ohne „Unterwegs“: M4 |
| `tests/support/db.ts:33`, `:44-45` | Konten über die Auth-API, am Ende gelöscht: M4 Punkt 3 |
| `tests/support/partner.ts:15` | Konten per SQL: Adressabfrage der Function findet sie nicht (OFFEN mail1-2): M4 Punkt 2 |
| Suche `tests/rls`, `tests/support`, `scripts` nach der Art „Unterwegs“ | vier Dateien, keine committet eine Zeile: M4 Punkt 1 |
| `supabase/functions/_shared/jobs/handlers.ts:320-343` | Empfänger vor Verfall vor Dev-Schutz: unverändert |
| `supabase/functions/_shared/jobs/handlers.ts:249-272` | 21 Texte ohne Betrag und Kontakt: unverändert |
| `supabase/functions/_shared/jobs/brevo.ts:26-41` | unverändert |
| `supabase/functions/_shared/jobs/db.ts:109-113`, `:133-143` | unverändert; M3 weiter offen (GOLIVE 46) |
| `supabase/functions/outbox-send/index.ts:28-32` | unverändert |
| `package.json:65`, `:70`, `:78` | unverändert |
| `supabase/functions/_shared/database.types.ts:1334`, `:1849`, `:1852`, `:2163-2166` | unverändert, Typen passen zu 0074 |
| `docs/freigaben/mail1-loesch-freigabe-1.md:1-3`, `-2.md:1-3` | Modellzeile, Hash, Urteil frei |
| `tests/unit/brevo.test.ts:25-44` | Erwartungen unverändert scharf, Helfer wirft ohne Fehler |
| `tests/unit/positiv-register.test.ts:40-50` | kein Transaktionsende und kein Auth-Zugriff in Register und Ausführer |
| `docs/OFFEN.md:57-63` | S9c-3 nachgeführt; mail1-1 bis mail1-5, ui2-5 vorhanden |
| `docs/OFFEN.md:242` | S9h4-8 ohne die Stelle in `offers.test.ts`: N12 |
| `docs/GOLIVE.md:71-72`, `:82-84` | 35, 36 (Zeile 265), 46 bis 48 |
| `docs/BEKS.md:29`, `:32` | Frage zum Schlüssel erledigt; Frage 1 zur Firmenadresse: N14, N11 |
| `docs/STAND.md:5-8`, `:35` | Zwischenstand veraltet (N11); Fehlalarm genannt |
| Suche `docs/OFFEN.md`, `GOLIVE.md`, `STAND.md`, `BEKS.md` nach dem Live-Beleg | keine Treffer: M4 |

Offene Findings hoch: 0
