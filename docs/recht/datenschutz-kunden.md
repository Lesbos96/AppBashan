**ENTWURF – nicht rechtsgeprüft**

# Datenschutzerklärung für Kundinnen und Kunden

> Entwurf aus dem Nachtauftrag vom 2026-11-05, abgeleitet aus Code und Migrationen (Commit `1630668`, Migrationen 0001–0022) und aus dem Konzept für den Partnerteil (`docs/S9_KONZEPT.md`). Was heute noch nicht gebaut ist, steht als **[noch nicht gebaut]** im Text; vor dem Livegang gegen den dann gebauten Stand prüfen. Belege in Abschnitt 11. Die Erklärung für Partnerbetriebe steht getrennt in `docs/recht/datenschutz-partner.md` (Begründung: `docs/nacht/doku.md`, E11). Vorgänger: `docs/legal/datenschutz.md` (Stand S8b-3).

## 1. Wer verantwortlich ist

[OFFEN: Name bzw. Firma, Anschrift, E-Mail für Datenschutzanfragen, siehe Impressum.]
Datenschutzbeauftragter: [OFFEN: benannt oder nicht erforderlich].

## 2. Worum es geht

MoveNow vermittelt in Wien Möbeltransport, Umzug, Entrümpelung sowie Montage und Demontage von Möbeln. Du bekommst einen Preis bzw. eine Preisspanne, sendest eine verbindliche Buchungsanfrage, und ein geprüfter Partnerbetrieb nimmt sie in der App an. Diese Erklärung nennt, welche Daten wir dafür verarbeiten, warum, wie lange und wer sie erhält.

Wir setzen keine Werbe-, Analyse- oder Tracking-Dienste ein, keine Cookies und keine Inhalte von Drittanbietern. Die Schrift wird von der App selbst ausgeliefert.

## 3. Preise ansehen, ohne Konto

- **Daten:** keine Angaben von dir. Beim Laden der App und der Tarife fallen technische Verbindungsdaten an (IP-Adresse, Zeitpunkt, angefragte Adresse), die unsere Dienstleister protokollieren.
- **Zweck und Rechtsgrundlage:** Auslieferung und Sicherheit der App, Art. 6 Abs. 1 lit. f DSGVO.
- **Speicherdauer:** [OFFEN: Protokolldauer des Hosting-Anbieters und der Supabase-Plattformprotokolle je Tarif].

## 4. Konto und Anmeldung

- **Daten:** E-Mail-Adresse, Einmal-Code und Anmelde-Link (derselbe Einmal-Wert, gültig 15 Minuten), Sitzungsdaten. Beim ersten Anmelden entsteht ein Profil mit der Rolle „Kunde“; es hat Felder für Name und Telefon, die die App heute nicht abfragt.
- **Zweck:** Damit du eine Buchungsanfrage senden und deine Aufträge sehen kannst. Die App fragt die Anmeldung erst beim Absenden einer Anfrage ab; das Konto entsteht, sobald du dabei zum ersten Mal einen Code anforderst (`src/lib/auth.ts:42-47`).
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertrag bzw. vorvertragliche Maßnahmen).
- **Speicherdauer:** bis zur Löschung des Kontos. [OFFEN: Eine Funktion „Konto löschen“ gibt es noch nicht; Verfahren, Frist und Anonymisierung bestätigter Aufträge festlegen (`docs/OPEN_ISSUES.md:7`).] [OFFEN: welche technischen Daten (z. B. IP-Adresse) das Anmeldesystem protokolliert und wie lange.]
- **Empfänger:** Supabase (Anmeldung, Datenbank) und der Mailversand. [OFFEN: Mail-Anbieter; heute nutzt das Projekt den Standard-Mailer von Supabase, vor dem Livegang ist ein eigener Anbieter mit Auftragsverarbeitungsvertrag vorgesehen (`docs/OPEN_ISSUES.md:32`).]

## 5. Adresssuche und Routenberechnung

