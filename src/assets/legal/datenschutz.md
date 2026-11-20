# Datenschutz

Die Abschnitte 1 bis 13 gelten für Kundinnen und Kunden. Für Partnerbetriebe gilt zusätzlich Abschnitt 14 (Registrierung und Betrieb eines Partnerkontos); die Abschnitte 1, 9 bis 12 gelten für sie entsprechend.

## 1. Wer verantwortlich ist

[ANWALT: Name bzw. Firma, Anschrift, E-Mail für Datenschutzanfragen, siehe Impressum.]
Datenschutzbeauftragter: [ANWALT: benannt oder nicht erforderlich].

## 2. Worum es geht

MoveNow vermittelt in Wien Möbeltransport, Umzug, Entrümpelung sowie Montage und Demontage von Möbeln. Du bekommst einen Preis bzw. eine Preisspanne, sendest eine verbindliche Buchungsanfrage, und ein geprüfter Partnerbetrieb nimmt sie in der App an. Diese Erklärung nennt, welche Daten wir dafür verarbeiten, warum, wie lange und wer sie erhält.

Wir setzen keine Werbe-, Analyse- oder Tracking-Dienste ein, keine Cookies und keine Inhalte von Drittanbietern für die Darstellung. Die Schrift wird von der App selbst ausgeliefert. Die Sicherheitsprüfung gegen automatisierte Zugriffe (Abschnitt 9a) und die Dienste in Abschnitt 11 erhalten nur die dort genannten Daten.

## 3. Preise ansehen, ohne Konto

- **Daten:** keine Angaben von dir. Beim Laden der App und der Tarife fallen technische Verbindungsdaten an (IP-Adresse, Zeitpunkt, angefragte Internetadresse), die unsere Dienstleister protokollieren.
- **Zweck und Rechtsgrundlage:** Auslieferung und Sicherheit der App, Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist ein sicherer, erreichbarer Dienst. Du kannst dieser Verarbeitung nach Art. 21 DSGVO widersprechen. [ANWALT: Interessenabwägung prüfen]
- **Speicherdauer:** [ANWALT: Protokolldauer des Hosting-Anbieters und der Supabase-Plattformprotokolle]

## 4. Konto und Anmeldung

- **Daten:** E-Mail-Adresse, Einmal-Code und Anmelde-Link (derselbe Einmal-Wert, gültig 15 Minuten), Sitzungsdaten. Beim ersten Anmelden entsteht ein Profil mit der Rolle „Kunde“; es hat Felder für Name und Telefon, die die App heute nicht abfragt.
- **Zweck:** Damit du eine Buchungsanfrage senden und deine Aufträge sehen kannst. Die App fragt die Anmeldung erst beim Absenden einer Anfrage ab; das Konto entsteht, sobald du dabei zum ersten Mal einen Code anforderst.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertrag bzw. vorvertragliche Maßnahmen).
- **Speicherdauer:** bis zur Löschung des Kontos. Du kannst dein Konto in der App unter „Profil“ selbst löschen. [ANWALT: Verfahren, Fristen und Anonymisierung von Aufträgen, für die ein Vertrag zustande kam, bestätigen.] [ANWALT: welche technischen Daten (z. B. IP-Adresse) das Anmeldesystem protokolliert und wie lange.]
- **Empfänger:** Supabase (Anmeldung, Datenbank, Abschnitt 11) und der Mailversand. Die Mail mit Code und Link verschickt [ANWALT: Versandweg der Anmelde-Mail bestätigen; Aufträge und Benachrichtigungen verschickt die App über Brevo, Abschnitt 11].

## 5. Adresssuche und Routenberechnung

