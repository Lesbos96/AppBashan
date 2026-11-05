# MoveNow · Überblick für Investorinnen und Investoren

Stand: 2026-11-05. Quelle sind ausschließlich Code und Dokumente dieses Repositorys (Commit `1630668`, Migrationen 0001–0022). Marktzahlen, Kundenzahlen, Umsätze oder Partnerverträge stehen nicht im Repository und kommen deshalb hier nicht vor; wo sie fehlen, steht [OFFEN: …]. Technische Einzelheiten: `docs/ARCHITEKTUR.md`.

## 1. Kurzfassung

- **Was:** eine App, die in Wien Möbeltransport, Umzug, Entrümpelung sowie Montage und Demontage von Möbeln vermittelt. Kundinnen und Kunden sehen sofort einen Preis, senden eine verbindliche Buchungsanfrage, und ein geprüfter Partnerbetrieb nimmt sie in der App an.
- **Geld:** MoveNow erhält vom Partner eine Provision von 15 % des Gesamtpreises (inklusive 20 % USt.). Kundinnen und Kunden zahlen keine Zusatzgebühr und zahlen direkt an den Partner; über MoveNow läuft in Phase 1 kein Zahlungsfluss.
- **Stand:** Der Kundenteil ist gebaut (Preis, Adressprüfung, Strecke, Fotos, Anmeldung, Anfrage senden, Aufträge, Zurückziehen) und läuft gegen ein Entwicklungsprojekt. Der Partnerteil (Registrierung, Annahme, Angebote, Storno, Abrechnung) ist geplant und freigegeben, aber noch nicht gebaut. Es gibt kein Produktivsystem, keine echten Nutzer und keine Partner.
- **Bis zum Start fehlen** vor allem: der Partnerteil (Schritte S9b bis S9i), eine Rechtsprüfung (Buchungsbutton, Storno, Rücktritt, Partner-AGB), Verträge mit Mail-, Routen- und Hosting-Anbietern und die Einrichtung des Produktivprojekts (Abschnitt 7).

## 2. Produkt

### Für Kundinnen und Kunden
- **Preis sofort:** Konfigurator für Transport und Umzug, Wizard für Entrümpelung, Auswahl für Montage. Der Preis entsteht aus veröffentlichten Tarifen mit Quellenangabe („Wie rechnet MoveNow?“ im Profil) und aus der berechneten Strecke, inklusive der Kilometer außerhalb Wiens. Wo ein fester Preis nicht seriös ist (z. B. Klavier, Spezialgut, fehlende Strecke), gibt es eine Spanne oder ein persönliches Angebot.
- **Preisgarantie:** Der angezeigte Preis wird beim Absenden eingefroren, mit Tarifversion und Bedingungen. Ändern sich die Tarife, sieht der Kunde den neuen Preis und muss ihn erneut bestätigen; stillschweigend ändert sich nichts.
- **Verbindlich buchen, ohne Telefonate:** Ein Partner nimmt in der App an; Mehraufwand gibt es nur über einen Nachtrag mit Fotobeleg, dem der Kunde zustimmt. Storno-Stufen sind vor dem Absenden sichtbar.
- **Datensparsam:** Partner sehen vor der Annahme nur Bezirk, Umfang, Termin und Foto-Kopien ohne eingebettete Daten, keine Adresse und keinen Namen. Keine Werbe- oder Tracking-Dienste.

### Für Partnerbetriebe
- Aufträge aus ihrem Gebiet (Wiener Bezirke) und ihren Leistungen, ohne eigene Akquise.
- Vor der Annahme sichtbar: Preis und der Betrag, den der Partner erhält.
- Klare Regeln: erste Annahme gewinnt, keine bezahlte Bevorzugung, Provision nur bei Vertragsschluss, Satzänderungen mit 30 Tagen Vorlauf, Sperren nur mit Begründung.

Design und Bedienung orientieren sich an iOS (Referenz in `docs/reference/design/`), Light und Dark, mobil zuerst; später als App über Capacitor.

## 3. Zielgruppen

- **Kundinnen und Kunden:** Privatpersonen in Wien, die Möbel transportieren, umziehen, eine Wohnung entrümpeln oder Möbel montieren lassen wollen. Abholadresse in Wien, Ziel in Österreich. [OFFEN: Zielgruppen-Analyse, Marktgröße und Wettbewerb sind im Projekt nicht dokumentiert.]
- **Partnerbetriebe:** Unternehmen mit Sitz in Österreich, die diese Leistungen in Wien erbringen und die nötigen Berechtigungen haben; Prüfung durch MoveNow vor der Freigabe. [OFFEN: Zahl und Gewinnung der ersten Partner.]
- **Später (Phase 2):** Transportermiete über Vermieter als Partner-Kategorie, weitere Städte (`docs/ROADMAP.md:121-127`, Briefing: „Start Wien, Anspruch Europa“).

