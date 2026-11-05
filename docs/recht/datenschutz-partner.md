**ENTWURF – nicht rechtsgeprüft**

# Datenschutzerklärung für Partnerbetriebe

> Entwurf aus dem Nachtauftrag vom 2026-11-05. Der Partnerteil ist **noch nicht gebaut**: Grundlage sind `docs/S9_KONZEPT.md` (Abschnitte 3, 5.2, 7, 9, 10) und `docs/S9b_PLAN.md` (Abschnitte 4–7, von Beks am 2026-11-04 freigegeben). Vor dem Livegang gegen die gebauten Migrationen ab 0023 prüfen. Diese Erklärung richtet sich an die Personen, deren Daten bei Registrierung und Betrieb eines Partnerkontos anfallen (Inhaberin oder Inhaber, Kontaktperson). Für die Daten der Kundinnen und Kunden, die ein Partner nach der Annahme erhält, gilt `docs/recht/datenschutz-kunden.md` und der Partnervertrag.

## 1. Wer verantwortlich ist

[OFFEN: Name bzw. Firma, Anschrift, E-Mail für Datenschutzanfragen, siehe Impressum.]
Datenschutzbeauftragter: [OFFEN: benannt oder nicht erforderlich].

Für Nutzung der App, Browser-Speicher und Missbrauchsschutz gelten die Abschnitte 3, 9, 9a und 10 von `docs/recht/datenschutz-kunden.md` entsprechend. [OFFEN: prüfen, ob für Partnerkonten Abweichungen gelten]

## 2. Konto, Anmeldung und zweiter Faktor [noch nicht gebaut]

- **Daten:** E-Mail-Adresse, Einmal-Code bzw. Anmelde-Link, Sitzungsdaten, ein TOTP-Faktor (Authenticator-App). Partnerkonten brauchen für alle Partnerfunktionen den zweiten Faktor; ohne ihn sieht das Konto nur die eigenen Firmendaten, um den Faktor einzurichten.
- **Zweck:** sicherer Zugang zu Aufträgen und Kundendaten.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO; für den zweiten Faktor zusätzlich Art. 32 DSGVO (Sicherheit der Verarbeitung) und Art. 6 Abs. 1 lit. f.
- **Hinweis:** Ein verlorener Faktor lässt sich nur durch MoveNow zurücksetzen, nach Prüfung der Identität; Wiederherstellungscodes gibt es nicht.
- **Speicherdauer:** [OFFEN: bis zur Löschung des Partnerkontos? Verhältnis zur Aufbewahrung nach Abschnitt 6.]

## 3. Registrierung und Prüfung [noch nicht gebaut]