- **Daten:** der Text deiner Adresseingabe (Suche) und die Koordinaten von Abhol- und Zielort (Strecke). Deine IP-Adresse und Browserdaten gehen nicht an den Routendienst; die Anfrage stellt unsere Serverfunktion.
- **Zweck:** Adresse bestätigen, Kilometer und Fahrzeit für den Preis berechnen, Bezirk der Abholadresse bestimmen.
- **Rechtsgrundlage:** Die App fragt vor jeder Übermittlung nach deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO); ohne sie wird keine Adresse übermittelt und du erhältst statt eines Preises ein persönliches Angebot. Widerruf jederzeit über den Schalter in der Adresseingabe oder per E-Mail an die Adresse in Abschnitt 1. [OFFEN: Ist für das Absenden der Buchung Einwilligung oder Vertragserfüllung (Art. 6 Abs. 1 lit. b) die richtige Grundlage? Eine Einwilligung, ohne die nicht gebucht werden kann, ist möglicherweise nicht freiwillig (`docs/OPEN_ISSUES.md:254`).]
- **Zwischenspeicher:** Die Antwort des Routendienstes zu einer Strecke (Distanzen, Dauer, Linie) speichern wir bis zu 24 Stunden ohne Bezug zu deinem Konto; der Schlüssel ist eine Prüfsumme (HMAC) über die Koordinaten. Beim Absenden prüft der Server deine Adresse noch einmal beim Routendienst; die gefundenen Adressvorschläge speichern wir ebenfalls bis zu 24 Stunden ohne Kontobezug, der Schlüssel ist eine Prüfsumme über den Adresstext. Beide Speicher werden stündlich bereinigt, die Daten sind also spätestens nach etwa 25 Stunden gelöscht.
- **Empfänger:** Heidelberg Institute for Geoinformation Technology (HeiGIT), Deutschland, Dienst openrouteservice, als Auftragsverarbeiter. [OFFEN: Auftragsverarbeitungsvertrag nach Art. 28 DSGVO abschließen, vor dem Livegang Pflicht (`docs/OPEN_ISSUES.md:23`); Speicherdauer beim Anbieter erfragen; Rechtsform des Anbieters bestätigen.]

## 6. Buchungsanfrage

- **Daten:** gewählte Leistung und deine Angaben zum Umfang (z. B. Personen, Fahrzeuge, Stunden, Gegenstände, Volumen, Etagen), Abhol- und Zieladresse mit Koordinaten, Wiener Bezirk der Abholadresse, berechnete Strecke und Region, Wunschtermin und Zeitfenster, Freitext (bis 800 Zeichen), Kontakt für den Auftrag (Name, Telefon, E-Mail, Stiege/Tür), Fotos (Abschnitt 7), der Preis-Stand zum Zeitpunkt des Absendens (Betrag oder Spanne, Tarifversion, Bedingungen) und ein Beleg, welchen Betrag und welche Bedingungen du bestätigt hast. Jede Statusänderung (z. B. „zurückgezogen“) wird mit Zeitpunkt und auslösendem Konto protokolliert.
- **Zweck:** Vermittlung an passende Partnerbetriebe, Zustandekommen und Abwicklung des Vertrags mit dem Partner, Nachweis deiner Zustimmung zum Preis.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO; für die Protokolle zusätzlich Art. 6 Abs. 1 lit. f DSGVO (Nachweis und Streitbeilegung).
- **Speicherdauer:** [OFFEN: Im Code ist keine automatische Löschfrist umgesetzt. Vorschlag aus dem Projekt, nicht entschieden: zurückgezogene und abgelaufene Anfragen 12 Monate, abgeschlossene Aufträge 3 Jahre, Buchhaltungsunterlagen 7 Jahre (§ 132 BAO) (`docs/ARCHITECTURE.md:62`).] Eine Funktion „Konto löschen“ ist **[noch nicht gebaut]**; geplant ist, Konten mit Aufträgen, für die ein Vertrag zustande kam, zu anonymisieren statt zu löschen, weil Abrechnungsdaten aufbewahrt werden müssen (`docs/S9_KONZEPT.md`, R11 und S9h). Technisch gilt heute: Wird ein Konto gelöscht, werden Profil, Anfragen, Preis-Stände, Kontakte, Fotoeinträge und Statusprotokolle mitgelöscht, die Fotodateien entfernt der stündliche Aufräumjob; der Beleg deiner Preisbestätigung bleibt mit der Konto-Kennung (ohne Name, Adresse oder E-Mail) bestehen [OFFEN: Frist für diesen Beleg festlegen].
- **Empfänger:** Supabase (Datenbank); Partnerbetriebe nach Abschnitt 8.

