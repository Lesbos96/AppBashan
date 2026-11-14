# MoveNow · Entscheidungen

Register aller Entscheidungen aus den Sessions (Nr. 1 bis 147 aus `docs/archiv/AUTOPILOT.md`, sortiert am 2026-11-14). Wird nur bei Bedarf gelesen. Status: `technisch` (Beks muss es nicht lesen), `Beks (Frage n)` (steht als Frage in `docs/BEKS.md`), `Start (GOLIVE n)` bzw. `Start (neu)` (Aufgabe in `docs/GOLIVE.md`). Neue Entscheidungen hängt jeder Schritt unten an, mit der nächsten Nummer.

| Nr | Datum | Schritt | Thema | Entscheidung | Status |
|---|---|---|---|---|---|
| 1 | | S9b (Vorlauf R1) | Rot-Beweise | Rot-Beweise mit Lockerung auf Dev entfallen laut Auftrag (kein `redproof-s9b.mjs`); die Wirkung der Sperren belegen Tests mit Fehlercode; `s9a3`/`s9a4` gilt als nicht erbracht. | technisch |
| 2 | | S9b-0 | Abnahme-Entwurf | `vat_rule` bis Phase 2 nur `standard_20`; keine Dauer-Fixture im Journal; Statusfunktionen schon in S9b-1. | technisch |
| 3 | 2026-11-07 | S9b | Partnerbedingungen | `terms_version` nur mit Formatprüfung, keine Liste gültiger Versionen; auf Dev gilt bis zur Rechtsklärung der Platzhalter `partner-2026-11-entwurf`. | Beks (Frage 8) |
| 4 | | S9b-1 | Tests | Tests als Rollback-Proben mit `auth.users`-Zeilen in der Transaktion; nur der Wettlauf-Test von `register_partner` committet eine Firma und löscht sie wieder. | technisch |
| 5 | | S9b-2 | Admin-Funktionen | `assert_not_member` in allen vier Admin-Funktionen; Constraints `partner_categories_no_rental`, `partner_vat_rules_phase1`; `partner_document_slot` prüft Firmenstatus; `uid` nicht leerbar. | technisch |
| 6 | | S9b-2 | Dokumente-Bucket | Migration 0025: Firma liest eigene Dateien in `partner-documents` (aal2, pending/active/payment_hold), weil der Upload die Select-Policy braucht; Nachweis S2-M2 folgt (siehe Nr. 73). | technisch |
| 7 | | S9b-2 | Dokumente | Migration 0026: entfernte Dokument-ID nicht wiederverwendbar, solange die Datei im Bucket liegt (`slot_taken`). | technisch |
| 8 | | allgemein (Fassung s9i-6) | Volllauf-Regel | Nach Transportfehler der Management-API den ganzen Volllauf wiederholen (höchstens zweimal); Merge nur mit EXIT=0 in check, test:e2e und test:rls. | technisch |
| 9 | | Konzept-Bereinigung | Doku | Nur `S9_KONZEPT.md:338` angepasst; die übrigen Stellen bleiben Doku-Runde ohne Wirkung auf Code (OPEN_ISSUES). | technisch |
| 10 | | S9b-3 | TOTP, Einstellungen | TOTP auf Dev aktiv; Tests überspringen nur bei abgeschaltetem TOTP; `rental_provider` verliert Satz-Lesezugriff; `select *` auf `platform_settings` für `authenticated` verweigert. | technisch |
| 11 | | S9b-4 | Journal | Regeln für `commission_book`: Gegenbuchungen mit gleicher `revision_id`, `change` nur erhöhend, `cancellation_fee` nur nach Gegenbuchung, höchstens eine, Betrag > 0; SQL rechnet keine Gebühr. | technisch, teils ersetzt durch Nr. 127 |
| 12 | | S9c | Verteilung | `quote` ruft `distribute_request` nach dem Speichern, Cron `distribute-pending` holt nach; kein Trigger; ohne passende Firma ist die Anfrage sofort `unmatched`. | technisch |
| 13 | | S9c | Namen, Kontakt | `start_job`/`complete_job` statt `start`/`complete`; `admin_contact` (nur `service_role`) und Edge Function `admin-contact` ersetzen freies Lesen von `request_contacts`. | technisch |
| 14 | | S9c | Mailversand | Outbox und `outbox-send` gebaut, Anbieter offen; ohne Function- und Vault-Secrets wird nichts gesendet, Zeilen bleiben `pending`; Einrichtungsskript fehlt. | Start (neu) |
| 15 | | S9c | Zuständigkeit | Kategorie und Bezirk gelten auch bei Annahme und beim Lesen offener Listings (`private.in_scope`); Listings außerhalb bleiben `open` (S9c-12). | technisch |
| 16 | | S9c | Listings | Listings ohne Ziel-PLZ und ohne Fotos; Nachzug mit S9e bzw. S9d (S9c-1, S9c-4). | technisch |
| 17 | | S9c | Tests | Globale Testfirma „Testabdeckung GmbH“ im `globalSetup` (alle Bezirke außer 17, 18, 21), danach gelöscht; `listings.test.ts` nutzt 17, 18, 21. | technisch |
| 18 | | S9c | Testreste Dev | Wettlauftest committet Fixtures; je Lauf bleiben Kunde, Auftrag, gesperrte Firma und Journalzeile auf Dev (S9c-7). | technisch |
| 19 | | S9d | Tests | S3-N6 und S4-N3 erledigt (nur Testergänzungen). | technisch |
| 20 | | S9g | Abschluss, Export | „Nicht stattgefunden“ und „durchgeführt“ schließen sich aus (kein Zurücknehmen); Mail `completion_ask`; `export_commissions` nur über `service_role` per Skript. | technisch |
| 21 | | S9h | Schnitt | S9h in vier Teile: S9h-1 Storno Kunde, S9h-2 Storno Partner und T16, S9h-3 `admin-correct`, S9h-4 Konto löschen. | technisch |
| 22 | | S9h-1 | Storno Kunde | Kunde bestätigt die Stornogebühr vorab (`preview`, `shownFeeCents`), bei Abweichung 409 `cancel_fee_changed`; nach „nicht stattgefunden“ gesperrt; Storno nach Termin mit 100 %. | technisch, teils ersetzt durch Nr. 24 |
| 23 | | – | Tests | `ownerSql` schreibt Abfragen ab 12.000 Zeichen in eine temporäre Datei und ruft `db query -f` auf. | technisch |
| 24 | | S9h-2 | Storno Kunde | Entscheidung Beks (S9h1-1): Kundenstorno nur bis Terminbeginn, danach 409 `too_late_use_report_not_done`; Prüfreihenfolge Status, `under_review`, Terminbeginn. | technisch |
| 25 | | S9h-2 | Weitervermittlung | T16: Folgeanfrage kopiert die gültige Revision als `submit` mit `copied_from_revision_id`; nur bei genug Vorlauf (`reissue_min_hours`, `accept_min_hours`); frühere Stornierer ausgeschlossen. | technisch |
| 26 | | S9h-2 | Pauschale | Pauschale nur bei `scope_impossible` mit 1 bis 8 Belegfotos nach abgelehntem oder abgelaufenem Nachtrag; Betrag `min(call_out_fee_cents, Gesamtpreis)`. | Beks (Frage 1) |
| 27 | | S9h-2 | Qualität, Mails | `partner_quality()` als admin-Funktion; Kundenmails `partner_cancelled`, `partner_cancelled_fee` (ohne Betrag), `request_reissued`, ohne Plattformgebühr. | Start (neu) |
| 28 | | S9h-3 | Storno Partner | Entscheidungen Beks (0048): `scope_impossible` ohne Belege löst T16 aus (kostenlos); ab `termin_at` nur `scope_impossible`, sonst 409 `too_late_for_reason`. | technisch |
| 29 | | S9h-3 | T14 | T14 über `admin-correct` (fünf Aktionen); admin-Storno ohne T16 und ohne Mail; Gebühr nur 0 oder die berechnete Basis; Liste `reported_jobs()`; Aufruf per `npm run admin:call`. | Start (neu) |
| 30 | | S9h-4 | Konto löschen | Grabstein statt Löschen: `auth.users` und `profiles` bleiben anonym, Personendaten der Anfragen NULL, Kontakt mit Platzhaltern; `price_revisions.inputs` bleibt. | technisch |
| 31 | | S9h-4 | Konto löschen | Offene Anfragen verhindern das Löschen (409 `open_requests`); admin und Partner-Mitglieder gesperrt (403 `role_not_allowed`), Firmenanonymisierung fehlt (S9h4-1). | Start (neu) |
| 32 | | S9h-4 | Fotos | `photo_purge` löscht Fotos gelöschter Konten und Originale nach `photo_retention_days` = 90; fehlt die Einstellung, scheitert der Job; Dateien entfernt `photo-cleanup`. | Start (GOLIVE 28) |
| 33 | | s9h-4-nach | Tests | `sweepTestResidue` (`tests/support/sweep.ts`) räumt Wettlauftests mit einem DO-Block auf; der Volllauf muss ohne Einzelwiederholung grün sein. | technisch |
| 34 | 2026-11-09 | s9h-4-nach | Belegfotos | Entscheidung Beks (0055): `photo_retention_days` 90; Belege der Partner bleiben `receipt_retention_days` = 365 Tage nach Endstatus, auch bei gelöschtem Kundenkonto. | Start (GOLIVE 28) |
| 35 | | s9h-4-nach | Storno-Grenze | `private.cancel_fee_base` war richtig; Testfehler an der Tagesgrenze behoben (`END_OF_DAY`); keine Migration nötig. | technisch |
| 36 | | s9h-4-nach | Tests | `not_found` in `change-orders-concurrency` war ein Testfehler; der Test liest IDs vor dem Rennen; die App sendet die Revisions-ID des gezeigten Nachtrags. | technisch |
| 37 | | s9h-4-nach | Abnahme | Abnahme hoch 0; M1, M2 behoben; N6: vor einer Änderung der Stornoschlüssel `cancel_late_percent` ≤ `cancel_full_percent` sicherstellen. | technisch |
| 38 | | s9i-1 | Umfang | s9i-1 ist nur der Schalter hinter dem Buchungsbutton; die übrigen Teile von S9i folgen ab s9i-2. | technisch |
| 39 | | s9i-1 | Buchungsschalter | Einstellung `booking_open` statt Build-Variable; fehlt die Zeile, ist zu; Produktion bekommt nie eine Zeile per Seed; Öffnen immer mit heutigem Datum. | Start (GOLIVE 29) |
| 40 | | s9i-1 | Bildsicht | Keine Shots und kein Reviewer in s9i-1; Position und Sperre per `boundingBox()` bei 390, 430, 1280 px gemessen. | technisch |
| 41 | | s9i-1 | Läufe | Volllauf 1 rot (`rls.test.ts` kannte `booking_open` nicht, Zeitlimit in `uploads.test.ts`); Lauf 2 mit 287 Tests Exit 0. | technisch |
| 42 | | s9i-2 | Schnitt | Scheiben s9i-2 bis s9i-7 festgelegt. | technisch |
| 43 | | s9i-2 | Storno-Oberfläche | Storno-Knopf nur bei `accepted`; Betrag allein aus `cancel-customer`, steht im Bestätigungsknopf; nach `cancel_fee_changed` neuer Klick; Sheet während der Buchung gesperrt. | technisch |
| 44 | | s9i-2 | Storno-Texte | Stufe in Worten und Partnerhinweis im Sheet entfallen in s9i-2 (S9i2-1). | technisch, ersetzt durch Nr. 46 |
| 45 | | s9i-2 | Tests | Flaky Test `anfrage.spec.ts:45` liest `.last()`. | technisch |
| 46 | | s9i-3 | Umfang | Keine Migration; die Scheibe umfasst Angebote, Nachtrag, Frage nach dem Termin und die Stufen im Storno-Sheet. | technisch |
| 47 | | s9i-3 | Geld in der App | Die App rechnet nichts: gesendet wird der gezeigte Betrag (`shownAmountCents`, `shownTotalCents`), bei Abweichung 409 und neu laden. | technisch |
| 48 | | s9i-3 | Terminfrage | Frage nach dem Termin nur als Anzeige nach Geräteuhr (`terminStarted`), die Datenbank entscheidet; Folgeanfragen (`cancel_fee_waived`) ohne Stufentext. | technisch |
| 49 | | s9i-3 | Nachtrag-Anzeige | Mehraufwand aus der Snapshot-Zeile `change_order` statt Subtraktion; passt der Snapshot nicht, nur der neue Gesamtpreis. | technisch |
| 50 | | s9i-3 | Meldung nach Abschluss | Abnahme M2 (Meldung bei `completed`) braucht ein Serversignal (S9i3-1), nicht in der App umgangen; Pflicht vor dem Öffnen von `booking_open` (s9k-1, siehe Nr. 55). | Start (neu) |
| 51 | | s9i-3 | Läufe | e2e-Vorlauf auf `main`: 323 grün, 1 rot (`dienste.spec.ts:13`, einzeln grün); Testreste ohne Zunahme (S9i3-6, S9i3-7). | technisch |
| 52 | | s9i-3 | Tests | Drei Locator angepasst und der Kontrollrunde vorgelegt; Urteil: nicht schwächer. | technisch |
| 53 | | s9i-4 | Modell | Session lief als Opus 5.5 statt Sonnet 5.5 und arbeitete wegen „keine Rückfragen“ weiter; eingebautes `advisor`-Tool nicht benutzt. | technisch |
| 54 | | s9i-4 | Läufe | e2e-Vorlauf grün (380); Testzahl 821 → 820 gewollt (Fall „Folgeanfrage kostenlos“ jetzt im E2E, Flag aus `cancel_fee_waived`). | technisch |
| 55 | 2026-11-11 | s9i-4 | Berichtigung | S9i3-1 gehört zur Scheibe s9k-1 nach s9i-7 („Pflicht vor Öffnen von `booking_open`“), nicht zu s9i-5; frühere Angaben entfallen. | technisch |
| 56 | | s9i-4 | Konto löschen | `delete-account` ohne erneute Anmeldung (S9h4-2 offen, Häkchen genügt vorerst); nur lokal abmelden, `signOut()` leert Fotos; neutraler 401-Text; 403 mit Verweis aufs Impressum. | Beks (Frage 9) |
| 57 | | s9i-4 | Abnahme | Abnahme hoch 0; M1, M3 behoben; `withdraw` fehlt in der App (S9i4-1) und 401 bei gestörtem Auth-Dienst (S9i4-3) stehen in s9k-1, Pflicht vor dem Öffnen des Schalters. | Start (neu) |
| 58 | | s9i-4 | Läufe | e2e-Volllauf 2 rot nur `wege.spec.ts:229` (S9i3-7), Volllauf 3 grün; danach keine Änderung an Code oder Tests. | technisch |
| 59 | | e2e-stabil | Modell | Session lief als Opus 5.5; eingebautes `advisor`-Tool nicht benutzt. | technisch |
| 60 | | e2e-stabil | E2E-Aufbau | Ursache `ERR_NO_BUFFER_SPACE`; e2e läuft gegen einen Build statt gegen den Dev-Server; Systemeinstellungen unberührt. | technisch |
| 61 | | e2e-stabil | E2E-Aufbau | Build mit `NODE_ENV=development` für e2e; das Produktions-Bundle prüft weiter `npm run build` mit `scan-dist`. | technisch |
| 62 | | e2e-stabil | E2E-Aufbau | Eigener Port 4180 und `reuseExistingServer: false`; ein belegter Port bricht den Lauf ab. | technisch |
| 63 | | e2e-stabil | Läufe | Volllauf 2 durch Session-Ende abgebrochen; als „dreimal hintereinander“ gelten 1, 2b, 3. | technisch |
| 64 | | e2e-stabil | Abnahme | S9i3-7 nicht geschlossen, sondern „gemindert, unter Beobachtung“ (Berater, gegen den Auftrag); Shots nicht pixelweise verglichen. | technisch |
| 65 | | s9i-5a | Firma lesen | Firma wird über `partner_members` gelesen, nicht über `partners` allein (`partners_select` liefert admin mit aal2 alle Firmen). | technisch |
| 66 | | s9i-5a | Registrierung | Abgelehnte Firma endgültig je Konto (`already_member`); gleiche UID mit zweiter E-Mail fängt nur die admin-Freigabe ab (S9i5-1); Konto mit Firma in der App nicht löschbar. | Beks (Frage 11) |
| 67 | | s9i-5a | Registrierung | Sperre der Partner-Registrierung ist `scripts/golive-check.mjs` (scheitert bei „entwurf“ in `TERMS_VERSION`), nicht das Verstecken; Zeile „Als Partner arbeiten“ sichtbar. | Start (GOLIVE 30) |
| 68 | | s9i-5a | Bildsicht, Texte | Kein Shots-Lauf in 5a (Maße per `boundingBox()`); eigene Texte für offline, `42501`/401 und `not_customer`. | technisch |
| 69 | | s9i-5b | Geräteverlust | Kein App-Weg: Beks setzt den Faktor im Dashboard zurück, nach Rückruf an `contact_phone`, mit Protokoll von Hand und nach Beenden der Sitzungen. | Start (GOLIVE 25) |
| 70 | | s9i-5b | MFA-Schranke | `MfaGate`: `pending`, `active`, `payment_hold` bis `aal2`, dann Dokumente; `rejected`, `suspended` ohne Abfrage; Einrichtung erst auf Knopfdruck; Schlüssel und QR nur im Komponentenzustand. | technisch |
| 71 | | s9i-5b | Dokumente | Zeile zuerst, dann Datei, ohne `upsert`; Bilder über `preparePhoto` (EXIF weg), PDF mit Kopfprüfung; ein gescheiterter Upload lässt die Zeile stehen („Erneut hochladen“). | technisch |
| 72 | | s9i-5b | 320 px | Bezirksraster unter 360 px fünfspaltig, `SelectField` rutscht unter das Label; Bildsicht `tests/shots/partner.spec.ts`. | technisch |
| 73 | | s9i-5b | Tests | `partner-documents.test.ts` belegt S2-M2 mit echten aal2-Token; `freshCode` erzeugt TOTP erst bei 6 s Restzeit; je Lauf bleibt eine Audit-Zeile. | technisch |
| 74 | | s9i-5b | Läufe | e2e 528; test:rls mit Transportfehler, nur die Datei einzeln wiederholt (danach gemergt). | technisch, ersetzt durch Nr. 75 |
| 75 | 2026-11-12 | s9i-6 | Volllauf-Regel | Auftrag Beks: Der Merge von s9i-5b mit `test:rls` EXIT=1 widersprach der Regel; ab jetzt ganzer Volllauf wiederholen (Nr. 8), Merge nur mit EXIT=0 in allen dreien. | technisch |
| 76 | | s9i-6 | Schnitt, `my_jobs` | s9i-6a ohne Migration, s9i-6b mit 0057 `my_jobs()` (`security definer`, aal2, nur Zugriffsfenster, Beträge aus dem Journal, kein Name, keine Adresse, kein Kontakt). | technisch |
| 77 | | s9i-6a | „Du erhältst“ | App zeigt „Du erhältst“ aus `splitFee` mit Satz aus `current_fee_rates` und sendet `shownPayoutCents` (409 `payout_changed`); beim Angebot „voraussichtlich“. | technisch, ersetzt durch Nr. 127 |
| 78 | | s9i-6a | Abnahme | H1 behoben: keine Beträge unter „Angenommen“ aus dem Listing; M1 bis M4 behoben; `partner-jobs.test.ts` als Charakterisierung ohne Rot-Lauf. | technisch |
| 79 | | s9i-6a | Bildsicht | Runde 1 mittel 4 behoben; Kontrollrunde hoch 0, mittel 0. | technisch |
| 80 | | s9i-6a | Test-Hilfen | Standard-Mocks für `job_listings`, `partner_offers`, `current_fee_rates` (15 %/20 %); Eingaben per `structuredClone`. | technisch, teils ersetzt durch Nr. 127 |
| 81 | | s9i-6b | `my_jobs()` | 0057 zusätzlich mit `can_start` (Datenbankuhr); `payment_hold` sieht angenommene Aufträge und darf starten, abschließen, Kontakt abrufen; nie ein erfundener 0-Betrag. | technisch |
| 82 | | s9i-6b | Oberfläche | `PartnerAuftraege` zeigt „Angenommen“; `job_contact` nur auf Antippen (je Abruf eine Audit-Zeile), nie vorab im DOM; `mailto:` nur bei erlaubten Zeichen. | technisch |
| 83 | | s9i-6b | Abnahme | hoch 0; M1 `mailHref` behoben, M2 teils (Rest S9i6b-5), M3 Lockerungsprobe rot mit Ist-Wert 1. | technisch |
| 84 | | s9i-6b | Rot-Beweis | Rot-Läufe vor 0057 belegen nur die fehlende Funktion; die Wirkung der Sperren belegt die Lockerungsprobe (Nr. 83). | technisch |
| 85 | | s9i-6b | Modell | Sonnet 5.5, Effort unbelegt; eingebautes `advisor`-Tool nicht benutzt; `db:types` neu erzeugt. | technisch |
| 86 | | s9i-6b | Läufe | test:rls 1040 s gegen 864 s, keine Datei über 150 s; kein `ERR_NO_BUFFER_SPACE`. | technisch |
| 87 | | s9i-7a | Modell | Sonnet 5.5, `reasoning_effort` 10; `advisor-report` rief das eingebaute `advisor`-Tool einmal auf (Regelverstoß des Subagents, gemeldet). | technisch |
| 88 | | s9i-7a | Schnitt | s9i-7 in drei Sessions: 7a Nachtrag (0058), 7b Storno durch die Firma (0059 mit M1 bis M4), 7c Journal-CSV und Durchgangstest. | technisch |
| 89 | | s9i-7a | Nachtrag | Abweichung vom Auftrag: Die Firma sendet keinen Betrag; `change-propose` rechnet aus geänderten Preisfeldern mit der gebuchten Preisversion; Vorschau und `shownTotalCents` Pflicht. | Beks (Frage 5) |
| 90 | | s9i-7a | 0058 | `my_job_changes()` liefert Preis-Eingaben, Gesamtpreis, letzten eigenen Nachtrag, `receipt_ids`; `propose_change_basis` zieht drei Prüfungen vor. | technisch |
| 91 | | s9i-7a | Belege | Belegfotos erst nach der Vorschau hochladen, vorhandene wiederverwenden; Server-Idempotenz (`sha256`) sollte mit 0059 folgen. | technisch, teils ersetzt durch Nr. 98 |
| 92 | | s9i-7a | Sheet | Prop `fit` am `Sheet`; Betragszeilen mit Label in eigener Spalte; Bildsicht in kleinen Reviewer-Paketen (zwölf Bilder). | technisch |
| 93 | | s9i-7a | Läufe | Rot-Lauf der E2E-Spec per `git checkout <commit> -- <Dateien>`; der Rot-Lauf der Unit-Datei für `partner-change.ts` fehlt. | technisch |
| 94 | | s9i-7b | Modell, Schnitt | Sonnet 5.5; Schnitt nach Berater: 7b1 Server (0059, `cancel-partner`), 7b2 Oberfläche (Abweichung vom Auftrag). | technisch |
| 95 | | s9i-7b | Storno Firma | Tor wie T13 (`accepted`/`in_progress`, ab `termin_at` nur `scope_impossible`); `job_contact` bleibt 30 Tage nach Storno offen; Fragen an Beks in S9i7-10. | Beks (Frage 1), teils ersetzt durch Nr. 104 |
| 96 | | s9i-7b | Pauschale | 0059: Pauschale nur, wenn der letzte nicht zurückgezogene Nachtrag `declined` oder `expired` ist und keiner offen; Berechtigung aus `cancel_by_partner_basis`. | technisch |
| 97 | | s9i-7b | Kundensicht Pauschale | `my_cancel_info`: erster Kundenzugriff auf einen Journalwert, nur `total_cents` der Zeile `cancellation_fee` samt Gegenbuchungen; Vorschau der Firma ohne Gebührenzeile. | Beks (Frage 3) |
| 98 | | s9i-7b | Belege | Belege (S9i7-1, S9i7-2) nicht in 0059, sondern eigene Migration mit Plan-Freigabe (S9i7-12); keine neue Mailart. | technisch |
| 99 | | s9i-7b | Läufe | Erste Läufe rot (TypeScript, verwaiste Testfirmen, Transportfehler), Wiederholung EXIT=0; Lockerungsprobe der Live-Tests nicht möglich (S9i7-13). | technisch |
| 100 | | s9t-1 | Testreste | `sweep.ts` findet Testfirmen über die Marker-Adresse `pt-firma-<8 Hex>@movenow.test`, Wächter und `BOUND`; auf Dev nichts gelöscht (254 Altfirmen gebunden). | technisch |
| 101 | | s9t-1 | Regeln | Geändertes SQL oder Lösch-Skript erneut an Fable vor `db:push`; Aufräumen nur markierter Daten mit Log; Logs nie überschreiben; Lockerungsprobe nie committen. | technisch |
| 102 | | s9t-1 | Messung | rls-Dauer in drei Messarten, Leitwert Wanduhr; Auswertung mit `node tmp/dauer.mjs`. | technisch |
| 103 | | s9t-1 | Doku | `S9_KONZEPT.md:239` an S9h2-2 angepasst (Weitervermittlung entfällt nur bei `scope_impossible` mit Pauschale); Abweichungen vom Auftrag bei Teil C und Läufen. | technisch |
| 104 | | s9i-7b2 | Kontaktsperre | 0060: `job_contact` nach Storno durch die Firma nur bei fälliger Pauschale (30 Tage), sonst sofort gesperrt (`private.partner_cancel_fee_due`); ändert Beks-Entscheidung vom 01.11.2026. | Beks (Frage 6) |
| 105 | | s9i-7b2 | Berater-Tools | Eingebautes `advisor`-Tool erscheint trotz `tools:`-Liste; jeder Auftrag an `advisor` und `advisor-report` verbietet es. | technisch |
| 106 | | s9i-7b2 | Absage-Maske Firma | Grund, Vorschau vom Server, Bestätigung mit gezeigtem Betrag; kein automatisches Senden; Zeile „Gebühr“ in der Maske weicht von CLAUDE.md (Anzeigeorte) ab (S9i7b2-5). | Beks (Frage 2) |
| 107 | | s9i-7b2 | Absage-Karte Kunde | Betrag nur aus `my_cancel_info`, Folgeanfrage über `reissued_from`; Pauschalen-Texte vorläufig bis zur Rechtsprüfung; Widerspruchsweg fehlt (S9i7b2-4). | Start (GOLIVE 33) |
| 108 | | s9i-7b2 | Messregel | Überdeckung und Umbruch per `boundingBox()` gegen die Fußleiste, nicht `toBeInViewport`; Lockerungslog statt „zuerst rot“. | technisch |
| 109 | | s9i-7c1 | Modell, Schnitt | Sonnet 5.5; 7c1 = Berater-Sperre, Nachhol-Bildsicht, Faktenprüfung Gebühr, Journal-CSV; 7c2 = Durchgangstest. | technisch |
| 110 | | s9i-7c1 | Berater-Tool | Keine deny-Regel für das `advisor`-Tool möglich; Abschaltweg `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` unerprobt, Sache von Beks. | technisch |
| 111 | | s9i-7c1 | Journal-CSV | Keine Migration, keine Edge Function: Die App liest `my_commissions(p_month)` und baut die Datei mit `journalCsv`; Zeitraum = Abrechnungsmonat; keine Kundendaten. | technisch, teils ersetzt durch Nr. 127 |
| 112 | | s9i-7c1 | CSV-Regeln | Beträge nur aus sicheren Ganzzahlen (`euro`), sonst `bad_row`; Betragsspalten nie durch `text()`; fehlerhafte Daten ergeben `unavailable`, nie eine halbe Datei. | technisch, teils ersetzt durch Nr. 127 |
| 113 | | s9i-7c1 | Karte „Abrechnung“ | `Abrechnung.tsx` hinter MFA für `active` und `payment_hold`; gesperrte Firmen sehen nichts (S9i7c1-3 offen); keine Gebühr auf der Karte; Download nur im Web (S9i7c1-2). | Beks (Frage 10) |
| 114 | | s9i-7c1 | Anzeigeorte Gebühr | Absage-Maske ist die einzige Partner-Ansicht mit Zeile „Gebühr“, das Journal-CSV zeigt die Provision; CLAUDE.md unverändert, Entscheidung bei Beks (S9i7b2-5, S9i7c1-5). | Beks (Frage 2) |
| 115 | | s9i-7c1 | Live-Test | `journal-live.test.ts` mit Ist-Werten an der unveränderten Sperre; hinterlässt je Lauf drei Aufträge und fünf Firmen auf Dev. | technisch |
| 116 | | s9i-7c2 | Durchgangstest | `flow-live.test.ts`: Anfrage per SQL-Fixture statt `quote`; Zuschlag, Start, Beleg, Nachtrag, Abschluss, Storno über die deployten Wege. | technisch |
| 117 | | s9i-7c2 | Testrechnung | Nachtragsbetrag aus der Vorschau von `change-propose`; Zeile `change` unabhängig in Postgres gerechnet (round(T · Satz)) und gegen `splitChange` geprüft. | technisch, teils ersetzt durch Nr. 125 |
| 118 | | s9i-7c2 | Fund | `partner_accept_basis` wirft 42804, `accept` liefert 500 (S9i7c2-1); Fix als Migration 0061 in der nächsten Session. | technisch |
| 119 | 2026-11-13 | s9i-7c2 | Migration 0061 | Auf Beks' Wort „Ja, Fix 0061“ entgegen dem Auftrag eine Migration: 0061 mit Cast, wortgleich zu 0038:359-384, Rot-Test zuerst. | technisch |
| 120 | | s9i-7c2 | Durchgangstest | `cancel-customer` und `offer-confirm` laufen live; Erwartungen an Ist-Werte angepasst (Firma auf `cancel-customer` 404; `job_contact` nach kostenlosem Kunden-Storno offen). | technisch |
| 121 | | s9i-7c2 | Verfahren | Fable prüfte das SQL von 0061 vor dem `db:push` nicht vollständig; nachträglich geprüft, hoch 0; Migration unverändert. | technisch |
| 122 | | s9i-7c2 | Kontaktsperre | Abnahme M4 (Kontakt nach kostenlosem Kunden-Storno sofort sperren) ist eine Entscheidung für Beks (S9i7-10 c): eigene Migration mit Plan-Freigabe. | Beks (Frage 7) |
| 123 | | s9i-7c2 | Läufe | `partner-mfa` 3,9x und `offers-concurrency` 2,2x länger, beide unter 60 s. | technisch |
| 124 | | s9p-1 | Staffel | Progressiv auf den Brutto-Gesamtpreis: bis 50.000 ct 1200 bp, bis 100.000 ct 1000 bp, darüber 700 bp, einmal gerundet; Version 2; Version 1 (15 %) nur Bestand. | Beks (Frage 4) |
| 125 | | s9p-1 | Nachtrag, Pauschale | Nachtrag = Provision(Gesamt nach) − Provision(Gesamt vor) in der Version des Auftrags (`splitChange`); Stornogebühr und Pauschale: Staffel auf die Basis allein (6900 → 828). | Beks (Frage 4) |
| 126 | | s9p-1 | Version | Version beim Senden des Festangebots bzw. bei der Annahme gespeichert (`offer_immutable`); Version 2 ohne Ankündigungsfrist ab Einspieltag; künftig `fee_notice_days` (S9p1-2). | Beks (Frage 4) |
| 127 | | s9p-1 | Schema | `fee_rate`/`fee_rate_version` im Journal entfallen (`fee_schedule_version`); `current_fee_rates` entfällt; RPC `payout_preview(bigint)` (Mitglied, aal2) ersetzt die Rechnung in der App. | technisch |
| 128 | | s9p-1 | Läufe | Zwei rls-Fehler waren veraltete Testerwartungen; kein 0063, kein Edge-Fix; `rls.test.ts` an die neuen Signaturen angepasst. | technisch |
| 129 | | s9p-1 | Deploy | Erster Deploy von verändertem WIP-Stand ohne Smoke-Test; sieben Functions von sauberen Commits neu deployt (Smoke 401). | technisch |
| 130 | | s9p-1 | Abnahme, Text | Abnahme hoch 0; M1 bis M5 geschlossen; N1: Text „Dein Anteil steht mit dem Senden fest.“ zur Durchsicht; N5 (Mocks 15 %) und N7 offen. | Beks (Frage 12) |
| 131 | | s9p-1 | CLAUDE.md | CLAUDE.md „Geld“ und Kopf auf die Staffel umgestellt (laut Auftrag; Fable sah es als Sache von Beks): zur Durchsicht. | Beks (Frage 4) |
| 132 | | s9p-1 | Berater-Tool | Eingebautes `advisor`-Tool nicht aufgerufen; `CLAUDE_CODE_DISABLE_ADVISOR_TOOL` nicht gesetzt. | technisch |
| 133 | 2026-11-14 | u1 | Arbeitssystem | Beschluss Beks: Alle Sessions arbeiten nach `docs/SYSTEM_VORSCHLAG.md`; u1 (Gates, Hooks) gebaut; Reihenfolge u2, u1b, u3, Probe. | technisch |
| 134 | 2026-11-14 | u1 | Doku-Abgleich | Die offizielle Doku gilt gegen den Vorschlag: `ask`-Regeln auf `.claude/`, Hook `trim-output.js` verfälscht EXIT nicht, CLI-JSON nur mit `--output-format json`. | technisch |
| 135 | | u1 | Übergang | Testsperre des Guards sofort aktiv (`npm run t`); bisherige Regeln bleiben bis u2; Abschnitt in `CLAUDE.md` laut Auftrag trotz Fable-Auflage 10; `CLAUDE.md` ist R3. | technisch |
| 136 | | u1 | Offen | Nicht gebaut (u1-1 bis u1-8): Gate für Lösch-Skripte, `fn:deploy`, Abnahme-Antrag, Migrationsliste, Herabstufen, Effort im Hook. | technisch |
| 137 | | u1 | Abnahme | Runde 1 hoch 2 (behoben), Runde 2 hoch 0; M16 bis M18 mit Fristen in den Sammelschritt u1b. | technisch |
| 138 | | u1 | Läufe | e2e Lauf 1 rot (`ERR_NO_BUFFER_SPACE`), Lauf 2 grün; kein Codebezug. | technisch |
| 139 | | u1 | Versehen | Einmal `npm run db:link` vorab (gleiche Dev-Ref); `advisor-report` las `.claude/settings.local.json`; die Vorlage verbietet es jetzt. | technisch |
| 140 | | u1b | Modell, Einrichtung | Sonnet 5.5; Einrichtung durch Beks: Schritte 1 und 2 nicht wirksam, 3 gesetzt, 4 und 5 wirksam. | technisch |
| 141 | | u1b | DB-Gate | `gate-db push` startet `supabase db push` selbst und schreibt je angewendeter Migration die Marke `{pfad, sha256}`; altes Format zählt nicht; Rest AM5 offen (u1b-6). | technisch |
| 142 | | u1b | Guard | Guard sperrt `psql`, freie `db query`, Shell-Innentexte, Skriptdateien, Befehlsersetzungen, MCP-Datenbankwerkzeuge; bleibt keine Sicherheitsgrenze. | technisch |
| 143 | | u1b | Lösch-Gate | Register `scripts/sys/loesch-register.json`, Aufruf nur über `npm run loesch`, Freigaben versioniert in `docs/freigaben/`; `sweep.ts` prüft sich selbst, Obergrenze 1000. | technisch |
| 144 | | u1b | Abnahme | Planprüfung hoch 5 (umgesetzt bis auf u1b-2, u1b-3); Abnahme Runde 4 hoch 0; AM10 offen mit Frist vor u3. | technisch |
| 145 | | u1b | Abweichungen | Nachweise über `npm run bericht` statt `cp`; Registerskripte ohne `LOESCH-ZAHL`; Lösch-Gate ersetzt für Claude auch `admin:call`, `setup:photo-cleanup`, `setup:photo-publish`. | technisch |
| 146 | | u1b | Guard | Selbstsperre des Guards (`resolve is not defined`), per Hilfsskript behoben; neue Fassungen zuerst unter `tmp/a/guard.mjs`. | technisch |
| 147 | | u1b | Läufe | e2e 1091,5 s (734 Tests); rls 1657,4 s (360 Tests) gegen 959,7 s; Ursache vermutlich Umgebung, nicht wiederholt. | technisch |
