**ENTWURF – nicht rechtsgeprüft**

# Allgemeine Geschäftsbedingungen für Partnerbetriebe

> Entwurf aus dem Nachtauftrag vom 2026-11-05. Der Partnerteil ist **noch nicht gebaut** (S9b ff.). Grundlage: `docs/S9_KONZEPT.md` (Abschnitte 1, 3, 5.2, 5.10, 7–10), `docs/S9b_PLAN.md` (Abschnitte 4–7) und `CLAUDE.md` („Geld“). Werte sind einstellbare Schlüssel in `platform_settings` und im Konzept vorläufig bis zur Rechtsprüfung. Gliederung nach der P2B-Verordnung (EU) 2019/1150; die Artikelangaben in Klammern sind Prüfhinweise für die Rechtsberatung. Der individuelle Vertrag steht in `docs/recht/partnervertrag.md`.

## 1. Geltung und Begriffe

1.1 Diese Bedingungen regeln die Nutzung der Plattform MoveNow durch Unternehmen, die über MoveNow Leistungen an Kundinnen und Kunden anbieten („Partner“). Betreiber ist [OFFEN: Name bzw. Firma laut Impressum] („MoveNow“).

1.2 **Leistungen** sind Transport, Umzug, Entrümpelung sowie Montage und Demontage von Möbeln in Wien. Transportermiete ist nicht Gegenstand dieser Fassung.

1.3 **Gesamtpreis** ist der Betrag, den die Kundin oder der Kunde für einen Auftrag schuldet, einschließlich Umsatzsteuer. **Provision** ist das Entgelt des Partners an MoveNow für die Vermittlung.

1.4 Diese Bedingungen sind vor der Registrierung und jederzeit danach in der App abrufbar. Der Partner nimmt sie bei der Registrierung an; Version und Zeitpunkt werden gespeichert (Art. 3 Abs. 1 lit. b P2B-VO).

## 2. Registrierung und Prüfung

2.1 Registrieren können sich Unternehmen mit Sitz in Österreich. Anzugeben sind Firmenname, Rechtsform, Anschrift des Sitzes, UID-Nummer (außer bei Kleinunternehmern, die das selbst erklären), Kontaktname, Telefon und E-Mail. Der Partner lädt die verlangten Unterlagen hoch (bis zu 5 Dateien, z. B. Gewerbeschein, Firmenbuchauszug). [OFFEN: verbindliche Liste der Unterlagen je Leistung, `docs/S9_KONZEPT.md`, 5.2 und `docs/S9b_PLAN.md`, 5.1 weichen voneinander ab.]

2.2 Für alle Partnerfunktionen ist ein zweiter Anmeldefaktor (Authenticator-App) Pflicht.

2.3 MoveNow prüft Angaben und Unterlagen und gibt den Partner frei oder lehnt den Antrag mit Begründung ab. Bei der Freigabe legt MoveNow die Leistungen und die Wiener Bezirke (1 bis 23) fest, für die der Partner Anfragen erhält. Ein Anspruch auf Freigabe besteht nicht. Eine Ablehnung ist endgültig; ein neuer Antrag mit demselben Konto ist nicht möglich (Entscheidung Beks, `docs/S9b_PLAN.md:5`). [OFFEN: Prüfkriterien schriftlich festlegen; prüfen, ob die endgültige Ablehnung ohne neuen Antrag zulässig ist.]

2.4 [OFFEN: Pflichten nach dem Digital Services Act für Online-Marktplätze, insbesondere Nachverfolgbarkeit der Unternehmer (Angaben und ihre Prüfung vor der Freigabe); prüfen, ob die Ausnahme für Klein- und Kleinstunternehmen gilt.]

2.5 Firmenname, Rechtsform, UID, Kleinunternehmer-Status und Anschrift ändert nach der Freigabe nur MoveNow auf Antrag des Partners; die Kontaktdaten ändert der Partner selbst. Phase 1 kennt je Partner ein Konto (Inhaberin oder Inhaber).

## 3. Leistungen von MoveNow

3.1 MoveNow stellt die App bereit, berechnet Preise aus veröffentlichten Tarifen, bietet Anfragen passenden Partnern an, übermittelt nach der Annahme die Auftragsdaten und führt das Provisions-Journal.

3.2 MoveNow schuldet keine bestimmte Zahl an Anfragen oder Aufträgen.