## 7. Fotos

- **Daten:** bis zu 8 Fotos je Anfrage, je höchstens 10 MB. Die App wandelt jedes Bild vor dem Hochladen in ein neues JPEG um (längste Kante höchstens 2.000 Pixel); dabei entfallen eingebettete Daten wie Aufnahmeort und Gerät. Auf Fotos erkennbare Personen, Kennzeichen oder Dokumente sind personenbezogene Daten: Bitte fotografiere nur Möbel, Gegenstände und Räume.
- **Zweck:** Umfang des Auftrags für Preis und Durchführung einschätzen.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO.
- **Ablauf und Speicherdauer:** Die Fotos werden nach der Anmeldung in einen privaten Speicher geladen und beim Absenden der Anfrage zugeordnet; danach kannst du sie nicht mehr ändern. Fotos, die keiner Anfrage zugeordnet wurden, löscht ein stündlicher Job nach 24 Stunden plus einer Stunde Karenz. Angezeigt werden Fotos nur über Links, die 10 Minuten gültig sind. Für die hochgeladenen Fotos zugeordneter Anfragen gibt es noch keine Löschfrist [OFFEN: Frist festlegen; Vorschlag im Projekt 90 Tage nach Abschluss, Rücknahme oder Ablauf]. Die Kopien für Partner werden 30 Tage nach Abschluss oder Storno gelöscht **[noch nicht gebaut]**.
- **Für Partnerbetriebe [noch nicht gebaut]:** Partner erhalten nie die hochgeladene Datei, sondern eine vom Server geprüfte und neu erzeugte Kopie ohne eingebettete Daten (längste Kante höchstens 1.600 Pixel), angezeigt über 10 Minuten gültige Links. Vor der Annahme sehen diese Kopien alle Partnerbetriebe, denen deine Anfrage angeboten wird.
- **Empfänger:** Supabase (Speicher); Partnerbetriebe nach Abschnitt 8.

## 8. Weitergabe an Partnerbetriebe [noch nicht gebaut]