- **Daten:** der Text deiner Adresseingabe (Suche) und die Koordinaten von Abhol- und Zielort (Strecke). Deine IP-Adresse und Browserdaten gehen nicht an den Routendienst; die Anfrage stellt unsere Serverfunktion.
- **Zweck:** Adresse bestätigen, Kilometer und Fahrzeit für den Preis berechnen, Bezirk der Abholadresse bestimmen.
- **Rechtsgrundlage:** Die App fragt vor jeder Übermittlung nach deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO); ohne sie wird keine Adresse übermittelt und du erhältst statt eines Preises ein persönliches Angebot. Widerruf jederzeit über den Schalter in der Adresseingabe oder per E-Mail an die Adresse in Abschnitt 1. [ANWALT: Ist für das Absenden der Buchung Einwilligung oder Vertragserfüllung (Art. 6 Abs. 1 lit. b) die richtige Grundlage? Eine Einwilligung, ohne die nicht gebucht werden kann, ist möglicherweise nicht freiwillig.]
- **Zwischenspeicher:** Die Antwort des Routendienstes zu einer Strecke (Distanzen, Dauer, Linie) speichern wir bis zu 24 Stunden ohne Bezug zu deinem Konto; der Schlüssel ist eine Prüfsumme (HMAC) über die Koordinaten. Beim Absenden prüft der Server deine Adresse noch einmal beim Routendienst; die gefundenen Adressvorschläge speichern wir ebenfalls bis zu 24 Stunden ohne Kontobezug, der Schlüssel ist eine Prüfsumme über den Adresstext. Beide Speicher werden stündlich bereinigt, die Daten sind also spätestens nach etwa 25 Stunden gelöscht.
- **Empfänger:** Heidelberg Institute for Geoinformation Technology (HeiGIT), Dienst openrouteservice (Abschnitt 11). [ANWALT: Auftragsverarbeitungsvertrag nach Art. 28 DSGVO abschließen; Speicherdauer beim Anbieter erfragen; Rechtsform des Anbieters bestätigen.]

## 6. Buchungsanfrage

- **Daten:** gewählte Leistung und deine Angaben zum Umfang (z. B. Personen, Fahrzeuge, Stunden, Gegenstände, Volumen, Etagen), Abhol- und Zieladresse mit Koordinaten, Wiener Bezirk der Abholadresse, berechnete Strecke und Region, Wunschtermin und Zeitfenster, Freitext (bis 800 Zeichen), Kontakt für den Auftrag (Name, Telefon, E-Mail, Stiege/Tür), Fotos (Abschnitt 7), der Preis-Stand zum Zeitpunkt des Absendens (Betrag oder Spanne, Tarifversion, Bedingungen) und ein Beleg, welchen Betrag und welche Bedingungen du bestätigt hast. Jede Statusänderung (z. B. „zurückgezogen“) wird mit Zeitpunkt und auslösendem Konto protokolliert.
- **Zweck:** Vermittlung an passende Partnerbetriebe, Zustandekommen und Abwicklung des Vertrags mit dem Partner, Nachweis deiner Zustimmung zum Preis.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO; für die Protokolle zusätzlich Art. 6 Abs. 1 lit. f DSGVO (Nachweis und Streitbeilegung). [ANWALT: Art. 6 Abs. 1 lit. c DSGVO für Daten, die aufbewahrt werden müssen; Umfang klären.]
- **Speicherdauer:** [ANWALT: Löschfristen festlegen. Vorschlag, nicht entschieden: zurückgezogene und abgelaufene Anfragen 12 Monate, abgeschlossene Aufträge 3 Jahre, Buchhaltungsunterlagen 7 Jahre (§ 132 BAO).] Wenn du dein Konto löschst, werden Profil, Anfragen, Preis-Stände, Kontakte, Fotoeinträge und Statusprotokolle mitgelöscht, die Fotodateien entfernt ein stündlicher Aufräumjob; der Beleg deiner Preisbestätigung bleibt mit der Konto-Kennung (ohne Name, Adresse oder E-Mail) bestehen. [ANWALT: Frist für diesen Beleg festlegen; Behandlung von Aufträgen, für die ein Vertrag zustande kam, bestätigen.]
- **Empfänger:** Supabase (Datenbank); Partnerbetriebe nach Abschnitt 8.

## 7. Fotos

