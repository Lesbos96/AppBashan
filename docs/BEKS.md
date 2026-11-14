# MoveNow · Fragen an Beks

Stand 2026-11-14. Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

### 1. Soll eine Firma die Anfahrtspauschale erst ab dem Beginn des Termins verlangen dürfen?
- Worum es geht: Heute kann eine Firma schon vor dem Termin absagen und dem Kunden eine Anfahrtspauschale berechnen, sobald der Kunde einen Nachtrag abgelehnt hat oder der Nachtrag abgelaufen ist und die Firma Fotos als Beleg hochlädt. Sie muss dafür nicht beim Kunden gewesen sein.
- Empfehlung: Ja, weil eine Pauschale für die Anfahrt nur fair ist, wenn die Firma auch angefahren sein kann, und die heutige Regel sich ausnutzen lässt.
- Bei „Nein“: Es bleibt wie heute; die Regel muss dann genau so in den Bedingungen für Kunden und Firmen stehen und rechtlich geprüft werden.
- Aufwand: eine Session (Änderung an der Datenbank mit Freigabe des Beraters, Tests, Texte)
- Quelle: Nr. 26, 95; OPEN_ISSUES S9i7-10 (a); GOLIVE 33

### 2. Darf eine Firma ihre Gebühr auch in der Absage-Maske und in ihrer Abrechnungs-Datei sehen?
- Worum es geht: Deine Regel nennt als Orte für die Gebühr nur die Vermieter-Abrechnung, die Rechnung und die Auszahlungsübersicht. Gebaut ist zusätzlich eine Zeile „Gebühr“, wenn eine Firma mit Pauschale absagt (das stand so im Auftrag), und die Abrechnungs-Datei der Firma nennt ihre Provision.
- Empfehlung: Ja, weil jede Firma nur ihre eigene Gebühr sieht und Kunden sie weiterhin nirgends sehen.
- Bei „Nein“: Die Zeile „Gebühr“ in der Absage-Maske wird gestrichen; die Firma sieht dort nur die Pauschale und „Du erhältst“. Die Provision steht dann nur in der Abrechnungs-Datei.
- Aufwand: bei Ja ein Satz in den Projektregeln, bei Nein klein
- Quelle: Nr. 106, 114; OPEN_ISSUES S9i7b2-5, S9i7c1-5

### 3. Darf der Kunde in der App den Betrag der Pauschale sehen, die ihm die Firma nach ihrer Absage berechnen darf?
- Worum es geht: Sagt eine Firma mit Pauschale ab, zeigt die App dem Kunden den Betrag. Die Zahl kommt aus dem internen Buchungsjournal, das Kunden laut deiner Regel sonst gar nicht lesen; die Gebühr von MoveNow sieht der Kunde dabei nicht, und die Mail an ihn nennt keinen Betrag.
- Empfehlung: Ja, weil es der Betrag ist, den der Kunde selbst schuldet, und er ihn sonst nirgends erfährt.
- Bei „Nein“: Die Karte beim Kunden zeigt nur noch, dass eine Pauschale anfällt, ohne Betrag; der Abruf wird wieder entfernt.
- Aufwand: bei Ja ein Satz in den Projektregeln, bei Nein eine Session (Änderung an der Datenbank mit Freigabe)
- Quelle: Nr. 97 (dazu Nr. 27, 107)

### 4. Bestätigst du die neue Provisionsstaffel so, wie sie gebaut ist und jetzt in den Projektregeln steht?
- Worum es geht: Statt 15 % gilt für neue Aufträge: bis 500 € 12 %, darüber bis 1.000 € 10 %, darüber 7 %, jeweils auf den Teil des Preises in der Stufe. Bei einem Nachtrag zählt der Unterschied der Provision vor und nach dem Nachtrag; die Staffel gilt ohne Vorankündigung ab dem Tag des Einspielens, und den Text in den Projektregeln hat die Session selbst angepasst.
- Empfehlung: Ja, weil es deiner Vorgabe entspricht und gegenüber 15 % eine reine Senkung ist.
- Bei „Nein“: Eine geänderte Staffel kommt als neue Fassung dazu (alte Buchungen bleiben unverändert), und der Regeltext wird angepasst. Künftige Erhöhungen brauchen ohnehin einen Vorlauf (laut Konzept 30 Tage).
- Aufwand: bei Ja keiner, bei Nein eine Session
- Quelle: Nr. 124, 125, 126, 131; OPEN_ISSUES S9p1-2

