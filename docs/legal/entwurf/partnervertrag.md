> KI-Entwurf, nicht anwaltlich geprüft. Nicht veröffentlichen.

**ENTWURF – nicht rechtsgeprüft**

# Partnervertrag (Vermittlungsvertrag)

> Entwurf aus dem Nachtauftrag vom 2026-11-05. Er ergänzt die Partner-AGB (`docs/legal/entwurf/agb-partner.md`) um die Angaben, die je Partner verschieden sind, und um die Datenschutzvereinbarung. Der Partnerteil ist **noch nicht gebaut** (S9b ff.). In der App sind Leistungen, Bezirke und Umsatzsteuer-Regel Parameter der Freigabe durch admin (`admin_approve_partner`, `docs/S9_KONZEPT.md`, Abschnitt 3; `docs/S9b_PLAN.md`, 4.2 und 5.1). [OFFEN: Abschluss online durch Annahme in der App bei der Registrierung oder schriftlich mit Unterschrift; das Datenmodell speichert die angenommene AGB-Version mit Zeitpunkt (`docs/S9b_PLAN.md:69`).]

## Vertragsparteien

**MoveNow:** [OFFEN: Name bzw. Firma, Anschrift, Firmenbuchnummer, UID-Nummer laut Impressum]

**Partner:**

| | |
|---|---|
| Firmenname | [Angabe aus der Registrierung] |
| Rechtsform | [Einzelunternehmen, e. U., GmbH, OG, KG, Sonstige] |
| Sitz | [Straße, PLZ, Ort, Österreich] |
| UID-Nummer | [ATU…, oder Erklärung als Kleinunternehmer] |
| Kontakt | [Name, Telefon, E-Mail] |
| Partnerkonto | [E-Mail des Kontos der Inhaberin oder des Inhabers] |

## § 1 Gegenstand

1.1 MoveNow nimmt den Partner in die Plattform MoveNow auf und vermittelt ihm Aufträge von Kundinnen und Kunden nach den Partner-AGB.

1.2 Bestandteile des Vertrags in dieser Rangfolge: (1) dieser Vertrag, (2) die Partner-AGB in der bei Abschluss angenommenen Fassung [Version …, angenommen am …], (3) die Datenschutzvereinbarung nach § 7. [OFFEN: prüfen, ob der Vorrang dieses Vertrags die Pflichtinhalte der AGB nach der P2B-VO einschränken darf.]

1.3 Haftung und Vertraulichkeit richten sich nach den Punkten 14 und 14a der Partner-AGB. [OFFEN: Abweichungen im Einzelfall]

## § 2 Freigabe, Leistungen und Gebiet

2.1 Der Vertrag beginnt mit der Freigabe durch MoveNow. Vor der Freigabe erhält der Partner keine Anfragen.

2.2 Freigegebene Leistungen: [ ] Transport [ ] Umzug [ ] Entrümpelung [ ] Montage/Demontage.

2.3 Freigegebene Wiener Bezirke (maßgeblich ist der Bezirk der Abholadresse): [Liste 1–23].

2.4 Änderungen von Leistungen und Bezirken nimmt MoveNow auf Antrag des Partners vor; sie werden in der App angezeigt.

## § 3 Nachweise

3.1 Der Partner hat folgende Unterlagen vorgelegt: [Liste, z. B. Gewerbeschein, Firmenbuchauszug]. [OFFEN: verbindliche Liste je Leistung.]

3.2 Der Partner sichert zu, während der Vertragsdauer über alle für die freigegebenen Leistungen nötigen Berechtigungen und Versicherungen zu verfügen ([OFFEN: Mindestdeckung der Haftpflichtversicherung]), und meldet Änderungen unverzüglich.

## § 4 Provision

4.1 Satz bei Vertragsschluss: [OFFEN: Satz; nach `CLAUDE.md` 15 %] des Gesamtpreises, einschließlich 20 % Umsatzsteuer. Berechnung, Entstehung und Änderungen nach Punkt 8 der Partner-AGB.

4.2 Umsatzsteuer-Regel des Partners: Standard (20 %), gültig ab [Datum der Freigabe]. [OFFEN: In Phase 1 kennt die Datenbank nur diese Regel (`docs/S9b_PLAN.md`, 5.1); Regelungen für Kleinunternehmer und Reverse Charge klärt die Steuerberatung.]