- **Daten:** bis zu 8 Fotos je Anfrage, je höchstens 10 MB. Die App wandelt jedes Bild vor dem Hochladen in ein neues JPEG um (längste Kante höchstens 2.000 Pixel); dabei entfallen eingebettete Daten wie Aufnahmeort und Gerät. Auf Fotos erkennbare Personen, Kennzeichen oder Dokumente sind personenbezogene Daten: Bitte fotografiere nur Möbel, Gegenstände und Räume.
- **Zweck:** Umfang des Auftrags für Preis und Durchführung einschätzen.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO.
- **Ablauf und Speicherdauer:** Die Fotos werden nach der Anmeldung in einen privaten Speicher geladen und beim Absenden der Anfrage zugeordnet; danach kannst du sie nicht mehr ändern. Fotos, die keiner Anfrage zugeordnet wurden, löscht ein stündlicher Job nach 24 Stunden plus einer Stunde Karenz. Angezeigt werden Fotos nur über Links, die 10 Minuten gültig sind. [ANWALT: Löschfrist für Fotos zugeordneter Anfragen festlegen; Vorschlag 90 Tage nach Abschluss, Rücknahme oder Ablauf.]
- **Für Partnerbetriebe:** Partner erhalten nie die hochgeladene Datei, sondern eine vom Server geprüfte und neu erzeugte Kopie ohne eingebettete Daten (längste Kante höchstens 1.600 Pixel), angezeigt über 10 Minuten gültige Links. Vor der Annahme sehen diese Kopien alle Partnerbetriebe, denen deine Anfrage angeboten wird. [ANWALT: Löschfrist der Kopien (Vorschlag 30 Tage nach Abschluss oder Storno) gegen den gebauten Stand bestätigen.]
- **Empfänger:** Supabase (Speicher); Partnerbetriebe nach Abschnitt 8.

## 8. Weitergabe an Partnerbetriebe

- **Vor der Annahme:** Deine Anfrage wird an Partnerbetriebe verteilt, die für die Leistung, den Bezirk der Abholadresse und den Termin in Frage kommen. Sie sehen den Bezirk der Abholadresse, bei Transport und Umzug die Postleitzahl des Ziels, Umfang, Termin, Preis und die Foto-Kopien, aber **keine Straße, keine Hausnummer, keinen Namen und keine Kontaktdaten**.
- **Nach der Annahme:** Nur der Partner, der angenommen hat, erhält Adresse und Kontakt für den Auftrag. Sein Zugriff endet 30 Tage nach Abschluss oder Storno des Auftrags. [ANWALT: Frist gegen den gebauten Stand bestätigen.]
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vermittlung und Erfüllung des Vertrags, den du mit dem Partner schließt).
- **Rolle des Partners:** [ANWALT: Ist der Partner für die Daten nach der Annahme eigener Verantwortlicher oder Auftragsverarbeiter von MoveNow? Der Text hier geht von eigener Verantwortung des Partners für die Durchführung aus.]
- **Mails:** Über Annahme, Ablauf, Angebote, Nachträge und Storno informieren wir dich per Mail und in der App. Die Mails verschickt Brevo (Abschnitt 11); sie enthalten deine E-Mail-Adresse als Empfängeradresse, einen Betreff und einen einfachen Text mit Link in die App. [ANWALT: Speicherdauer der Benachrichtigungen und Zustellprotokolle.]

### 8a. Support, Beschwerden und Streitfälle

[ANWALT: Verarbeitung bei Anfragen an den Support, Beschwerden, Widerspruch gegen eine Anfahrtspauschale und der Meldung „Auftrag hat nicht stattgefunden“ (Prüfung durch MoveNow): Daten, Zweck, Rechtsgrundlage (Art. 6 Abs. 1 lit. b bzw. f DSGVO), Speicherdauer.]

## 9. Missbrauchsschutz

- **Daten:** Zähler je Zeitfenster, zugeordnet über eine Prüfsumme (HMAC mit Server-Geheimnis) deiner IP-Adresse bzw. deiner Konto-Kennung. Die IP-Adresse selbst speichern wir nicht; die Prüfsumme ist trotzdem ein personenbezogenes Pseudonym.
- **Zweck:** Schutz vor Überlastung und Missbrauch, Einhaltung der Kontingente des Routendienstes.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (Sicherheit und Funktionsfähigkeit des Dienstes). Du kannst nach Art. 21 DSGVO widersprechen. [ANWALT: Interessenabwägung prüfen]
- **Speicherdauer:** Ein stündlicher Job löscht Zähler, deren Zeitfenster mehr als 2 Tage zurückliegt.

### 9a. Schutz vor automatisierten Zugriffen