## 4. Ablauf

1. **Preis ansehen** ohne Konto.
2. **Adresse bestätigen:** nur mit Einwilligung des Kunden geht die Adresse an den Routendienst; der Server prüft sie beim Absenden noch einmal.
3. **Anmelden** beim Absenden per E-Mail (Link und Code in derselben Mail, kein Passwort); Fotos werden dann hochgeladen.
4. **Absenden:** Der Server rechnet den Preis neu und vergleicht ihn mit dem angezeigten; nur bei Gleichheit wird gespeichert. Die Annahmefrist richtet sich nach dem Termin (höchstens 24 Stunden, mindestens 2 Stunden).
5. **Verteilung** an alle passenden Partner *(geplant)*; der erste, der annimmt, erhält den Auftrag, der Vertrag entsteht zwischen Kunde und Partner. Bei Spannen senden Partner Festangebote, der Kunde wählt eines.
6. **Durchführung, Nachtrag, Storno** *(geplant)* nach festen Regeln; nach dem Termin fragt die App, ob der Auftrag stattgefunden hat.
7. **Abrechnung** *(geplant)*: Der Partner stellt dem Kunden den Gesamtpreis in Rechnung. MoveNow führt ein unveränderliches Provisions-Journal und stellt dem Partner monatlich die Provision in Rechnung (Phase 1 außerhalb der App, per Überweisung).

## 5. Geschäftsmodell

- **Erlös:** Provision je vermitteltem Auftrag, 15 % des Gesamtpreises inklusive 20 % USt. Rechenbeispiel mit dem Umzug aus der Design-Referenz (Gesamtpreis 689,61 €): Provision 103,44 € (netto 86,20 €, USt. 17,24 €), der Partner erhält 586,17 €. Auf Stornogebühren und berechtigte Anfahrtspauschalen fällt ebenfalls Provision an; storniert der Partner, entfällt sie.
- **Kosten:** [OFFEN: Betriebskosten (Supabase-Tarif, Routendienst, Mail, Hosting), Vertrieb, Personal; im Projekt nicht dokumentiert.]
- **Preisniveau:** Die Tarife sind Stichproben-Richtwerte aus einer Recherche vom 28.10.2026 bei einzelnen Anbietern, keine Marktdurchschnitte (`docs/PRICING.md:48-49`). Ob Partner zu diesen Preisen arbeiten, ist nicht belegt. [OFFEN: Validierung mit Partnern.]
- **Phase 2:** automatische Sammelrechnung, SEPA-Lastschrift, Zahlungsdienstleister (z. B. Stripe Connect); das Datenmodell sieht das vor.

## 6. Stand der Technik

### Gebaut (Schritte S1 bis S9a, abgeschlossen 2026-11-03)
- App: Vite, React, TypeScript, Tailwind; Start, Onboarding, Konfiguratoren für Transport und Umzug, Entrümpelung, Montage; Termin, Zusammenfassung, Bestätigung; Anmeldung; Aufträge-Liste; Zurückziehen; Profil mit Tarif-Transparenz.
- Backend auf Supabase (Postgres mit PostGIS, Auth, Storage, Edge Functions):
  - **Preis-Engine** als ein Modul für App und Server, centgenau, gegen den Prototyp mit 60 Golden-Fällen geprüft (`docs/PRICING.md:66`).
  - **Routing** über openrouteservice hinter einem austauschbaren Adapter; Kilometer außerhalb Wiens per Geometrie-Schnitt mit der Wiener Stadtgrenze; Wiener Bezirk aus den Bezirksgrenzen; Cache und Rate-Limits.
  - **Anfrage speichern** nur serverseitig: Neuberechnung, Preisabgleich, Adressprüfung, unveränderlicher Preis-Stand mit Tarifversion und Hash, Beleg der Kundenbestätigung, Fotos mit festem Ablauf.
  - **Statusmaschine** in der Datenbank: Statuswechsel nur über Funktionen, jeder Wechsel protokolliert; Preisversionen und Gebührensätze unveränderlich, neue Sätze nur mit Vorlauf.