3.3 MoveNow wird nicht Vertragspartner der Leistung und nimmt keine Zahlungen der Kundinnen und Kunden entgegen.

3.4 [OFFEN: zusätzliche Vertriebskanäle oder Partnerprogramme (Art. 3 Abs. 1 lit. d P2B-VO) und Nebenwaren oder -dienste von MoveNow (Art. 6 P2B-VO); im Projekt keine vorgesehen.]

## 4. Verteilung der Anfragen (Art. 5 P2B-VO)

4.1 Eine Anfrage wird gleichzeitig allen freigegebenen Partnern im Status „aktiv“ angeboten, deren Leistungen und Bezirke passen. Maßgeblich ist der Bezirk der Abholadresse. Eine Anfrage, die der Partner selbst als Kunde gesendet hat, wird ihm nicht angeboten (keine Selbstbuchung, `docs/S9_KONZEPT.md`, 7.2).

4.2 Den Auftrag erhält der Partner, der zuerst annimmt. Es gibt keine Reihung, keine Bewertung und keine bezahlte Bevorzugung. Die Provision hat keinen Einfluss auf die Verteilung.

4.3 Ein Partner kann höchstens 5 angenommene, noch offene Aufträge gleichzeitig haben; darüber hinaus kann er nicht annehmen.

## 5. Annahme, Festangebot und Vertrag mit der Kundin oder dem Kunden

5.1 Vor der Annahme sieht der Partner den Bezirk der Abholadresse, bei Transport und Umzug die Postleitzahl des Ziels, Umfang, Termin, Kopien der Fotos ohne eingebettete Daten, den Gesamtpreis und den Betrag, den er nach Abzug der Provision erhält. Name, Hausnummer und Kontaktdaten sieht er erst nach der Annahme.

5.2 **Festpreis:** Mit der Annahme in der App kommt der Vertrag über die Leistung zwischen Partner und Kundin oder Kunde zum angezeigten Gesamtpreis zustande. Die Annahme ist nur innerhalb der Annahmefrist möglich und nur, wenn der angezeigte Auszahlungsbetrag noch gilt; hat sich der Provisionssatz zwischenzeitlich geändert, muss der Partner den neuen Betrag bestätigen.

5.3 **Festangebot:** Bei einer Spanne oder einer Anfrage ohne Preis kann der Partner ein Festangebot senden, bei einer Spanne nur innerhalb der Spanne, ohne Spanne höchstens [OFFEN: Obergrenze; im Projekt 8.000,00 € (`offer_max_cents`)]. Je Anfrage gibt es höchstens 3 offene Angebote und je Partner eines. Ein Angebot gilt 48 Stunden, höchstens bis zum Termin, und ist nach dem Senden unveränderlich. Der Vertrag kommt zustande, wenn die Kundin oder der Kunde das Angebot bestätigt und der Partner zu diesem Zeitpunkt aktiv ist.

5.4 Der Partner ist Vertragspartner der Kundin oder des Kunden und erbringt die Leistung im eigenen Namen, auf eigene Rechnung und in eigener Verantwortung. Für das Verhältnis zur Kundin oder zum Kunden gelten die Bedingungen in `docs/recht/agb-kunden.md` (Preis, Nachtrag, Storno, Zahlung). [OFFEN: rechtliche Konstruktion, siehe dort Punkt 1.2.]

## 6. Pflichten des Partners