- **Was passiert:** Adresssuche, Routenberechnung und Anmeldung sind durch Cloudflare Turnstile geschützt. Das Skript von Cloudflare lädt dein Browser erst, wenn du eine dieser Aktionen auslöst, nicht beim Start der App. Dabei verarbeitet Cloudflare technische Daten deines Browsers, und dein Browser verbindet sich dafür direkt mit Cloudflare. Unser Server prüft das Ergebnis (ein Token) anschließend bei Cloudflare, ohne deine IP-Adresse mitzuschicken.
- **Zweck und Rechtsgrundlage:** Schutz vor automatisierten Zugriffen, Art. 6 Abs. 1 lit. f DSGVO. Du kannst nach Art. 21 DSGVO widersprechen. [ANWALT: Rechtsgrundlage und Interessenabwägung prüfen; prüfen, ob für den Zugriff auf dein Endgerät eine Einwilligung nach § 165 Abs. 3 TKG 2021 oder ein Hinweistext nötig ist; Drittlandbezug und Auftragsverarbeitungsvertrag; Daten, die Supabase bei der Prüfung der Anmeldung an Cloudflare weitergibt.]

## 10. Speicherung in deinem Browser

Die App legt in deinem Browser nur ab, was für den Ablauf nötig ist:
- die Anmeldesitzung (Zugangs- und Aktualisierungstoken im lokalen Speicher, Voreinstellung der Supabase-Bibliothek), bis du dich abmeldest;
- für höchstens 15 Minuten das Rücksprungziel nach der Anmeldung und eine Kopie des gerade gesendeten Entwurfs, damit der Link aus der Mail auch in einem neuen Tab funktioniert;
- eine Markierung „Einführung gesehen“ ohne Ablauf;
- im Sitzungsspeicher des Tabs den Entwurf deiner Anfrage (Angaben, Termin, Adressen, Kontakt, angezeigter Preis); er verschwindet, wenn du den Tab schließt oder dich abmeldest.

Diese Speicherung ist für den von dir gewünschten Dienst unbedingt erforderlich und braucht keine Einwilligung (§ 165 Abs. 3 Telekommunikationsgesetz 2021). [ANWALT: prüfen]

## 11. Empfänger, Auftragsverarbeiter, Drittländer

| Empfänger | Aufgabe | Ort | Stand |
|---|---|---|---|
| Supabase | Datenbank, Anmeldung, Dateispeicher, Serverfunktionen | [ANWALT: Region des Produktivprojekts bestätigen; vorgesehen ist eine EU-Region, im Testbetrieb eu-west-1 (Irland)] | [ANWALT: Auftragsverarbeitungsvertrag bestätigen; Drittlandbezug des Anbieters und Garantien prüfen] |
| Brevo | Mails zu Aufträgen und Benachrichtigungen (Empfängeradresse, Betreff, Text) | EU [ANWALT: Rechenzentrum und Sitz des Anbieters bestätigen] | [ANWALT: Auftragsverarbeitungsvertrag abschließen] |
| Cloudflare (Turnstile) | Prüfung gegen automatisierte Zugriffe, Abschnitt 9a | [ANWALT: Sitz und Verarbeitungsorte] | [ANWALT: Auftragsverarbeitungsvertrag; Drittlandbezug prüfen] |
| HeiGIT (openrouteservice) | Adresssuche, Routen | [ANWALT: Sitz bestätigen (Deutschland)] | [ANWALT: Rolle als Auftragsverarbeiter und Auftragsverarbeitungsvertrag] |
| Hosting der App | Auslieferung der App | [ANWALT: Anbieter noch nicht festgelegt] | [ANWALT: Anbieter, Protokolle, Auftragsverarbeitungsvertrag] |
| Partnerbetriebe | Durchführung deines Auftrags | [ANWALT: Sitz der Partner bestätigen (Österreich)] | Abschnitt 8 |

### 11a. Übermittlung in Drittländer

[ANWALT: Ob Daten außerhalb des EWR verarbeitet werden (z. B. durch Konzerngesellschaften von Supabase, Brevo oder Cloudflare) und auf welcher Grundlage (Angemessenheitsbeschluss, Standardvertragsklauseln), ist nicht geklärt. Abschnitt nach Klärung der Anbieter ausfüllen.]

## 12. Deine Rechte

Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Eine Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3). Schreib dafür an die Adresse in Abschnitt 1.

Du kannst dich bei der Aufsichtsbehörde beschweren: Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, www.dsb.gv.at. [ANWALT: Anschrift vor Veröffentlichung prüfen]

## 13. Pflicht zur Bereitstellung, keine automatisierte Entscheidung

Ohne E-Mail-Adresse, Adressen und Kontakt für den Auftrag kannst du keine Buchungsanfrage senden. Die Einwilligung zur Adressübermittlung ist freiwillig; ohne sie bekommst du ein persönliches Angebot statt eines Preises. [ANWALT: siehe Abschnitt 5 zur Rechtsgrundlage]

