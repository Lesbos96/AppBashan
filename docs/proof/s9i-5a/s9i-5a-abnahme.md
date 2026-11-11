Modell: claude-fable-5-2

# Abnahme s9i-5a (Partner-Portal 1a: Registrierung und Status)

- Datum: 2026-11-11
- Stand: Branch `s9i-5`, Commit 54400e1
- Geprüft (vollständig gelesen): `src/lib/partner.ts`, `src/screens/Partner.tsx`, `src/screens/partner/Registrierung.tsx`, `src/app/router.tsx`, `src/screens/Profil.tsx`, `src/components/Surfaces.tsx`, `tests/unit/partner-register.test.ts`, `tests/e2e/partner.spec.ts`, `tests/rls/partners.test.ts`, `tests/support/partner.ts`, `supabase/migrations/…0023_partners.sql`, `…0054_s9h4_abnahme.sql`, `…0027_partner_fee_read.sql`
- In Auszügen: 0015 (`is_admin`), 0024 (Dokumente), 0034/0035/0038/0040 (Akteur-Funktionen), `supabase/functions/_shared/jobs/handlers.ts`, `src/lib/account.ts`, `src/lib/session.tsx`, `src/lib/prices.ts` (`useLoad`), `src/components/States.tsx`, `docs/AUTOPILOT.md:159-173`, `docs/GOLIVE.md:57-64`, `docs/OPEN_ISSUES.md` (Suche), Logs `tmp/proof/s9i-5a-*.log` (nur Exit-Zeilen)
- Nicht geprüft: Screenshots, Kontraste (Sache des `reviewer`). Ich habe keine Tests ausgeführt, nur Logs gelesen.
- Vermerk: Das eingebaute `advisor`-Tool wurde in diesem Lauf einmal aufgerufen (CLAUDE.md untersagt es der Hauptsession). Die Bewertung unten stammt aus eigenen Nachschlägen.

Ergebnis: kein Finding hoch. Drei mittel, sechs niedrig. Der Servercode ist unverändert und trägt die Regel „ein Konto, eine Firma, für immer“.

## Findings hoch

Keine.

## Findings mittel

**M1 · `src/screens/partner/Registrierung.tsx:152` – Der Hinweis vor dem Absenden verschweigt die Löschsperre.**
Wer eine Firma anlegt, kann sein Konto nicht mehr in der App löschen: `delete_account` weist jedes Mitglied ab (`0054_s9h4_abnahme.sql:52`, Text in `src/lib/account.ts:14`). Das gilt auch für `pending` und `rejected`, und es gibt keinen Rückweg (kein DML auf `partner_members`, `0023_partners.sql:238-241`). Der Hinweis nennt nur „nicht zurückziehen“ und „endgültig“. Seit 5a erreicht jedes Kundenkonto diesen Zustand über eine Zeile im Profil.
Fix: Satz ergänzen, z. B. „Mit einer Firma kannst du dein Konto nicht mehr in der App löschen.“ Dazu eine Zeile im E2E-Test `partner.spec.ts:109-124`. In `docs/OPEN_ISSUES.md:483` (S9h4-1, Firmenanonymisierung) das Ziel auf „vor dem Öffnen der Partner-Registrierung (GOLIVE 30)“ setzen.

**M2 · `src/screens/Profil.tsx:68`, `docs/GOLIVE.md:64`, `scripts/golive-check.mjs` – Die Sperre „erst nach Rechtsklärung öffnen“ steht nur im Text.**
GOLIVE 30 verlangt, die Profil-Zeile bis dahin nicht auszuliefern. Der Code liefert sie ohne Bedingung. Die Zeile zu verstecken würde ohnehin nicht reichen: Route `/partner` (`router.tsx:65`) und die RPC (`0023:367`) bleiben offen. `golive-check.mjs` prüft den Entwurfs-Platzhalter nicht (Suche nach „entwurf“, „terms“, „partner“: kein Treffer). Folge bei versehentlichem Ausliefern: Firmen mit Zustimmung zu Bedingungen, die niemand lesen kann (`Registrierung.tsx:145` ohne Link), und `terms_version` lässt sich danach nicht mehr ändern (`0023:174-177`).
Fix: `golive-check.mjs` scheitert, solange `TERMS_VERSION` in `src/lib/partner.ts:9` auf „entwurf“ endet, und prüft in Produktion `count(*) = 0` für Firmen mit dieser Version. GOLIVE 30 umformulieren: Die Sperre ist der Check, nicht das Verstecken der Zeile. Mit den echten Bedingungen kommt ein Link neben die Checkbox.

