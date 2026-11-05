**ENTWURF – nicht rechtsgeprüft**

# Allgemeine Geschäftsbedingungen für Kundinnen und Kunden

> Entwurf aus dem Nachtauftrag vom 2026-11-05. Abläufe und Werte stammen aus `docs/S9_KONZEPT.md` (Abschnitte 1, 8, 10, Werte in 5.10) und sind dort **vorläufig bis zur Rechtsprüfung** (Abschnitt 11). Annahme, Angebote, Nachtrag, Storno und Fertigmeldung sind **noch nicht gebaut** (S9c ff.); heute gibt es nur das Senden. Zurückziehen ist in der Datenbank vorhanden (`withdraw()`), in der App aber noch ohne Oberfläche (`docs/ROADMAP.md:103`). Die Werte stehen als einstellbare Schlüssel in `platform_settings`; was beim Vertragsschluss galt, steht im Preis-Stand der Buchung. Dieser Text erscheint in Kunden-Screens: Er nennt deshalb keine Vergütung von MoveNow durch Partner (`CLAUDE.md`, UI und Geld). [OFFEN: Rechtsprüfung, ob und wie eine solche Vergütung offenzulegen ist.]

## 1. Geltung

1.1 Diese Bedingungen gelten für die Nutzung der App MoveNow und für Buchungsanfragen, die du über die App sendest. Betreiber ist [OFFEN: Name bzw. Firma laut Impressum] („MoveNow“).

1.2 Für den Vertrag über die Leistung selbst (Transport, Umzug, Entrümpelung, Montage oder Demontage) gelten diese Bedingungen zwischen dir und dem Partnerbetrieb („Partner“), der deine Anfrage annimmt. [OFFEN: Rechtsprüfung, ob die Leistungsbedingungen hier als Vorgabe von MoveNow für alle Partner stehen dürfen oder als eigene Bedingungen der Partner einzubinden sind.]

1.3 Die App richtet sich an Verbraucherinnen und Verbraucher. [OFFEN: ob Unternehmer buchen dürfen und welche Abweichungen dann gelten; Mindestalter bzw. Geschäftsfähigkeit.]

## 2. Rolle von MoveNow

2.1 MoveNow vermittelt Leistungen geprüfter Partner in Wien. MoveNow führt keine Transporte, Umzüge, Entrümpelungen oder Montagen selbst durch und wird nicht Vertragspartner der Leistung.

2.2 Vertragspartner für die Leistung ist der Partner, der deine Anfrage in der App annimmt bzw. dessen Festangebot du bestätigst. Bei einem Festangebot siehst du den Partner schon mit dem Angebot; Kontakt und Bestätigung erhältst du mit dem Vertragsschluss in der App und per Mail. [OFFEN: welche Angaben zum Partner das Angebot zeigt; das Konzept nennt „Betrag und Partner“ (`docs/S9_KONZEPT.md`, 8.2).]

2.3 Die Nutzung der App ist für dich kostenlos. Du zahlst nur den Preis des Auftrags an den Partner. [OFFEN: Offenlegungspflichten zur Finanzierung der Plattform prüfen, siehe Hinweis im Kopf.]

2.4 [OFFEN: Pflichtinformationen für Verträge über Online-Marktplätze (§ 4 FAGG, insbesondere die Angaben für Online-Marktplätze nach dem Modernisierungsrichtlinie-Umsetzungsgesetz): Hauptparameter der Auswahl der Partner (Leistung, Bezirk der Abholadresse, Termin, erste Annahme), Hinweis, dass alle Partner Unternehmer sind, und wie die Pflichten zwischen Partner und MoveNow verteilt sind. Vgl. `docs/S9_KONZEPT.md`, Abschnitt 11, Punkte 1 und 6.]

## 3. Konto

3.1 Zum Senden einer Buchungsanfrage brauchst du ein Konto. Du meldest dich mit deiner E-Mail-Adresse an; du erhältst eine Mail mit einem Code und einem Link, beide 15 Minuten gültig. Ein Passwort gibt es nicht.

3.2 Halte den Zugang zu deinem Postfach geschützt. Wer Code oder Link nutzt, handelt in deinem Konto.

3.3 [OFFEN: Zulässige Nutzung der App, ausgeschlossene Güter (z. B. Gefahrgut), Folgen falscher Angaben, Sperre oder Beendigung eines Kundenkontos durch MoveNow.]

3.4 [OFFEN: Zugang von Erklärungen per Mail und in der App (Annahme, Angebote, Nachträge, Storno).]

3.5 [OFFEN: Löschen des Kontos. Eine Funktion dafür ist noch nicht gebaut (`docs/OPEN_ISSUES.md:7`); bis dahin per E-Mail an die Adresse im Impressum.]

