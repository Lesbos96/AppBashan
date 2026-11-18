Modell: claude-fable-5-2
SHA256: 63cb9118a501fe9d5a684b808f31af2490047b428d55245a38233a3a7072e3b9 scripts/setup-outbox.mjs
Urteil: frei

# Lösch-Freigabe 2, Schritt mail1 (R3)

Datum: 2026-11-18
Vorgängerbericht: `tmp/proof/mail1/loesch-freigabe-1.md` (Hash a71f7b78…, frei, hoch 0). Dessen hohe Funde: keine, also nichts mitzuzählen.
Geprüft (vollständig gelesen): `scripts/setup-outbox.mjs` (115 Zeilen, laut Auftrag Commit 53295ee), `supabase/functions/_shared/jobs/handlers.ts` (359 Zeilen), `_shared/jobs/brevo.ts` (43 Zeilen), `_shared/jobs/db.ts` (144 Zeilen), `supabase/functions/outbox-send/index.ts` (35 Zeilen).
Zur Einordnung gelesen: `.claude/rules/daten.md`, `.claude/rules/geld.md`, `scripts/dev-guard.mjs`, `scripts/setup-photo-publish.mjs`, `scripts/sys/gate-loesch.mjs`, `scripts/sys/gate-loesch-lib.mjs`, `scripts/sys/gate-db-lib.mjs:33-66`, `scripts/sys/loesch-register.json`, `scripts/scan-proof.mjs`, `tests/support/owner.ts`, `scripts/redproof-lib.mjs:572-598`, `scripts/redproof-soll.mjs:16-33`, Migrationen 0074 und 0075 (ganz), 0036 (ganz), 0030 (Outbox-Tabelle), 0031 (`outbox_put`), 0023 (Spalte `contact_email`), `tests/unit/brevo.test.ts` (ganz), `tests/unit/outbox-handler.test.ts:84-117` und Trefferliste, `tmp/proof/mail1/loesch-lauf.jsonl`, `tmp/proof/mail1/runs.jsonl`, `docs/STAND.md:5-7`, Suchen über Migrationen, `scripts/` und `tests/` nach dem Schlüssel-Präfix der Probe, nach erzwungener Zeilensicherheit und nach den Aufrufern von `db query`.

Hinweise zum Nachweis:
- Die Hash-Zeile oben ist unverändert aus dem Auftrag übernommen, nicht nachgerechnet (kein Shell-Werkzeug). Das Gate rechnet sie beim Übernehmen und beim Start gegen die Datei nach.
- Ich konnte nichts ausführen, habe keinen Zugriff auf die Datenbank und kein `git diff`. Gelesen ist der Arbeitsbaum; laut Sitzungskontext war er beim Start sauber und HEAD ist 53295ee. Aussagen über den Bestand auf Dev (Zahlen, Vault leer, gesetzte Secrets, deployte Fassung) stammen aus dem Auftrag.
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.
- Zum Auftrag: Die Bezeichnung „ohne_adresse“ stammt nicht aus Freigabe 1. Dort steht nur, dass eine Zeile ohne Adresse nicht versendet wird; das deckt sich mit den 336 Zeilen ohne Empfänger.

## Ergebnis in einem Satz

Die Härtung ist umgesetzt und hält `daten.md` ein (Gate-Kennung, Vorprüfung vor jeder Änderung, kein Wert in Ausgabe oder Fehlertext, Vault nur zwei Namen, Outbox-Änderung nur Probe-Zeilen, Abbruch vor dem Vault bei allem außer genau einer gesendeten Mail), die neue Function-Fassung lässt die Schutzteile unverändert und gibt als Diagnose nur Status und ein gefiltertes Kürzel heraus; die Wirkung der Vorprüfung ist aber nicht belegt, weil sie allein am Exit-Code der CLI hängt: frei mit den bindenden Auflagen unten.

## Findings hoch

Keine.

## Findings mittel