**M3 · `docs/GOLIVE.md:64`, `docs/AUTOPILOT.md:171` – Der zugesagte Eintrag in OPEN_ISSUES fehlt.**
Beide Stellen verweisen für „Neuregistrierung nach Ablehnung“ und „doppelte UID“ auf OPEN_ISSUES. Dort gibt es keinen Eintrag (Suche nach Neuregistrierung, doppelte UID, already_member, S9i5: kein Treffer). Inhaltlich ist „endgültig“ nur je Konto erzwungen (`0023:46`). `uid` hat kein Unique (`0023:19`); eine abgelehnte Person registriert sich mit einer zweiten E-Mail-Adresse und derselben UID erneut. Das fängt heute nur die Freigabe durch admin ab, und admin erfährt es nirgends.
Fix: Eintrag anlegen (z. B. S9i5-1, mittel, Ziel Admin-Oberfläche oder S10) mit der Regel: Vor der Freigabe zeigt die Admin-Sicht Firmen mit gleicher UID samt Status; ob der Server gleiche UIDs sperrt (Prüfung in `admin_approve_partner` oder Teilindex), entscheidet Beks.

## Findings niedrig

**N1 · `src/lib/partner.ts:115` – Abgelaufenes Token hängt an einem einzigen PGRST-Code.**
Neuere PostgREST-Versionen melden abgelaufene Claims mit einem anderen Code (PGRST303) bei Status 401; das ergäbe „Das hat nicht geklappt“ statt „Melde dich neu an“. Die Version des Projekts habe ich nicht geprüft.
Fix: `status === 401` zusätzlich auf `not_authenticated` abbilden, eine Unit-Zeile dazu. Der Zweig „42501 ohne bekannte Meldung“ ist ungetestet (alle 42501-Zeilen in `partner-register.test.ts:129-130` tragen eine bekannte Meldung): Zeile mit „permission denied for function register_partner“ ergänzen.

**N2 · Befund b) des Auftrags, `docs/AUTOPILOT.md:161` – Berichtigung und Plan-Abweichung.**
`is_admin()` verlangt aal2 (`0015_versions_published.sql:12`), nicht „jedes aal“; ein admin mit aal1 sieht über `partners` nichts (`partners.test.ts:338`, `:351`). Das Lesen über `partner_members` bleibt richtig, weil ein Mitglied später admin werden kann (Testfall „self“, `partners.test.ts:167-169`).
Fix: Abweichung vom Plan (Plan: `from('partners')`) in `docs/PROGRESS.md` mit der richtigen Begründung festhalten.

**N3 · `tests/unit/partner-register.test.ts:45-58`, `tests/e2e/partner.spec.ts:18`, `:260` – Lücken in den Tests.**
- Obergrenzen sind nur für `name` geprüft (121 Zeichen); `street` 121, `city` 81, `contactName` 101, `phone` 41, `email` 255 fehlen.
- `noFee` im E2E sucht nicht nach dem bloßen Wort „Gebühr“ (der Unit-Test tut es).
- Der Kommentar zu StrictMode ist überholt; E2E läuft seit d893e71 gegen den Build.
- `p_uid: null` läuft nie über PostgREST gegen den echten Server (`partners.test.ts:68` ist eine SQL-Probe, der Live-Aufruf `:110` sendet eine UID).
Fix: Zeilen ergänzen; für den letzten Punkt den Live-Aufruf in `:110` auf Kleinunternehmer ohne UID umstellen.

**N4 · `src/screens/partner/Registrierung.tsx:70`, `src/screens/Partner.tsx:28`, `:37` – Fokus nach dem Erfolg geht verloren.**
Das Formular wird ausgehängt, der Fokus fällt auf `body`, die Statuskarte wird nicht angesagt.
Fix: Überschrift der Statuskarte mit `tabIndex={-1}` nach dem Wechsel fokussieren.

**N5 · `src/screens/partner/Registrierung.tsx:49`, `:120`, `:159` – Kleinere Punkte zur Barrierefreiheit.**
- Pflichtfelder tragen kein `aria-required` (das Formular ist `noValidate`).
- Der gesperrte Knopf sagt während des Sendens nichts an.
- Das Bezirksraster hat bei 320 px Breite 40 px breite Felder (gerechnet: (320 − 40 − 40) / 6); gemessen ist nur ab 390 px.
Fix: `aria-required` an `Field`; Text „Wird gesendet …“ im Knopf; falls 320 px unterstützt wird, fünf Spalten unter 360 px.