- **Sicherheit:** Zeilenrechte auf allen 18 Tabellen; Kunden lesen nur Eigenes und nie Gebühren; Schreiben nur über geprüfte Serverfunktionen; Admin-Lesen nur mit zweitem Faktor; keine Geheimnisse in der App (Build-Prüfung `scripts/scan-dist.mjs`).
- **Tests** (letzter belegter Lauf 2026-11-03, `docs/PROGRESS.md:16`): 368 Unit-Tests, 176 Rechte-Tests gegen die Datenbank, 102 End-to-End-Tests, dazu Live-Tests gegen das Entwicklungsprojekt und „Rot-Beweise“, die zeigen, dass ein Test bei gelockerter Sperre tatsächlich fehlschlägt.
- **Entwicklung:** in einzelnen, dokumentierten Sessions mit Claude Code nach festen Regeln (`CLAUDE.md`): jede Session mit grünen Prüfläufen, Nachweisdateien in `docs/proof/` und unabhängiger Abnahme von Geld- und Sicherheitslogik.

### Geplant und freigegeben, nicht gebaut
- **S9b** Partnerfirmen, Prüfung und Freigabe, zweiter Faktor, Provisions-Journal (Bauplan `docs/S9b_PLAN.md`, freigegeben 2026-11-04).
- **S9c bis S9h** Verteilung und Annahme, Foto-Kopien für Partner, Festangebote, Nachtrag, Fertigmeldung und Export, Storno und Konto löschen (`docs/S9_KONZEPT.md`, Abschnitt 13).
- **S9i** Oberflächen für Kunden (Buchungsbutton nach Rechtsprüfung, Auftragsdetail) und Partner-Portal.
- **S10** Abnahme und Politur (Lighthouse, Preis-Stichproben, Bot-Schutz, Supabase-Advisor ohne Warnungen).
- **Phase 2** Admin-Oberfläche, Transportermiete, Zahlungsabwicklung, Push, iOS- und Android-Build, Bewertungen, weitere Städte.

## 7. Offene Punkte (ehrlich)

### Geschäft
1. Keine Partner, keine Kunden, kein Umsatz; nichts davon ist im Projekt belegt. [OFFEN: Stand außerhalb des Repositorys]
2. Preisniveau nur aus Stichproben; Bereitschaft der Partner, zu diesen Preisen und 15 % Provision zu arbeiten, ist nicht geprüft.
3. Markt, Wettbewerb, Gewinnung von Kunden und Partnern, Team und Finanzierung sind im Projekt nicht dokumentiert. [OFFEN]

### Recht und Steuern (vor dem Buchungsbutton zu klären, `docs/S9_KONZEPT.md`, Abschnitt 11)
4. Informationspflichten und Beschriftung des Buchungsbuttons, Rücktrittsrecht je Leistung, Bindung der Anfrage bis zur Annahme, Zulässigkeit der Stornostufen.
5. P2B-Verordnung für die Partner-AGB, DSA-Pflichten, Rolle der Partner im Datenschutz.
6. Ob MoveNow eine Gewerbeberechtigung für die Vermittlung braucht; Berechtigungen der Partner (Güterbeförderung, Abfall).
7. Umsatzsteuer bei Kleinunternehmer-Partnern; Risiko einer Leistungskommission; Meldepflichten für Plattformen (DAC7); keine Zahlungsdienst-Konzession nötig, solange kein Geld über MoveNow läuft (zu bestätigen).
8. Rechtstexte liegen nur als ungeprüfte Entwürfe vor (`docs/recht/`); die App zeigt heute Platzhalter.

### Betrieb (Livegang-Liste `docs/GOLIVE.md`)
9. Produktivprojekt in der EU-Region anlegen, eigene Schlüssel, Migrationen und Tarife einspielen.
10. Mail-Anbieter mit eigener Domain (Pflicht vor dem ersten Test auf einem Handy), Domain und Hosting der App festlegen.
11. Vertrag mit dem Routendienst (kommerzielle Nutzung, Auftragsverarbeitung, Kontingent); Ausweichanbieter ist vorgesehen.
12. Bot-Schutz vor Routing und Anmeldung (Pflicht vor dem Livegang).
13. Bekannter Blocker: Nach einer verlorenen Serverantwort und geändertem Fotosatz kann eine zweite Anfrage entstehen (`docs/GOLIVE.md:54`, Punkt 23).

### Technik
14. Partnerteil vollständig offen (S9b bis S9i); ohne ihn ist keine echte Buchung möglich.
15. Konto löschen, Anonymisierung und Aufbewahrungsfristen fehlen (`docs/OPEN_ISSUES.md:7`).
16. Kleinere Punkte: Tab „Miete“ noch sichtbar, App-Bundle über 500 kB, kein Offline-Cache, Capacitor- und Apple-Anmeldung noch nicht eingebunden (`docs/OPEN_ISSUES.md:16`, `:100`; `docs/ARCHITEKTUR.md`, Abschnitt 9).
17. Zweiter Faktor für Admin und Partner ist in der Projektkonfiguration noch nicht aktiviert (`supabase/config.toml:304-306`).