6.1 Der Partner sichert zu, für die freigegebenen Leistungen alle nötigen Berechtigungen zu besitzen und während der Partnerschaft zu behalten, und meldet Änderungen unverzüglich. [OFFEN: konkrete Berechtigungen je Leistung, z. B. Gewerbeberechtigung, Konzession nach dem Güterbeförderungsgesetz, abfallrechtliche Berechtigungen bei Entrümpelung (`docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 8); Haftpflicht- und Transportversicherung mit Mindestdeckung.]

6.2 Der Partner führt den Auftrag wie gebucht aus, zum gebuchten Termin und zum gebuchten Gesamtpreis. Mehr darf er nur verlangen, wenn die Kundin oder der Kunde einem Nachtrag in der App zugestimmt hat (Punkt 7), eine Stornogebühr nach den gebuchten Stufen anfällt oder eine Anfahrtspauschale nach Punkt 7.3 berechtigt ist.

6.3 Der Partner stellt der Kundin oder dem Kunden den Gesamtpreis in Rechnung. Die Provision weist er gegenüber Kundinnen und Kunden nicht aus.

6.4 Der Partner meldet in der App, wenn ein Auftrag begonnen und abgeschlossen ist.

6.4a [OFFEN: ob der Partner Subunternehmer oder Erfüllungsgehilfen einsetzen darf und wie er für sie haftet.]

6.5 Der Partner nutzt Kundendaten nur für den jeweiligen Auftrag (Punkt 11) und schließt für einen über MoveNow vermittelten Auftrag keine Abrede mit der Kundin oder dem Kunden außerhalb der App, die die Provision umgeht. [OFFEN: Zulässigkeit und Reichweite dieser Klausel.]

## 7. Nachtrag, Storno, Anfahrtspauschale

7.1 **Nachtrag:** Stellt der Partner vor Ort mehr Umfang fest, schlägt er vor der Mehrleistung einen Nachtrag mit Fotobeleg vor. Der Betrag entsteht nur über das Preismodul aus korrigierten Angaben mit der gebuchten Tarifversion; ein freier Betrag ist nicht möglich. Nur erhöhend, keine Änderung von Adresse oder Strecke, nicht bei Aufträgen aus einem Festangebot. Die Kundin oder der Kunde entscheidet innerhalb von 2 Stunden; ohne Zustimmung gilt der gebuchte Umfang zum gebuchten Preis.

7.2 **Storno durch den Partner:** Nach der Annahme kann der Partner nur mit Angabe eines Grundes stornieren. Die Kundin oder der Kunde zahlt dann nichts, die Provision des Auftrags entfällt vollständig. Liegt der Termin mindestens 24 Stunden entfernt und beruhte die Buchung nicht auf einem Festangebot, wird die Anfrage automatisch anderen Partnern angeboten; der stornierende Partner ist davon ausgeschlossen. Ab 3 Stornos durch den Partner innerhalb von 30 Tagen prüft MoveNow die Zusammenarbeit (Punkt 10).

7.3 **Anfahrtspauschale:** Ist der gebuchte Umfang wegen falscher Angaben der Kundin oder des Kunden nicht ausführbar, storniert der Partner mit dem Grund „Umfang nicht ausführbar“ und Fotobeleg. Dann darf er eine feste Anfahrtspauschale verlangen ([OFFEN: Betrag; im Projekt vorläufig 69,00 €]). Widerspricht die Kundin oder der Kunde, entscheidet MoveNow. Waren die Angaben richtig, ist der Abbruch für beide Seiten kostenlos.

7.4 **Storno durch die Kundin oder den Kunden:** nach den Stufen in `docs/recht/agb-kunden.md`, Punkt 8.2. Die Stornogebühr stellt der Partner in Rechnung.

## 8. Provision und Abrechnung

8.1 **Höhe:** Die Provision beträgt [OFFEN: Satz; nach `CLAUDE.md` 15 %] des Gesamtpreises und enthält 20 % Umsatzsteuer. Berechnung je Auftrag: Provision = Gesamtpreis × Satz, kaufmännisch auf Cent gerundet; Nettobetrag = Provision ÷ 1,2, auf Cent gerundet; Umsatzsteuer = Provision − Nettobetrag; Auszahlungsbetrag des Partners = Gesamtpreis − Provision. Kaution und Kraftstoff sind nie Teil des Gesamtpreises. [OFFEN: Steuerberatung zu Kleinunternehmern und zum Rechenweg der Rechnung (`docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 9).]

8.2 **Entstehung:** Die Provision entsteht mit der Annahme bzw. der Bestätigung des Festangebots, mit dem dann geltenden Satz. Vorher (Zurückziehen, Ablauf, keine Annahme) entsteht keine Provision.

8.3 **Änderungen des Betrags:**
- Nachtrag: Provision auf den neuen Gesamtpreis mit dem Satz der Buchung; gebucht wird die Differenz.
- Storno durch die Kundin oder den Kunden: Die Provision des Auftrags entfällt; auf eine Stornogebühr fällt Provision mit dem Satz der Buchung an.
- Storno durch den Partner: Die Provision entfällt vollständig; auf eine berechtigte Anfahrtspauschale fällt Provision an.
- Korrekturen bucht MoveNow nur als Gegenbuchung im Monat der Korrektur, nie durch Änderung einer früheren Zeile.

