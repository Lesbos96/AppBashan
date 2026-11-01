# Datenschutzerklärung

> **Entwurf, rechtlich nicht geprüft.** Abgeleitet aus dem Code (Stand Commit `14e9dca` plus der laufenden Foto-Arbeit S8b-3). Mit `[BEKS: …]` markierte Angaben muss der Betreiber liefern oder prüfen, mit `[IN ARBEIT]` markierte Teile sind noch nicht fertig. Belege mit Datei:Zeile stehen in Abschnitt 7.

## 1. Verantwortlicher

[BEKS: Name/Firma, Anschrift, E-Mail für Datenschutzanfragen, siehe Impressum]. Datenschutzbeauftragter: [BEKS: benannt oder nicht erforderlich].

## 2. Worum es geht

MoveNow vermittelt Möbeltransport, Umzug, Entrümpelung, Montage und Transportermiete in Wien. Du bekommst einen Richtpreis und sendest eine unverbindliche Anfrage. Diese Erklärung nennt, welche Daten dafür verarbeitet werden. Tracking, Werbe- oder Analysedienste setzt die App nicht ein. Die Schrift Inter wird von der App selbst ausgeliefert, nicht von einem Drittanbieter.

## 3. Verarbeitungen

### 3.1 Anmeldung per E-Mail

- **Daten:** E-Mail-Adresse, Einmal-Code und Link-Token, Sitzungsdaten (Zugangs- und Aktualisierungstoken). Ein Profil mit Rolle wird automatisch angelegt; Name und Telefon sind als Felder vorhanden, die App fragt sie aktuell nicht ab.
- **Zweck:** Konto, damit du eine Anfrage absenden und einsehen kannst.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung).
- **Speicherdauer:** Konto und E-Mail, bis das Konto gelöscht wird [BEKS: Löschverfahren und Frist festlegen, im Code gibt es keine Konto-Löschfunktion]. Der Code ist 15 Minuten gültig (lokale Konfiguration; [BEKS: Wert im gehosteten Projekt prüfen]).
- **Empfänger:** Supabase als Auftragsverarbeiter (Auth). Mailversand: [BEKS: Anbieter, Standard-Mailer von Supabase oder eigener SMTP-Dienst, plus Auftragsverarbeitungsvertrag]. Welche technischen Daten (z. B. IP-Adresse) das Auth-System protokolliert und wie lange: [BEKS: prüfen].
- **Im Browser:** Die Sitzung speichert die Supabase-Bibliothek in deinem Browser (Voreinstellung der Bibliothek, vom Projekt nicht geändert). Das Rücksprungziel und der Entwurf der gerade gesendeten Anfrage liegen für höchstens 15 Minuten im lokalen Speicher, damit der Link der Mail in einem neuen Tab funktioniert. Eine Markierung „Einführung gesehen“ bleibt ohne Ablauf, bis du die Browserdaten löschst. Entwürfe des Anfrageablaufs liegen im Sitzungsspeicher und verschwinden, wenn du den Tab schließt. Alles ist für den Betrieb notwendig; eine Einwilligung ist dafür nicht erforderlich.

### 3.2 Anfragen und Adressen

- **Daten:** Leistungsart, deine Angaben zum Auftrag (Umfang, Personen, Fahrzeuge, Stunden), Abhol- und Zieladresse samt PLZ und Koordinaten, berechnete Strecke und Region, Wunschtermin und Zeitfenster, Freitext (bis 800 Zeichen), Volumen, Richtpreis (Snapshot mit Tarifversion). Bei Mietanfragen: Angebot, Abhol- und Rückgabezeit, Kilometer, Zusatzoptionen.
- **Zweck:** Anfrage bearbeiten, Preis und Termin bestätigen, Auftrag abwickeln.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO.
- **Speicherdauer:** Im Code ist keine automatische Löschfrist umgesetzt. Löschst du das Konto, werden Profil, Anfragen, Mietanfragen und Foto-Einträge mitgelöscht; die Foto-Dateien entfernt der stündliche Aufräumjob (siehe 3.5). Vorgesehene Fristen (Vorschlag, noch nicht entschieden): zurückgezogene und abgelaufene Anfragen 12 Monate, abgeschlossene Aufträge 3 Jahre, Rechnungen 7 Jahre nach § 132 BAO [BEKS: Fristen festlegen und umsetzen lassen].
- **Empfänger:** Supabase (Datenbank). Weitergabe an einen Partner zur Terminbestätigung erfolgt in dieser Phase außerhalb der App [BEKS: Partner, Umfang der Weitergabe und Rechtsgrundlage beschreiben].