Welche Partner deine Anfrage sehen, ergibt sich automatisch aus Leistung, Bezirk und Termin; den Auftrag erhält der Partner, der zuerst annimmt. Eine automatisierte Entscheidung mit rechtlicher Wirkung dir gegenüber im Sinne von Art. 22 DSGVO findet nicht statt. [ANWALT: prüfen]

## 14. Partnerbetriebe

Dieser Abschnitt richtet sich an die Personen, deren Daten bei Registrierung und Betrieb eines Partnerkontos anfallen (Inhaberin oder Inhaber, Kontaktperson). Die Daten der Kundinnen und Kunden, die ein Partner nach der Annahme erhält, regeln Abschnitt 8 und die Partnerbedingungen. [ANWALT: Entwurf gegen den gebauten Stand und die Partnerbedingungen prüfen.]

### 14a. Konto, Anmeldung und zweiter Faktor

- **Daten:** E-Mail-Adresse, Einmal-Code bzw. Anmelde-Link, Sitzungsdaten, ein TOTP-Faktor (Authenticator-App). Partnerkonten brauchen für alle Partnerfunktionen den zweiten Faktor; ohne ihn sieht das Konto nur die eigenen Firmendaten, um den Faktor einzurichten.
- **Zweck:** sicherer Zugang zu Aufträgen und Kundendaten.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO; für den zweiten Faktor zusätzlich Art. 32 DSGVO (Sicherheit der Verarbeitung) und Art. 6 Abs. 1 lit. f.
- **Hinweis:** Ein verlorener Faktor lässt sich nur durch MoveNow zurücksetzen, nach Prüfung der Identität; Wiederherstellungscodes gibt es nicht.
- **Speicherdauer:** [ANWALT: bis zur Löschung des Partnerkontos? Verhältnis zur Aufbewahrung nach Abschnitt 14d.]

### 14b. Registrierung und Prüfung

- **Daten der Firma:** Firmenname, Rechtsform, Sitz in Österreich (Straße, PLZ, Ort), UID-Nummer (Pflicht, außer bei Selbstauskunft als Kleinunternehmer), Kontaktname, Telefon und E-Mail der Firma, angenommene Version der Partnerbedingungen mit Zeitpunkt. Bei Einzelunternehmen sind das personenbezogene Daten der Inhaberin oder des Inhabers.
- **Unterlagen:** bis zu 5 Dateien (PDF oder JPEG, je höchstens 10 MB), z. B. Gewerbeberechtigung und Firmenbuchauszug, in einem privaten Speicher. Der Partner sieht nur Art und Zeitpunkt der hochgeladenen Unterlagen, nicht die Datei; lesen kann sie nur MoveNow. [ANWALT: ob ein Ausweis und ein UID-Prüfprotokoll (VIES) verlangt werden.]
- **Prüfung:** MoveNow prüft die Angaben und gibt die Firma frei, lehnt sie ab oder fordert Unterlagen nach. Bei der Freigabe legt MoveNow Leistungen, Wiener Bezirke und die Umsatzsteuer-Regel der Firma fest.
- **Zweck:** Nur geprüfte Betriebe erhalten Anfragen; Nachweis der Berechtigungen.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertrag), Art. 6 Abs. 1 lit. c (gesetzliche Pflichten, z. B. Aufzeichnungen nach der BAO), Art. 6 Abs. 1 lit. f (Schutz der Kundinnen und Kunden vor unseriösen Anbietern). [ANWALT: Meldepflichten für Plattformbetreiber nach dem Digitale Plattformen-Meldepflichtgesetz (DPMG) prüfen und welche Daten dafür nötig sind.]
- **Speicherdauer:** solange das Partnerverhältnis besteht; danach nach den gesetzlichen Aufbewahrungsfristen. [ANWALT: Löschfrist für Unterlagen abgelehnter Anträge festlegen; Vorschlag 90 Tage nach Ablehnung, nicht entschieden.]
- **Pflicht zur Bereitstellung:** Ohne die Angaben dieses Abschnitts und ohne den zweiten Faktor kann MoveNow ein Partnerkonto nicht freigeben.

### 14c. Status, Begründungen und Qualität