M1. `scripts/setup-outbox.mjs:24-31` mit `:44-58` – Die Vorprüfung wirkt nur, wenn die CLI bei einer in SQL geworfenen Ausnahme mit einem Exit-Code ungleich 0 endet; die Ausgabe wird verworfen (`:26`). Die übrigen Aufrufer im Repository verlassen sich darauf nicht allein: sie werten zusätzlich die JSON-Antwort der CLI aus, auch nach einem Aufruf, der ohne Ausnahme zurückkam (`tests/support/owner.ts:34-35`, `scripts/redproof-lib.mjs:595-596`, `scripts/redproof-soll.mjs:30-31`). Die Fangzweige dort (`owner.ts:28-30`, `redproof-lib.mjs:586-591`) sprechen dafür, dass ein SQL-Fehler mit Exit ungleich 0 und Fehlertext auf stdout endet; belegt ist das für dieses Skript nicht (kein Test, kein Rot-Beweis, ich kann nichts ausführen). Endete die CLI in diesem Fall mit 0, liefe das Skript weiter und stünde beim Schutz wieder auf dem Stand von Runde 1 (Datenannahme plus Abbruch nach dem Versand). Dazu: Die Meldung `:28` ist für alle drei `db query`-Schritte gleich; ein Treffer der Vorprüfung, ein CLI- oder Netzfehler und ein Fehler beim Anlegen der Probe-Zeile sind in der Ausgabe nicht zu unterscheiden (alle ohne vorherige Zeile „Probe: …“). Gleiches gilt am Ende: Scheiterte der Vault-Schritt mit Exit 0, stünde die Erfolgsmeldung `:115` bei leerem Vault (fail-closed, aber falsche Meldung). Fix (bei der nächsten Hash-Änderung): Vorprüfung als Zählabfrage, stdout lesen (enthält nur eine Zahl), nur bei positiv gelesener 0 weiter, sonst Abbruch mit eigener Meldung je Fall („echte Adresse wartet“ bzw. „Abfrage fehlgeschlagen“); im Vault-Schritt die Antwort auf das Fehlerkennzeichen prüfen, ohne sie auszugeben. Für diesen Lauf: Auflagen 2 und 4.

M2. Auftrag gegen `tmp/proof/mail1/loesch-lauf.jsonl:1` und `runs.jsonl:23-27` – Der Beleg zu Auflage 2 der Runde 1 ist in sich widersprüchlich. Der Auftrag nennt als Zeitpunkt der Zählung 22:07 UTC „vor dem Lauf“; der Lauf c22b8d25 endete laut Lauf-Log um 09:05:59 UTC (Push 0075 um 08:58 UTC, die nächsten Einträge erst 22:12 UTC). Die Summe passt zu einer Zählung vor dem Lauf (349 + 493 = 842; angefasst wurden 337 + 506 = 843, also 842 und die Probe-Zeile), dann stimmt die Zeitangabe nicht. Stimmt die Zeitangabe, wurde nach dem Lauf gezählt: dann fehlt der Beleg vor dem Lauf, und 842 wartende Zeilen nach einem Lauf, der 506 als erledigt gemeldet hat, wären erklärungsbedürftig (Markieren gescheitert?). Schaden ist keiner entstanden: Lauf 1 hat 0 Mails gesendet. Fix: In der Bewertung Quelle, Befehl und Zeitpunkt der Zählung richtigstellen; für Lauf 2 frische Zahlen (Auflage 2) und Abgleich mit den Zahlzeilen (Auflage 5).

M3. `scripts/sys/loesch-register.json:15` mit `scripts/setup-outbox.mjs:67` – unverändert aus Runde 1 (dort M2): Das Register bindet keine weitere Datei, das Skript deployt den Arbeitsbaum. Der Schutz der Probe steckt in `handlers.ts:275-276`, `:334-342`, `brevo.ts:39-41` und `outbox-send/index.ts:31`. Diese Runde zeigt den Fall: Die Function wurde geändert, die neue Runde entstand nur durch die Auflage. Fix wie in Runde 1 (Dateien im Register binden oder Auflage je Lauf). Für diesen Lauf: Auflage 3.

## Findings niedrig