### 3.3 Adresssuche und Routenberechnung (openrouteservice / HeiGIT)

- **Daten:** Der Adresstext deiner Eingabe (Suche) und die Koordinaten von Abhol- und Zielort (Route). Deine IP-Adresse und Browserdaten gehen nicht an den Anbieter; die Anfrage kommt von unserer Serverfunktion.
- **Zweck:** Adresse bestätigen, Kilometer und Fahrzeit für den Richtpreis berechnen.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO. Die App fragt vor der Übermittlung nach deiner Einwilligung; ohne sie bleibt die Strecke ungeprüft und du erhältst ein persönliches Angebot. Widerruf: Schalter in der Strecken-Eingabe ausschalten bzw. formlos an die Adresse in Abschnitt 1.
- **Speicherdauer beim Anbieter:** [BEKS: Angaben von HeiGIT einholen]. Wir speichern die Adresssuche nicht zwischen.
- **Zwischenspeicher (route_cache):** Gespeichert wird die Antwort des Anbieters (Distanzen, Dauer, Linie der Strecke, adressgenau, ohne Bezug zu deinem Konto). Der Schlüssel ist ein HMAC über die Koordinaten. Löschfrist: 24 Stunden Gültigkeit, stündlich bereinigt, also spätestens 25 Stunden nach dem Speichern. Empfänger: Supabase.
- **Empfänger:** HeiGIT (Heidelberg Institute for Geoinformation Technology, Deutschland), Auftragsverarbeiter [BEKS: Auftragsverarbeitungsvertrag nach Art. 28 DSGVO abschließen, vor Livegang Pflicht laut Projektentscheidung].

### 3.4 Missbrauchsschutz (Rate-Limits)

- **Daten:** Ein Zähler je Zeitfenster, zugeordnet über eine Prüfsumme (HMAC mit Server-Geheimnis) deiner IP-Adresse bzw. deiner Konto-Kennung. Die IP-Adresse selbst wird nicht gespeichert; die Prüfsumme gilt dennoch als personenbezogenes Pseudonym.
- **Zweck:** Schutz vor Überlastung und Missbrauch der Routenfunktionen, Einhaltung der Kontingente des Routendienstes.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (Sicherheit und Funktionsfähigkeit des Dienstes).
- **Speicherdauer:** Zähler werden stündlich gelöscht, sobald der Beginn ihres Zeitfensters mehr als 2 Tage zurückliegt, also spätestens 2 Tage und 1 Stunde nach Beginn des Zeitfensters.
- **Empfänger:** Supabase.

### 3.5 Fotos [IN ARBEIT]

Dieser Abschnitt beschreibt den Stand von S8b-3 und ist noch nicht abgeschlossen.

- **Daten:** Bis zu 8 Fotos je Anfrage (je höchstens 10 MB). Die App kodiert jedes Bild vor dem Upload neu zu JPEG (längste Kante 2000 px); dabei entfallen EXIF-Daten wie Standort und Gerät. Auf Fotos erkennbare Personen, Kennzeichen oder Gegenstände sind personenbezogen: bitte nur Fotos von Möbeln und Räumen hochladen.
- **Zweck:** Umfang des Auftrags einschätzen.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO.
- **Speicherdauer:** Fotos liegen in einem privaten Speicher und werden nur über kurz gültige Links (10 Minuten) angezeigt. Dateien ohne zugehörigen Datenbankeintrag (Fehl-Uploads) werden stündlich geprüft und nach 1 Stunde entfernt, Datenbankeinträge ohne Datei nach 48 Stunden. Das Entfernen der Dateien läuft erst nach der einmaligen Einrichtung des Aufräumjobs (Secrets im Vault) [BEKS/IN ARBEIT: Einrichtung im Live-Projekt bestätigen]; ohne sie läuft nur der Datenbankteil. Für Fotos zu gültigen Anfragen ist keine automatische Löschfrist im Code umgesetzt [BEKS: Frist festlegen; Vorschlag im Projekt: 90 Tage nach Abschluss, Rücknahme oder Ablauf]. Du kannst Fotos entfernen, solange die Anfrage offen ist.
- **Empfänger:** Supabase (Storage). Vor einer Weitergabe an Partner ist laut Projektplan eine serverseitige Prüfung nötig [IN ARBEIT].