### 5. Sollen Entrümpelung und andere Aufträge mit festem Angebot der Firma zum Start buchbar sein, obwohl die Firma dort bei mehr Aufwand vor Ort nur ohne Pauschale absagen kann?
- Worum es geht: Einen Nachtrag schlägt die Firma vor, indem sie Angaben des Auftrags ändert; der Preis wird dann neu berechnet (im Auftrag stand, die Firma nennt selbst einen Betrag). Bei Entrümpelung, Einpacken, Sonderware, großem Lkw und Montage innerhalb eines Umzugs gibt es keinen Nachtrag und deshalb nie eine Pauschale.
- Empfehlung: Ja, weil die Firma bei diesen Aufträgen ihren Preis selbst festlegt, nachdem sie Umfang und Fotos gesehen hat, und dem Kunden so keine Zusatzkosten entstehen.
- Bei „Nein“: Entweder werden diese Leistungen zum Start nicht angeboten, oder Nachtrag und Pauschale werden für sie ausgebaut, bevor die Buchung geöffnet wird.
- Aufwand: bei Ja keiner, bei Nein mindestens eine Session mit Planprüfung
- Quelle: Nr. 89; GOLIVE 32; OPEN_ISSUES S9i7-5, S9i7-10 (b)

### 6. Bleibt es dabei, dass eine Firma nach ihrer eigenen Absage ohne Pauschale Name, Adresse und Telefonnummer des Kunden sofort nicht mehr abrufen kann?
- Worum es geht: Am 01.11.2026 hast du entschieden, dass Firmen auch nach einem Storno 30 Tage Zugriff behalten. Seit der letzten Änderung gilt das nach einer Absage durch die Firma nur noch, wenn eine Pauschale fällig ist; der Auftrag an die Session enthielt das so.
- Empfehlung: Ja, weil die Firma die Kontaktdaten ohne offene Forderung nicht mehr braucht.
- Bei „Nein“: Die Änderung wird zurückgenommen (neue Änderung an der Datenbank), die Hinweise in der Firmen-App und im Konzept werden zurückgestellt; dann gelten wieder 30 Tage.
- Aufwand: bei Ja keiner, bei Nein eine Session
- Quelle: Nr. 104 (ändert die in Nr. 95 genannte Entscheidung)

### 7. Soll eine Firma auch nach einem kostenlosen Storno durch den Kunden den Kontakt sofort verlieren, und nach jedem Storno ohne Pauschale auch die Fotos?
- Worum es geht: Storniert der Kunde kostenlos, kann die Firma seinen Kontakt heute noch 30 Tage abrufen. Die Fotos der Anfrage bleiben in dieser Zeit in jedem Fall sichtbar, auch nach einer Absage der Firma ohne Pauschale.
- Empfehlung: Ja, weil die Firma diese Daten nach einem Storno ohne offene Forderung nicht mehr braucht.
- Bei „Nein“: Es bleibt beim Zugriff für 30 Tage; das muss dann so in der Datenschutzerklärung stehen.
- Aufwand: eine Session (Änderung an der Datenbank mit Freigabe)
- Quelle: Nr. 122, 120; OPEN_ISSUES S9i7-10 (c), S9i7b2-3

### 8. Soll der Server ab dem Start nur noch die gültige Fassung der Partnerbedingungen annehmen?
- Worum es geht: Bei der Anmeldung einer Firma wird gespeichert, welcher Fassung der Bedingungen sie zugestimmt hat. Der Server prüft heute nur die Schreibweise dieser Angabe; du hast am 07.11.2026 festgelegt, dass es bis zur Rechtsklärung keine Liste gültiger Fassungen gibt.
- Empfehlung: Ja, weil du sonst im Streitfall nicht sicher belegen kannst, welcher Fassung eine Firma zugestimmt hat.
- Bei „Nein“: Es bleibt bei der Prüfung der Schreibweise; ein manipulierter Aufruf kann eine erfundene Fassung speichern, und du prüfst die Angabe bei der Freigabe der Firma von Hand.
- Aufwand: klein (Änderung an der Datenbank mit Freigabe, zusammen mit den echten Bedingungen)
- Quelle: Nr. 3; GOLIVE 30

### 9. Soll „Konto löschen“ schon zum Start zusätzlich einen Code aus einer E-Mail verlangen?
- Worum es geht: Heute genügt es, angemeldet zu sein und ein Häkchen zu setzen. Wer ein entsperrtes Handy oder eine gestohlene Anmeldung hat, könnte ein Konto ohne offene Aufträge unwiderruflich löschen.
- Empfehlung: Nein, weil das Löschen bei offenen Aufträgen ohnehin gesperrt ist und der zusätzliche Schritt nach dem Start nachgerüstet werden kann.
- Bei „Nein“: Es bleibt wie heute; der Punkt bleibt als offene Aufgabe für die Zeit nach dem Start stehen.
- Aufwand: bei Ja eine Session, bei Nein keiner
- Quelle: Nr. 56; OPEN_ISSUES S9h4-2; „Aufgaben für Beks“ (s9i-4)