4.3 Änderungen des Satzes kündigt MoveNow mindestens 30 Tage im Voraus an (Punkt 9 der Partner-AGB).

## § 5 Abrechnung

5.1 Abrechnungszeitraum: Kalendermonat. MoveNow stellt die Rechnung an [OFFEN: Rechnungsadresse, falls abweichend vom Sitz] per [OFFEN: Weg, z. B. E-Mail].

5.2 Zahlung per Überweisung auf [OFFEN: Konto von MoveNow] innerhalb von [OFFEN: Tage] ab Rechnungsdatum.

5.3 Verzug: Zahlungssperre ab 14 Tagen nach Fälligkeit, Sperre ab 45 Tagen, danach Inkasso (Punkt 8.6 der Partner-AGB). [OFFEN: Fristen vorläufig, `docs/S9_KONZEPT.md`, 10.4]

## § 6 Zugang und Sicherheit

6.1 Der Partner nutzt die Plattform über das Partnerkonto mit zweitem Anmeldefaktor. Er hält Zugangsdaten und Faktor geheim und meldet den Verlust unverzüglich; MoveNow setzt den Faktor nach Prüfung der Identität zurück.

6.2 In Phase 1 hat der Partner genau ein Konto. [OFFEN: Mitarbeiterkonten kommen erst in Phase 2 (`docs/S9_KONZEPT.md`, Abschnitt 3).]

## § 7 Datenschutz

7.1 MoveNow übermittelt dem Partner Kundendaten nur nach Punkt 11 der Partner-AGB: vor der Annahme ohne Name, Hausnummer und Kontakt, nach der Annahme Adresse und Kontakt für den Auftrag; der Zugriff endet 30 Tage nach Abschluss oder Storno.

7.2 [OFFEN: Rolle der Parteien (`docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 10). Variante A, getrennte Verantwortliche: Der Partner ist für die Daten ab der Annahme selbst verantwortlich, verarbeitet sie nur für den Auftrag und die gesetzlichen Pflichten (z. B. Rechnung) und informiert die Kundin oder den Kunden selbst. Variante B, Auftragsverarbeitung: Vereinbarung nach Art. 28 DSGVO als Anlage. Die Rechtsprüfung wählt die Variante; der Text der Kunden-Datenschutzerklärung (`docs/legal/entwurf/datenschutz-kunden.md`, Abschnitt 8) geht von Variante A aus.]

7.3 Der Partner nutzt die Daten nicht für Werbung und gibt sie nicht weiter, außer an Beschäftigte und Erfüllungsgehilfen, die sie für den Auftrag brauchen und zur Vertraulichkeit verpflichtet sind.

## § 8 Laufzeit und Kündigung

8.1 Unbefristet ab der Freigabe.

8.2 Kündigung durch den Partner: [OFFEN: Frist]. Kündigung durch MoveNow: 30 Tage mit Begründung; Einschränkung, Sperre und fristlose Beendigung nach Punkt 10 der Partner-AGB.

8.3 Nach dem Ende führt der Partner angenommene Aufträge aus oder storniert sie nach den Partner-AGB; offene Provisionen bleiben fällig.

## § 9 Schlussbestimmungen

9.1 Änderungen dieses Vertrags bedürfen der Textform; die Mitteilung in der App mit Bestätigung durch den Partner genügt [OFFEN: prüfen].

9.2 Es gilt österreichisches Recht. Gerichtsstand: [OFFEN].

## Abschluss

| MoveNow | Partner |
|---|---|
| Ort, Datum: [ ] | Ort, Datum: [ ] |
| [Name, Funktion] | [Name, Funktion] |

[OFFEN: entfällt bei Online-Abschluss in der App; dann Bestätigung mit Zeitpunkt und AGB-Version.]

## Anlagen

1. Partner-AGB in der angenommenen Fassung
2. [OFFEN: Vereinbarung zur Datenverarbeitung nach § 7]
3. [OFFEN: Preisblatt mit dem Provisionssatz und seiner Gültigkeit]