N1. `scripts/setup-outbox.mjs:50-55` – Die Vorprüfung sieht nur fällige Zeilen (`:53`) von Kunden und Firmen. Nicht geprüft werden (a) wartende Zeilen im Wiederholungs-Abstand oder mit laufender Lease (`0075:9-11`), die erst während der Aufrufe oder nach dem Scharfschalten des Crons fällig werden, und (b) Betreiber-Zeilen: Eine wartende Meldung zu einer Anfrage, deren Kunde eine Adresse ohne reservierte Endung hat, geht an den Betreiber (`handlers.ts:335-336`, `:343`). Zu (a): Seit dem einzigen Function-Lauf sind über 13 Stunden vergangen, praktisch ist jede wartende Zeile fällig; eine Zeile, die im vorigen Lauf angefasst wurde, war dort bereits fällig und damit geprüft. Zu (b): Die Mail ginge nur an den Betreiber, der Lauf endete dann vor dem Vault (`:104-107`). Fix: alle Zeilen in den wartenden Zuständen mit weniger als fünf Versuchen prüfen, Betreiber-Zeilen über den Kunden der Anfrage einbeziehen. Für diesen Lauf: Auflage 2.

N2. `scripts/setup-outbox.mjs:86-89` – Bei einem Status ungleich 200 endet das Skript ohne Zahlzeilen. Was frühere Aufrufe desselben Laufs gesendet haben, und was ein abgebrochener Aufruf (Zeitgrenze, 5xx) noch gesendet hat, steht dann weder in der Ausgabe noch in `loesch-lauf.jsonl`. Fix: Zahlzeilen und Diagnose vor diesem Abbruch ausgeben. Für diesen Lauf: Auflage 4.

N3. `scripts/setup-outbox.mjs:75` – Die Bedingung der Outbox-Änderung hängt am Schlüssel-Präfix und am Zustand. Das Präfix vergibt nur dieses Skript (Suche: einzige Treffer `:75-76`; die Schlüssel der Migrationen mit gleichem Anfangsbuchstaben tragen vier andere Präfixe, z. B. `0074:36`, `:131` für die neuen Arten). Enger wäre zusätzlich Art, Empfängerart Betreiber und leere Anfrage. Kein Fix für diesen Lauf nötig.

N4. `tmp/proof/mail1/runs.jsonl:25-27` – Die Läufe der beiden Unit-Dateien und von `accept.test.ts` liefen auf b5cb136 mit unsauberem Arbeitsbaum; für 53295ee gibt es keinen Lauf. Das Skript hat weiter keinen Unit-Test. Die Tests selbst decken die neuen Teile (`tests/unit/brevo.test.ts:25-36`, `tests/unit/outbox-handler.test.ts:95-100`, `:114-116`). Auflage 3.

N5. Unverändert aus Runde 1: N2 (Secret als Argument des Kindprozesses und im SQL-Text des Vault-Schritts, jetzt `:66`, `:113`), N6 (Schalter vor dem Deploy gesetzt; Lauf 1 hat mit 506 übersprungenen Zeilen und 0 gesendeten gezeigt, dass er wirkt), N8 (Betreiber-Zeile gilt mit Schalter als erledigt, wenn der Kunde nicht lesbar ist, `handlers.ts:335-340`, `db.ts:137-143`).

N6. Für die Abnahme, nicht für dieses Skript: `handlers.ts:289-291` mit `brevo.ts:41` und `0075:43-46` – Ablehnungen, die das Konto betreffen (401, 403: Schlüssel, Kontoeinstellung), zählen je Zeile als Ablehnung der Mail. Jede betroffene Zeile verbraucht Versuche und ist nach dem fünften (rund 21 Stunden) endgültig gescheitert. Das Skript schaltet den Cron erst nach einer gesendeten Probe scharf, der Fall trifft also erst eine spätere Störung. Prüfen, ob 401 und 403 als vorübergehend gelten sollen.

## Auflagen für den Lauf (bindend)