## 4. Preise

4.1 Die App rechnet den Preis aus deinen Angaben und den veröffentlichten Tarifen der aktuellen Tarifversion. Die Tarife und ihre Quellen findest du unter „Wie rechnet MoveNow?“ im Profil. [OFFEN: Angabe, dass Preise Bruttopreise inklusive 20 % USt. sind; die Tarife sind als Bruttowerte hinterlegt (`docs/PRICING.md:55`). Klären, was gilt, wenn der Partner Kleinunternehmer ist (`docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 9).]

4.2 Je nach Leistung erhältst du einen **Festpreis** oder eine **Preisspanne**. Bei besonderen Umständen (z. B. Klavier, Spezialgut, fehlende Strecke) erhältst du statt eines Preises ein **persönliches Angebot**: Partner senden dir dann Festangebote (Punkt 5.5).

4.3 Für Kilometer und Fahrzeit braucht die App deine Einwilligung zur Übermittlung der Adressen an den Routendienst. Ohne Einwilligung gibt es keinen Kilometerpreis, sondern ein persönliches Angebot.

4.4 Verbindlich ist der Betrag, den du vor dem Absenden siehst. Ändern sich die Tarife, während du die Anfrage vorbereitest, hält der angezeigte Preis noch 30 Minuten. Danach oder bei geänderten Bedingungen zeigt die App den neuen Preis, und du musst ihn ausdrücklich bestätigen; ohne Bestätigung wird nichts gesendet.

4.5 Der Preis gilt für den Umfang, den du angegeben hast (Gegenstände, Personen, Stunden, Etagen, Strecke). Mehraufwand gibt es nur nach Punkt 7.

## 5. Buchungsanfrage und Vertragsschluss

5.1 Mit „[OFFEN: Beschriftung des Buttons nach Rechtsprüfung, Vorschlag im Projekt „Zahlungspflichtig buchen“; der Wortlaut muss dazu passen, dass du nicht an MoveNow, sondern nach Vertragsschluss an den Partner zahlst]“ sendest du eine verbindliche Buchungsanfrage zum angezeigten Preis. [OFFEN: Bindung an die Anfrage bis zur Annahme (§ 862 ABGB) und Verhältnis zum kostenlosen Zurückziehen nach Punkt 8.1 klären (`docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 3).]

5.2 Buchbar sind Aufträge mit Abholadresse in Wien und Ziel in Österreich. Der Termin muss mindestens 2 Stunden in der Zukunft liegen.

5.3 MoveNow bietet deine Anfrage allen Partnern an, die für die Leistung, den Bezirk der Abholadresse und den Termin in Frage kommen. Eine Anfrage, die ein Partner selbst als Kunde sendet, wird ihm nicht angeboten. Vor der Annahme sehen die Partner den Bezirk der Abholadresse, bei Transport und Umzug die Postleitzahl des Ziels, Umfang, Termin, Preis und Kopien deiner Fotos, aber keine Straße, keine Hausnummer, keinen Namen und keine Kontaktdaten.

5.4 **Festpreis:** Der Vertrag mit dem Partner kommt zustande, wenn ein Partner deine Anfrage in der App annimmt. Den Auftrag erhält der Partner, der zuerst annimmt. Die Annahmefrist beträgt höchstens 24 Stunden, höchstens die Hälfte der Zeit bis zum Termin und mindestens 2 Stunden. Nimmt innerhalb der Frist kein Partner an, ist die Anfrage abgelaufen; lehnen alle angefragten Partner ab oder passt kein Partner, wird sie als „nicht vermittelt“ geschlossen. Du wirst in beiden Fällen informiert und kannst neu senden, dann zum dann gültigen Preis.

5.5 **Spanne oder persönliches Angebot:** Partner können dir innerhalb der Annahmefrist ein Festangebot senden, bei einer Spanne nur innerhalb der Spanne. Du siehst höchstens 3 offene Angebote mit Betrag und Partner. Ein Angebot gilt 48 Stunden, höchstens bis zum Termin. Der Vertrag kommt zustande, wenn du ein Angebot in der App bestätigst; die übrigen Angebote erlöschen.

5.6 Nach dem Vertragsschluss erhält nur der Partner des Auftrags deine Adresse und deinen Kontakt.

## 6. Deine Angaben und Mitwirkung

6.1 Deine Angaben zu Umfang, Gegenständen, Etagen, Zugang und Adressen müssen zutreffen und vollständig sein; Fotos helfen dem Partner, den Auftrag einzuschätzen. Nach dem Absenden kannst du die Anfrage nicht mehr ändern; zieh sie zurück und sende sie neu [noch nicht gebaut: Zurückziehen hat in der App noch keinen Knopf].