- **Vor der Annahme:** Deine Anfrage wird an Partnerbetriebe verteilt, die für die Leistung, den Bezirk der Abholadresse und den Termin in Frage kommen. Sie sehen den Bezirk der Abholadresse, bei Transport und Umzug die Postleitzahl des Ziels, Umfang, Termin, Preis und die Foto-Kopien, aber **keine Straße, keine Hausnummer, keinen Namen und keine Kontaktdaten** (`docs/S9_KONZEPT.md`, 5.5).
- **Nach der Annahme:** Nur der Partner, der angenommen hat, erhält Adresse und Kontakt für den Auftrag. Sein Zugriff endet 30 Tage nach Abschluss oder Storno des Auftrags; danach löschen wir die Foto-Kopien.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vermittlung und Erfüllung des Vertrags, den du mit dem Partner schließt).
- **Rolle des Partners:** [OFFEN: Ist der Partner für die Daten nach der Annahme eigener Verantwortlicher oder Auftragsverarbeiter von MoveNow? (`docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 10). Der Text hier geht von eigener Verantwortung des Partners für die Durchführung aus.]
- **Mails:** Über Annahme, Ablauf, Angebote, Nachträge und Storno informieren wir dich per Mail und in der App. [OFFEN: Mail-Anbieter, siehe Abschnitt 4.]

## 9. Missbrauchsschutz

- **Daten:** Zähler je Zeitfenster, zugeordnet über eine Prüfsumme (HMAC mit Server-Geheimnis) deiner IP-Adresse bzw. deiner Konto-Kennung. Die IP-Adresse selbst speichern wir nicht; die Prüfsumme ist trotzdem ein personenbezogenes Pseudonym.
- **Zweck:** Schutz vor Überlastung und Missbrauch, Einhaltung der Kontingente des Routendienstes.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (Sicherheit und Funktionsfähigkeit des Dienstes).
- **Speicherdauer:** Ein stündlicher Job löscht Zähler, deren Zeitfenster mehr als 2 Tage zurückliegt.

### 9a. Schutz vor automatisierten Zugriffen [noch nicht gebaut]

Vor dem Livegang sollen Adresssuche, Routenberechnung und Anmeldung zusätzlich durch eine Prüfung gegen automatisierte Zugriffe geschützt werden (Turnstile, `docs/GOLIVE.md:35`, `:45`). Dabei verarbeitet der Anbieter technische Daten deines Browsers. [OFFEN: Anbieter (Cloudflare), verarbeitete Daten, Rechtsgrundlage (Art. 6 Abs. 1 lit. f DSGVO?), Drittlandbezug, Auftragsverarbeitungsvertrag; prüfen, ob dafür eine Einwilligung nach § 165 Abs. 3 TKG 2021 nötig ist.]

## 10. Speicherung in deinem Browser

Die App legt in deinem Browser nur ab, was für den Ablauf nötig ist:
- die Anmeldesitzung (Zugangs- und Aktualisierungstoken im lokalen Speicher, Voreinstellung der Supabase-Bibliothek), bis du dich abmeldest;
- für höchstens 15 Minuten das Rücksprungziel nach der Anmeldung und eine Kopie des gerade gesendeten Entwurfs, damit der Link aus der Mail auch in einem neuen Tab funktioniert;
- eine Markierung „Einführung gesehen“ ohne Ablauf;
- im Sitzungsspeicher des Tabs den Entwurf deiner Anfrage (Angaben, Termin, Adressen, Kontakt, angezeigter Preis); er verschwindet, wenn du den Tab schließt oder dich abmeldest.

Diese Speicherung ist für den von dir gewünschten Dienst unbedingt erforderlich und braucht keine Einwilligung (§ 165 Abs. 3 Telekommunikationsgesetz 2021). [OFFEN: prüfen]

## 11. Empfänger, Auftragsverarbeiter, Drittländer

| Empfänger | Aufgabe | Ort | Stand |
|---|---|---|---|
| Supabase | Datenbank, Anmeldung, Dateispeicher, Serverfunktionen | [OFFEN: Region des Projekts; `CLAUDE.md` verlangt EU] | [OFFEN: Auftragsverarbeitungsvertrag bestätigen; Drittlandbezug des Anbieters und Garantien prüfen] |
| HeiGIT (openrouteservice) | Adresssuche, Routen | Deutschland | [OFFEN: Auftragsverarbeitungsvertrag] |
| Mail-Anbieter | Anmelde- und Auftragsmails | [OFFEN] | [OFFEN] |
| Hosting der App | Auslieferung der App | [OFFEN] | [OFFEN: Anbieter, Protokolle] |
| Bot-Schutz (Turnstile) | Prüfung gegen automatisierte Zugriffe | [OFFEN] | [noch nicht gebaut], Abschnitt 9a |
| Partnerbetriebe | Durchführung deines Auftrags | Österreich | [noch nicht gebaut], Abschnitt 8 |

### 11a. Übermittlung in Drittländer

[OFFEN: Ob Daten außerhalb des EWR verarbeitet werden (z. B. durch Konzerngesellschaften von Supabase, des Mail- oder Hosting-Anbieters oder des Bot-Schutzes) und auf welcher Grundlage (Angemessenheitsbeschluss, Standardvertragsklauseln), ist nicht geklärt. Abschnitt erst nach Wahl der Anbieter ausfüllen.]

## 12. Deine Rechte

Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Eine Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3). Schreib dafür an die Adresse in Abschnitt 1.

Du kannst dich bei der Aufsichtsbehörde beschweren: Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, www.dsb.gv.at. [OFFEN: Anschrift vor Veröffentlichung prüfen]

## 13. Pflicht zur Bereitstellung, keine automatisierte Entscheidung

Ohne E-Mail-Adresse, Adressen und Kontakt für den Auftrag kannst du keine Buchungsanfrage senden. Die Einwilligung zur Adressübermittlung ist freiwillig; ohne sie bekommst du ein persönliches Angebot statt eines Preises [OFFEN: siehe Abschnitt 5 zur Rechtsgrundlage].

Welche Partner deine Anfrage sehen, ergibt sich automatisch aus Leistung, Bezirk und Termin; den Auftrag erhält der Partner, der zuerst annimmt. Eine automatisierte Entscheidung mit rechtlicher Wirkung dir gegenüber im Sinne von Art. 22 DSGVO findet nicht statt. [OFFEN: prüfen]

## 14. Belege im Code

| Aussage | Beleg |
|---|---|
| keine externen Inhalte, keine Cookies, Inter lokal | `src/main.tsx:5`, kein `document.cookie` in `src/` |
| Konto beim Absenden, Code und Link in einer Mail | `src/lib/auth.ts:42-47`, `supabase/templates/magic_link.html` |
| Code 15 Minuten (lokale Konfiguration) | `supabase/config.toml:235` [OFFEN: Wert im gehosteten Projekt; im Dev-Projekt laut `docs/OPEN_ISSUES.md:32` gesetzt] |
| Profil mit Rolle, Name, Telefon | `supabase/migrations/20261029141616_0001_foundation.sql:28-57` |
| Einwilligung vor Adressübermittlung | `src/lib/route.ts:32`, `src/screens/konfigurator/useRouteCalc.ts:16` |
| keine IP/Header an den Routendienst | `supabase/functions/_shared/route/provider.ts:2` |
| Routen-Cache 24 h, HMAC-Schlüssel | `supabase/functions/_shared/route/compute.ts:7`, `:22`, `:33` |
| Adress-Cache 24 h, HMAC-Schlüssel über das Label | `supabase/functions/_shared/quote/handler.ts:33`, `:169-190` |
| stündliche Bereinigung der Caches | `…_0009_route_cleanup.sql:16`, `…_0019_quote_hardening.sql:27` |
| Felder der Anfrage, Kontakt, Freitext | `…_0001_foundation.sql:105-129`, `…_0010_quote.sql:7-8`, `…_0018_revisions_contacts.sql:206-213` |
| Beleg der Preisbestätigung ohne Personendaten | `…_0020_photo_staging.sql:278-283`, `audit_log` ohne Fremdschlüssel (`…_0015_versions_published.sql:19-28`) |
| Statusprotokoll | `…_0017_status_machine.sql:153-197` |
| Kontolöschung kaskadiert | `…_0001_foundation.sql:29`, `:107`, `:135`; `…_0018_revisions_contacts.sql:12`, `:207`; `…_0017_status_machine.sql:156` |
| Fotos: 8, 10 MB, JPEG neu, 2.000 px | `src/lib/photos.ts:3-5`, `:13`, `:30-43` |
| Staging und Aufräumen nach 24 h + 1 h | `…_0020_photo_staging.sql:79-123`, `supabase/seed.sql:108` |
| Links 10 Minuten | `src/lib/uploads.ts:8-9` |
| Zähler mit HMAC, Löschung nach 2 Tagen | `supabase/functions/_shared/route/handler.ts:56`, `supabase/functions/_shared/quote/handler.ts:215-226`, `…_0009_route_cleanup.sql:3-16` |
| Browser-Speicher | `src/lib/onboarding.ts:1`, `src/lib/auth.ts:18-19`, `:75-85`, `src/lib/draft.ts:5-54`, `:190-191` |
| Partnerteil (Abschnitt 7 und 8, noch nicht gebaut) | `docs/S9_KONZEPT.md` 7.1–7.3, 5.10 (`partner_access_days` 30), `CLAUDE.md` („Partner-Portal“) |