1. Migration 0075 liegt auf Dev (Marken `runs.jsonl:22-23`): erfüllt. Sie bleibt Voraussetzung, die Vorprüfung ruft die Fällig-Funktion aus 0075 auf.
2. Unmittelbar vor dem Lauf belegt die Hauptsession die Datenannahme neu, mit Zahlen aus einer nur lesenden Abfrage auf einem erlaubten Weg, und nennt Quelle, Befehl und Zeitpunkt in der Bewertung: wartende Outbox-Zeilen (beide wartenden Zustände, weniger als fünf Versuche) je Empfängerart (Kunde, Firma, Betreiber); davon die mit einer Adresse ohne reservierte Endung (Kunde über das Konto, Firma über `contact_email`, Betreiber-Zeile mit Anfrage über das Konto des Kunden der Anfrage); dazu die Zahl der wartenden Probe-Zeilen. Für Kunden und Firmen muss die Zahl ohne reservierte Endung 0 sein, sonst nicht starten und Beks berichten. Ist sie bei Betreiber-Zeilen nicht 0: vor dem Start Beks berichten (er bekäme veraltete Meldungen, der Lauf endete vor dem Vault). Gibt es keinen erlaubten Leseweg: nicht starten. Die Zeitangabe zur Zählung von Runde 1 wird in der Bewertung richtiggestellt (M2).
3. Start nur über `npm run loesch -- scripts/setup-outbox.mjs`, nach Übernahme und Commit dieser Freigabe, mit sauberem Arbeitsbaum. `scripts/setup-outbox.mjs`, `supabase/functions/outbox-send/index.ts` und die drei Dateien unter `supabase/functions/_shared/jobs/` sind gegenüber 53295ee unverändert (sonst neue Runde). Vor dem Start laufen `tests/unit/brevo.test.ts` und `tests/unit/outbox-handler.test.ts` über `npm run t` grün auf diesem Stand (Einträge in `runs.jsonl` mit sauberem Arbeitsbaum).
4. Endet der Lauf mit EXIT ungleich 0: Meldung, Zahlzeilen und Diagnosezeile im Wortlaut berichten. Keine Wiederholung, wenn (a) die Meldung Status 401 oder 503 der Function nennt (Secrets, die Beks setzt), (b) eine Zeile „Anbieter-Diagnose“ erscheint (Brevo lehnt ab; erst behebt Beks die Ursache bei Brevo, jeder weitere Lauf verbraucht nur Versuche), (c) die Meldung zu `db query` ohne vorherige Zeile „Probe: …“ kommt (das kann der Treffer der Vorprüfung sein: erst neu zählen wie in Auflage 2, bei einer Zahl ungleich 0 Beks berichten), (d) der Abbruch mit einem Status ungleich 200 nach mindestens einem Aufruf kam (Zahl der gesendeten Mails unbekannt: Beks berichten, Stand der Probe-Zeilen nur lesend zählen). Sonst höchstens eine Wiederholung. Nie den Vault auf anderem Weg füllen.
5. Die Zahlzeilen, die Zeile „Probe: …“ und, falls vorhanden, die Diagnosezeile stehen im Wortlaut in der Bewertung. Erwartet ist genau eine gesendete Mail. Sind es mehr: sofort anhalten, nichts nachbessern, Beks die Zahl berichten. Die Summe der vier Zahlen wird mit der Zählung aus Auflage 2 abgeglichen (fällige Zeilen ohne die verworfenen Probe-Zeilen, plus die neue Probe); eine Abweichung steht mit Erklärung in der Bewertung.
6. Beks erfährt im Bericht: Die Probe aus Lauf 1 wurde von Brevo abgelehnt, es kam keine Mail an. Je weiterem Lauf geht höchstens eine Probe-Mail mit dem Text einer Kundenmeldung an die Betreiber-Adresse; sie ist keine echte Meldung. Verworfene Probe-Zeilen stehen in der Outbox als gescheitert mit dem Verfallscode. Jeder Lauf verbraucht bei den Zeilen ohne Empfänger einen der fünf Versuche.
7. Die Freigabe gilt für Dev und diesen Hash. Produktion richtet GOLIVE 35 ein, nicht dieses Skript.

## Antworten auf die Prüffragen