- **Daten:** Status der Firma (in Prüfung, aktiv, Zahlungssperre, gesperrt, abgelehnt), Zeitpunkt und schriftliche Begründung jeder Änderung, das ausführende Konto bei MoveNow, die Anzahl der Stornos durch den Partner in den letzten 30 Tagen (Qualitätszähler).
- **Zweck:** verlässliche Vermittlung, Schutz der Kundinnen und Kunden, Transparenz nach der P2B-Verordnung (EU) 2019/1150 (Begründung bei Einschränkung oder Sperre).
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b und lit. f DSGVO.
- **Wer sieht was:** Die Begründung einer Statusänderung sieht der Partner. Den Qualitätszähler sieht nur MoveNow. Zahlungssperre und Sperre setzt ein Mensch bei MoveNow mit Begründung.
- **Speicherdauer:** [ANWALT: Statusverläufe, Begründungen und Qualitätszähler.]
- **Automatisierte Entscheidung:** Freigabe, Zahlungssperre und Sperre entscheidet ein Mensch. Automatisch laufen die Verteilung der Anfragen (Leistung, Bezirk, Termin, erste Annahme) und eine Grenze für gleichzeitig offene Aufträge. [ANWALT: Aussage zu Art. 22 DSGVO prüfen.]

### 14d. Anfragen, Auftragsabwicklung und Abrechnung

- **Daten:** angebotene Anfragen, Annahmen, Ablehnungen, Festangebote, Nachträge mit Fotobeleg, Stornos mit Grund, Fertigmeldungen, jeweils mit Zeitpunkt und handelndem Konto. Je Auftrag Abrechnungszeilen (Beträge, angewandte Regeln und ihre Versionen, Umsatzsteuer-Regel), die nur ergänzt, nie geändert werden; daraus entsteht monatlich eine Abrechnung. Die Rechnung stellt MoveNow außerhalb der App, der Partner zahlt per Überweisung. Bankdaten des Partners speichert die App nicht.
- **Zweck:** Vermittlung, Nachweis der Vertragsschlüsse und Zustimmungen, Abrechnung, Buchhaltung, Streitbeilegung.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b und lit. f DSGVO; für die Abrechnung zusätzlich lit. c (Aufbewahrungspflichten nach § 132 BAO).
- **Beleg-Fotos des Partners:** Der Server prüft sie, erzeugt sie neu ohne eingebettete Daten und zeigt sie der Kundin oder dem Kunden des Auftrags.
- **Speicherdauer:** Abrechnungsunterlagen 7 Jahre nach § 132 BAO; eine Firma mit Abrechnungszeilen lässt sich nicht löschen, nur sperren. [ANWALT: Fristbeginn und Umfang mit der Steuerberatung klären; Frist für abgeschlossene Aufträge festlegen, Vorschlag 3 Jahre, nicht entschieden.]
- **Wer sieht was:** Abrechnungszeilen sieht jedes Mitglied der eigenen Firma mit zweitem Faktor und MoveNow, nie Kundinnen und Kunden.

### 14e. Kundendaten beim Partner

Nach der Annahme erhält der Partner Adresse und Kontakt der Kundin oder des Kunden für diesen Auftrag; vorher nur den Bezirk der Abholadresse, bei Transport und Umzug die Postleitzahl des Ziels, Umfang, Termin, Preis und Foto-Kopien ohne eingebettete Daten. Der Zugriff endet 30 Tage nach Abschluss oder Storno. [ANWALT: Rolle des Partners (eigener Verantwortlicher oder Auftragsverarbeiter), die daraus folgende Vereinbarung und Rechtsgrundlage der Übermittlung klären; Regelung in den Partnerbedingungen.]

### 14f. Mails, Empfänger, Rechte

Über neue Anfragen, Annahmen, Fristen und Statusänderungen informiert MoveNow per Mail (Brevo, Abschnitt 11) und in der App. Mails an Partner enthalten nie die Adresse der Kundin oder des Kunden. Kundinnen und Kunden erhalten nach der Annahme Firmenname und Kontakt des Partners. Empfänger und Drittländer: Abschnitte 11 und 11a; dazu [ANWALT: Steuerberatung für die Buchhaltung und, nur wenn beauftragt, ein Inkassobüro]. Deine Rechte und die Beschwerde: Abschnitt 12; gesetzliche Aufbewahrungspflichten (14d) gehen dem Löschrecht vor. Der Partnerteil holt keine Einwilligungen ein. [ANWALT: bestätigen]