6.2 [OFFEN: weitere Mitwirkungspflichten (z. B. Zugang, Parkmöglichkeit, Halteverbotszone, Aufzug, Sicherung von Wertsachen, Entleerung von Möbeln, Erreichbarkeit am Termin und Folgen von Wartezeit), soweit die Partner sie verlangen dürfen; im Projekt nicht festgelegt.]

## 7. Mehraufwand (Nachtrag)

7.1 Stellt der Partner vor Ort mehr Umfang fest, als du angegeben hast, kann er vor der Mehrleistung in der App einen Nachtrag vorschlagen, mit Fotobeleg. Den Betrag rechnet die App aus den korrigierten Angaben mit der Tarifversion deiner Buchung; einen frei gewählten Betrag gibt es nicht. Ein Nachtrag kann den Preis nur erhöhen und ändert weder Adressen noch Strecke. Bei Aufträgen aus einem Festangebot gibt es keinen Nachtrag.

7.2 Du entscheidest in der App. Der Vorschlag gilt 2 Stunden. Stimmst du zu, gilt der neue Gesamtpreis. Lehnst du ab oder läuft die Frist ab, führt der Partner den gebuchten Umfang zum gebuchten Preis aus. Ohne deine Zustimmung darf der Partner die Mehrleistung nicht verlangen.

7.3 Ist der gebuchte Umfang wegen falscher Angaben nicht ausführbar, kann der Partner den Auftrag mit Fotobeleg abbrechen. Dann darf er eine Anfahrtspauschale von [OFFEN: Betrag; im Projekt vorläufig 69,00 € (`docs/S9_KONZEPT.md`, 10.3)] verlangen. Du kannst der Pauschale in der App widersprechen; über den Widerspruch entscheidet MoveNow. Waren deine Angaben richtig, ist der Abbruch für dich kostenlos. [OFFEN: Rechtsprüfung, ob MoveNow über die Pauschale verbindlich entscheiden darf.]

## 8. Zurückziehen und Storno

8.1 **Vor dem Vertragsschluss** kannst du deine Anfrage jederzeit kostenlos zurückziehen [noch nicht gebaut: in der Datenbank vorhanden, in der App noch ohne Knopf].

8.2 **Nach dem Vertragsschluss** kannst du in der App stornieren:
- bis 48 Stunden vor dem Termin kostenlos,
- danach 50 % des Gesamtpreises,
- am Tag des Termins (Wiener Zeit) 100 % des Gesamtpreises.