### 3.6 Hosting und Betrieb

- **Backend:** Supabase (Datenbank, Authentifizierung, Dateispeicher, Serverfunktionen). Region des gehosteten Projekts: [BEKS: prüfen, die Konfiguration im Repository enthält keine Region; als Empfehlung ist Frankfurt dokumentiert]. Auftragsverarbeitungsvertrag: [BEKS: abschließen bzw. bestätigen]. Drittlandübermittlung: [BEKS: prüfen (Supabase Inc., USA, Standardvertragsklauseln / Data Privacy Framework)].
- **Auslieferung der App:** statischer Build; Hosting-Anbieter [BEKS: Anbieter, Serverstandort, Zugriffsprotokolle und deren Dauer].
- **Protokolle der Serverfunktionen:** Sie enthalten nur Modus, Statuscode, Dauer und Fehlercode, keine Adressen, Koordinaten oder IP-Adressen. Die Plattform-Protokolle von Supabase speichern Metadaten der Anfrage samt IP-Adresse ohne Inhalt; Aufbewahrungsdauer je nach Tarif [BEKS: prüfen]. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.

### 3.7 Kartendaten

Die App lädt keine Kartenkacheln von Drittanbietern. Grenzdaten (Wien, Österreich) liegen in unserer Datenbank (OpenStreetMap, ODbL).

## 4. Deine Rechte

Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitung aufgrund berechtigter Interessen (Art. 21). Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3). Schreibe dafür an die Adresse in Abschnitt 1.

## 5. Beschwerde

Du kannst dich bei der österreichischen Datenschutzbehörde beschweren: Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, www.dsb.gv.at, dsb@dsb.gv.at.

## 6. Pflicht zur Bereitstellung

Ohne E-Mail-Adresse kannst du keine Anfrage absenden. Die Einwilligung zur Adressübermittlung ist freiwillig; ohne sie erhältst du ein persönliches Angebot statt eines Richtpreises.

## 7. Belege im Code

Stand: 2026-11-01, Zeilen gegen den committeten Stand von S8b-3 geprüft; sie können sich verschieben.