### 10. Sollen gesperrte Firmen ihre Abrechnung weiter in der App sehen und herunterladen können?
- Worum es geht: Eine gesperrte Firma sieht im Portal heute nichts mehr, auch nicht die Abrechnung über frühere Aufträge. Der Server würde es ihr erlauben; bis zu deiner Entscheidung bekommt sie die Abrechnung nur auf Anfrage von dir.
- Empfehlung: Ja, weil die Firma ihre eigenen Buchungen auch nach einer Sperre nachvollziehen können muss und du sonst jede Anfrage von Hand bedienst.
- Bei „Nein“: Es bleibt dabei: Du schickst die Abrechnung auf Anfrage aus deinem Monatsexport.
- Aufwand: klein (nur App)
- Quelle: Nr. 113; OPEN_ISSUES S9i7c1-3

### 11. Soll der Server eine neue Bewerbung ablehnen, wenn dieselbe UID-Nummer schon bei einer abgelehnten Firma steht?
- Worum es geht: Eine abgelehnte Firma kann sich mit demselben Konto nicht neu bewerben, mit einer zweiten E-Mail-Adresse und derselben UID-Nummer aber schon. Das fällt heute nur auf, wenn du es bei der Freigabe selbst bemerkst.
- Empfehlung: Nein, weil eine nachgebesserte Bewerbung sonst keinen Weg mehr hätte und die Freigabe ohnehin bei dir liegt; besser ist ein Hinweis auf gleiche UID-Nummern vor der Freigabe.
- Bei „Nein“: Du gibst weiter jede Firma von Hand frei und prüfst vorher, ob die UID-Nummer schon vorkommt; die Anzeige dafür kommt mit der Verwaltungsoberfläche.
- Aufwand: bei Ja klein (Änderung an der Datenbank mit Freigabe), bei Nein jetzt keiner
- Quelle: Nr. 66; OPEN_ISSUES S9i5-1

### 12. Soll beim Festangebot der Firma das Wort „voraussichtlich“ bei „Du erhältst“ entfallen?
- Worum es geht: Im Angebot steht „Du erhältst voraussichtlich“ und direkt darunter „Dein Anteil steht mit dem Senden fest.“ Seit der neuen Staffel steht der Anteil mit dem Senden tatsächlich fest; die beiden Sätze passen nicht zusammen.
- Empfehlung: Ja, weil die Firma sonst nicht weiß, ob der gezeigte Betrag gilt.
- Bei „Nein“: Beide Texte bleiben, wie sie sind.
- Aufwand: klein
- Quelle: Nr. 130 (N1), 77, 126

### 13. Soll ein Anwalt vor dem Start prüfen, auf welcher Rechtsgrundlage Adressen an den Routen-Dienst gehen?
- Worum es geht: Für die Preisberechnung geht die Adresse an einen Routen-Dienst. Heute fragt die App dafür nach einer Einwilligung, und ohne sie kann man nicht buchen. Eine Einwilligung, ohne die es nicht geht, gilt möglicherweise nicht als freiwillig.
- Empfehlung: Ja, weil es zusammen mit den übrigen Rechtstexten kaum Mehraufwand ist; bis dahin bleibt die Einwilligung.
- Bei „Nein“: Es bleibt ungeprüft bei der Einwilligung.
- Aufwand: keiner für den Bau; Teil der Rechtsklärung
- Quelle: OFFEN Recht-1

### 14. Dürfen die vier Preiswerte ohne eigene Quelle so live gehen?
- Worum es geht: Vier Werte stammen aus dem Prototyp und haben keine eigene Marktquelle: Montage 46,60 € je Stunde, Mindestpreis Entrümpelung 180 €, Etagenzuschlag 25 €, Montage mindestens 2 Laufmeter.
- Empfehlung: Ja, weil sie aus deinem Prototyp stammen und sich später ohne Umbau ändern lassen.
- Bei „Nein“: Du nennst die neuen Werte, sie kommen als neue Preisfassung dazu.
- Aufwand: bei Ja keiner, bei Nein klein
- Quelle: OFFEN PR-2

### 15. Sollen die Karte „Transporter mieten“ und die Seite dazu bis Phase 2 verschwinden?
- Worum es geht: Die Miete kommt erst in Phase 2. Heute führt die Karte auf der Startseite auf eine leere Seite mit „Folgt“, von der kein Pfeil zurückführt.
- Empfehlung: Ja, weil eine Sackgasse auf der Startseite Kunden kostet.
- Bei „Nein“: Karte und Seite bleiben, die Seite bekommt einen Zurück-Pfeil.
- Aufwand: klein
- Quelle: OFFEN NA-6

## Hinweise zu den Fragen
- Frage 2 führt der Berater als hohen Fund: Die Zeile „Gebühr“ in der Absage-Maske widerspricht heute dem Wortlaut der Geldregel (kein Kunde sieht sie). Bitte vor dem Öffnen der Buchung beantworten.
- Zu Frage 9 und 11 kamen die zwei Prüfungen zu verschiedenen Empfehlungen: Die Prüfung der offenen Punkte rät bei beiden zu Ja (Schutz vor gestohlener Anmeldung; Neuanmeldung mit zweiter E-Mail fällt sonst nicht auf).
- Zwei weitere Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