- **Daten der Firma:** Firmenname, Rechtsform, Sitz in Österreich (Straße, PLZ, Ort), UID-Nummer (Pflicht, außer bei Selbstauskunft als Kleinunternehmer), Kontaktname, Telefon und E-Mail der Firma, angenommene Version der Partner-AGB mit Zeitpunkt. Bei Einzelunternehmen sind das personenbezogene Daten der Inhaberin oder des Inhabers.
- **Unterlagen:** bis zu 5 Dateien (PDF oder JPEG, je höchstens 10 MB), z. B. Gewerbeschein und Firmenbuchauszug, in einem privaten Speicher. Der Partner sieht nur Art und Zeitpunkt der hochgeladenen Unterlagen, nicht die Datei; lesen kann sie nur MoveNow. [OFFEN: ob ein Ausweis und ein UID-Prüfprotokoll (VIES) verlangt werden; das Konzept nennt beides (`docs/S9_KONZEPT.md`, 5.2), der Bauplan nur Gewerbeschein, Firmenbuch und Sonstiges (`docs/S9b_PLAN.md`, 5.1).]
- **Prüfung:** MoveNow prüft die Angaben und gibt die Firma frei, lehnt sie ab oder fordert Unterlagen nach. Bei der Freigabe legt MoveNow Leistungen, Wiener Bezirke und die Umsatzsteuer-Regel der Firma fest.
- **Zweck:** Nur geprüfte Betriebe erhalten Anfragen; Nachweis der Berechtigungen.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertrag), Art. 6 Abs. 1 lit. c (gesetzliche Pflichten, z. B. Aufzeichnungen nach der BAO) [OFFEN: prüfen, ob Meldepflichten für Plattformbetreiber nach dem Digitale Plattformen-Meldepflichtgesetz (DPMG) bestehen und welche Daten dafür nötig sind (`docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 7)], Art. 6 Abs. 1 lit. f (Schutz der Kundinnen und Kunden vor unseriösen Anbietern).
- **Speicherdauer:** solange das Partnerverhältnis besteht; danach nach den gesetzlichen Aufbewahrungsfristen. [OFFEN: Löschfrist für Unterlagen abgelehnter Anträge; im Plan steht „90 Tage nach Ablehnung, Rechtsfrage“, Umsetzung mit S9h (`docs/S9b_PLAN.md`, 5.1).]
- **Pflicht zur Bereitstellung:** Ohne die Angaben dieses Abschnitts und ohne den zweiten Faktor kann MoveNow ein Partnerkonto nicht freigeben.

## 4. Status, Begründungen und Qualität [noch nicht gebaut]

- **Daten:** Status der Firma (in Prüfung, aktiv, Zahlungssperre, gesperrt, abgelehnt; im Datenmodell `pending`, `active`, `payment_hold`, `suspended`, `rejected`), Zeitpunkt und schriftliche Begründung jeder Änderung, das ausführende Konto bei MoveNow. Anzahl der Stornos durch den Partner in den letzten 30 Tagen (Qualitätszähler); ab 3 Stornos in 30 Tagen prüft MoveNow. Höchstens 5 gleichzeitig offene angenommene Aufträge.
- **Zweck:** verlässliche Vermittlung, Schutz der Kundinnen und Kunden, Transparenz nach der P2B-Verordnung (EU) 2019/1150 (Begründung bei Einschränkung oder Sperre).
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b und lit. f DSGVO.
- **Wer sieht was:** Die Begründung einer Statusänderung sieht der Partner. Den Qualitätszähler sieht nur MoveNow; Zahlungssperre und Sperre setzt in Phase 1 nur ein Mensch bei MoveNow mit Begründung, kein Automatismus (`docs/S9_KONZEPT.md`, 10.2, 10.4; eine Automatik ist erst für Phase 2 vorgesehen).
- **Speicherdauer:** [OFFEN: Statusverläufe, Begründungen und Qualitätszähler.]
- **Automatisierte Entscheidung:** Freigabe, Zahlungssperre und Sperre entscheidet ein Mensch. Automatisch laufen die Verteilung der Anfragen (Leistung, Bezirk, Termin, erste Annahme) und die Grenze von 5 offenen Aufträgen. [OFFEN: Aussage zu Art. 22 DSGVO prüfen.]

## 5. Anfragen, Annahme und Auftragsabwicklung [noch nicht gebaut]

- **Daten:** angebotene Anfragen, Annahmen, Ablehnungen, Festangebote, Nachträge mit Fotobeleg, Stornos mit Grund, Fertigmeldungen, jeweils mit Zeitpunkt und handelndem Konto.
- **Zweck:** Vermittlung, Nachweis der Vertragsschlüsse und Zustimmungen, Abrechnung, Streitbeilegung.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b und lit. f DSGVO.
- **Beleg-Fotos des Partners:** Der Server prüft sie, erzeugt sie neu ohne eingebettete Daten und zeigt sie der Kundin oder dem Kunden des Auftrags.
- **Speicherdauer:** [OFFEN: Vorschlag im Projekt für abgeschlossene Aufträge 3 Jahre, nicht entschieden (`docs/ARCHITECTURE.md:62`).]

## 6. Abrechnung der Vermittlung [noch nicht gebaut]

- **Daten:** je Auftrag eine Journalzeile bei der Annahme und weitere Zeilen bei Nachtrag, Storno, Stornogebühr, Anfahrtspauschale oder Korrektur: Gesamtpreis, Provision netto und Umsatzsteuer, Auszahlungsbetrag, angewandte Sätze und ihre Versionen, Umsatzsteuer-Regel. Das Journal wird nur ergänzt, nie geändert. Monatlich entsteht daraus eine Abrechnung; die Rechnung stellt MoveNow in Phase 1 außerhalb der App, der Partner zahlt per Überweisung. Bankdaten des Partners speichert die App nicht.
- **Zweck:** Abrechnung, Buchhaltung, Nachweis gegenüber Partner und Behörden.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b und lit. c DSGVO (Aufbewahrungspflichten nach § 132 BAO).
- **Speicherdauer:** 7 Jahre nach § 132 BAO [OFFEN: Fristbeginn und Umfang mit der Steuerberatung klären]. Eine Firma mit Journalzeilen lässt sich nicht löschen, nur sperren.
- **Wer sieht was:** jedes Mitglied der eigenen Firma mit zweitem Faktor und MoveNow; nie Kundinnen und Kunden.

## 7. Kundendaten beim Partner [noch nicht gebaut]

Nach der Annahme erhält der Partner Adresse und Kontakt der Kundin oder des Kunden für diesen Auftrag; vorher nur den Bezirk der Abholadresse, bei Transport und Umzug die Postleitzahl des Ziels, Umfang, Termin, Preis und Foto-Kopien ohne eingebettete Daten. Der Zugriff endet 30 Tage nach Abschluss oder Storno. Rechtsgrundlage der Übermittlung an den Partner: [OFFEN: Art. 6 Abs. 1 lit. b DSGVO gegenüber den Kundinnen und Kunden; hängt an der Rolle des Partners]. [OFFEN: Rolle des Partners (eigener Verantwortlicher oder Auftragsverarbeiter) und die daraus folgende Vereinbarung, `docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 10; Regelung im Partnervertrag, § 7.]

## 8. Mails [noch nicht gebaut]

Über neue Anfragen, Annahmen, Fristen und Statusänderungen informiert MoveNow per Mail und in der App. Mails an Partner enthalten nie die Adresse der Kundin oder des Kunden (`docs/S9_KONZEPT.md`, R14). Zweck: Information über Anfragen, Fristen und Entscheidungen; Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO. [OFFEN: Mail-Anbieter mit Auftragsverarbeitungsvertrag; Speicherdauer der Benachrichtigungen]

## 9. Empfänger und Auftragsverarbeiter

Supabase (Datenbank, Anmeldung, Dateispeicher, Serverfunktionen; [OFFEN: Region und Auftragsverarbeitungsvertrag]), Mail-Anbieter [OFFEN], Steuerberatung für die Buchhaltung [OFFEN], bei Zahlungsverzug ein Inkassobüro [OFFEN: nur aufnehmen, wenn beauftragt]. Kundinnen und Kunden erhalten nach der Annahme Firmenname und Kontakt des Partners. [OFFEN: Übermittlung außerhalb des EWR und Garantien, wie `docs/recht/datenschutz-kunden.md`, Abschnitt 11a.]

## 10. Rechte und Beschwerde

Wie in `docs/recht/datenschutz-kunden.md`, Abschnitt 12: Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch; Beschwerde bei der Österreichischen Datenschutzbehörde. Gesetzliche Aufbewahrungspflichten (Abschnitt 6) gehen dem Löschrecht vor. Der Partnerteil holt nach heutigem Plan keine Einwilligungen ein. [OFFEN: bestätigen]

## 11. Grundlage im Projekt

| Aussage | Quelle |
|---|---|
| Pflichtangaben der Registrierung, UID-Regel, Sitz AT | `docs/S9b_PLAN.md:56-73`, Entscheidung Beks 2026-11-04 (`:5`) |
| zweiter Faktor für Partner, Ausnahme für eigene Firmendaten | `docs/S9b_PLAN.md:31`, `:208-213` |
| Statuswerte, Begründungspflicht | `docs/S9b_PLAN.md:95-106` |
| Unterlagen: höchstens 5, PDF/JPEG, nur admin liest | `docs/S9b_PLAN.md:184-187` |
| Journal, nur anfügen, Sichtbarkeit | `docs/S9b_PLAN.md:243-290` |
| Qualitätszähler, Grenze offener Aufträge | `docs/S9_KONZEPT.md` 8.6, 5.10 |
| Zugriff auf Kundendaten, 30 Tage | `docs/S9_KONZEPT.md` 7.2, 5.10 |
| Rechnung außerhalb der App, Überweisung | `docs/S9_KONZEPT.md` 9.5, `docs/ROADMAP.md:7` |