**N6 · `supabase/migrations/…0023_partners.sql:16`, `:21-25` – Beobachtung zum Server, nicht Teil von 5a.**
Die Checks kürzen nicht; ein direkter API-Aufruf legt eine Firma mit einem Namen aus zwei Leerzeichen an. Die Freigabe durch admin fängt das ab.
Fix: Bei der nächsten Partner-Migration `btrim` in die Checks oder in `register_partner`.

## Prüffragen

**(1) Sicherheit und Rollen**
- Mehr als eine Firma je Konto: nein. `unique (user_id)` (`0023:46`), der Block fängt den Verstoß und rollt die Firma zurück (`0023:275-284`), für jeden Status (`partners.test.ts:94-106`) und im Wettlauf (`:108-121`). Die UI sperrt zusätzlich per Ref und `disabled` (`Registrierung.tsx:59`, `:66`, `:159`). Befund a) stimmt, auch der Teil zu doppelten Bezirken (`0023:285`, `partners.test.ts:60`, `:81`).
- „Kein Rückzug, rejected endgültig, keine Neuregistrierung“: im Server erzwungen, je Konto. Kein DML für `authenticated` und `service_role` (`0023:238-241`), `rejected` hat keinen ausgehenden Übergang (`0023:112-114`, Trigger `:144`), `delete_account` weist Mitglieder ab (`0054:52`). Nicht erzwungen je Person oder UID (M3).
- pending, rejected, aal1: sieht nur die eigenen Firmenzeilen. `partner_of_user()` steht nur in sechs Lese-Policies (`0023:245`, `:252-258`, `0024:196`); bei Dokumenten ohne Pfadspalte (`0024:191`). Alles andere läuft über die aal2-Helfer oder über Akteur-Funktionen, die Status und aal prüfen (`0035:287-293`, `0040:312-318`, `0038:405-409`, `handlers.ts:57`). Befund c) stimmt.
- Präzisierung: Mit selbst eingerichtetem TOTP (aal2) liest auch ein pending- oder rejected-Konto `fee_rate` (`0027:11`). Das ist laut CLAUDE.md gewollt und bestand schon vor 5a über die RPC. Die Aussage „Kunden lesen die Gebühr nicht“ ist damit nur so stark wie die Hürde der Registrierung (GOLIVE 26).
- Befund b): berichtigt in N2.

**(2) Daten**
- `p_uid: null` passt: `uid` ist nullbar (`0023:19`), der Check verlangt UID oder Kleinunternehmer (`0023:37`); die Probe belegt es (`partners.test.ts:68`, `:85`). Der Cast ist nötig, weil der generierte Typ kein `null` kennt (`database.types.ts:1995`). Alle zwölf Schlüssel werden immer gesendet (`partner.ts:75-90`).
- Grenzen in `validate` (`partner.ts:59-69`) decken sich mit `0023:16-26` oder sind strenger (E-Mail). Rechtsformen `partner.ts:12-19` = `0023:17`. `TERMS_VERSION` passt zum Format `0023:32`. Randfall ohne Finding: JS zählt UTF-16-Einheiten, Postgres Zeichen; der Server bleibt die Instanz.

**(3) Geld und Texte**
- Keine Gebühr, kein Betrag, kein Prozentsatz in `partner.ts`, `Partner.tsx`, `Registrierung.tsx`, `Profil.tsx:68`. Deutsch, per Du, kurz. Kein Geldcode berührt.

**(4) Fehlerzuordnung**
- 42501 pauschal auf `not_authenticated` ist in Ordnung: Nach den zwei benannten Meldungen bleibt nur „permission denied for function“ ohne gültige Sitzung (`partners.test.ts:76`). `not_customer` hat einen eigenen Text. 23505 entsteht nur bei doppelten Bezirken, die die App vorher entfernt. Schwachstelle: N1.