| Aussage | Beleg im Code |
|---|---|
| Routen-Cache gilt 24 Stunden | `supabase/functions/_shared/route/compute.ts:7`, gesetzt in `:33`, `expires_at` in `supabase/functions/_shared/route/db.ts:19` |
| Cache enthält Antwort des Anbieters ohne Adresstexte, Schlüssel = HMAC über Koordinaten | `supabase/migrations/20261029214421_0006_route_infra.sql:5-10`, `compute.ts:22` |
| Cache stündlich bereinigt, also ≤ 25 h | `supabase/migrations/20261029233428_0009_route_cleanup.sql:8` und `:16` (Minute 17, stündlich) |
| Zähler werden gelöscht, wenn der Fensterbeginn > 2 Tage zurückliegt; stündlicher Job | `supabase/migrations/20261029233428_0009_route_cleanup.sql:9` und `:16` |
| Zähler tragen gehashte IP (HMAC) | `supabase/functions/_shared/route/handler.ts:56`, `supabase/functions/_shared/quote/handler.ts:117`, Tabelle `0006_route_infra.sql:13-19` |
| Zähler auch je gehashter Konto-Kennung | `supabase/functions/_shared/quote/handler.ts:159`, Limits `:31` |
| Tagesfenster = 86400 s | `supabase/functions/_shared/route/handler.ts:18` |
| Logs der Functions ohne IP, Adresse, Koordinaten | `supabase/functions/route/index.ts:29`, `supabase/functions/quote/index.ts:31`, Felder in `route/handler.ts:13` |
| Plattform-Logs mit IP, Aufbewahrung je Plan | `docs/ARCHITECTURE.md:62` |
| Anbieter ORS/HeiGIT, URLs | `supabase/functions/_shared/route/provider.ts:22-24` |
| Keine IP/Header an den Anbieter | `supabase/functions/_shared/route/provider.ts:2` |
| Geocoding wird nicht gecacht | `docs/ARCHITECTURE.md:62`, `compute.ts:22-33` (Cache nur für Route) |
| AVV vor Produktion Pflicht | `docs/ARCHITECTURE.md:91` |
| Einwilligung vor Adressübermittlung | `src/screens/konfigurator/Strecke.tsx:68` (ohne Einwilligung kein Aufruf), `:102`, `:108` |
| Anmelde-Code 15 Minuten (lokale Konfiguration) | `supabase/config.toml:235` |
| Eigener SMTP nicht konfiguriert | `supabase/config.toml:238` (auskommentiert) |
| Anmeldung per E-Mail-Code/Link, Konto wird angelegt | `src/lib/auth.ts:45`, `:57`, `:64`, Trigger `supabase/migrations/20261029141616_0001_foundation.sql:44-57` |
| Sitzung nicht vom Projekt überschrieben (Bibliotheksstandard) | `src/lib/supabase.ts:5-10` (nur `detectSessionInUrl` gesetzt, kein `storage`-Eintrag) |
| Rücksprungziel 15 Minuten im lokalen Speicher | `src/lib/auth.ts:17-19`, `:113` |
| Entwurf-Übergabe 15 Minuten im lokalen Speicher | `src/lib/draft.ts:146-148`, `:157` |
| Entwürfe im Sitzungsspeicher | `src/lib/flow.ts:169`, `src/lib/draft.ts:65` |
| Einführungs-Markierung ohne Ablauf | `src/lib/onboarding.ts:1`, `:14` |
| Schrift Inter lokal | `src/main.tsx:5` |
| Konto-Löschung kaskadiert auf Anfragen, Mietanfragen, Fotos | `0001_foundation.sql:107` (Anfragen), `:135` (Fotos), `:174` (Mietanfragen) |
| Felder der Anfrage (Adressen, PLZ, Punkte, Route, Termin, Zeitfenster) | `0001_foundation.sql:105-129` |
| Freitext ≤ 800 Zeichen, Volumen | `supabase/migrations/20261030120000_0010_quote.sql:7-8` |
| Profil mit Name/Telefon-Feldern | `0001_foundation.sql:28-35` |
| Keine automatische Löschung von Anfragen im Code; Fristen sind Vorschlag | `docs/ARCHITECTURE.md:62` („Vorschlag, Entscheidung offen“), kein `cron.schedule` für Anfragen in `supabase/migrations/` |
| Privater Foto-Speicher | `0001_foundation.sql:408-409` |
| Nur JPEG im Speicher | `supabase/migrations/20261101120000_0011_photos.sql:39` |
| Höchstens 8 Fotos je Anfrage | `0011_photos.sql:10-11`, `src/lib/photos.ts:3` |
| Höchstens 10 MB, Neu-Kodierung, EXIF entfällt, 2000 px | `src/lib/photos.ts:4-5`, `:13`, `:43` |
| Signierte Links 10 Minuten | `src/lib/uploads.ts:10`, `:124-133`, `docs/ARCHITECTURE.md:60` |
| Dateien ohne Zeile nach 1 Stunde entfernt, nur nach Einrichtung der Vault-Secrets | `0011_photos.sql:48`, `:56-57`, `:71-75`, `supabase/functions/photo-cleanup/index.ts:33`, `:39` |
| Einträge ohne Datei nach 48 Stunden gelöscht | `0011_photos.sql:67-69` |
| Foto-Aufräumjob stündlich (Minute 23) | `0011_photos.sql:82` |
| Foto-Frist 90 Tage nur Vorschlag | `docs/ARCHITECTURE.md:62` |
| Region des Supabase-Projekts nicht in der Konfiguration; nur Empfehlung Frankfurt | `docs/SESSION_PROMPTS.md:9`, `supabase/config.toml` enthält keinen Regionswert |
| Keine Kartenkacheln, Grenzdaten OSM in der DB | `docs/ARCHITECTURE.md:86`, keine Kachelbibliothek in `package.json` |