**Härtung nach M1, N3, N4, N5 aus Runde 1 umgesetzt?**
- M1: ja, in zwei Teilen. Vorprüfung als DO-Block vor jeder Änderung (`:44-58`): fällige Zeile eines Kunden über das Konto oder einer Firma über `contact_email`, deren Adresse nicht auf eine der vier reservierten Endungen ausgeht, wirft. Das Muster entspricht dem der Function (`handlers.ts:275-276`): dieselben vier Endungen, ohne Groß- und Kleinschreibung; die Function prüft den Teil nach dem letzten At-Zeichen, das SQL die ganze Adresse, beides trifft dieselben Adressen, in Grenzfällen (Endung ohne Punkt davor, angehängter Leerraum) melden beide „nicht reserviert“, die Vorprüfung bricht dann ab. Eine fehlende Adresse (Konto gelöscht, Firma gelöscht; `contact_email` ist Pflichtspalte, `0023:26`) meldet die Vorprüfung nicht, die Function sendet dann auch nicht (`handlers.ts:325`). Die Firmenadresse nimmt die Vorprüfung aus derselben Spalte über dieselbe Verknüpfung wie die Function (`0075:29-30`). Zweiter Teil: Abbruch vor dem Vault, wenn nicht genau eine Mail gesendet wurde (`:104-107`). Offen bleiben M1 und N1 oben.
- N3: ja. Vier Zahlzeilen (`:96-97`) im Format des Gates (`gate-loesch.mjs:77`), vor den Abbrüchen `:100-107`, also auch bei EXIT 1 im Lauf-Log. Rest: N2.
- N4: ja. Abbruch ohne Gate-Kennung (`:16-19`, Exit 2, vor jeder Aktion, Muster wie `scripts/dev-testdaten-zuruecksetzen.mjs:19`); Kommentar `:1` und Meldung `:34` nennen den Weg über das Gate.
- N5: ja. Wartende Probe-Zeilen früherer Läufe werden vor dem Anlegen der neuen im selben Befehl verworfen (`:75-76`). Eine Wiederholung bei einem Fehlstatus direkt nach dem Deploy gibt es weiter nicht (`:86-89`): fail-closed, Auflage 4.

**Kein Wert in Ausgabe oder Fehlertext?** Ja. Die CLI läuft ohne jede Ausgabe (`:26`), ihr Fehler wird durch eine feste Meldung mit den ersten zwei Wörtern des Befehls ersetzt (`:28`; Werte stehen ab dem dritten Argument). Feste Texte: `:17`, `:34`, `:38`, `:41`, `:62`, `:101`, `:115`. Status und Zahlen: `:87`, `:97`, `:98`, `:105`. Die Diagnosezeile `:99` gibt nur Schlüssel aus, die das Muster in `:93` bestehen (drei Ziffern oder das feste Wort für Netzfehler, Doppelpunkt, höchstens 40 Kleinbuchstaben, Unterstriche oder Bindestriche), und deren Zähler als Zahl. In diesem Zeichenvorrat hat weder eine Adresse noch ein Schlüssel mit Ziffern Platz. Ungefangene Fehler (`fetch`, `res.json`, `appendFileSync`) tragen Hostnamen, Pfad oder den Anfang einer Antwort, nie Header oder Secret. Rest: N5 (Secret als Prozessargument).

**Löschbedingung eng?** Ja. Vault: `:113` löscht genau die zwei Namen des Mailversands und legt sie im selben Befehl neu an, unverändert gegenüber Runde 1. Outbox: `:75` ändert nur Zeilen mit dem Schlüssel-Präfix der Probe in den zwei wartenden Zuständen und setzt Werte, die die Tabelle zulässt (Zustand `0034:181`, Fehlercode `0075:37-38`). Auf der Tabelle liegen kein Trigger und keine weitere Bedingung zwischen Zustand und Spalten (Suche über die Migrationen); die Zeilensicherheit ist nicht erzwungen (Suche: 0 Treffer), die Änderung des Eigentümers wirkt also. Gesendete und gescheiterte Zeilen bleiben unberührt. Rest: N3. Mittelbar ändert die aufgerufene Function wie in Runde 1 den Zustand aller fälligen Zeilen (übersprungen gilt als gesendet, verfallen als gescheitert, Fehlversuch zählt einen Versuch); beabsichtigt, nicht umkehrbar.

