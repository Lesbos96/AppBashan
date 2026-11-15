# MoveNow · Fragen an Beks

Stand 2026-11-14. Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

Die 15 Fragen vom 2026-11-14 sind beantwortet (ENTSCHEIDUNGEN Nr. 148 bis 162); ihre Folgearbeiten stehen in `docs/OFFEN.md`.

### 1. Soll die Sieben-Tage-Grenze für übernommene Läufe auch für `check` und `e2e` gelten?
- Worum es geht: Seit u2b übernimmt das Gate bei R3 einen grünen `rls`-Lauf aus einem früheren Schritt nur, wenn er höchstens 7 Tage alt ist, weil `rls` gegen die lebende Dev-Datenbank läuft. `check` und `e2e` laufen ohne Datenbank und hängen nur an den Dateien; für sie gilt keine Altersgrenze.
- Empfehlung: Nein, weil ein unveränderter Stand bei `check` und `e2e` dasselbe Ergebnis liefert und ein Volllauf von `e2e` rund 18 Minuten kostet.
- Bei „Ja“: Das Gate bekommt dieselbe Grenze für beide Suiten; jeder Schritt nach einer Woche Pause fährt dann alle drei Suiten voll.
- Aufwand: bei Nein keiner, bei Ja klein (R3)
- Quelle: Planprüfung u2b; OFFEN u2b-2

### 2. Behält der direkte `git push` seine `ask`-Regel auch nach dem Probe-Schritt?
- Worum es geht: Die flüchtigen Umgehungen des Pre-Push-Hooks (`git -c core.hooksPath=x push`, `--no-verify`, `GIT_CONFIG_*`) fängt der Guard in der üblichen Schreibweise (u3b), aber er ist keine Sicherheitsgrenze: Aliase, Variablen als Schlüssel und Umgebung aus einem früheren Aufruf bleiben offen. Die dauerhafte Umgehung fängt `hooksAktiv` in `fertig`. Die `ask`-Regel für `git push` ist die einzige Sperre gegen einen Push, der das Gate umgeht.
- Empfehlung: Ja, die Regel für `git push` bleibt; `commit`, `merge`, `rm` und dotenv können nach dem Probe-Schritt entfallen. `npm run fertig` pusht ohnehin selbst.
- Bei „Nein“: ein Push auf `main` ist nur noch durch Guard und Pre-Push-Hook geschützt; ein bewusst gebauter Umweg (Alias) wäre nicht gesperrt.
- Aufwand: keiner (Einstellung in `.claude/settings.json`, R3)
- Quelle: Abnahme u3b, Rat von Fable; OFFEN u3b-1

### 3. Wer beendet eine Kundenmeldung „nicht stattgefunden“, und bis wann?
- Worum es geht: Meldet der Kunde „nicht stattgefunden“ (ab `termin_at`, auch nach dem Abschluss der Firma bis 7 Tage nach dem Termin), ist der Auftrag in Prüfung (s9k-1). Die Firma kann dann nicht starten, abschließen, absagen oder einen Nachtrag stellen; der Kunde kann nicht stornieren und keinen Nachtrag annehmen; das Löschen seines Kontos wartet (`under_review`). Das Ende kommt nur von admin (`admin_correct`, Liste `reported_jobs`, nur per Skript `npm run admin:call`). Es gibt keine Oberfläche und keine Benachrichtigung bei einer Meldung.
- Empfehlung: Vor dem Öffnen von `booking_open` legst du fest, wer `reported_jobs` wie oft ansieht (zum Beispiel du, täglich, Entscheidung innerhalb von zwei Werktagen) und trägst es in GOLIVE ein. Die Admin-Oberfläche bleibt unter „Später“.
- Bei „anderer Weg“ (zum Beispiel Frist, nach der die Meldung von selbst gilt oder verfällt): eigene Entscheidung, sie ändert T14 und T15 in `docs/S9_KONZEPT.md` und wäre ein eigener R3-Schritt.
- Aufwand: bei der Empfehlung keiner (Betrieb), sonst mittel (R3)
- Quelle: Planprüfung und Abnahme s9k-1; OFFEN s9k1-1, s9k1-2

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