8.4 **Journal:** Jede Provision steht als Zeile im Provisions-Journal (Gesamtpreis, Provision netto und Umsatzsteuer, Auszahlung, Satz und seine Version). Der Partner sieht das Journal seiner Firma jederzeit in der App; das Journal wird nur ergänzt.

8.5 **Rechnung und Zahlung:** MoveNow stellt dem Partner monatlich eine Rechnung über die Provisionen der Aufträge, die im Monat ihren Endstand erreicht haben (abgeschlossen oder storniert), in Phase 1 außerhalb der App. Der Partner zahlt per Überweisung innerhalb von [OFFEN: Zahlungsziel]. Aufträge ohne Fertigmeldung gelten 7 Tage nach dem Termin als abgeschlossen, wenn die Kundin oder der Kunde nicht widerspricht.

8.6 **Zahlungsverzug:** Nach einer Erinnerung kann MoveNow den Partner 14 Tage nach Fälligkeit auf „Zahlungssperre“ setzen: Er erhält keine neuen Anfragen, laufende Aufträge führt er aus. 45 Tage nach Fälligkeit kann MoveNow den Partner sperren; danach folgt Inkasso. Jede Sperre wird schriftlich begründet (Punkt 10). [OFFEN: Fristen 14 und 45 Tage sind vorläufig (`docs/S9_KONZEPT.md`, 10.4); Verzugszinsen, Mahnspesen.]

## 9. Änderungen dieser Bedingungen und des Provisionssatzes (Art. 3 P2B-VO)

9.1 MoveNow teilt Änderungen dieser Bedingungen und des Provisionssatzes mindestens 30 Tage vor ihrem Wirksamwerden in der App und auf einem dauerhaften Datenträger mit [OFFEN: Weg, z. B. E-Mail; Art. 3 Abs. 2 P2B-VO verlangt mindestens 15 Tage, das Projekt hat 30 Tage entschieden und die Datenbank erzwingt den Vorlauf (`fee_notice_days`)]. Ein neuer Satz ist in der App schon ab der Ankündigung sichtbar. Für bereits angenommene Aufträge gilt der Satz der Annahme; Änderungen wirken nie rückwirkend (Art. 8 lit. a P2B-VO) [OFFEN: prüfen].

9.2 Der Partner kann den Vertrag bis zum Wirksamwerden der Änderung kündigen. [OFFEN: Ausnahmen nach Art. 3 Abs. 4 P2B-VO, z. B. gesetzliche Pflichten.]

## 10. Einschränkung, Sperre und Beendigung (Art. 4 P2B-VO)

10.1 MoveNow kann einen Partner vorübergehend einschränken („Zahlungssperre“, Punkt 8.6) oder sperren, wenn er gegen diese Bedingungen verstößt, die Voraussetzungen der Freigabe nicht mehr erfüllt, Kundinnen oder Kunden gefährdet oder die Provision nicht zahlt. [OFFEN: abschließende Liste der Gründe nach Art. 3 Abs. 1 lit. c P2B-VO.]

10.2 Jede Einschränkung und Sperre wird spätestens mit ihrem Wirksamwerden in der App schriftlich begründet. Der Partner kann dazu Stellung nehmen (Punkt 13). Einschränken und sperren kann in Phase 1 nur ein Mensch bei MoveNow, nie ein Automatismus. Mit der Zahlungssperre und mit der Sperre schließt MoveNow die offenen Anfragen und Festangebote des Partners und informiert die betroffenen Kundinnen und Kunden. Angenommene Aufträge führt ein Partner in Zahlungssperre aus; ein gesperrter Partner kann sie in der App nicht mehr abwickeln, MoveNow leitet sie um. [OFFEN: Verfahren für die Umleitung laufender Aufträge bei Sperre, `docs/S9_KONZEPT.md`, 10.4.]

10.3 Eine ordentliche Kündigung durch MoveNow erfolgt mit einer Frist von 30 Tagen und Begründung. [OFFEN: Fälle der fristlosen Kündigung (Art. 4 Abs. 4 P2B-VO).]

## 11. Daten (Art. 9 P2B-VO) und Datenschutz

11.1 Der Partner erhält Daten der Kundinnen und Kunden nur nach Punkt 5.1: vor der Annahme ohne Namen, Hausnummer und Kontakt, nach der Annahme Adresse und Kontakt für den Auftrag. Der Zugriff endet 30 Tage nach Abschluss oder Storno des Auftrags.