**Reihenfolge?** Guard `:11`, Gate-Kennung `:16-19`, Formatprüfungen `:33-41`, Vorprüfung `:44-58`, erst danach das Anhängen an `.env.local` (`:60-63`, nur wenn das Secret neu ist), Function-Secrets `:66`, Deploy `:67`, Probe-Zeilen `:71-77`, Aufrufe `:83-95`, Zahlen und Diagnose `:96-99`, Abbrüche `:100-107`, Vault `:109-114`. Das entspricht Vorprüfung, Secrets, Deploy, Probe, Vault. Jeder Fehlerweg endet vor `:109`: Fehlstatus `:86-89`, Outbox nach 80 Aufrufen nicht leer `:100-103`, nicht genau eine Mail `:104-107`, CLI-Fehler `:27-30`, ungefangene Ausnahme. Fehlen Felder in der Antwort, wird die Summe in `:94` keine Zahl, die Schleife läuft aus und endet in `:100-103`.

**Neue Function-Fassung gegen Auflage 3 der Runde 1?** Die Schutzteile sind inhaltlich unverändert: reservierte Endungen `handlers.ts:275-276`; Methode, Secret (401), Einrichtung (503) vor jedem Zugriff auf die Outbox `:298-302`; je Zeile Empfänger `:321-325`, Verfall `:327-332`, Schalter `:334-342`, Versand `:343`; Schalter je Aufruf aus dem Secret `outbox-send/index.ts:31`, Versand nur mit allen vier Werten `:32`.
- Verfall von „Unterwegs“: nur Art `en_route` mit Anfrage, nach der Ankunftszeit oder ohne sie (`db.ts:109-113`); Markierung mit dem Verfallscode, die Datenbank setzt die Zeile sofort endgültig auf gescheitert (`0075:44-46`). Der Verfall steht vor dem Schalter, eine fehlende Adresse davor (`:325`). Ein Lesefehler wirft und zählt als Versuch.
- Schalter `devGuard`: mit Schalter gilt eine Zeile als erledigt, wenn die Adresse oder (bei Betreiber-Zeilen mit Anfrage) die Adresse des Kunden reserviert ist oder der Kunde nicht lesbar ist; ohne Schalter wird der Kunde nicht abgefragt (`outbox-handler.test.ts:146`). Die Probe-Zeile ohne Anfrage geht an den Betreiber, sofern dessen Adresse nicht reserviert ist.
- Zähler `provider`: Schlüssel aus Status (oder festem Wort bei Netzfehler) und Kürzel (`handlers.ts:348-349`), nur bei Fehlern des Mail-Anbieters, in der Antwort nur wenn nicht leer (`:358`) und nur an den Aufrufer mit gültigem Secret; im Log Status und Kürzel ohne Adresse (`:350`). Über den Cron landet die Antwort zusätzlich in der Antworttabelle von pg_net: nur Zahlen und Kürzel.
- `brevo.ts`: Status aus der Antwort, Kürzel nur aus dem Feld `code` und nur, wenn es das Muster `:19` besteht (Kleinbuchstaben und Unterstrich, höchstens 40 Zeichen), sonst leer (`:39-40`); der Antworttext wird nie übernommen, die Fehlermeldung ist fest (`:12`). Netzfehler und Zeitüberschreitung ohne Status (`:32-34`). Die Unit-Tests prüfen genau das mit Adresse im Antworttext und im Feld `code` (`brevo.test.ts:27-35`).
Für diese Runde ist das der geprüfte Stand; Auflage 3 bindet den Lauf jetzt an 53295ee.

**Gilt der bindende Teil der Runde 1 weiter?** Ja, sinngemäß, in den Auflagen oben neu gefasst: 1 erfüllt (Push-Marke vor dem Lauf, `runs.jsonl:22-23` gegen `loesch-lauf.jsonl:1`), bleibt Voraussetzung. 2 bleibt trotz Vorprüfung (M1) und wird um Betreiber-Zeilen ergänzt. 3 gilt mit dem neuen Bezugsstand und gezielten Unit-Läufen. 4 gilt, ergänzt um die Fälle Diagnose, Vorprüfung und unbekannte Zahlen. 5 gilt, das Skript erzwingt „genau eine“ jetzt selbst. 6 und 7 gelten unverändert. Die Hauptsession hat nach Lauf 1 nicht wiederholt, sondern das Skript geändert und eine neue Runde verlangt; das entspricht den Auflagen 3 und 4 der Runde 1.