**(5) Testqualität**
- Die E2E-Tests messen Wirkung: `toEqual([BODY])` mit genau zwölf Schlüsseln und Werten (`partner.spec.ts:160`), `p_uid: null` (`:171`), Doppelklick bei 800 ms Verzögerung ergibt einen Body (`:175-180`), Fehlerfälle prüfen zwei Bodies und erhaltene Eingaben (`:211-216`), Lesefehler zeigt kein Formular (`:264`). Maße per `boundingBox()` (`:286-294`). Lücken: N3.
- Der neue RLS-Test misst Fehlercode, Zahl der Mitgliedschaften und Zahl der Zweitfirmen (`partners.test.ts:101-105`); der Name wird wirklich überschrieben (`tests/support/partner.ts:17-18`).

**(6) Barrierefreiheit**
- Jedes Feld hat ein Label (`Surfaces.tsx:96-103`, `:121-126`), Fehler je Feld mit `aria-invalid` und `aria-describedby`, Fokus auf das erste fehlerhafte Feld (`Registrierung.tsx:53-55`, getestet `partner.spec.ts:133`). Bezirke als `fieldset` mit `legend`, Name „Bezirk n“, Fokusrahmen am Label (`Registrierung.tsx:124`). Ziele ab 390 px mindestens 44 px (gemessen im Test). Offen: N4, N5; Kontraste beim `reviewer`.

## Auflagen vor dem Commit (kein Finding)

- Volläufe `test:rls` und `test:e2e` stehen laut Commit-Nachricht aus. Vorhanden: `s9i-5a-check-1.log` (874 Tests, EXIT=0), `s9i-5a-gruen-2.log` (52 bestanden, EXIT=0; `gruen-1` war ein roter Zwischenstand, EXIT=1), Einzeltest RLS in `s9i-5a-rot.log:1041-1059` (EXIT=0).

## Stichproben

| Datei:Zeile | Ergebnis |
|---|---|
| `0023_partners.sql:46` | `unique (user_id)` vorhanden |
| `0023_partners.sql:275-284` | Block fängt `unique_violation`, wirft `already_member` |
| `0023_partners.sql:285` | Bezirke außerhalb des Blocks, 23505 bei Dublette |
| `0023_partners.sql:238-241` | nur `select` für authenticated und service_role |
| `0023_partners.sql:245`, `:252-258` | `partner_of_user()` nur in Lese-Policies |
| `0023_partners.sql:19`, `:37` | `uid` nullbar ohne Unique; Check UID oder Kleinunternehmer |
| `0023_partners.sql:112-114` | kein Übergang aus `rejected` |
| `0023_partners.sql:174-177` | `terms_version` unveränderlich |
| `0015_versions_published.sql:12` | `is_admin()` verlangt aal2 |
| `0024_partner_admin.sql:191`, `:196` | Dokumente: Spalten ohne Pfad, Lese-Policy über `partner_of_user()` |
| `0027_partner_fee_read.sql:11` | Satz lesbar für Mitglieder mit aal2, jeder Status |
| `0054_s9h4_abnahme.sql:39`, `:52` | Trigger gegen gelöschte Konten; Mitglieder nicht löschbar |
| `0035_job_photos.sql:287-293` | aal2 und Firmenstatus geprüft |
| `0040_change_orders.sql:312-318` | aal2 und Firmenstatus geprüft |
| `0038_partner_offers.sql:405-409` | Mitgliedschaft und `active` geprüft |
| `functions/_shared/jobs/handlers.ts:57` | 403 `mfa_required` ohne aal2 |
| `tests/rls/offers.test.ts:108-110` | aal1 `mfa_required`, pending `partner_not_active` |
| `tests/rls/listings.test.ts:242-243` | aal1 `mfa_required`, pending `partner_not_active` |
| `tests/rls/partners.test.ts:351` | admin aal1 sieht 0 Zeilen |
| `src/lib/partner.ts:132` | liest über `partner_members`, vier Spalten |
| `src/lib/partner.ts:79`, `:87` | UID leer wird `null`; Bezirke entdoppelt und sortiert |
| `src/screens/Partner.tsx:19`, `:27-28` | Schlüssel je Konto; Lesefehler zeigt nie das Formular |
| `src/app/router.tsx:65` | Route mit `requireSession`, ohne Tab-Bar |
| `src/lib/account.ts:14` | Text zur Löschsperre für Partner-Konten |
| `docs/GOLIVE.md:57`, `:64` | Punkte 26 und 30 vorhanden, 30 nur als Text |
| `docs/OPEN_ISSUES.md:483` | S9h4-1 vorhanden; Eintrag zu Neuregistrierung und UID fehlt |

Offene Findings hoch: 0