11.2 MoveNow speichert die Daten der Vermittlung (Anfragen, Annahmen, Angebote, Nachträge, Stornos, Journal) und nutzt sie für Vermittlung, Abrechnung, Qualitätssicherung und Streitbeilegung. Der Partner hat Zugang zu den Daten seiner eigenen Aufträge und seines Journals; aggregierte Daten anderer Partner erhält er nicht. [OFFEN: Zugang nach Vertragsende (Art. 8 P2B-VO, Buchstabe prüfen); Weitergabe von Plattformdaten an Dritte und Zugang zu personenbezogenen Daten (Art. 9 P2B-VO).]

11.3 [OFFEN: Rolle des Partners für Kundendaten (eigener Verantwortlicher oder Auftragsverarbeiter) und die daraus folgende Vereinbarung; Regelung im Partnervertrag.] Die Datenschutzerklärung für Partnerbetriebe steht in `docs/recht/datenschutz-partner.md`.

## 12. Gleichbehandlung (Art. 7 P2B-VO), andere Vertriebswege (Art. 10 P2B-VO)

12.1 MoveNow bietet die Leistungen nicht selbst an und behandelt alle Partner nach denselben Regeln. [OFFEN: bestätigen.]

12.2 Der Partner darf seine Leistungen auch über andere Kanäle und zu anderen Bedingungen anbieten. [OFFEN: bestätigen, dass keine Bestpreisklausel gewollt ist.]

## 13. Beschwerden (Art. 11 und 12 P2B-VO)

13.1 Beschwerden des Partners, auch gegen eine Einschränkung, Sperre oder Entscheidung über eine Anfahrtspauschale, richtet er an [OFFEN: Adresse]. MoveNow prüft sie, antwortet schriftlich und teilt das Ergebnis mit. [OFFEN: Fristen; jährliche Information über Zahl, Gegenstand und Dauer der Beschwerden (Art. 11 Abs. 4 P2B-VO), falls keine Ausnahme für kleine Unternehmen gilt.]

13.2 [OFFEN: Benennung von Mediatoren (Art. 12 P2B-VO) oder Ausnahme für kleine Unternehmen (Art. 11 Abs. 5, Art. 12 Abs. 7).]

## 14. Haftung

14.1 Der Partner haftet für die Ausführung der Leistung gegenüber der Kundin oder dem Kunden allein und stellt MoveNow von Ansprüchen frei, die aus seiner Leistung entstehen.

14.2 MoveNow haftet für die Vermittlung und den Betrieb der App nur bei Vorsatz und grober Fahrlässigkeit, außer bei Personenschäden. [OFFEN: Umfang einer Haftungsbeschränkung zwischen Unternehmern prüfen.]

14.3 [OFFEN: Haftung des Partners gegenüber MoveNow bei falschen Angaben in der Registrierung und bei Verstößen gegen diese Bedingungen.]

## 14a. Vertraulichkeit

[OFFEN: Vertraulichkeit von Geschäftsinterna beider Seiten (z. B. Journal, Qualitätszähler, Prüfunterlagen) und Dauer der Pflicht über das Vertragsende hinaus.]

## 15. Geistiges Eigentum (Art. 3 Abs. 1 lit. e P2B-VO)

Der Partner behält alle Rechte an seinem Firmennamen und seinen Unterlagen. Er räumt MoveNow das Recht ein, Firmennamen und Kontakt zur Abwicklung von Aufträgen an Kundinnen und Kunden zu übermitteln. Beleg-Fotos darf MoveNow für den Auftrag und für Streitfälle nutzen. [OFFEN: prüfen]

## 16. Laufzeit und Kündigung

Der Vertrag läuft auf unbestimmte Zeit. Der Partner kann jederzeit mit [OFFEN: Frist] kündigen; angenommene Aufträge führt er aus. Zur Kündigung durch MoveNow siehe Punkt 10.

## 17. Recht und Gerichtsstand

Es gilt österreichisches Recht. Gerichtsstand ist [OFFEN: Wien, sachlich zuständiges Gericht; prüfen].

## 18. Schlussbestimmungen

[OFFEN: Teilunwirksamkeit, Abtretung von Rechten aus dem Vertrag, Schriftform bzw. Textform.]