**Zum Lauf 1:** `loesch-lauf.jsonl:1` zeigt den Lauf mit dem Hash der Runde 1, EXIT 1, ohne Zahlen (wie in N3 der Runde 1 erwartet). Die Zahlen des Auftrags (0 gesendet, 337 Fehler, 506 übersprungen) kann ich nicht nachprüfen. Sie sind in sich stimmig mit dem Ablauf der Function: Zeilen ohne Empfänger scheitern vor dem Schalter (`handlers.ts:325`), Testadressen werden übersprungen (`:336-340`), die Probe ging an Brevo und wurde abgelehnt (`:290`, Zeile danach wieder wartend, `0075:44`). Die Ursache der Ablehnung ist offen; die Diagnosezeile des nächsten Laufs nennt Status und Kürzel, die Behebung liegt bei Beks.

**Geld:** nicht berührt. Die Mailtexte (`handlers.ts:249-272`) sind unverändert ohne Gebühr; die Diagnose enthält keine Beträge.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/setup-outbox.mjs:11` | Guard ist der erste Import: in Ordnung |
| `scripts/setup-outbox.mjs:16-19` | Abbruch ohne Gate-Kennung, vor jeder Aktion: in Ordnung |
| `scripts/setup-outbox.mjs:24-31` | CLI ohne Ausgabe, feste Fehlermeldung; Wirkung hängt am Exit-Code: M1 |
| `scripts/setup-outbox.mjs:35-41` | Secret aus der Umgebung oder neu, Formatprüfung vor jeder Verwendung; URL-Muster ohne Hochkomma: in Ordnung |
| `scripts/setup-outbox.mjs:44-58` | Vorprüfung vor jeder Änderung, SQL-Text fest, Muster wie die Function; nur fällige Zeilen, ohne Betreiber: M1, N1 |
| `scripts/setup-outbox.mjs:60-63` | Anhängen erst nach der Vorprüfung, nur bei neuem Secret: in Ordnung |
| `scripts/setup-outbox.mjs:66-67` | drei Function-Secrets, danach Deploy; Brevo-Werte nicht angefasst: in Ordnung; M3 |
| `scripts/setup-outbox.mjs:75-76` | Verwerfen nur über Präfix und wartenden Zustand, neue Zeile für den Betreiber ohne Anfrage, ein Befehl: in Ordnung; N3 |
| `scripts/setup-outbox.mjs:83-95` | Abbruch bei jedem Status ungleich 200 ohne Zahlen: N2; Diagnose nur gefilterte Schlüssel |
| `scripts/setup-outbox.mjs:96-107` | Zahlzeilen vor den Abbrüchen; Abbruch bei allem außer genau einer Mail: in Ordnung |
| `scripts/setup-outbox.mjs:109-115` | einzige Löschanweisung, zwei Namen, sofort neu angelegt, letzter Schritt: in Ordnung |
| `scripts/sys/gate-loesch.mjs:53-56`, `:62`, `:66`, `:77-78` | Register und Freigabe aus dem Commit, Guard, Kennung für das Kind, Zahlzeilen ins Lauf-Log |
| `scripts/sys/gate-db-lib.mjs:39-51`, `:57-63` | Format der Freigabe; geprüft wird je Pfad und Hash, die Freigabe 1 (alter Hash) stört nicht |
| `scripts/sys/loesch-register.json:15` | Eintrag weiter ohne gebundene Dateien: M3 |
| `scripts/dev-guard.mjs:7-22` | Abbruch bei abweichender Ref aus drei Quellen, Ref für Kindprozesse festgelegt |
| `tests/support/owner.ts:24-35` | Aufrufer wertet Exit-Code und Fehlerkennzeichen der Antwort aus: M1 |
| `scripts/redproof-lib.mjs:585-597` | ebenso; Fangzweig liest den Fehlertext aus stdout: M1 |
| `supabase/functions/_shared/jobs/handlers.ts:275-276` | vier reservierte Endungen, Teil nach dem letzten At-Zeichen |
| `supabase/functions/_shared/jobs/handlers.ts:289-294` | feste Fehlercodes, Anbieterfehler nach dauerhaft und vorübergehend |
| `supabase/functions/_shared/jobs/handlers.ts:298-302` | Methode, Secret, Einrichtung vor dem Zugriff auf die Outbox |
| `supabase/functions/_shared/jobs/handlers.ts:321-343` | Empfänger, Verfall, Schalter, Versand in dieser Reihenfolge |
| `supabase/functions/_shared/jobs/handlers.ts:344-358` | Zähler und Log ohne Adresse und ohne Text; Antwort mit Diagnose nur bei Bedarf |
| `supabase/functions/_shared/jobs/brevo.ts:6-14`, `:19`, `:32-41` | Fehler mit fester Meldung, Status und gefiltertem Kürzel |
| `supabase/functions/_shared/jobs/db.ts:109-113`, `:133-143` | Verfall bei erreichter oder fehlender Ankunftszeit; Adressen über die Auth-Verwaltung, Fehler ergibt leer |
| `supabase/functions/outbox-send/index.ts:28-32` | Secret, Schalter je Aufruf, Versand nur mit allen vier Werten |
| `supabase/migrations/20261118074249_0075_mail1_faellig.sql:6-12` | Fällig-Definition, die die Vorprüfung nutzt |
| `supabase/migrations/20261118074249_0075_mail1_faellig.sql:29-30` | Firmenadresse aus `contact_email`, gleiche Verknüpfung wie die Vorprüfung |
| `supabase/migrations/20261118074249_0075_mail1_faellig.sql:36-38`, `:43-52` | Verfallscode erlaubt; Verfall sofort endgültig, sonst wartend bis zum fünften Versuch |
| `supabase/migrations/20261118074249_0075_mail1_faellig.sql:63-66` | Cron ruft ohne fällige Zeile und ohne beide Vault-Werte nicht auf |
| `supabase/migrations/20261108130000_0030_job_listings.sql:101-113`, `:119-120` | Outbox-Spalten, Schlüssel eindeutig, Zeilensicherheit an, kein DML für Konten |
| `supabase/migrations/20261108170000_0034_s9c_abnahme.sql:181` | vier Zustände, darunter gescheitert |
| `supabase/migrations/20261108140000_0031_distribute_accept.sql:19-25` | `outbox_put`: reines Einfügen, bei gleichem Schlüssel nichts |
| `supabase/migrations/20261107100000_0023_partners.sql:26` | `contact_email` ist Pflicht; „Firma ohne Adresse“ heißt gelöschte Firma |
| Suche Migrationen nach erzwungener Zeilensicherheit | 0 Treffer |
| Suche Migrationen nach Triggern und Bedingungen der Outbox | nur Art, Empfängerart, Empfänger-ID, Zustand, Fehlercode |
| Suche `supabase/`, `scripts/`, `tests/`, `src/` nach dem Probe-Präfix | nur `scripts/setup-outbox.mjs:75-76` |
| `tests/unit/brevo.test.ts:25-36` | Status und Kürzel im Fehler, nie Text oder Adresse |
| `tests/unit/outbox-handler.test.ts:95-100`, `:114-116` | Diagnose in Antwort und Log, fremder Fehler erscheint dort nicht |
| `tmp/proof/mail1/loesch-lauf.jsonl:1` | Lauf 1: Hash der Runde 1, EXIT 1, ohne Zahlen, Ende 09:05:59 UTC: M2 |
| `tmp/proof/mail1/runs.jsonl:22-24` | Push 0075 um 08:58 UTC, danach `en-route.test.ts` grün auf 2f2ff10, sauber |
| `tmp/proof/mail1/runs.jsonl:25-27` | drei Unit-Läufe auf b5cb136, unsauber, 22:12 UTC: N4 |
| `docs/STAND.md:5-7` | Stand der Datei liegt vor dem Push von 0075 und vor Lauf 1 (nicht nachgeführt) |

Offene Findings hoch: 0