Maßgeblich sind die Stufen, die du vor dem Absenden gesehen hast; sie stehen im Preis-Stand deiner Buchung. Die Stornogebühr stellt dir der Partner in Rechnung. [OFFEN: Zulässigkeit nach § 6 KSchG und richterliches Mäßigungsrecht (§ 1336 ABGB); Verhältnis zum Rücktrittsrecht nach Punkt 10 (`docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 5). Als „Termin“ gilt der Beginn des gewählten Zeitfensters (bei „Flexibel“ 08:00 Uhr), bei Leistungen ohne Zeitfenster 00:00 Uhr des Termintags, jeweils Wiener Zeit (`docs/S9_KONZEPT.md`, 5.10; so gerechnet in `supabase/migrations/20261102110000_0020_photo_staging.sql:213-227`). Für Transport und Umzug verschiebt das die 48-Stunden-Grenze auf den Beginn des Vortags; klären, ob der Kundentext das so nennen soll.]

8.2a [OFFEN: Verschieben des Termins nach Vertragsschluss; im Projekt nicht vorgesehen (Zurückziehen bzw. Storno und Neusenden).]

8.3 **Storno durch den Partner:** Sagt der Partner nach dem Vertragsschluss ab, zahlst du nichts. Liegt der Termin noch mindestens 24 Stunden entfernt und beruhte die Buchung nicht auf einem Festangebot, bietet MoveNow deine Anfrage automatisch zum gleichen Preis anderen Partnern an; diese Folgeanfrage kannst du kostenlos zurückziehen oder stornieren. Sonst kannst du neu senden.

## 9. Zahlung

9.1 Den Gesamtpreis (und gegebenenfalls Nachtrag, Stornogebühr oder Anfahrtspauschale) stellt dir der Partner in Rechnung; du zahlst direkt an den Partner. MoveNow nimmt keine Zahlungen entgegen.

9.2 [OFFEN: Zahlungsart, Fälligkeit, Anzahlung oder Barzahlung vor Ort; im Projekt nicht festgelegt.]

## 10. Rücktrittsrecht

[OFFEN: gesamter Abschnitt nach Rechtsprüfung (`docs/S9_KONZEPT.md`, Abschnitt 11, Punkt 2). Zu klären:
- ob für Transport und Umzug zu einem festen Termin die Ausnahme für die Beförderung von Waren zu einem bestimmten Zeitpunkt gilt (§ 18 Abs. 1 FAGG) und für Entrümpelung und Montage das 14-tägige Rücktrittsrecht nach § 11 FAGG;
- wem gegenüber der Rücktritt zu erklären ist (Partner als Vertragspartner) und wie MoveNow ihn weiterleitet;
- Belehrung, Muster-Widerrufsformular, ausdrückliches Verlangen eines Beginns vor Ablauf der Frist (§ 10 FAGG) und anteiliges Entgelt (§ 16 FAGG);
- wie sich Rücktritt und Stornostufen nach Punkt 8.2 zueinander verhalten.]

## 11. Nach dem Termin

Nach dem Termin fragt dich die App, ob der Auftrag stattgefunden hat. Antwortest du nicht bis 7 Tage nach dem Termin, gilt der Auftrag als durchgeführt. Meldest du, dass er nicht stattgefunden hat, prüft MoveNow den Fall. [OFFEN: Wirkung dieser Rückfrage gegenüber dem Partner (keine Abnahme im Rechtssinn), Rechtsprüfung.]

## 12. Gewährleistung und Haftung

12.1 Für die Leistung haftet der Partner nach den gesetzlichen Bestimmungen; deine gesetzlichen Gewährleistungsrechte gegenüber dem Partner bleiben unberührt. [OFFEN: Gewährleistung für die Leistung (Mängelanzeige, Verbesserung, Preisminderung) ausformulieren.] [OFFEN: Haftung für Transportschäden und Umzugsgut, Versicherungspflicht der Partner, Reklamationsfristen; im Projekt nicht festgelegt.]

12.2 MoveNow haftet für die Vermittlung und den Betrieb der App. Für leichte Fahrlässigkeit haftet MoveNow nicht, ausgenommen bei Personenschäden. [OFFEN: Zulässigkeit und Umfang nach § 6 Abs. 1 Z 9 KSchG prüfen.]

12.3 MoveNow bemüht sich um eine durchgehend erreichbare App, schuldet sie aber nicht. Wartung und Störungen können die Nutzung zeitweise einschränken.

## 12a. Vertragsschluss in der App

[OFFEN: Informationen für Vertragsabschlüsse im elektronischen Geschäftsverkehr (ECG): technische Schritte bis zum Vertragsschluss, ob und wo der Vertragstext gespeichert und abrufbar ist (heute: Preis-Stand und Bedingungen je Anfrage in der App), Erkennen und Berichtigen von Eingabefehlern vor dem Absenden (Zusammenfassung), Vertragssprache Deutsch.]

[OFFEN: Pflichten nach dem Digital Services Act für Online-Plattformen, etwa ein Meldeweg für rechtswidrige Inhalte (z. B. Fotos) und die Angaben zur Auswahl der Partner; prüfen, ob die Ausnahmen für Klein- und Kleinstunternehmen gelten.]

## 13. Datenschutz

Wie MoveNow deine Daten verarbeitet und wann Partner sie erhalten, steht in der Datenschutzerklärung (`docs/recht/datenschutz-kunden.md`).

## 14. Änderungen dieser Bedingungen

MoveNow kann diese Bedingungen für künftige Anfragen ändern. Für eine gesendete Anfrage und einen geschlossenen Vertrag gelten die Bedingungen und Werte, die beim Absenden galten. [OFFEN: Verfahren und Frist der Mitteilung an registrierte Kundinnen und Kunden.]

## 15. Beschwerden und Streitbeilegung

Beschwerden zur App oder zur Vermittlung an [OFFEN: Adresse]. Beschwerden zur Leistung richtest du an den Partner; MoveNow unterstützt dich dabei. [OFFEN: Teilnahme an einer Verbraucherschlichtung nach AStG, siehe Impressum.]

## 16. Recht und Gerichtsstand

Es gilt österreichisches Recht. Zwingende Verbraucherschutzbestimmungen deines Aufenthaltsstaats bleiben unberührt. Für Klagen gegen dich als Verbraucherin oder Verbraucher ist das Gericht an deinem Wohnsitz, gewöhnlichen Aufenthalt oder Beschäftigungsort zuständig (§ 14 KSchG). [OFFEN: prüfen]

## 17. Schlussbestimmungen

[OFFEN: Teilunwirksamkeit einzelner Bestimmungen (bei Verbrauchern ohne geltungserhaltende Ersatzklausel, prüfen).]
